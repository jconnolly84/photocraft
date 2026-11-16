"""Exercise the production poll function with real egui idle repaint scheduling."""
from pathlib import Path
import subprocess
import tempfile
root = Path(__file__).resolve().parents[1]
source = (root / 'custom-source/browser_background.rs').read_text(encoding='utf-8')
poll = source[source.index('pub fn poll('):]
header = r'''
use std::cell::{Cell, RefCell};
struct SubjectResult {alpha:Vec<u8>,background:Option<Vec<u8>>}
struct Outcome { document: u64, revision: u64, layer: u64, bounds: [i32;4], mode:String, result: Result<SubjectResult,String> }
thread_local! {
    static DONE: RefCell<Vec<Outcome>> = const {RefCell::new(Vec::new())};
    static BUSY: Cell<bool> = const {Cell::new(false)};
    static WAKE: RefCell<Option<egui::Context>> = const {RefCell::new(None)};
}
#[derive(Default)] struct Ui {status: String, status_error: bool}
#[derive(Default)] pub struct PhotocraftApp {session: u64, ui: Ui}
struct JsValue;
impl JsValue {fn from_str(_: &str)->Self {Self}}
struct HostFunction;
impl HostFunction {fn call1(&self,_:&(),_:&JsValue)->Result<(),()> {Ok(())}}
fn parent_function(_: &str)->Result<((),HostFunction),()> {Err(())}
mod photocraft_engine {pub mod cutout_cmds {
    pub fn apply_model_mask(s: &mut u64,_:u64,_:u64,_:u64,_:[i32;4],_:Vec<u8>)->Result<(),String> {*s+=1;Ok(())}
    pub fn apply_subject_tool(s:&mut u64,_:u64,_:u64,_:u64,_:[i32;4],_:&str,_:Vec<u8>,_:Option<Vec<u8>>)->Result<(),String> {*s+=1;Ok(())}
}}
'''
tests = r'''
#[cfg(test)] mod tests {
    use super::*;
    fn idle() -> egui::Context {
        let ctx=egui::Context::default();
        for _ in 0..8 {let mut out=ctx.run_ui(egui::RawInput::default(), |_|{}); out.textures_delta.clear();}
        assert!(!ctx.has_requested_repaint(), "test starts with an idle UI");
        ctx
    }
    #[test] fn completed_mask_repaints_without_input_or_busy_timer() {
        let ctx=idle(); let mut app=PhotocraftApp::default();
        BUSY.with(|b|b.set(false));
        DONE.with(|d|d.borrow_mut().push(Outcome {document:1,revision:2,layer:3,bounds:[0,0,1,1],mode:"remove".into(),result:Ok(SubjectResult{alpha:vec![255],background:None})}));
        poll(&mut app,&ctx);
        assert_eq!(app.session,1,"apply the completed edit exactly once");
        assert!(ctx.has_requested_repaint(),"completed mask must request a visible paint even when the worker is no longer busy");
    }
    #[test] fn failed_or_cancelled_result_repaints_status_without_editing() {
        let ctx=idle(); let mut app=PhotocraftApp::default();
        DONE.with(|d|d.borrow_mut().push(Outcome {document:1,revision:2,layer:3,bounds:[0,0,1,1],mode:"remove".into(),result:Err("cancelled".into())}));
        poll(&mut app,&ctx);
        assert_eq!(app.session,0); assert!(app.ui.status_error);
        assert!(ctx.has_requested_repaint(),"error status must become visible without clicking a tool");
    }
}
'''
with tempfile.TemporaryDirectory(prefix='photocraft-repaint-') as directory:
    folder = Path(directory)
    (folder/'src').mkdir()
    (folder/'Cargo.toml').write_text('[package]\nname="photocraft-repaint-regression"\nversion="0.0.0"\nedition="2024"\n[dependencies]\negui={version="=0.37.0",default-features=false}\n', encoding='utf-8')
    code=header+poll+tests
    # Prove that the pre-fix production behavior fails this same idle-frame test.
    before=code.replace('        ctx.request_repaint();', '')
    (folder/'src/lib.rs').write_text(before, encoding='utf-8')
    result=subprocess.run(['cargo','test','--manifest-path',str(folder/'Cargo.toml')],capture_output=True,text=True)
    assert result.returncode != 0 and 'completed mask must request' in result.stdout + result.stderr, result.stdout + result.stderr
    print('Confirmed the pre-fix behavior fails the idle redraw regression.')
    (folder/'src/lib.rs').write_text(code, encoding='utf-8')
    subprocess.run(['cargo','test','--manifest-path',str(folder/'Cargo.toml')],check=True)
