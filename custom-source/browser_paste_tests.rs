
#[cfg(test)]
mod browser_paste_menu_tests {
    use super::*;
    use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
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
