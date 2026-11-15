/* Buildless classroom guide. Progress stays in this browser; no analytics or uploads. */
(() => {
  'use strict';
  const main = document.getElementById('main');
  const nav = document.getElementById('chapter-nav');
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menu-toggle');
  const progressKey = 'photocraft.flux-guide.progress.v1';
  const assets = {
    trainer: {name:'The FLUX trainer',file:'trainer-original.png',role:'Download · Place Embedded',description:'The original product image includes a studio backdrop. Place it in your advert, then practise background removal on its own layer.',copy:false},
    background: {name:'Cobalt grid background',file:'background-grid.png',role:'Download · Place Embedded',description:'An A4 portrait graphic foundation. Keep it on its own background layer, or use it as a starting point for a different composition.',copy:false},
    streaks: {name:'Energy streaks',file:'energy-streaks.png',role:'Blend mode · Screen',description:'Bright marks on black. Place these as a separate layer, try Screen and lower the opacity if the effect overwhelms the trainer.',copy:true},
    badge: {name:'The FLUX 01 badge',file:'flux-badge.png',role:'Copy image · Multiply',description:'A dark stamp on white. Copy and paste it into PhotoCraft, then test Multiply to combine it with the background.',copy:true}
  };
  let course;
  let completed = new Set();
  let toastTimer;
  let storageAvailable = true;
  let projectAvailability;
  const optionalProject = 'assets/downloads/flux-advert.pcraft';
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const assetPath = name => `assets/downloads/${name}`;
  function toast(message) {
    const node = document.getElementById('toast');
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {node.hidden = true;}, 6500);
  }
  function readProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey) || '[]');
      if (Array.isArray(saved)) completed = new Set(saved.filter(id => course.lessons.some(lesson => lesson.id === id)));
    } catch {storageAvailable = false;}
  }
  function saveProgress() {
    try {localStorage.setItem(progressKey, JSON.stringify([...completed]));}
    catch {storageAvailable = false; toast('Chapter ticks work for this visit, but this browser could not save them.');}
  }
  function updateProgress() {
    const count = completed.size;
    document.getElementById('progress-count').textContent = `${count} / ${course.lessons.length}`;
    const bar = document.getElementById('progress-bar');
    bar.max = course.lessons.length;
    bar.value = count;
    bar.textContent = `${count} of ${course.lessons.length}`;
    renderNavigation();
  }
  function routeName() {
    let route;
    try {route = decodeURIComponent(location.hash.slice(1));} catch {route = 'overview';}
    return route || 'overview';
  }
  function renderNavigation() {
    const active = routeName();
    let phase = '';
    nav.innerHTML = course.lessons.map(lesson => {
      const heading = lesson.phase !== phase ? `<p class="nav-phase">${escapeHTML(phase = lesson.phase)}</p>` : '';
      return `${heading}<a class="chapter-link${active === lesson.id ? ' active' : ''}" href="#${lesson.id}"${active === lesson.id ? ' aria-current="page"' : ''}><span class="num">${lesson.number}</span><span>${escapeHTML(lesson.short)}</span>${completed.has(lesson.id) ? '<span class="done" aria-label="Completed">✓</span>' : ''}</a>`;
    }).join('');
    document.querySelector('.overview-link').setAttribute('aria-current',active === 'overview' ? 'page' : 'false');
  }
  function footer() {
    return `<footer class="footer"><span>PhotoCraft Studio Guide · FLUX is a fictional classroom project.</span><span><a href="#teacher">Teacher notes &amp; credits</a> · <a href="../" target="_blank" rel="noopener">Open PhotoCraft ↗</a></span></footer>`;
  }
  function breadcrumbs(current) {
    return `<div class="breadcrumbs"><a href="#overview">Studio guide</a><span aria-hidden="true">/</span><span>${escapeHTML(current)}</span></div>`;
  }
  function overview() {
    document.title = 'Make Your Move — PhotoCraft Studio Guide';
    return `<div class="page-inner">
      <div class="eyebrow"><span class="dot" aria-hidden="true"></span> GCSE design workshop · PhotoCraft</div>
      <section class="hero" aria-labelledby="hero-heading"><div class="hero-copy"><div class="eyebrow">THE FLUX PROJECT / 01</div><h1 id="hero-heading">MAKE<br>YOUR<br><span>MOVE.</span></h1><p>Turn a trainer photograph into a bold advert. Build the layers, shape the message and make the design your own.</p><div class="hero-actions"><a class="button button-primary" href="#01-brief">Start the project <span aria-hidden="true">→</span></a><a class="button button-light" href="${assetPath('practice-pack.zip')}" download>Get the assets <span aria-hidden="true">↓</span></a></div><div class="hero-note"><span>${course.lessons.length} bite-size chapters</span><b>Silent demos + written steps</b></div></div><div class="hero-visual"><div class="poster-frame"><img src="${assetPath('final-advert.png')}" alt="Example FLUX trainer advert with bold typography and electric colours" width="2480" height="3508" fetchpriority="high"></div><div class="poster-caption">BUILD IT.<br>THEN MAKE IT YOURS.<span>FICTIONAL BRAND · REAL DESIGN SKILLS</span></div></div></section>
      <div class="summary-strip"><div><strong>Think like a designer</strong><span>Audience, hierarchy, contrast and a clear message.</span></div><div><strong>Learn by doing</strong><span>Editable layers, image placement, masks, type and effects.</span></div><div><strong>Keep your work</strong><span>Save an editable project and export a finished image.</span></div></div>
      <section class="section" aria-labelledby="chapters-heading"><div class="section-head"><h2 id="chapters-heading" class="display">YOUR ROUTE TO THE FINISH.</h2><p>Follow the sequence the first time. Return to any chapter when you need a reminder. Chapter ticks are yours to control.</p></div><div class="chapter-grid">${course.lessons.map(lesson => `<a class="chapter-card" href="#${lesson.id}"><span class="card-number">${lesson.number}</span><div><h3>${escapeHTML(lesson.title)}</h3><p>${escapeHTML(lesson.phase)} · about ${lesson.time} guided practice</p>${completed.has(lesson.id) ? '<span class="completed-tag">✓ Marked complete</span>' : ''}</div><span class="arrow" aria-hidden="true">↗</span></a>`).join('')}</div></section>
      <section class="asset-banner"><div><h2>YOUR CREATIVE STARTER KIT.</h2><p>Original practice imagery, a graphic background, blend-mode overlays and a badge. Download the pack or copy individual graphics.</p></div><a class="button button-primary" href="#assets">Explore the assets <span aria-hidden="true">→</span></a></section>
      <div class="source-note"><strong>A starting point, not a template to trace.</strong> FLUX is a fictional brand. The supplied product photograph is AI-generated practice imagery; it is not evidence about a real product. Choose your own layout and explain your decisions. You do not need an account to follow this guide. Editing happens in PhotoCraft on your device; download your project to keep a copy.</div>${footer()}</div>`;
  }
  function assetCard(key, inline = false) {
    const asset = assets[key];
    if (!asset) return '';
    return `<article class="asset-card" data-asset="${key}"><a class="asset-visual" href="${assetPath(asset.file)}" target="_blank" rel="noopener" aria-label="Open full-size ${escapeHTML(asset.name)}"><img src="${assetPath(asset.file)}" alt="${escapeHTML(asset.name)} practice asset" loading="lazy"></a><div class="asset-body"><span class="asset-role">${escapeHTML(asset.role)}</span><h3>${escapeHTML(asset.name)}</h3><div class="file-name">${asset.file}</div><p>${escapeHTML(asset.description)}</p><div class="asset-actions"><a class="button button-dark button-small" href="${assetPath(asset.file)}" download>Download PNG ↓</a>${asset.copy ? `<button class="button button-quiet button-small" type="button" data-copy-image="${key}">Copy image</button>` : ''}</div><p class="copy-feedback" role="status" aria-live="polite"></p></div></article>`;
  }
  function media(lesson) {
    const screenshot = `<figure class="screenshot${!lesson.video ? ' final-shot' : ''}"><a href="${lesson.image}" target="_blank" rel="noopener" aria-label="Open full-size screenshot: ${escapeHTML(lesson.title)}"><img src="${lesson.image}" alt="${escapeHTML(lesson.imageAlt)}" loading="lazy"></a><figcaption>${lesson.video ? 'PhotoCraft reference screenshot. Open the image to inspect the controls at full size.' : 'Example outcome. Use it to analyse the design, then develop your own response.'}</figcaption></figure>`;
    return `${lesson.video ? `<section class="media-card" aria-label="Silent demonstration: ${escapeHTML(lesson.title)}"><div class="media-top"><span><span class="play-dot" aria-hidden="true">▶</span> &nbsp; SEE THE SKILL</span><span class="silent-label">SILENT CLIP</span></div><video controls playsinline preload="metadata" poster="${lesson.image}" aria-label="Short silent PhotoCraft demonstration: ${escapeHTML(lesson.title)}"><source src="${lesson.video}" type="video/mp4"><a href="${lesson.video}" download>Download this demonstration</a></video><p class="media-note">A short demonstration of one action. Pause and replay, then follow the written steps for the complete skill. No sound is needed.${lesson.videoNote ? ' ' + escapeHTML(lesson.videoNote) : ''}${lesson.id === '07-remove-background' ? ' The first AI run also downloads the model; wait for the completion message.' : ''}</p></section>` : ''}${screenshot}`;
  }
  function lessonPage(lesson) {
    document.title = `${lesson.title} — PhotoCraft Studio Guide`;
    const index = course.lessons.indexOf(lesson);
    const previous = course.lessons[index - 1];
    const next = course.lessons[index + 1];
    return `<div class="page-inner">${breadcrumbs(`Chapter ${lesson.number}`)}<header class="lesson-heading"><div class="lesson-meta"><span class="phase-pill">${escapeHTML(lesson.phase)}</span><span>Chapter ${lesson.number} / ${course.lessons.length} · about ${lesson.time}</span></div><h1>${escapeHTML(lesson.title)}</h1><p class="intro">${escapeHTML(lesson.intro)}</p></header>
      <div class="lesson-workspace"><div><ol class="steps">${lesson.steps.map(step => `<li><h3>${escapeHTML(step.title)}</h3><p>${escapeHTML(step.text)}</p></li>`).join('')}</ol><aside class="notice warning"><h3>Watch out</h3><p>${escapeHTML(lesson.pitfall)}</p></aside>${lesson.asset ? `<div class="asset-inline">${assetCard(lesson.asset,true)}</div>` : ''}</div><div class="media-column">${media(lesson)}</div></div>
      <section class="checkpoint"><span class="checkpoint-icon" aria-hidden="true">✓</span><div><h3>CHECK YOUR WORK</h3><p>${escapeHTML(lesson.check)}</p></div></section>
      <section class="reflection"><div><h3>Why this matters</h3><p>${escapeHTML(lesson.reason)}</p></div><div><h3>Push it further</h3><p>${escapeHTML(lesson.challenge)}</p></div></section>
      <div class="completion-row"><button class="button complete-button${completed.has(lesson.id) ? ' is-complete' : ''}" type="button" data-complete="${lesson.id}" aria-pressed="${completed.has(lesson.id)}">${completed.has(lesson.id) ? '✓ Chapter marked complete' : 'Mark this chapter complete'}</button><p>${storageAvailable ? 'This tick is saved in your browser, not sent to your teacher. Check the work yourself before moving on.' : 'Browser storage is unavailable. Ticks will last only for this visit.'}</p></div>
      <nav class="lesson-pagination" aria-label="Previous and next chapter"><a href="#${previous ? previous.id : 'overview'}"><small>← ${previous ? 'Previous chapter' : 'Back to the start'}</small>${escapeHTML(previous ? previous.title : 'Project overview')}</a><a href="#${next ? next.id : 'assets'}"><small>${next ? 'Next chapter' : 'Keep exploring'} →</small>${escapeHTML(next ? next.title : 'Practice assets')}</a></nav>${footer()}</div>`;
  }
  function assetPage() {
    document.title = 'Practice assets — PhotoCraft Studio Guide';
    return `<div class="page-inner">${breadcrumbs('Practice assets')}<div class="eyebrow"><span class="dot" aria-hidden="true"></span> THE FLUX TOOLKIT</div><h1 class="wide-heading">GOOD INGREDIENTS.<br>YOUR OWN RECIPE.</h1><p class="page-lead">Use the supplied files to learn the workflow, then make a different design. Download the trainer and background for Place Embedded. Copy the badge or streaks to practise clipboard placement.</p><div class="hero-actions"><a class="button button-dark" href="${assetPath('practice-pack.zip')}" download>Download the practice pack ↓</a><a class="button button-quiet" href="${assetPath('final-advert.png')}" target="_blank" rel="noopener">View the screen preview ↗</a><span id="project-download-slot"></span></div><div class="section asset-grid">${Object.keys(assets).map(key => assetCard(key)).join('')}</div><aside class="notice"><h3>If Copy image is blocked</h3><p>Open the full-size PNG, right-click it and choose Copy image. If school settings still block clipboard access, download the PNG and use File → Place Embedded in PhotoCraft. Copy image address provides a link, not image pixels.</p></aside><div class="source-note"><strong>Asset credits and use.</strong> FLUX is a fictional classroom brand. The example is a screen preview, not a print-resolution export. The trainer photograph is AI-generated practice imagery; the background and overlays are original teaching graphics. Keep a note of this source in your project. <a href="${assetPath('ASSET-NOTICES.txt')}" target="_blank" rel="noopener">Read the asset notes</a>. Bebas Neue and Inter retain their original <a href="assets/fonts/bebasneue/OFL.txt" target="_blank" rel="noopener">Bebas Neue</a> and <a href="assets/fonts/inter/OFL.txt" target="_blank" rel="noopener">Inter</a> font licences. If you add other imagery, check its licence and record its source.</div>${footer()}</div>`;
  }
  function teacherPage() {
    document.title = 'Teacher notes — PhotoCraft Studio Guide';
    return `<div class="page-inner">${breadcrumbs('Teacher notes')}<div class="eyebrow"><span class="dot" aria-hidden="true"></span> PLAN · DEMONSTRATE · DEVELOP</div><h1 class="wide-heading">TEACH THE TOOLS.<br>ASSESS THE THINKING.</h1><p class="page-lead">A practical GCSE-friendly project that joins technical editing to visual communication. Adapt the level, duration and evidence requirements to your class and specification; this guide does not claim to meet a particular exam board’s assessment rules.</p><div class="teacher-grid">
      <section class="teacher-box"><h2>A workable lesson sequence</h2><ol><li><strong>Lesson 1:</strong> discuss the brief, sketch alternatives, set up the canvas and build a layered product composition. Model selecting the correct layer before each action.</li><li><strong>Lesson 2:</strong> refine type, contrast, masks and blending. Use paired feedback before saving and exporting.</li><li><strong>Optional development lesson:</strong> make an original audience-led variation, adapt the format and write an evidence-based evaluation.</li></ol><p style="margin-top:16px;margin-bottom:0">Allow roughly 2–3 lessons of 50–60 minutes, depending on starting skills and how much independent development you expect. The chapter timings describe guided practice, not a deadline for finishing an original advert.</p></section>
      <section class="teacher-box"><h2>Before the lesson</h2><ul><li>Open PhotoCraft in the school browser and test downloading, extracting ZIP files and opening a project.</li><li>Test clipboard image permissions. Place Embedded is the reliable alternative when copying is blocked.</li><li>Run Remove Background once to check the model download and performance. Allow additional time on slower devices.</li><li>Check where school downloads are saved and whether browser profiles are cleared between sessions.</li><li>Keep the guide and editor in separate tabs or windows so demonstrations do not replace student work.</li></ul></section>
      <section class="teacher-box"><h2>Evidence worth collecting</h2><ul><li>A short statement of audience and intention, plus two initial composition sketches.</li><li>A screenshot of an organised layer stack and a purposeful mask or blending decision.</li><li>One earlier version and an explanation of a refinement made after testing or feedback.</li><li>An editable .pcraft project and an inspected final PNG or JPEG.</li><li>A concise evaluation linking specific visual choices to the intended communication.</li></ul></section>
      <section class="teacher-box"><h2>Support without flattening the challenge</h2><ul><li><strong>Support:</strong> supply the palette, headline and four essential layer names; focus first on accurate selection, proportion and readability.</li><li><strong>Core:</strong> require independent layer organisation, a convincing cut-out and a clear three-level hierarchy.</li><li><strong>Stretch:</strong> change the target audience, create an alternative layout and adapt the work for a square digital format.</li><li>Invite students to justify when an effect is unnecessary. More effects do not automatically mean stronger design.</li></ul></section>
      <section class="teacher-box full"><h2>Questions that reveal understanding</h2><ul><li>Why did you choose that product angle and scale? What is the viewer meant to notice first?</li><li>When does Auto-Select help, and when does selecting directly in Layers give you more control?</li><li>Why does Screen suit a light-on-black graphic? Why might Multiply suit a dark-on-white stamp?</li><li>How did you distinguish a layer blend mode from a layer style in Blending Options?</li><li>What can your editable project retain that the exported image cannot?</li><li>Which change improved communication, and what evidence supports that judgement?</li></ul></section>
      <section class="teacher-box full"><h2>Originality, credits and AI literacy</h2><p>The fictional product and generated trainer photograph make a shared practice brief possible without borrowing a real sports brand’s campaign. Identify the supplied photograph as AI-generated practice imagery. Ask students to record sources for any extra images, fonts or copy, check permissions and follow your school’s approach to AI-assisted material and assessed work.</p><p>For independent assessed work, decide which supplied assets and demonstrations are appropriate under your own specification and centre policy. Encourage original intentions and development rather than identical copies of the example.</p><p style="margin-bottom:0">The guide’s progress ticks stay in the browser and are self-reported. They are not teacher tracking or proof that a skill has been mastered. Project images are not uploaded by this tutorial.</p></section>
      </div><div class="asset-banner"><div><h2>READY TO GET STARTED?</h2><p>Give students the practice pack and begin with the creative brief.</p></div><a class="button button-primary" href="#01-brief">Go to chapter 01 →</a></div>${footer()}</div>`;
  }
  async function copyImage(key, button) {
    const asset = assets[key];
    const feedback = button.closest('.asset-card').querySelector('.copy-feedback');
    button.disabled = true;
    feedback.textContent = '';
    try {
      if (!navigator.clipboard?.write || !window.ClipboardItem) throw new Error('Clipboard image access is unavailable.');
      // Begin the write in the user gesture; a promised blob also works in
      // browsers that require clipboard activation before asynchronous fetching.
      const image = fetch(assetPath(asset.file)).then(response => {
        if (!response.ok) throw new Error('The practice image could not be loaded.');
        return response.blob();
      }).then(blob => new Blob([blob], {type:'image/png'}));
      image.catch(() => {}); // Avoid a later unhandled fetch error if permission is denied first.
      await navigator.clipboard.write([new ClipboardItem({'image/png':image})]);
      feedback.textContent = 'Image copied. Click inside PhotoCraft, then press Ctrl+V.';
      toast('Image copied — return to PhotoCraft and press Ctrl+V.');
    } catch {
      feedback.textContent = 'Clipboard blocked. Open the full-size image and use right-click → Copy image, or download it and use Place Embedded.';
    } finally {button.disabled = false;}
  }
  function attachPageEvents() {
    const projectSlot = main.querySelector('#project-download-slot');
    if (projectSlot) {
      projectAvailability ||= fetch(optionalProject,{method:'HEAD'}).then(response => response.ok && response.headers.get('content-length') !== '0' && !String(response.headers.get('content-type')).includes('text/html')).catch(() => false);
      projectAvailability.then(available => {
        if (!available || !projectSlot.isConnected) return;
        const link = document.createElement('a');
        link.className = 'button button-quiet'; link.href = optionalProject; link.download = 'flux-advert.pcraft';
        link.textContent = 'Download editable example ↓';
        projectSlot.replaceChildren(link);
      });
    }
    main.querySelectorAll('[data-copy-image]').forEach(button => button.addEventListener('click',() => copyImage(button.dataset.copyImage,button)));
    main.querySelectorAll('[data-complete]').forEach(button => button.addEventListener('click',() => {
      const id = button.dataset.complete;
      completed.has(id) ? completed.delete(id) : completed.add(id);
      saveProgress();
      updateProgress();
      button.classList.toggle('is-complete',completed.has(id));
      button.setAttribute('aria-pressed',String(completed.has(id)));
      button.textContent = completed.has(id) ? '✓ Chapter marked complete' : 'Mark this chapter complete';
    }));
    main.querySelectorAll('video').forEach(video => {
      video.addEventListener('play',() => {main.querySelectorAll('video').forEach(other => {if (other !== video) other.pause();});});
      video.addEventListener('error',() => {
        const note = video.closest('.media-card').querySelector('.media-note');
        note.textContent = 'The clip could not be loaded. Use the written steps and reference screenshot, or try reloading this guide.';
      });
    });
  }
  function render({focus = false} = {}) {
    main.querySelectorAll('video').forEach(video => video.pause());
    const route = routeName();
    const lesson = course.lessons.find(item => item.id === route);
    main.innerHTML = lesson ? lessonPage(lesson) : route === 'assets' ? assetPage() : route === 'teacher' ? teacherPage() : overview();
    updateProgress();
    attachPageEvents();
    sidebar.classList.remove('open');
    menuToggle.setAttribute('aria-expanded','false');
    window.scrollTo({top:0,behavior:'instant'});
    if (focus) main.focus({preventScroll:true});
  }
  menuToggle.addEventListener('click',() => {
    const open = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open',open);
    menuToggle.setAttribute('aria-expanded',String(open));
  });
  document.addEventListener('keydown',event => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open'); menuToggle.setAttribute('aria-expanded','false'); menuToggle.focus();
    }
  });
  document.addEventListener('click',event => {
    if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
      sidebar.classList.remove('open'); menuToggle.setAttribute('aria-expanded','false');
    }
  });
  const resetDialog = document.getElementById('reset-dialog');
  document.getElementById('reset-progress').addEventListener('click',() => resetDialog.showModal());
  document.getElementById('cancel-reset').addEventListener('click',() => resetDialog.close());
  document.getElementById('confirm-reset').addEventListener('click',() => {
    completed.clear(); saveProgress(); resetDialog.close(); render(); toast('Chapter ticks reset. Your projects and downloads are untouched.');
  });
  window.addEventListener('message',event => {
    if (event.origin === location.origin && event.source === window.parent && event.data?.type === 'photocraft-tutorial-pause') {
      main.querySelectorAll('video').forEach(video => video.pause());
    }
  });
  window.addEventListener('hashchange',() => {if (course) render({focus:true});});
  fetch('lessons.json').then(response => {
    if (!response.ok) throw new Error('Course content unavailable');
    return response.json();
  }).then(data => {
    if (!Array.isArray(data.lessons) || !data.lessons.length) throw new Error('Course content invalid');
    course = data; readProgress(); render();
  }).catch(() => {
    main.innerHTML = `<div class="error-page"><h1>THE GUIDE COULDN’T LOAD.</h1><p>Try reloading this page. You can still download the assets and continue in PhotoCraft.</p><div class="hero-actions"><a class="button button-dark" href="${assetPath('practice-pack.zip')}" download>Download practice assets ↓</a><a class="button button-quiet" href="../" target="_blank" rel="noopener">Open PhotoCraft ↗</a></div></div>`;
  });
})();
