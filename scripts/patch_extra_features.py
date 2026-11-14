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
