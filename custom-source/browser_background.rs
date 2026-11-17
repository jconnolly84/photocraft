//! Async on-device model bridge. No image is uploaded; the host worker returns a mask.
use std::cell::{Cell, RefCell};
use js_sys::{Function, Object, Reflect, Uint8Array};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use photocraft_codecs::{ChannelLayout, EncodeOptions, Image};
use photocraft_doc::Document;
use photocraft_ui_egui::PhotocraftApp;

struct SubjectResult { alpha: Vec<u8>, background: Option<Vec<u8>> }
struct Outcome { document: u64, revision: u64, layer: u64, bounds: [i32; 4], mode: String, result: Result<SubjectResult, String> }
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
    start_tool(doc,layer,revision,"remove")
}
pub fn start_tool(doc: &Document, layer: u64, revision: u64, mode: &str) -> Result<(), String> {
    if BUSY.with(Cell::get) {return Err("Another AI tool is already running. Use Cancel to stop it.".into());}
    if !matches!(mode,"remove"|"select"|"blur"|"replace"|"refine"|"enhance"|"upscale") {return Err("Unknown image tool".into());}
    if matches!(mode,"blur"|"replace") && doc.bounds().size().area()>16_777_216 {return Err("AI backgrounds support canvases up to 16 megapixels. Resize the document first.".into());}
    let target = doc.layer(photocraft_doc::LayerId(layer)).ok_or("select an image layer")?;
    if matches!(mode,"blur"|"replace"|"enhance"|"upscale") && target.clipped {return Err("Release this image's clipping mask before using this tool.".into());}
    let surface = target.surface().ok_or("The image is not rendered yet. Try again after it loads.")?;
    let area = surface.content_bounds().intersect(&doc.bounds());
    let count = u64::from(area.width()) * u64::from(area.height());
    if mode=="upscale" && count>1_048_576 {return Err("2× AI upscaling supports image layers up to 1 megapixel. Use it on a smaller source image.".into());}
    if area.is_empty() || count > 16_777_216 {return Err("AI background removal supports image layers up to 16 megapixels. Resize the image first.".into());}
    let mut pixels = vec![[0u8; 4]; count as usize];
    surface.read_rgba8_into(area, &mut pixels);
    let image = Image::from_u8(area.width(), area.height(), ChannelLayout::Rgba, pixels.into_iter().flatten().collect()).map_err(|e| e.to_string())?;
    let png = photocraft_codecs::encode(&image, photocraft_codecs::Format::Png, &EncodeOptions::default()).map_err(|e| e.to_string())?;
    let (host, function) = parent_function(if mode=="remove" {"photocraftRemoveBackground"} else {"photocraftSubjectTool"})?;
    let object = Object::new();
    if matches!(mode,"refine"|"enhance"|"upscale") {
        if let Some(mask) = target.mask.as_ref().filter(|m| m.enabled) {
            let mut values = Vec::new();
            mask.values_into(area, &mut values);
            let bytes:Vec<u8> = values.into_iter().map(|v|(v.clamp(0.0,1.0)*255.0).round() as u8).collect();
            Reflect::set(&object,&JsValue::from_str("mask"),&Uint8Array::from(bytes.as_slice())).map_err(error)?;
        }
    }
    Reflect::set(&object, &JsValue::from_str("png"), &Uint8Array::from(png.as_slice())).map_err(error)?;
    for (key,value) in [("width",area.width() as i32),("height",area.height() as i32),("canvasWidth",doc.bounds().width() as i32),("canvasHeight",doc.bounds().height() as i32),("left",area.x0),("top",area.y0)] {
        Reflect::set(&object,&JsValue::from_str(key),&JsValue::from_f64(value as f64)).map_err(error)?;
    }
    Reflect::set(&object,&JsValue::from_str("mode"),&JsValue::from_str(mode)).map_err(error)?;
    let promise = js_sys::Promise::resolve(&function.call1(&host, &object).map_err(error)?);
    let document = doc.id.0;
    let bounds = [area.x0, area.y0, area.width() as i32, area.height() as i32];
    let mode = mode.to_string();
    BUSY.with(|busy| busy.set(true));
    wasm_bindgen_futures::spawn_local(async move {
        let result = async {
            let value = JsFuture::from(promise).await.map_err(error)?;
            let alpha = if mode=="remove" {value.clone()} else {Reflect::get(&value,&JsValue::from_str("alpha")).map_err(error)?};
            let bytes: Uint8Array = alpha.dyn_into().map_err(|_| "Invalid model mask bytes")?;
            if !matches!(mode.as_str(),"enhance"|"upscale") && u64::from(bytes.length()) != count {return Err("Model mask dimensions do not match the image".into());}
            let background = if matches!(mode.as_str(),"blur"|"replace"|"enhance"|"upscale") {
                let bytes: Uint8Array = Reflect::get(&value,&JsValue::from_str("background")).map_err(error)?.dyn_into().map_err(|_| "Invalid background pixels")?;
                if bytes.length() as u64 > 16_777_216*4 {return Err("Background is too large".into());}
                Some(bytes.to_vec())
            }else{None};
            Ok(SubjectResult {alpha:bytes.to_vec(),background})
        }.await;
        DONE.with(|done| done.borrow_mut().push(Outcome {document, revision, layer, bounds, mode, result}));
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
        let mode = outcome.mode.as_str();
        let result = outcome.result.and_then(|data| if mode=="remove" {
            photocraft_engine::cutout_cmds::apply_model_mask(&mut app.session,outcome.document,outcome.revision,outcome.layer,outcome.bounds,data.alpha).map_err(|e| e.to_string())
        }else{
            photocraft_engine::cutout_cmds::apply_subject_tool(&mut app.session,outcome.document,outcome.revision,outcome.layer,outcome.bounds,mode,data.alpha,data.background).map_err(|e|e.to_string())
        });
        let (message, success) = match result {
            Ok(()) => (match mode {"select"=>"Subject selected locally. Use selection tools to refine it.",
                "blur"=>"Background blurred. The original image is kept hidden underneath. Undo restores it.",
                "replace"=>"Background replaced. Subject and background are separate layers. Undo restores the original.",
                "refine"=>"Cutout refined. Original pixels are unchanged. Undo restores the previous mask.",
                "enhance"=>"Image enhanced on a new layer. The original is hidden underneath. Undo restores it.",
                "upscale"=>"2× AI source created in a new Smart Object. Size and position are kept; transform it to enlarge. Undo restores the original.",
                _=>"Background removed locally. Undo restores the original."}.to_string(), true),
            Err(reason) => (format!("AI tool did not change the document: {reason}"), false),
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
