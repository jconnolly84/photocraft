
/// Apply a completed local model mask only to the unchanged source document.
pub fn apply_model_mask(s: &mut Session, document: u64, revision: u64, layer: u64, bounds: [i32; 4], alpha: Vec<u8>) -> Result<()> {
    let active = s.active().ok_or(EngineError::NoDocument)?;
    if active.doc.id.0 != document || active.revision != revision {
        return Err(EngineError::Other("The document changed while removing the background. Try again.".into()));
    }
    let id = photocraft_doc::LayerId(layer);
    check(&active.doc, active.doc.layer(id).ok_or(EngineError::NoLayer(id))?).map_err(EngineError::Other)?;
    let [x, y, w, h] = bounds;
    if w <= 0 || h <= 0 || w as u64 * h as u64 > 16_777_216 || alpha.len() as u64 != w as u64 * h as u64 {
        return Err(EngineError::Other("Invalid background-removal mask".into()));
    }
    let area = Rect::new(x, y, x.saturating_add(w), y.saturating_add(h));
    if area.intersect(&active.doc.bounds()) != area {
        return Err(EngineError::Other("Background-removal mask is outside the canvas".into()));
    }
    s.edit("Remove Background (AI)", move |doc, _| {
        let mut mask = crate::commands::mask_at_depth(LayerMask::hide_all(), doc.depth)?;
        let data: Vec<f32> = alpha.into_iter().map(|value| f32::from(value) / 255.0).collect();
        mask.surface.write_region(area, &data);
        crate::extra_cmds::background_to_layer_for_mask(doc, id);
        doc.layer_mut(id).ok_or(EngineError::NoLayer(id))?.mask = Some(mask);
        doc.selection = None;
        Ok(())
    })
}
