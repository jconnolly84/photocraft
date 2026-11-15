
#[cfg(test)]
mod browser_paste_menu_tests {
    use super::*;
    use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
    #[test]
    fn background_removal_commits_transform_before_capturing_model_input() {
        let captured = Arc::new(std::sync::Mutex::new(None));
        let output = captured.clone();
        let mut app = PhotocraftApp::new(photocraft_engine::Session::new(), crate::Services {
            browser_remove_background: Some(Box::new(move |doc, layer, revision| {
                let bounds = doc.layer(photocraft_doc::LayerId(layer)).unwrap().surface().unwrap().content_bounds();
                *output.lock().unwrap() = Some((bounds.x0, revision));
                Ok(())
            })),
            ..Default::default()
        });
        app.run("file.new", json!({"width": 200, "height": 200})).unwrap();
        app.run("layer.new.layer", json!({"name": "Subject"})).unwrap();
        app.run("select.rect", json!({"x": 20, "y": 20, "width": 40, "height": 40})).unwrap();
        app.run("edit.fill", json!({"contents": "color", "color": "#ff0000"})).unwrap();
        app.run("select.deselect", json!({})).unwrap();
        let ctx = egui::Context::default();
        invoke(&mut app, &ctx, "edit.freeTransform", json!({})).unwrap();
        let t = app.ui.transform.as_mut().unwrap();
        t.quad = t.quad.map(|[x,y]| [x + 10.0, y]);
        t.pivot[0] += 10.0;
        invoke(&mut app, &ctx, "layer.removeBackground", json!({})).unwrap();
        assert!(app.ui.transform.is_none(), "the old preview must not cover the new mask");
        let (x, revision) = captured.lock().unwrap().unwrap();
        assert_eq!(x, 30, "model must receive the transformed image");
        assert_eq!(revision, app.session.active().unwrap().revision);
    }
    #[test]
    fn browser_menu_paste_is_enabled_without_reading_and_starts_on_click() {
        let calls = Arc::new(AtomicUsize::new(0));
        let count = calls.clone();
        let mut app = PhotocraftApp::new(photocraft_engine::Session::new(), crate::Services {
            browser_paste: Some(Box::new(move || {count.fetch_add(1, Ordering::SeqCst); Ok(true)})),
            ..Default::default()
        });
        assert!(is_enabled(&app, "edit.paste"));
        assert_eq!(calls.load(Ordering::SeqCst), 0);
        let result = invoke(&mut app, &egui::Context::default(), "edit.paste", json!({})).unwrap();
        assert_eq!(result["browserPaste"], true);
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert!(app.session.clipboard.is_none());
    }
}
