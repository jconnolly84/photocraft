
/// Apply a local subject operation atomically to the exact captured document.
/// Background bytes are generated off-thread; original pixels are never rewritten.
pub fn apply_subject_tool(s: &mut Session, document: u64, revision: u64, layer: u64,
    bounds: [i32;4], mode: &str, alpha: Vec<u8>, background: Option<Vec<u8>>) -> Result<()> {
    let st = s.active().ok_or(EngineError::NoDocument)?;
    if st.doc.id.0 != document || st.revision != revision {
        return Err(EngineError::Other("The document changed while the AI tool was open. Try again.".into()));
    }
    let id = photocraft_doc::LayerId(layer);
    let source = st.doc.layer(id).ok_or(EngineError::NoLayer(id))?;
    check(&st.doc, source).map_err(EngineError::Other)?;
    let label = match mode {"select" => "Select Subject (AI)", "blur" => "Blur Background (AI)",
        "replace" => "Replace Background (AI)", _ => return Err(EngineError::Other("Unknown AI tool".into()))};
    if mode != "select" && source.clipped {
        return Err(EngineError::Other("Release this image's clipping mask before changing its background.".into()));
    }
    let [x,y,w,h] = bounds;
    if w <= 0 || h <= 0 || w as u64 * h as u64 > 16_777_216 || alpha.len() as u64 != w as u64 * h as u64 {
        return Err(EngineError::Other("Invalid subject mask".into()));
    }
    let area = Rect::new(x,y,x.saturating_add(w),y.saturating_add(h));
    if area.intersect(&st.doc.bounds()) != area || !alpha.iter().any(|v| *v > 0) {
        return Err(EngineError::Other("No subject found inside this canvas".into()));
    }
    let bg_area = if mode == "replace" {st.doc.bounds()} else {area};
    if mode != "select" && (bg_area.size().area() > 16_777_216 ||
        background.as_ref().is_none_or(|b| b.len() as u64 != bg_area.size().area()*4)) {
        return Err(EngineError::Other("Invalid AI background pixels".into()));
    }
    let selection = mode == "select";
    s.edit(label, move |doc, active| {
        let original = doc.layer(id).ok_or(EngineError::NoLayer(id))?.clone();
        let mut mask = crate::commands::mask_at_depth(LayerMask::hide_all(), doc.depth)?;
        let mut old_mask = Vec::new();
        let mut pixels = vec![[0u8;4]; w as usize];
        let mut row = vec![0.0; w as usize];
        for yy in 0..h {
            let r = Rect::new(x,y+yy,x+w,y+yy+1);
            if let Some(previous) = &original.mask {previous.values_into(r, &mut old_mask);}
            if selection {original.surface().ok_or_else(|| EngineError::Other("Image pixels are unavailable".into()))?.read_rgba8_into(r, &mut pixels);}
            for xx in 0..w as usize {
                // Fuzzy intersection avoids compounding the same soft AI edge
                // when a user changes the background of an existing cut-out.
                row[xx] = (f32::from(alpha[yy as usize*w as usize+xx])/255.0)
                    .min(old_mask.get(xx).copied().unwrap_or(1.0))
                    .min(if selection {f32::from(pixels[xx][3])/255.0} else {1.0});
            }
            mask.surface.write_region(r, &row);
        }
        if selection {
            doc.selection = Some(mask.surface);
            return Ok(());
        }
        if let Some(previous) = &original.mask {mask.feather = previous.feather;}
        let format = doc.pixel_format();
        let mut backdrop = Layer::raster(if background.as_ref().is_some() && label.starts_with("Blur") {
            "Background blur (AI)"} else {"Replacement background (AI)"}, format);
        backdrop.opacity = original.opacity;
        let surface = backdrop.surface_mut().unwrap();
        let channels = surface.channels();
        let bytes = background.as_ref().unwrap();
        let bw = bg_area.width() as usize;
        let mut row = vec![0.0; bw*channels];
        for yy in 0..bg_area.height() as usize {
            for (xx,px) in bytes[yy*bw*4..(yy+1)*bw*4].chunks_exact(4).enumerate() {
                photocraft_raster::from_rgba_into(&format,
                    [px[0] as f32/255.0,px[1] as f32/255.0,px[2] as f32/255.0,px[3] as f32/255.0],
                    &mut row[xx*channels..(xx+1)*channels]);
            }
            surface.write_region(Rect::new(bg_area.x0,bg_area.y0+yy as i32,bg_area.x1,bg_area.y0+yy as i32+1), &row);
        }
        let mut subject = original.duplicate();
        subject.name = format!("{} — Subject (AI)",original.name);
        subject.visible = true;
        subject.locks = Default::default();
        subject.mask = Some(mask);
        doc.layer_mut(id).unwrap().visible = false;
        let bg = doc.insert_above(Some(id),backdrop);
        let top = doc.insert_above(Some(bg),subject);
        *active = Some(top);
        doc.selection = None;
        Ok(())
    })
}

