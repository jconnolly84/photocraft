"""Compact toolbar matching the supplied classroom reference; extras stay opt-in."""
from pathlib import Path
import re
import sys
source = Path(sys.argv[1]).resolve()
def replace(path, before, after):
    text = path.read_text(encoding='utf-8')
    assert text.count(before) == 1, f'Upstream changed: {path}: {before[:60]}'
    path.write_text(text.replace(before, after), encoding='utf-8', newline='\n')

groups = [
    ['Move', 'Artboard'],
    ['RectMarquee', 'EllipseMarquee', 'SingleRowMarquee', 'SingleColumnMarquee'],
    ['MagicWand', 'ObjectSelection', 'QuickSelection'],
    ['Crop', 'PerspectiveCrop', 'Slice', 'SliceSelect'],
    ['SpotHealing', 'Remove', 'Healing', 'Patch', 'ContentAwareMove', 'RedEye'],
    ['Eraser', 'BackgroundEraser', 'MagicEraser'],
    ['PaintBucket', 'Gradient'], ['Blur', 'Sharpen', 'Smudge'],
    ['Type', 'VerticalType', 'VerticalTypeMask', 'HorizontalTypeMask'],
    ['Pen', 'FreeformPen', 'CurvaturePen', 'AddAnchorPoint', 'DeleteAnchorPoint', 'ConvertPoint'],
    ['PathSelection', 'DirectSelection'],
    ['Rectangle', 'EllipseShape', 'Triangle', 'Polygon', 'Star', 'Line', 'CustomShape'],
    ['Hand', 'RotateView'], ['Zoom'],
]
visible = [name for group in groups for name in group]
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
enabled_names = ', '.join('"' + name + '"' for name in visible)
replace(prefs, '''    pub order: Vec<String>,
}

/// Layer Mask Display Options''', '''    pub order: Vec<String>,
}
impl Default for ToolbarCustomization {
    fn default() -> Self {
        Self {hidden: [''' + names + '''].into_iter().map(str::to_string).collect(), order: Vec::new()}
    }
}
impl ToolbarCustomization {
    /// Restore alternatives inside the classroom toolbar's existing slots.
    /// Preserve independently hidden groups and custom ordering.
    pub fn enable_compact_flyouts(&mut self) {
        const ENABLED: &[&str] = &[''' + enabled_names + '''];
        self.hidden.retain(|name| !ENABLED.contains(&name.as_str()));
    }
}

/// Layer Mask Display Options''')
toolbar = source / 'crates/ui-egui/src/panels/toolbar.rs'
replace(toolbar, '&[Tool::Gradient, Tool::PaintBucket]', '&[Tool::PaintBucket, Tool::Gradient]')
replace(toolbar, '&[Tool::ObjectSelection, Tool::QuickSelection, Tool::MagicWand]', '&[Tool::MagicWand, Tool::ObjectSelection, Tool::QuickSelection]')
replace(toolbar, '''                                let long_press = held_for.is_some_and(|seconds| seconds >= 0.35);''', '''                                // A browser may coalesce the scheduled held frame with release.
                                // Remember the original press independently of egui's current
                                // down state so releasing a stationary hold still opens the list.
                                let hold_start_id = key.with("hold-start");
                                let now = ui.input(|i| i.time);
                                if ui.input(|i| i.pointer.primary_pressed()
                                    && i.pointer.press_origin().is_some_and(|p| resp.rect.contains(p))) {
                                    ui.data_mut(|d| d.insert_temp(hold_start_id, now));
                                }
                                let held_release = ui.input(|i| i.pointer.primary_released()
                                    && i.pointer.interact_pos().is_some_and(|p| resp.rect.contains(p)))
                                    && ui.data(|d| d.get_temp::<f64>(hold_start_id))
                                        .is_some_and(|start| now - start >= 0.35);
                                if ui.input(|i| i.pointer.primary_released()) {
                                    ui.data_mut(|d| d.remove::<f64>(hold_start_id));
                                }
                                let long_press = held_for.is_some_and(|seconds| seconds >= 0.35) || held_release;''')
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
        if let Some(s) = storage.as_ref() {let _ = s.set_item(KEY, "true");}
    }
    // Repair the original compact preset without resetting any other choices.
    const FLYOUT_KEY: &str = "photocraft.compact-flyouts.v1";
    let enable_flyouts = storage.as_ref().and_then(|s| s.get_item(FLYOUT_KEY).ok())
        .map(|v| v.is_none()).unwrap_or(false);
    if enable_flyouts {
        app.session.edit_prefs(|p| {
            p.toolbar.enable_compact_flyouts();
        });
        if let Some(s) = storage.as_ref() {let _ = s.set_item(FLYOUT_KEY, "true");}
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
        assert_eq!(prefs.hidden.len(), 20);
        assert_eq!(slots[1].as_slice(), &[Tool::RectMarquee, Tool::EllipseMarquee,
            Tool::SingleRowMarquee, Tool::SingleColumnMarquee]);
        assert_eq!(slots[11].as_slice(), &[Tool::Rectangle, Tool::EllipseShape,
            Tool::Triangle, Tool::Polygon, Tool::Star, Tool::Line, Tool::CustomShape]);
        assert!(!prefs.hidden.iter().any(|n| n == "Gradient"));
        assert!(prefs.hidden.iter().any(|n| n == "Frame"));
        let roundtrip: photocraft_engine::prefs::ToolbarCustomization = serde_json::from_str("{}").unwrap();
        assert_eq!(roundtrip, prefs);
    }
    #[test]
    fn existing_compact_prefs_gain_flyouts_without_resetting_other_choices() {
        let mut prefs = photocraft_engine::prefs::ToolbarCustomization {
            hidden: ["EllipseMarquee", "EllipseShape", "Sharpen", "VerticalType",
                "DirectSelection", "Frame", "Brush"].into_iter().map(str::to_string).collect(),
            order: vec!["Zoom".into(), "Move".into()],
        };
        prefs.enable_compact_flyouts();
        assert_eq!(prefs.hidden, vec!["Frame", "Brush"]);
        assert_eq!(prefs.order, vec!["Zoom", "Move"]);
        let once = prefs.clone();
        prefs.enable_compact_flyouts();
        assert_eq!(prefs, once);
        let sections = toolbar::visible_sections(&photocraft_engine::prefs::ToolbarCustomization::default().hidden);
        for (_, slot) in sections.iter().flatten() {
            assert!(slot.len() > 1 || slot == &vec![Tool::Zoom]);
        }
    }
    #[test]
    fn stationary_hold_opens_even_without_an_intermediate_held_frame() {
        let mut app = PhotocraftApp::new(photocraft_engine::Session::new(), crate::Services::default());
        let ctx = egui::Context::default();
        PhotocraftApp::setup_context(&ctx, crate::theme::ThemeKind::ALL[0]);
        let frame = |app: &mut PhotocraftApp, time, events| {
            ctx.run_ui(egui::RawInput {time: Some(time), events,
                screen_rect: Some(Rect::from_min_size(Pos2::ZERO, vec2(1200.0,1800.0))),
                ..Default::default()}, |ui| toolbar::toolbar(app, ui))
        };
        frame(&mut app, 0.0, vec![]);
        frame(&mut app, 0.1, vec![]);
        let bx = if Tokens::get(&ctx).pro {30.0} else {36.0};
        let mut buttons: Vec<Rect> = ctx.viewport(|v| v.prev_pass.widgets.layers()
            .flat_map(|(_,widgets)| widgets.iter())
            .filter(|w| w.rect.size() == egui::Vec2::splat(bx) && w.sense.senses_click())
            .map(|w| w.rect).collect());
        buttons.sort_by(|a,b| a.top().total_cmp(&b.top()));
        let at = buttons[1].center();
        let pointer = |pressed| egui::Event::PointerButton {pos:at,
            button:egui::PointerButton::Primary,pressed,modifiers:Default::default()};
        frame(&mut app, 1.0, vec![egui::Event::PointerMoved(at), pointer(true)]);
        frame(&mut app, 1.5, vec![pointer(false)]);
        assert!(ctx.data(|d| d.get_temp::<(egui::Id,Rect)>(egui::Id::unique("tool-flyout"))).is_some());
    }
}
''')
print('Set 14 compact toolbar slots with all 49 grouped alternatives, 20 opt-in tools and Paint Bucket first.')
