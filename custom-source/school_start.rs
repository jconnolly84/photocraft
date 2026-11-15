use super::tabs::open_on_double_click;
use super::{PhotocraftApp, Rect, Sense};
use egui::{Color32, RichText, vec2, pos2, Align2, FontId, Stroke, StrokeKind};

pub(crate) const SCHOOL_PRESETS: &[crate::new_doc_ui::Preset] = &[
    ("A4 portrait", 2480, 3508, 300.0),
    ("A4 landscape", 3508, 2480, 300.0),
    ("Presentation", 1920, 1080, 72.0),
    ("Square artwork", 1080, 1080, 72.0),
];

fn new_project(app: &mut PhotocraftApp, preset: Option<&crate::new_doc_ui::Preset>) {
    let mut fields = app.new_document_fields();
    fields.insert("__category".into(), serde_json::json!("Classroom"));
    if let Some(preset) = preset {
        crate::new_doc_ui::apply_preset(&mut fields, preset, &app.session.prefs().units_and_rulers);
    }
    app.ui.open_dialog(crate::state::DialogKind::NewDocument, fields);
}

pub(super) fn start_screen(app: &mut PhotocraftApp, ui: &mut egui::Ui) {
    let area = ui.available_rect_before_wrap();
    open_on_double_click(app, ui, area);
    let width = (area.width() - 40.0).clamp(180.0, 1080.0);
    let rect = Rect::from_min_size(pos2(area.center().x - width / 2.0, area.top() + 24.0), vec2(width, (area.height() - 24.0).max(0.0)));
    let t = crate::theme::Tokens::get(ui.ctx());
    ui.scope_builder(egui::UiBuilder::new().max_rect(rect), |ui| {
        egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| {
            ui.set_width(width);
            ui.horizontal(|ui| {
                let (mark, _) = ui.allocate_exact_size(vec2(48.0,48.0), Sense::hover());
                crate::panels::brand::paint_mark(ui, mark);
                ui.add_space(8.0);
                ui.vertical(|ui| {
                    ui.label(RichText::new("PhotoCraft").size(30.0).strong().color(t.text));
                    ui.label(RichText::new("Your ideas. Your canvas.").size(14.0).color(t.text_dim));
                });
            });
            ui.add_space(22.0);
            egui::Frame::new().fill(t.field).corner_radius(12.0).inner_margin(22.0).show(ui, |ui| {
                ui.set_min_width((width - 44.0).max(0.0));
                ui.label(RichText::new("Make something worth sharing.").size(26.0).strong());
                ui.label(RichText::new("Edit a photo, build a poster or start with a blank canvas.").size(14.0).color(t.text_dim));
                ui.add_space(18.0);
                ui.horizontal_wrapped(|ui| {
                    if ui.add_sized([150.0,42.0], egui::Button::new(RichText::new("New project").strong()).fill(t.accent)).clicked() {new_project(app,None);}
                    if ui.add_sized([180.0,42.0], egui::Button::new("Open from computer")).clicked() {let _ = app.open_dialog_file();}
                    if app.services.browser_start_action.is_some() && ui.add_sized([180.0,42.0],egui::Button::new("Recovery & saving")).clicked() {
                        if let Some(action) = app.services.browser_start_action.as_mut() {let _ = action("recovery");}
                    }
                    if !app.session.documents().is_empty() && ui.add_sized([150.0,42.0],egui::Button::new("Back to your work")).clicked() {app.ui.chrome.home = None;}
                });
            });
            ui.add_space(22.0);
            ui.label(RichText::new("Start with a canvas").size(18.0).strong());
            ui.label(RichText::new("Choose a size, then customise the details before creating.").color(t.text_dim));
            ui.add_space(10.0);
            ui.horizontal_wrapped(|ui| {
                ui.spacing_mut().item_spacing = vec2(12.0,12.0);
                let card_w = if width < 480.0 {(width - 16.0) / 2.0} else {((width - 48.0) / 4.0).min(250.0)};
                for preset in SCHOOL_PRESETS {
                    let (r, response) = ui.allocate_exact_size(vec2(card_w,146.0),Sense::click());
                    response.widget_info(|| egui::WidgetInfo::labeled(egui::Role::Button,true,preset.0));
                    ui.painter().rect_filled(r,8.0,if response.hovered(){t.hover}else{t.field});
                    let scale = 58.0 / preset.1.max(preset.2) as f32;
                    let page = Rect::from_center_size(pos2(r.center().x,r.top()+44.0),vec2(preset.1 as f32*scale,preset.2 as f32*scale));
                    ui.painter().rect_filled(page,2.0,Color32::from_rgb(226,235,249));
                    let inset = page.shrink(5.0);
                    ui.painter().rect_filled(Rect::from_min_size(inset.min,vec2(inset.width(),inset.height()*0.4)),1.0,t.accent);
                    ui.painter().line_segment([pos2(inset.left(),inset.center().y+5.0),pos2(inset.right(),inset.center().y+5.0)],Stroke::new(2.0,Color32::from_rgb(126,151,187)));
                    ui.painter().text(pos2(r.center().x,r.top()+98.0),Align2::CENTER_CENTER,preset.0,FontId::proportional(14.0),t.text);
                    ui.painter().text(pos2(r.center().x,r.top()+124.0),Align2::CENTER_CENTER,format!("{} × {} px",preset.1,preset.2),FontId::proportional(11.0),t.text_dim);
                    if response.on_hover_cursor(egui::CursorIcon::PointingHand).clicked(){new_project(app,Some(preset));}
                }
            });
            ui.add_space(18.0);
            let (drop, response) = ui.allocate_exact_size(vec2(width-8.0,88.0),Sense::click());
            response.widget_info(||egui::WidgetInfo::labeled(egui::Role::Button,true,"Browse for an image or project"));
            ui.painter().rect_stroke(drop,8.0,Stroke::new(1.0,if response.hovered(){t.accent}else{t.separator}),StrokeKind::Inside);
            ui.painter().text(pos2(drop.center().x,drop.top()+27.0),Align2::CENTER_CENTER,"Drop an image or project here, or click to browse",FontId::proportional(if width<480.0{12.0}else{15.0}),t.text);
            ui.painter().text(pos2(drop.center().x,drop.top()+57.0),Align2::CENTER_CENTER,"PNG · JPEG · WebP · PSD · .pcraft projects",FontId::proportional(11.0),t.text_dim);
            if response.clicked(){let _ = app.open_dialog_file();}
            ui.add_space(20.0);
            ui.label(RichText::new("A little help to get started").size(18.0).strong());
            ui.add_space(6.0);
            for (title,body) in [
                ("Build with layers", "Use separate layers for images, text and shapes. Drag a layer in the Layers panel to change what appears in front. Download a .pcraft project to keep your work editable."),
                ("Remove a background", "Select an image layer, then Select → Remove Background. The first use downloads the model. Processing happens on this device; the result is an editable mask. Undo restores the original."),
                ("Add text and fonts", "Choose the Type tool and click your canvas. Choose Fonts & import in the top tools to load TTF/OTF files or use this PC’s fonts. Save before applying fonts: it restarts the editor."),
                ("Save a project and export an image", "Save a .pcraft project to continue editing later. Export a PNG or JPEG for sharing. Recovery copies stay in this browser profile and can be cleared by browser or school settings; keep downloaded copies too."),
            ] {egui::CollapsingHeader::new(title).show(ui,|ui|{ui.label(body);});}
            ui.add_space(16.0);
            ui.label(RichText::new("Editing happens on this device. Download your project to keep a copy.").color(t.text_dim));
            ui.add_space(12.0);
            ui.horizontal_wrapped(|ui| {
                if ui.link("PhotoCraft project & credits").clicked(){crate::links::open(app,ui.ctx(),crate::links::GITHUB);}
                ui.label("•");
                if ui.link("More tutorials").clicked(){crate::links::open(app,ui.ctx(),crate::links::TUTORIALS);}
            });
            ui.add_space(20.0);
        });
    });
}

pub(crate) fn start_screen_drop_hint(_app: &PhotocraftApp) -> std::borrow::Cow<'static,str> {
    "Drop an image or PSD anywhere to open it.".into()
}

#[cfg(test)]
mod school_start_tests {
    use super::*;
    #[test]
    fn preset_actions_open_reviewable_dialogs_without_creating_documents() {
        for preset in SCHOOL_PRESETS {
            let mut app = PhotocraftApp::new(photocraft_engine::Session::new(),crate::Services::default());
            new_project(&mut app,Some(preset));
            assert!(app.session.documents().is_empty());
            let fields = &app.ui.dialogs.last().unwrap().fields;
            assert_eq!(fields["width"].as_u64(),Some(u64::from(preset.1)));
            assert_eq!(fields["height"].as_u64(),Some(u64::from(preset.2)));
            assert_eq!(fields["__category"],"Classroom");
            let params = crate::new_doc_ui::command_params(fields);
            app.run("file.new",params).unwrap();
            assert_eq!(app.session.active().unwrap().doc.size.width,preset.1);
        }
    }
}
