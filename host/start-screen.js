/* Entry-point assistance only; documents remain in the native browser editor. */
(() => {
  const tutorial = document.getElementById('tutorial-dialog');
  const tutorialFrame = document.getElementById('tutorial-frame');
  const openTutorial = () => {
    if (!tutorialFrame.getAttribute('src')) tutorialFrame.src = './tutorial/';
    if (!tutorial.open) tutorial.showModal();
  };
  document.getElementById('open-tutorial').addEventListener('click',openTutorial);
  document.getElementById('close-tutorial').addEventListener('click',()=>tutorial.close());
  tutorial.addEventListener('close',()=>{
    tutorialFrame.contentWindow?.postMessage({type:'photocraft-tutorial-pause'},window.location.origin);
  });
  window.photocraftStartAction = async action => {
    if (action === 'tutorial') {openTutorial(); return;}
    if (action !== 'recovery') throw new Error('Unknown start action');
    const toolbar = document.getElementById('host-toolbar');
    if (toolbar.hidden) document.getElementById('show-toolbar').click();
    const panel = document.getElementById('recovery-tools');
    panel.open = true;
    panel.querySelector('summary').focus();
    const list = document.getElementById('recovery-available');
    const reload = document.getElementById('recovery-reload');
    list.replaceChildren(); reload.hidden = true;
    try {
      const entries = await window.photocraftRecoverySummary();
      const note = document.createElement('p');
      note.textContent = entries.length ? 'Recovery copies from closed or crashed tabs on this browser profile:' : 'No recovery copies from closed or crashed tabs were found. Available copies are offered automatically when the editor starts.';
      list.append(note);
      for (const entry of entries) {
        const row = document.createElement('p');
        row.textContent = `${entry.name} — ${new Date(entry.updated).toLocaleString()}`;
        list.append(row);
      }
      if (entries.length) {
        const warning = document.createElement('p');
        warning.textContent = 'Save any open work first. Reloading reopens available recovery copies and closes this editor session.';
        list.append(warning); reload.hidden = false;
      }
    } catch (error) {
      const note = document.createElement('p');
      note.textContent = 'Recovery storage could not be checked. ' + error.message;
      list.append(note);
    }
  };
  document.getElementById('recovery-reload').addEventListener('click', () => location.reload());
})();
