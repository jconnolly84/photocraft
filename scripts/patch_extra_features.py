"""Wire the existing cutout command and local browser services into the pinned app."""
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
def replace(path, before, after):
    text = path.read_text(encoding='utf-8')
    assert text.count(before) == 1, f'Upstream code changed: {path}: {before[:60]}'
    path.write_text(text.replace(before, after), encoding='utf-8', newline='\n')
ui = source / 'crates/ui-egui/src/menu_catalog.rs'
anchor = '    (&["Select"], "Subject", None, "select.subject"),'
replace(ui, anchor, '    (&["Select"], "Remove Background", None, "layer.removeBackground"),\n' + anchor)
app = source / 'apps/photocraft-web'
replace(app / 'Cargo.toml', 'photocraft-engine = { workspace = true }', 'photocraft-engine = { workspace = true }\nphotocraft-format = { workspace = true }')
replace(app / 'src/main.rs', '#[cfg(target_arch = "wasm32")]\nmod web;', '#[cfg(target_arch = "wasm32")]\nmod browser_recovery;\n\n#[cfg(target_arch = "wasm32")]\nmod web;')
(app / 'src/browser_recovery.rs').write_text((root / 'custom-source/browser_recovery.rs').read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
web = app / 'src/web.rs'
replace(web, '        let pen_target = canvas.clone();', '        let recovery = crate::browser_recovery::load().await;\n        let pen_target = canvas.clone();')
replace(web, 'services(inbox.clone(), place_inbox.clone(), drag_pos_service(pen_target.clone(), drag))', 'services(inbox.clone(), place_inbox.clone(), drag_pos_service(pen_target.clone(), drag), recovery.clone())')
replace(web, '                    if !preset_warnings.is_empty() {', '''                    if recovery.is_some() {
                        app.session.edit_prefs(|prefs| {
                            prefs.file_handling.autosave = true;
                            prefs.file_handling.autosave_minutes = 1;
                            prefs.file_handling.recover_on_launch = true;
                        });
                    }
                    if !preset_warnings.is_empty() {''')
replace(web, 'fn services(inbox: Inbox, place_inbox: PlaceInbox, cursor_pos: photocraft_ui_egui::CursorPosFn) -> Services {\n    Services {', 'fn services(inbox: Inbox, place_inbox: PlaceInbox, cursor_pos: photocraft_ui_egui::CursorPosFn, recovery: Option<crate::browser_recovery::Bridge>) -> Services {\n    let mut services = Services {')
replace(web, '        write: Some(Box::new(|path: &str, bytes: &[u8]| download(path, bytes))),', '''        write: Some(Box::new(|path: &str, bytes: &[u8]| download(path, bytes))),
        clipboard_set_image: Some(Box::new(|w, h, rgba| {
            let image = Image::from_u8(w, h, ChannelLayout::Rgba, rgba.to_vec()).map_err(|error| error.to_string())?;
            let png = photocraft_codecs::encode(&image, photocraft_codecs::Format::Png, &EncodeOptions::default()).map_err(|error| error.to_string())?;
            crate::browser_recovery::write_clipboard(&png)
        })),''')
replace(web, '        ..Default::default()\n    }\n}\n\nconst PREFS_KEY', '        ..Default::default()\n    };\n    crate::browser_recovery::attach(&mut services, recovery);\n    services\n}\n\nconst PREFS_KEY')
print('Added Select > Remove Background, local recovery hooks and browser clipboard export.')

# Browser clipboard reads are asynchronous and must begin from the menu gesture.
services = source / 'crates/ui-egui/src/services.rs'
replace(services, '    pub clipboard_get_image: Option<ClipboardGetFn>,', '    pub clipboard_get_image: Option<ClipboardGetFn>,\n    /// True when a browser host accepted an asynchronous image paste.\n    pub browser_paste: Option<Box<dyn FnMut() -> Result<bool, String> + Send>>,')
state = source / 'crates/ui-egui/src/menus/state.rs'
replace(state, '"edit.paste" | "file.newFromClipboard" => app.session.is_enabled(id) || app.services.clipboard_get_image.is_some(),', '"edit.paste" => app.session.is_enabled(id) || app.services.clipboard_get_image.is_some() || app.services.browser_paste.is_some(),\n        "file.newFromClipboard" => app.session.is_enabled(id) || app.services.clipboard_get_image.is_some(),')
menu = source / 'crates/ui-egui/src/menus/invoke.rs'
replace(menu, '        "edit.paste" if params.as_object().is_none_or(|o| o.is_empty()) => {', '''        "edit.paste" if params.as_object().is_none_or(|o| o.is_empty()) => {
            if app.services.browser_paste.as_mut().map(|paste| paste()).transpose()?.unwrap_or(false) {
                return Ok(json!({"browserPaste": true}));
            }''')
replace(web, '        clipboard_set_image: Some(Box::new(|w, h, rgba| {', '''        browser_paste: Some(Box::new(crate::browser_recovery::paste_clipboard)),
        clipboard_set_image: Some(Box::new(|w, h, rgba| {''')

# The native Smart Object cache is in document coordinates, like raster pixels.
# Sampling only that cache avoids selecting subjects on unrelated visible layers.
cutout = source / 'crates/engine/src/cmd/cutout_cmds.rs'
replace(cutout, 'if !matches!(l.content, LayerContent::Raster(_)) {', 'if !matches!(l.content, LayerContent::Raster(_) | LayerContent::Smart(_)) {')
replace(cutout, '    let area = subject_area(layer, doc.bounds(), sample_all);\n', '')
replace(cutout, '            // Cancel reaches the min cuts', '''            if let Some(mut target) = doc.layer(id).cloned()
                && matches!(&target.content, LayerContent::Smart(smart) if smart.cache.is_none())
            {
                crate::smart_cmds::refresh_layer(doc, &mut target)?;
                *doc.layer_mut(id).ok_or(EngineError::NoLayer(id))? = target;
            }
            let target = doc.layer(id).ok_or(EngineError::NoLayer(id))?;
            if target.surface().is_none() {
                return Err(EngineError::Other("The selected image has no rendered pixels".into()));
            }
            let area = subject_area(target, doc.bounds(), sample_all);
            // Cancel reaches the min cuts''')
replace(cutout, '    #[test]\n    fn remove_background_disabled_states_and_bad_params()', (root / 'custom-source/cutout_smart_tests.rs').read_text(encoding='utf-8') + '    #[test]\n    fn remove_background_disabled_states_and_bad_params()')
with (source / 'crates/ui-egui/src/menus.rs').open('a', encoding='utf-8', newline='\n') as f:
    f.write((root / 'custom-source/browser_paste_tests.rs').read_text(encoding='utf-8'))
