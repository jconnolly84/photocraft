"""Encode chronological CUA screen captures as short, silent H.264 demos."""
from pathlib import Path
import json
import shutil
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
captures=Path(sys.argv[1]).resolve()
out=ROOT/'host/tutorial/assets/clips';out.mkdir(parents=True,exist_ok=True)
lessons=json.loads((ROOT/'host/tutorial/lessons.json').read_text(encoding='utf-8'))['lessons']
titles={lesson['id']:lesson['title'] for lesson in lessons}
shutil.copyfile(ROOT/'font-library/fonts/bebasneue/BebasNeue-Regular.ttf',captures/'BebasNeue-Regular.ttf')
provenance=[]
for manifest in sorted(captures.glob('*/capture.json')):
    capture=json.loads(manifest.read_text(encoding='utf-8'))
    if capture['id'] not in titles:
        continue
    shortened = capture['id'] == '07-remove-background'
    if shortened:
        result=json.loads((captures/'07-result/capture.json').read_text(encoding='utf-8'))
        capture['frames']=[frame for frame in capture['frames'] if frame['timeMs'] < 2500] + [
            {'file':'../07-result/'+frame['file'], 'timeMs':2500+frame['timeMs']} for frame in result['frames']]
        capture['durationMs']=2500+result['durationMs']
    frames=capture['frames'];duration=min(10000,capture['durationMs'])
    assert frames and duration>=5000
    lines=['ffconcat version 1.0']
    for i,frame in enumerate(frames):
        end=frames[i+1]['timeMs'] if i+1<len(frames) else capture['durationMs']
        lines += [f"file '{frame['file']}'",f"duration {max(0.001,(end-frame['timeMs'])/1000):.6f}"]
    lines += [f"file '{frames[-1]['file']}'"]
    folder=manifest.parent
    (folder/'concat.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    (folder/'caption.txt').write_text(titles[capture['id']],encoding='utf-8')
    (folder/'footer.txt').write_text('PHOTOCRAFT STUDIO  /  '+('PROCESSING WAIT SHORTENED' if shortened else 'SILENT SKILL DEMO  /  PAUSE + REPLAY'),encoding='utf-8')
    filters="scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x11131b,drawtext=fontfile='../BebasNeue-Regular.ttf':textfile='caption.txt':x=22:y=10:fontsize=24:fontcolor=0xd9ff43,drawtext=fontfile='../BebasNeue-Regular.ttf':textfile='footer.txt':x=22:y=h-31:fontsize=18:fontcolor=0xc3c8d5"
    target=out/(capture['id']+'.mp4')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-safe','0','-f','concat','-i','concat.txt','-vf',filters,'-r','15','-an','-c:v','libx264','-crf','21','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart','-t',str(duration/1000),str(target)],cwd=folder,check=True)
    provenance.append({'lesson':capture['id'],'method':'chronological captures of actual PhotoCraft UI actions','processing_wait_shortened':shortened,'captured_frames':len(frames),'capture_duration_ms':capture['durationMs'],'clip_duration_ms':duration,'audio':False})
    print(f"Encoded {capture['id']}: {len(frames)} genuine frames / {duration/1000:.2f}s / {target.stat().st_size:,} bytes")
(ROOT/'host/tutorial/assets/recording-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf-8')
