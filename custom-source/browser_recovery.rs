//! Local-only recovery and clipboard services for the school browser host.
use std::sync::{Arc, Mutex, PoisonError};
use js_sys::{Array, Function, Object, Reflect, Uint8Array};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use photocraft_ui_egui::{Recoverable, Services};
const MAX_BYTES: u32 = 64 * 1024 * 1024;
type Outcomes = Vec<(u64, u64, Result<(), String>)>;
struct Entry { key: String, name: String, path: Option<String>, bytes: Vec<u8> }
#[derive(Default)]
struct State { entries: Vec<Entry>, outcomes: Outcomes }
#[derive(Clone, Default)]
pub struct Bridge(Arc<Mutex<State>>);
fn js(error: JsValue) -> String { error.as_string().unwrap_or_else(|| format!("{error:?}")) }
fn invoke(name: &str, argument: &JsValue) -> Result<js_sys::Promise, String> {
    let host = web_sys::window().ok_or("no browser window")?.parent().map_err(js)?.ok_or("no host window")?;
    let function: Function = Reflect::get(&host, &JsValue::from_str(name)).map_err(js)?.dyn_into().map_err(|_| "host feature unavailable")?;
    let value = function.call1(&host, argument).map_err(js)?;
    Ok(js_sys::Promise::resolve(&value))
}
fn field(value: &JsValue, name: &str) -> Result<JsValue, String> { Reflect::get(value, &JsValue::from_str(name)).map_err(js) }
fn set(object: &Object, name: &str, value: &JsValue) -> Result<(), String> {
    Reflect::set(object, &JsValue::from_str(name), value).map_err(js).map(|_| ())
}
pub async fn load() -> Option<Bridge> {
    let promise = invoke("photocraftRecoveryLoad", &JsValue::NULL).ok()?;
    let value = match JsFuture::from(promise).await {
        Ok(value) => value,
        Err(error) => { log::warn!("Browser recovery unavailable: {}", js(error)); return None; }
    };
    if !Array::is_array(&value) { return None; }
    let values = Array::from(&value);
    if values.length() > 16 { return None; }
    let mut entries = Vec::new();
    let mut total = 0u64;
    for value in values.iter() {
        let record = (|| -> Result<Entry, String> {
            let key = field(&value, "key")?.as_string().ok_or("missing recovery key")?;
            let name = field(&value, "name")?.as_string().ok_or("missing document name")?;
            if key.len() > 256 || name.len() > 1024 { return Err("recovery metadata too long".into()); }
            let data: Uint8Array = field(&value, "bytes")?.dyn_into().map_err(|_| "invalid snapshot bytes")?;
            if data.length() > MAX_BYTES { return Err("recovery snapshot too large".into()); }
            total = total.saturating_add(u64::from(data.length()));
            if total > 128 * 1024 * 1024 { return Err("recovery data exceeds memory budget".into()); }
            Ok(Entry { key, name, path: field(&value, "path")?.as_string(), bytes: data.to_vec() })
        })();
        match record { Ok(entry) => entries.push(entry), Err(error) => log::warn!("Recovery entry skipped: {error}") }
    }
    Some(Bridge(Arc::new(Mutex::new(State {entries, outcomes: Vec::new()}))))
}
pub fn attach(services: &mut Services, bridge: Option<Bridge>) {
    let Some(bridge) = bridge else { return };
    let saves = bridge.clone();
    services.autosave = Some(Box::new(move |doc, revision, path| {
        let bytes = photocraft_format::save_to_bytes(doc, &Default::default()).map_err(|error| error.to_string())?;
        if bytes.len() > MAX_BYTES as usize { return Err("Recovery snapshot exceeds 64 MiB; download a .pcraft copy".into()); }
        let object = Object::new();
        set(&object, "docId", &JsValue::from_str(&doc.id.0.to_string()))?;
        set(&object, "revision", &JsValue::from_str(&revision.to_string()))?;
        set(&object, "name", &JsValue::from_str(&doc.name))?;
        set(&object, "path", &path.map(JsValue::from_str).unwrap_or(JsValue::NULL))?;
        set(&object, "bytes", &Uint8Array::from(bytes.as_slice()))?;
        let promise = invoke("photocraftRecoverySave", &object)?;
        let state = saves.clone();
        let id = doc.id.0;
        wasm_bindgen_futures::spawn_local(async move {
            let result = JsFuture::from(promise).await.map(|_| ()).map_err(js);
            state.0.lock().unwrap_or_else(PoisonError::into_inner).outcomes.push((id, revision, result));
        });
        Ok(())
    }));
    let results = bridge.clone();
    services.autosave_results = Some(Box::new(move || {
        std::mem::take(&mut results.0.lock().unwrap_or_else(PoisonError::into_inner).outcomes)
    }));
    services.recover = Some(Box::new(move || {
        std::mem::take(&mut bridge.0.lock().unwrap_or_else(PoisonError::into_inner).entries)
            .into_iter().map(|entry| Recoverable {
                key: entry.key, name: entry.name, path: entry.path,
                load: Box::new(move || photocraft_format::load_from_bytes(&entry.bytes).map_err(|error| error.to_string())),
            }).collect()
    }));
    services.discard_autosave = Some(Box::new(|id| {
        if let Ok(promise) = invoke("photocraftRecoveryDiscard", &JsValue::from_str(&id.to_string())) {
            wasm_bindgen_futures::spawn_local(async move { let _ = JsFuture::from(promise).await; });
        }
    }));
    services.adopt_autosave = Some(Box::new(|id, key| {
        let object = Object::new();
        if set(&object, "docId", &JsValue::from_str(&id.to_string())).is_err() || set(&object, "key", &JsValue::from_str(key)).is_err() { return; }
        if let Ok(promise) = invoke("photocraftRecoveryAdopt", &object) {
            wasm_bindgen_futures::spawn_local(async move { let _ = JsFuture::from(promise).await; });
        }
    }));
}
pub fn write_clipboard(bytes: &[u8]) -> Result<(), String> {
    let promise = invoke("photocraftClipboardWrite", &Uint8Array::from(bytes))?;
    wasm_bindgen_futures::spawn_local(async move {
        if let Err(error) = JsFuture::from(promise).await { log::warn!("Browser clipboard write failed: {}", js(error)); }
    });
    Ok(())
}