#[cfg(test)]
mod school_subject_tools_tests {
    use super::*;
    fn fixture() -> Session {
        let mut s=Session::new();
        s.execute("file.new",json!({"width":4,"height":3})).unwrap();
        s
    }
    fn args(s:&Session)->(u64,u64,u64) {let st=s.active().unwrap();(st.doc.id.0,st.revision,st.active_layer.unwrap().0)}
    #[test] fn subject_selection_changes_no_layers_and_undo_restores_it() {
        let mut s=fixture();let before=s.active().unwrap().doc.layers.clone();let(d,r,l)=args(&s);
        apply_subject_tool(&mut s,d,r,l,[1,1,2,1],"select",vec![255,0],None).unwrap();
        let st=s.active().unwrap();let sel=st.doc.selection.as_ref().unwrap();
        assert_eq!(sel.sample_channel(1,1,0),1.0);assert_eq!(sel.sample_channel(2,1,0),0.0);
        assert_eq!(sel.sample_channel(0,0,0),0.0);assert_eq!(st.doc.layers,before);
        s.execute("edit.undo",json!({})).unwrap();assert!(s.active().unwrap().doc.selection.is_none());
    }
    #[test] fn backgrounds_keep_original_and_commit_as_one_undo_step() {
        for mode in ["blur","replace"] {
            let mut s=fixture();let before=s.active().unwrap().doc.layers.clone();let(d,r,l)=args(&s);
            let count=if mode=="replace" {12}else{2};
            apply_subject_tool(&mut s,d,r,l,[1,1,2,1],mode,vec![255,0],Some([20,40,200,255].repeat(count))).unwrap();
            let st=s.active().unwrap();assert_eq!(st.doc.layers.len(),3);
            let mut original=st.doc.layers[0].clone();assert!(!original.visible);original.visible=true;
            assert_eq!(original,before[0]);
            assert_eq!(st.doc.layers[2].mask.as_ref().unwrap().value(1,1),1.0);
            assert_eq!(st.doc.layers[2].mask.as_ref().unwrap().value(2,1),0.0);
            let at=if mode=="replace" {(0,0)}else{(1,1)};
            let px=st.doc.layers[1].surface().unwrap().rgba(at.0,at.1);assert!((px[2]-200.0/255.0).abs()<0.01);
            s.execute("edit.undo",json!({})).unwrap();assert_eq!(s.active().unwrap().doc.layers,before);
        }
    }
    #[test] fn stale_and_malformed_results_do_not_edit_the_document() {
        let mut s=fixture();let(d,r,l)=args(&s);let before=s.active().unwrap().doc.layers.clone();
        assert!(apply_subject_tool(&mut s,d,r+1,l,[0,0,1,1],"select",vec![255],None).is_err());
        assert!(apply_subject_tool(&mut s,d,r,l,[0,0,2,1],"blur",vec![255],Some(vec![])).is_err());
        assert!(apply_subject_tool(&mut s,d,r,l,[0,0,1,1],"replace",vec![255],Some(vec![0;4])).is_err());
        assert!(apply_subject_tool(&mut s,d,r,l,[0,0,1,1],"select",vec![0],None).is_err());
        assert_eq!(s.active().unwrap().doc.layers,before);
    }
}
