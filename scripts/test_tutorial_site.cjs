/* Validate tutorial content, local links and the actual shipped demonstrations. */
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const args = process.argv.slice(2);
const allowMissing = args.includes('--allow-missing-media');
const probe = args.includes('--probe');
const siteIndex = args.indexOf('--site');
const root = siteIndex >= 0 ? path.resolve(args[siteIndex + 1] || '') : path.resolve(__dirname,'../host/tutorial');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--site') {i++; continue;}
  if (!['--allow-missing-media','--probe'].includes(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
}
const errors = [];
const deferred = [];
const checked = new Set();
const expect = (condition,message) => {if (!condition) errors.push(message);};
function read(relative) {
  try {return fs.readFileSync(path.join(root,relative),'utf8');}
  catch (error) {errors.push(`Cannot read ${relative}: ${error.message}`); return '';}
}
let course;
try {course = JSON.parse(read('lessons.json'));}
catch (error) {errors.push(`Invalid lessons.json: ${error.message}`); course = {lessons:[]};}
const lessons = Array.isArray(course.lessons) ? course.lessons : [];
const missingAllowed = new Set(['assets/downloads/final-advert.png','assets/downloads/practice-pack.zip']);
for (const lesson of lessons) {
  if (lesson.image) missingAllowed.add(lesson.image);
  if (lesson.video) missingAllowed.add(lesson.video);
}
function checkLocal(reference,base = '.',context = 'local asset') {
  if (!reference || reference.includes('${') || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference)) return;
  const relative = reference.split(/[?#]/)[0];
  if (!relative) return;
  const absolute = path.resolve(root,base,decodeURIComponent(relative));
  const key = path.relative(root,absolute).split(path.sep).join('/');
  if (checked.has(absolute)) return absolute;
  checked.add(absolute);
  let stat;
  try {stat = fs.statSync(absolute);}
  catch {
    if (allowMissing && missingAllowed.has(key)) deferred.push(key);
    else errors.push(`Missing ${context}: ${key}`);
    return;
  }
  if (stat.isDirectory()) {
    expect(fs.existsSync(path.join(absolute,'index.html')),`Directory link has no index.html: ${key}`);
  } else {
    expect(stat.size > 0,`Empty ${context}: ${key}`);
    const extension = path.extname(absolute).toLowerCase();
    if (extension === '.png') {
      const header = Buffer.alloc(24);
      const file = fs.openSync(absolute,'r');
      fs.readSync(file,header,0,24,0); fs.closeSync(file);
      expect(header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`Invalid PNG signature: ${key}`);
      expect(header.readUInt32BE(16) > 0 && header.readUInt32BE(20) > 0,`Invalid PNG dimensions: ${key}`);
    } else if (['.jpg','.jpeg'].includes(extension)) {
      const header = Buffer.alloc(3);
      const file = fs.openSync(absolute,'r');
      fs.readSync(file,header,0,3,0); fs.closeSync(file);
      expect(header[0] === 255 && header[1] === 216 && header[2] === 255,`Invalid JPEG signature: ${key}`);
    }
  }
  return absolute;
}

expect(lessons.length === 15,`Expected 15 chapters, found ${lessons.length}`);
expect(new Set(lessons.map(lesson => lesson.id)).size === lessons.length,'Duplicate chapter IDs');
const clips = [];
const allText = JSON.stringify(course);
for (const [index,lesson] of lessons.entries()) {
  expect(/^\d{2}[a-z]?-[a-z0-9-]+$/.test(lesson.id || ''),`Invalid chapter ID: ${lesson.id}`);
  expect(lesson.number === String(index + 1).padStart(2,'0'),`Chapter numbering is not sequential: ${lesson.id}`);
  for (const field of ['title','short','time','phase','intro','check','pitfall','challenge','reason','image','imageAlt']) {
    expect(typeof lesson[field] === 'string' && lesson[field].trim().length > 0,`${lesson.id}: missing ${field}`);
  }
  expect(Array.isArray(lesson.steps) && lesson.steps.length >= 3,`${lesson.id}: needs substantive written steps`);
  for (const step of lesson.steps || []) {
    expect(typeof step.title === 'string' && step.title.length > 0,`${lesson.id}: unnamed step`);
    expect(typeof step.text === 'string' && step.text.length >= 35,`${lesson.id}: incomplete written step`);
  }
  checkLocal(lesson.image,'.',`${lesson.title} screenshot/example`);
  if (lesson.video) {
    expect(lesson.video === `assets/clips/${lesson.id}.mp4`,`${lesson.id}: unexpected clip filename`);
    const absolute = checkLocal(lesson.video,'.',`${lesson.title} MP4`);
    if (absolute) clips.push({lesson,absolute});
  }
}
expect(lessons.filter(lesson => lesson.video).length === 13,'Exactly 13 app-skill clips must be referenced');
for (const topic of [
  /2480/,/3508/,/300/,/RGB/,/Auto-Select/,/Show Transform Controls/,/Place Embedded/,
  /Layers/,/Ctrl\+V/,/Bebas Neue/,/Inter/,/History/,/Remove Background/,/Screen/,/Multiply/,
  /Blending Options/,/Drop Shadow/,/Stroke/,/\.pcraft/,/PNG/,/JPEG/,/audience/i,/hierarchy/i,
  /Rulers/,/New Guide Layout/,/Snap To/,/non-printing/,/do not appear in the exported advert/
]) expect(topic.test(allText),`Missing required teaching topic: ${topic}`);
expect(!/\b(?:TODO|TBD|coming soon|insert screenshot here)\b/i.test(allText),'Advertised lesson content contains placeholders');

const html = read('index.html');
const css = read('styles.css');
const app = read('app.js');
expect(/<html\b[^>]*lang="en"/i.test(html),'HTML needs an English language declaration');
expect(/<meta\b[^>]*name="viewport"/i.test(html),'Responsive viewport meta is missing');
expect(/id="main"/.test(html) && /class="skip-link"/.test(html),'Main landmark/skip link missing');
expect(/<video controls playsinline preload="metadata"/.test(app),'Video players must have controls and metadata preload');
expect(!/<video[^>]*autoplay/.test(app),'Tutorial clips must not autoplay');
expect(/photocraft-tutorial-pause/.test(app) && /event\.origin === location\.origin/.test(app) && /event\.source === window\.parent/.test(app),'Embedded guide must accept pause messages only from its same-origin parent');
expect(/ASSET-NOTICES\.txt/.test(app),'Asset provenance link missing');
expect(/AI-generated/.test(app),'Generated practice imagery must be identified');
expect(/projectAvailability/.test(app) && /method:'HEAD'/.test(app),'Optional editable project must be checked before showing its download');

for (const source of [html,app]) {
  for (const match of source.matchAll(/\b(?:src|href)="([^"]+)"/g)) checkLocal(match[1],'.','HTML reference');
}
for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) checkLocal(match[1],'.','CSS asset');
for (const match of app.matchAll(/assetPath\('([^']+)'\)/g)) checkLocal(`assets/downloads/${match[1]}`,'.','download');
for (const match of app.matchAll(/file:'([^']+)'/g)) checkLocal(`assets/downloads/${match[1]}`,'.','practice asset');
for (const name of ['trainer-original.png','background-grid.png','energy-streaks.png','flux-badge.png','final-advert.png','practice-pack.zip','ASSET-NOTICES.txt']) {
  checkLocal(`assets/downloads/${name}`,'.','required practice resource');
}
const project = path.join(root,'assets/downloads/flux-advert.pcraft');
if (fs.existsSync(project)) expect(fs.statSync(project).size > 0,'Editable example .pcraft is empty');

if (probe) {
  for (const {lesson,absolute} of clips) {
    const result = spawnSync(process.env.FFPROBE || 'ffprobe',[
      '-v','error','-show_entries','stream=codec_type,codec_name,duration,width,height,pix_fmt:format=duration','-of','json',absolute
    ],{encoding:'utf8',windowsHide:true});
    if (result.error || result.status !== 0) {
      errors.push(`${lesson.id}: ffprobe failed: ${result.error?.message || result.stderr?.trim() || result.status}`);
      continue;
    }
    let info;
    try {info = JSON.parse(result.stdout);} catch {errors.push(`${lesson.id}: invalid ffprobe output`);continue;}
    const video = info.streams?.filter(stream => stream.codec_type === 'video') || [];
    expect(video.length === 1,`${lesson.id}: expected one video stream`);
    expect(!info.streams?.some(stream => stream.codec_type === 'audio'),`${lesson.id}: clip must be silent (no audio stream)`);
    expect(video[0]?.codec_name === 'h264',`${lesson.id}: MP4 must use H.264`);
    expect(video[0]?.width > 0 && video[0]?.height > 0,`${lesson.id}: invalid video dimensions`);
    const seconds = Number(info.format?.duration || video[0]?.duration);
    expect(Number.isFinite(seconds) && seconds >= 5 && seconds <= 10.5,`${lesson.id}: duration ${seconds}s is outside 5–10.5 seconds`);
  }
}

if (errors.length) {
  console.error(`Tutorial validation failed (${errors.length}):\n` + errors.map(message => `- ${message}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Tutorial valid: ${lessons.length} chapters, ${lessons.reduce((sum,l) => sum + l.steps.length,0)} written steps, ${checked.size} local references${probe ? `; ${clips.length} silent H.264 clips probed` : ''}.`);
}
if (deferred.length) console.log(`Deferred until capture/package (${new Set(deferred).size}): ${[...new Set(deferred)].join(', ')}`);
