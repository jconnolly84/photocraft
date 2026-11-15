"""Create original, deterministic graphic exercise assets (not UI screenshots)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'host/tutorial/assets/downloads'
OUT.mkdir(parents=True,exist_ok=True)
W,H=2480,3508
image=Image.new('RGB',(W,H)); pixels=image.load()
for y in range(H):
    f=y/(H-1)
    color=tuple(round(a+(b-a)*f) for a,b in zip((31,73,248),(15,17,35)))
    for x in range(W):pixels[x,y]=color
draw=ImageDraw.Draw(image)
for x in range(-H,W+H,155):draw.line((x,0,x-H,H),fill=(47,73,157),width=2)
for y in range(0,H,155):draw.line((0,y,W,y),fill=(47,73,157),width=2)
draw.ellipse((W-1140,1160,W+390,2690),fill='#D9FF43')
draw.rectangle((0,3180,W,H),fill='#D9FF43')
draw.polygon([(0,2510),(W,2030),(W,2075),(0,2555)],fill='#FD7958')
draw.rectangle((140,150,185,340),fill='#D9FF43')
image.save(OUT/'background-grid.png',optimize=True)

W,H=1600,1000
image=Image.new('RGB',(W,H),'black');draw=ImageDraw.Draw(image)
for i,(color,thickness) in enumerate([('#FFFFFF',7),('#D9FF43',21),('#4474FF',10),('#FF7958',7),('#D9FF43',5)]):
    y=590+i*53
    draw.line((-100,y,1700,y-560),fill=color,width=thickness)
for x,y,r in [(230,710,12),(860,390,8),(1250,240,14),(1350,650,6)]:draw.ellipse((x-r,y-r,x+r,y+r),fill='#D9FF43')
image.save(OUT/'energy-streaks.png',optimize=True)

image=Image.new('RGB',(1000,350),'white');draw=ImageDraw.Draw(image)
font=ImageFont.truetype(str(ROOT/'font-library/fonts/bebasneue/BebasNeue-Regular.ttf'),170)
inter_path=next(line.split('|')[2].strip() for line in (ROOT/'font-library/fonts/manifest.txt').read_text(encoding='utf-8').splitlines() if line.startswith('Inter |'))
small=ImageFont.truetype(str(ROOT/'font-library'/inter_path),26)
draw.rectangle((18,18,981,331),outline='#10131C',width=9)
draw.text((45,20),'FLUX / 01',font=font,fill='#10131C')
draw.text((49,261),'MAKE YOUR MOVE.  /  FICTIONAL STUDENT CAMPAIGN',font=small,fill='#10131C')
image.save(OUT/'flux-badge.png',optimize=True)

(OUT/'asset-notes.txt').write_text('''FLUX — MAKE YOUR MOVE / PhotoCraft GCSE practice pack

A fictional sportswear campaign for classroom design practice.
trainer-original.png: original AI-generated product visual, unbranded; no real
brand endorsement or product performance claim. Generated with OpenAI image_gen.
background-grid.png: original cobalt/lime graphic, 2480 x 3508 px.
energy-streaks.png: bright graphic on BLACK; use Screen blend mode.
flux-badge.png: dark graphic on WHITE; use Multiply blend mode.

The supplied assets may be downloaded, edited and reused in your own classroom
projects and portfolios. Credit: PhotoCraft Studio classroom practice assets.
Do not present the fictional product as a real commercial product.
The badge uses the open-licensed Bebas Neue typeface (OFL); the licence is in
the PhotoCraft font library. Final project fonts remain editable in .pcraft.
''',encoding='utf-8')
print('Created original background, Screen overlay and Multiply badge graphics.')
