"""Default the school web workspace to History above Layers, preserving later choices."""
from pathlib import Path
import sys
source = Path(sys.argv[1]).resolve()
def replace(path, before, after):
    text = path.read_text(encoding='utf-8')
    assert text.count(before) == 1, f'Upstream changed: {path}: {before[:60]}'
    path.write_text(text.replace(before, after), encoding='utf-8', newline='\n')
replace(source / 'crates/ui-egui/src/menus/invoke.rs', '        _ => (false, true, true, false, true),', '        _ => (false, false, true, true, false),')
replace(source / 'crates/ui-egui/src/state.rs', '            layers: true,\n            history: false,\n            properties: true,\n            color: true,', '            layers: true,\n            history: true,\n            properties: false,\n            color: false,')
web = source / 'apps/photocraft-web/src/web.rs'
replace(web, '                    if !preset_warnings.is_empty() {', '                    initialize_default_panels(&mut app);\n                    if !preset_warnings.is_empty() {')
with web.open('a', encoding='utf-8', newline='\n') as file:
    file.write('''
/// Upgrade Essentials once; saved named workspaces and subsequent panel choices survive.
fn initialize_default_panels(app: &mut PhotocraftApp) {
    const KEY: &str = "photocraft.history-layers-default.v1";
    let storage = web_sys::window().and_then(|window| window.local_storage().ok().flatten());
    let first = storage.as_ref().and_then(|store| store.get_item(KEY).ok())
        .map(|value| value.is_none()).unwrap_or_else(|| app.session.prefs().panel_layout.is_null());
    if first {
        if app.ui.workspace == "Essentials" {
            photocraft_ui_egui::menus::apply_workspace(app);
        }
        if let Some(store) = storage {let _ = store.set_item(KEY, "true");}
    }
}
''')
print('Set Essentials to History above Layers, with one-time migration and remembered changes.')
