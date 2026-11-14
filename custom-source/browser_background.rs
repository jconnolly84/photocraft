//! Async on-device model bridge. No image is uploaded; the host worker returns a mask.
use std::cell::{Cell, RefCell};
use js_sys::{Function, Object, Reflect, Uint8Array};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use photocraft_codecs::{ChannelLayout, EncodeOptions, Image};
use photocraft_doc::Document;
use photocraft_ui_egui::PhotocraftApp;

struct Outcome { document: u64, revision: u64, layer: u64, bounds: [i32; 4], result: Result<Vec<u8>, String> }
thread_local! {
    static BUSY: Cell<bool> = const {Cell::new(false)};
    static DONE: RefCell<Vec<Outcome>> = const {RefCell::new(Vec::new())};
    static WAKE: RefCell<Option<egui::Context>> = const {RefCell::new(None)};
}
fn error(value: JsValue) -> String {value.as_string().unwrap_or_else(|| format!("{value:?}"))}
fn parent_function(name: &str) -> Result<(web_sys::Window, Function), String> {
    let host = web_sys::window().ok_or("no browser window")?.parent().map_err(error)?.ok_or("no host window")?;
    let function = Reflect::get(&host, &JsValue::from_str(name)).map_err(error)?.dyn_into::<Function>().map_err(|_| "AI background removal is unavailable in this host")?;
    Ok((host, function))
}
pub fn start(doc: &Document, layer: u64, revision: u64) -> Result<(), String> {
    if BUSY.with(Cell::get) {return Err("Background removal is already running. Use Cancel in the toolbar to stop it.".into());}
    let target = doc.layer(photocraft_doc::LayerId(layer)).ok_or("select an image layer")?;
    let surface = target.surface().ok_or("The image is not rendered yet. Try again after it loads.")?;
    let area = surface.content_bounds().intersect(&doc.bounds());
    let count = u64::from(area.width()) * u64::from(area.height());
    if area.is_empty() || count > 16_777_216 {return Err("AI background removal supports image layers up to 16 megapixels. Resize the image first.".into());}
    let mut pixels = vec![[0u8; 4]; count as usize];
    surface.read_rgba8_into(area, &mut pixels);
    let image = Image::from_u8(area.width(), area.height(), ChannelLayout::Rgba, pixels.into_iter().flatten().collect()).map_err(|e| e.to_string())?;
    let png = photocraft_codecs::encode(&image, photocraft_codecs::Format::Png, &EncodeOptions::default()).map_err(|e| e.to_string())?;
    let (host, function) = parent_function("photocraftRemoveBackground")?;
    let object = Object::new();
    Reflect::set(&object, &JsValue::from_str("png"), &Uint8Array::from(png.as_slice())).map_err(error)?;
    let promise = js_sys::Promise::resolve(&function.call1(&host, &object).map_err(error)?);
    let document = doc.id.0;
    let bounds = [area.x0, area.y0, area.width() as i32, area.height() as i32];
    BUSY.with(|busy| busy.set(true));
    wasm_bindgen_futures::spawn_local(async move {
        let result = async {
            let value = JsFuture::from(promise).await.map_err(error)?;
            let bytes: Uint8Array = value.dyn_into().map_err(|_| "Invalid model mask bytes")?;
            if u64::from(bytes.length()) != count {return Err("Model mask dimensions do not match the image".into());}
            Ok(bytes.to_vec())
        }.await;
        DONE.with(|done| done.borrow_mut().push(Outcome {document, revision, layer, bounds, result}));
        BUSY.with(|busy| busy.set(false));
        // A completed promise can arrive between idle logic ticks. Wake a real
        // UI paint instead of waiting for another mouse or keyboard event.
        WAKE.with(|wake| {
            if let Some(ctx) = wake.borrow().as_ref() {ctx.request_repaint();}
        });
    });
    Ok(())
}
pub fn poll(app: &mut PhotocraftApp, ctx: &egui::Context) {
    WAKE.with(|wake| *wake.borrow_mut() = Some(ctx.clone()));
    for outcome in DONE.with(|done| std::mem::take(&mut *done.borrow_mut())) {
        let result = outcome.result.and_then(|alpha| photocraft_engine::cutout_cmds::apply_model_mask(&mut app.session, outcome.document, outcome.revision, outcome.layer, outcome.bounds, alpha).map_err(|e| e.to_string()));
        let (message, success) = match result {
            Ok(()) => ("Background removed locally. Undo restores the original.".to_string(), true),
            Err(reason) => (format!("Background was not changed: {reason}"), false),
        };
        app.ui.status = message.clone();
        app.ui.status_error = !success;
        // Session edits happen in logic; request the next UI pass explicitly
        // so the changed document revision reaches the canvas immediately.
        ctx.request_repaint();
        if let Ok((host, function)) = parent_function("photocraftBackgroundComplete") {
            let _ = function.call1(&host, &JsValue::from_str(&message));
        }
    }
    if BUSY.with(Cell::get) {ctx.request_repaint_after(std::time::Duration::from_millis(100));}
}
