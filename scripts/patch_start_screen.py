"""Replace the bare Home canvas with a native, local-first project hub."""
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
def replace(path, before, after):
    text = path.read_text(encoding='utf-8')
    assert text.count(before) == 1, f'Upstream changed: {path}: {before[:60]}'
    path.write_text(text.replace(before,after),encoding='utf-8',newline='\n')
(source / 'crates/ui-egui/src/canvas/start_screen.rs').write_text((root / 'custom-source/school_start.rs').read_text(encoding='utf-8'),encoding='utf-8',newline='\n')
replace(source / 'crates/ui-egui/src/services.rs', '    pub browser_paste: Option<Box<dyn FnMut() -> Result<bool, String> + Send>>,', '    pub browser_paste: Option<Box<dyn FnMut() -> Result<bool, String> + Send>>,\n    pub browser_start_action: Option<Box<dyn FnMut(&str) -> Result<(), String> + Send>>,')
replace(source / 'apps/photocraft-web/src/web.rs', '        browser_paste: Some(Box::new(crate::browser_recovery::paste_clipboard)),', '        browser_paste: Some(Box::new(crate::browser_recovery::paste_clipboard)),\n        browser_start_action: Some(Box::new(crate::browser_recovery::start_action)),')
with (source / 'apps/photocraft-web/src/browser_recovery.rs').open('a',encoding='utf-8',newline='\n') as f:
    f.write('''
pub fn start_action(action: &str) -> Result<(), String> {
    let promise = invoke("photocraftStartAction", &JsValue::from_str(action))?;
    wasm_bindgen_futures::spawn_local(async move {let _ = JsFuture::from(promise).await;});
    Ok(())
}
''')
dialog = source / 'crates/ui-egui/src/dialogs/new_doc_ui.rs'
replace(dialog, 'pub const CATEGORIES: &[(&str, &[Preset])] = &[', 'pub const CATEGORIES: &[(&str, &[Preset])] = &[\n    ("Classroom", &[("A4 portrait",2480,3508,300.0),("A4 landscape",3508,2480,300.0),("Presentation",1920,1080,72.0),("Square artwork",1080,1080,72.0)]),')
replace(dialog, 'let cat = get_s(f, "__category", "Recent");', 'let cat = get_s(f, "__category", "Classroom");')
replace(dialog, 'Some(c) if c.0 != CATEGORIES[0].0', 'Some(c) if c.0 != "Recent"')
replace(dialog, '    // Category tabs.\n    ui.horizontal(|ui| {', '    // Category tabs wrap on narrower windows.\n    ui.horizontal_wrapped(|ui| {')
replace(dialog, '    ui.painter().rect_stroke(page, 1.0, Stroke::new(1.2, t.text_dim), StrokeKind::Inside);', '''    ui.painter().rect_filled(page, 2.0, egui::Color32::from_rgb(226,235,249));
    let inner = page.shrink(4.0);
    ui.painter().rect_filled(Rect::from_min_size(inner.min, vec2(inner.width(),inner.height()*0.4)),1.0,t.accent);''')
print('Added native start hub, classroom preset cards and recovery access.')
