"""Add the asynchronous local-model service without adding a remote inference API."""
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
def replace(path, before, after):
    text = path.read_text(encoding='utf-8')
    assert text.count(before) == 1, f'Upstream changed: {path}: {before[:60]}'
    path.write_text(text.replace(before, after), encoding='utf-8', newline='\n')
app = source / 'apps/photocraft-web'
(app / 'src/browser_background.rs').write_text((root / 'custom-source/browser_background.rs').read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
replace(app / 'src/main.rs', 'mod browser_recovery;', 'mod browser_recovery;\n\n#[cfg(target_arch = "wasm32")]\nmod browser_background;')
replace(app / 'src/web.rs', '        browser_paste: Some(Box::new(crate::browser_recovery::paste_clipboard)),', '        browser_paste: Some(Box::new(crate::browser_recovery::paste_clipboard)),\n        browser_remove_background: Some(Box::new(crate::browser_background::start)),')
replace(app / 'src/web.rs', '    fn logic(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {', '    fn logic(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {\n        crate::browser_background::poll(&mut self.app, ctx);')
replace(source / 'crates/ui-egui/src/services.rs', '    pub browser_paste: Option<Box<dyn FnMut() -> Result<bool, String> + Send>>,', '    pub browser_paste: Option<Box<dyn FnMut() -> Result<bool, String> + Send>>,\n    /// On-device model service, applied asynchronously to the unchanged source layer.\n    pub browser_remove_background: Option<Box<dyn FnMut(&Document, u64, u64) -> Result<(), String> + Send>>,')
menu = source / 'crates/ui-egui/src/menus/invoke.rs'
replace(menu, '        "edit.paste" if params.as_object().is_none_or(|o| o.is_empty()) => {', '''        "layer.removeBackground" if app.services.browser_remove_background.is_some() => {
            if let Some(reason) = app.session.disabled_reason_with(id, &params) {return Err(reason);}
            let st = app.session.active().ok_or("no document")?;
            let layer = st.active_layer.ok_or("select an image layer")?;
            if let Some(start) = app.services.browser_remove_background.as_mut() {
                start(&st.doc, layer.0, st.revision)?;
            }
            ctx.request_repaint_after(std::time::Duration::from_millis(100));
            Ok(json!({"backgroundRemoval": "running locally"}))
        }
        "edit.paste" if params.as_object().is_none_or(|o| o.is_empty()) => {''')
cutout = source / 'crates/engine/src/cmd/cutout_cmds.rs'
with cutout.open('a', encoding='utf-8', newline='\n') as file:
    file.write((root / 'custom-source/background_mask.rs').read_text(encoding='utf-8'))
replace(cutout, '    vec![CommandSpec {', '    let mut specs = vec![CommandSpec {')
replace(cutout, '    }]\n}', '''    }];
    specs.push(CommandSpec {
        id: "layer.removeBackgroundQuick", label: "Remove Background (Quick)", menu: &[], shortcut: None,
        params: specs[0].params, enabled, run, journal: true,
    });
    specs
}''')
replace(source / 'crates/ui-egui/src/menu_catalog.rs', '    (&["Select"], "Remove Background", None, "layer.removeBackground"),', '    (&["Select"], "Remove Background", None, "layer.removeBackground"),\n    (&["Select"], "Remove Background (Quick)", None, "layer.removeBackgroundQuick"),')
# Route through the regular command path: it owns transform commit/queueing.
# Capturing the image directly in the menu leaves a frozen transform preview
# above the newly masked document, and can later overwrite that document.
text = menu.read_text(encoding='utf-8')
begin = text.index('        "layer.removeBackground" if app.services.browser_remove_background.is_some() => {')
end = text.index('        "edit.paste" if params.as_object()', begin)
text = text[:begin] + text[end:]
menu.write_text(text, encoding='utf-8', newline='\n')
commands = source / 'crates/ui-egui/src/app/commands.rs'
replace(commands, 'if photocraft_engine::PRECHECKED.contains(&id) && self.ui.transform.is_some() {', 'if (photocraft_engine::PRECHECKED.contains(&id) || matches!(id, "layer.removeBackground" | "layer.removeBackgroundQuick")) && self.ui.transform.is_some() {')
replace(commands, '        actions::suspended_guard(self, id)?;', '''        if id == "layer.removeBackground" && self.services.browser_remove_background.is_some() {
            self.session.precheck(id, &params).map_err(|e| e.to_string())?;
            let st = self.session.active().ok_or("no document")?;
            let layer = st.active_layer.ok_or("select an image layer")?;
            self.services.browser_remove_background.as_mut().unwrap()(&st.doc, layer.0, st.revision)?;
            return Ok(json!({"backgroundRemoval": "running locally"}));
        }
        actions::suspended_guard(self, id)?;''')
print('Added local model background removal with transform commit/queueing, stale-document checks and quick fallback.')

# The three subject tools share the existing worker/model and command lifecycle.
with cutout.open('a',encoding='utf-8',newline='\n') as file:
    file.write((root/'custom-source/subject_tools.rs').read_text(encoding='utf-8'))
replace(cutout,'    specs\n}', '''    for (id,label) in [("select.subjectAI","Select Subject (AI)"),
        ("layer.backgroundBlurAI","Blur Background (AI)"),("layer.replaceBackgroundAI","Replace Background (AI)"),
        ("layer.refineCutout","Refine Cutout"),("image.autoEnhanceLocal","Auto Enhance")] {
        specs.push(CommandSpec {id,label,menu:&[],shortcut:None,params:"{}",enabled,
            run: |_,_| Err(EngineError::Other("This AI tool requires the browser host".into())),journal:true});
    }
    specs
}''')
replace(source/'crates/ui-egui/src/services.rs',
    '    pub browser_remove_background: Option<Box<dyn FnMut(&Document, u64, u64) -> Result<(), String> + Send>>,',
    '''    pub browser_remove_background: Option<Box<dyn FnMut(&Document, u64, u64) -> Result<(), String> + Send>>,
    pub browser_subject_tool: Option<Box<dyn FnMut(&Document, u64, u64, &str) -> Result<(), String> + Send>>,''')
replace(app/'src/web.rs','        browser_remove_background: Some(Box::new(crate::browser_background::start)),',
    '        browser_remove_background: Some(Box::new(crate::browser_background::start)),\n        browser_subject_tool: Some(Box::new(crate::browser_background::start_tool)),')
replace(commands,'matches!(id, "layer.removeBackground" | "layer.removeBackgroundQuick")',
    'matches!(id, "layer.removeBackground" | "layer.removeBackgroundQuick" | "select.subjectAI" | "layer.backgroundBlurAI" | "layer.replaceBackgroundAI" | "layer.refineCutout" | "image.autoEnhanceLocal")')
replace(commands,'        if id == "layer.removeBackground" && self.services.browser_remove_background.is_some() {',
    '''        if matches!(id,"select.subjectAI"|"layer.backgroundBlurAI"|"layer.replaceBackgroundAI"|"layer.refineCutout"|"image.autoEnhanceLocal") && self.services.browser_subject_tool.is_some() {
            self.session.precheck(id,&params).map_err(|e|e.to_string())?;
            let st=self.session.active().ok_or("no document")?;
            let layer=st.active_layer.ok_or("select an image layer")?;
            let mode=match id {"select.subjectAI"=>"select","layer.backgroundBlurAI"=>"blur","layer.refineCutout"=>"refine","image.autoEnhanceLocal"=>"enhance",_=>"replace"};
            self.services.browser_subject_tool.as_mut().unwrap()(&st.doc,layer.0,st.revision,mode)?;
            return Ok(json!({"subjectTool":"running locally"}));
        }
        if id == "layer.removeBackground" && self.services.browser_remove_background.is_some() {''')
replace(source/'crates/ui-egui/src/menu_catalog.rs',
    '    (&["Select"], "Remove Background", None, "layer.removeBackground"),',
    '''    (&["Select"], "Select Subject (AI)", None, "select.subjectAI"),
    (&["Select"], "Blur Background (AI)…", None, "layer.backgroundBlurAI"),
    (&["Select"], "Replace Background (AI)…", None, "layer.replaceBackgroundAI"),
    (&["Select"], "Refine Cutout…", None, "layer.refineCutout"),
    (&["Image"], "Auto Enhance…", None, "image.autoEnhanceLocal"),
    (&["Select"], "Remove Background", None, "layer.removeBackground"),''')
print('Added shared Select Subject, Background Blur and Replace Background browser commands.')
