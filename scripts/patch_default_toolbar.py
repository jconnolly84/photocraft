"""Compact toolbar matching the supplied classroom reference; extras stay opt-in."""
from pathlib import Path
import re
import sys
source = Path(sys.argv[1]).resolve()
def replace(path, before, after):
    text = path.read_text(encoding='utf-8')
    assert text.count(before) == 1, f'Upstream changed: {path}: {before[:60]}'
    path.write_text(text.replace(before, after), encoding='utf-8', newline='\n')

visible = ['Move', 'RectMarquee', 'MagicWand', 'Crop', 'SpotHealing', 'Eraser',
           'PaintBucket', 'Gradient', 'Blur', 'Type', 'Pen', 'PathSelection',
           'Rectangle', 'Hand', 'Zoom']
tool_source = (source / 'crates/ui-egui/src/state/tool.rs').read_text(encoding='utf-8')
all_tools = re.findall(r'^    ([A-Z]\w*),$', tool_source.split('impl Tool {')[0], re.M)
assert len(all_tools) == 69 and set(visible) <= set(all_tools)
hidden = [name for name in all_tools if name not in visible]
prefs = source / 'crates/engine/src/prefs.rs'
replace(prefs, '''#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ToolbarCustomization {''', '''#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ToolbarCustomization {''')
names = ', '.join('"' + name + '"' for name in hidden)
replace(prefs, '''    pub order: Vec<String>,
}

/// Layer Mask Display Options''', '''    pub order: Vec<String>,
}
impl Default for ToolbarCustomization {
    fn default() -> Self {
        Self {hidden: [''' + names + '''].into_iter().map(str::to_string).collect(), order: Vec::new()}
    }
}

/// Layer Mask Display Options''')
toolbar = source / 'crates/ui-egui/src/panels/toolbar.rs'
replace(toolbar, '&[Tool::Gradient, Tool::PaintBucket]', '&[Tool::PaintBucket, Tool::Gradient]')
pen = '        &[Tool::Pen, Tool::FreeformPen, Tool::CurvaturePen, Tool::AddAnchorPoint, Tool::DeleteAnchorPoint, Tool::ConvertPoint],'
type_slot = '        &[Tool::Type, Tool::VerticalType, Tool::VerticalTypeMask, Tool::HorizontalTypeMask],'
replace(toolbar, pen + '\n' + type_slot, type_slot + '\n' + pen)
replace(source / 'crates/ui-egui/src/prefs/prefs_ui/dialogs.rs', '        hidden.clear();', '        hidden = photocraft_engine::prefs::ToolbarCustomization::default().hidden;')

web = source / 'apps/photocraft-web/src/web.rs'
replace(source / 'apps/photocraft-web/Cargo.toml', '\negui = { workspace = true }\n', '\negui = { workspace = true }\nserde_json = { workspace = true }\n')
replace(web, '                    initialize_default_panels(&mut app);', '                    initialize_default_panels(&mut app);\n                    initialize_default_toolbar(&mut app);')
with web.open('a', encoding='utf-8', newline='\n') as f:
    f.write('''
/// Apply this classroom preset once; later toolbar choices remain user-controlled.
fn initialize_default_toolbar(app: &mut PhotocraftApp) {
    const KEY: &str = "photocraft.compact-toolbar.v1";
    let storage = web_sys::window().and_then(|w| w.local_storage().ok().flatten());
    let first = storage.as_ref().and_then(|s| s.get_item(KEY).ok())
        .map(|v| v.is_none()).unwrap_or(false);
    if first {
        app.ui.group_tools.retain(|tool| !matches!(tool, photocraft_ui_egui::state::Tool::Gradient | photocraft_ui_egui::state::Tool::PaintBucket));
        app.ui.remember_group_tool(photocraft_ui_egui::state::Tool::PaintBucket);
        let groups = serde_json::to_value(&app.ui.group_tools).unwrap_or_default();
        app.session.edit_prefs(|p| {
            p.toolbar = Default::default();
            p.group_tools = groups;
        });
        if let Some(s) = storage {let _ = s.set_item(KEY, "true");}
    }
}
''')
with (source / 'crates/ui-egui/src/panels.rs').open('a', encoding='utf-8', newline='\n') as f:
    f.write('''
#[cfg(test)]
mod school_toolbar_tests {
    use super::*;
    #[test]
    fn compact_defaults_have_reference_slots_and_bucket_front() {
        let prefs = photocraft_engine::prefs::ToolbarCustomization::default();
        let sections = toolbar::visible_sections(&prefs.hidden);
        let slots: Vec<_> = sections.iter().flatten().map(|(_, tools)| tools).collect();
        let fronts: Vec<_> = slots.iter().map(|slot| toolbar::slot_tool(Tool::Move, &[], slot)).collect();
        assert_eq!(fronts, vec![Tool::Move, Tool::RectMarquee, Tool::MagicWand,
            Tool::Crop, Tool::SpotHealing, Tool::Eraser, Tool::PaintBucket,
            Tool::Blur, Tool::Type, Tool::Pen, Tool::PathSelection,
            Tool::Rectangle, Tool::Hand, Tool::Zoom]);
        assert_eq!(slots[6].as_slice(), &[Tool::PaintBucket, Tool::Gradient]);
        assert_eq!(prefs.hidden.len(), 54);
        assert!(!prefs.hidden.iter().any(|n| n == "Gradient"));
        assert!(prefs.hidden.iter().any(|n| n == "Frame"));
        let roundtrip: photocraft_engine::prefs::ToolbarCustomization = serde_json::from_str("{}").unwrap();
        assert_eq!(roundtrip, prefs);
    }
}
''')
print('Set 14 compact toolbar slots, 54 opt-in tools and Paint Bucket first.')
