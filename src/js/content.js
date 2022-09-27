const waitForSelector = query => new Promise((resolve, reject) => {
  const target = document.querySelector(query);
  if (target) return target;
  const observer = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes) {
        const target = document.querySelector(query);
        if (target) {
          observer.disconnect();
          return resolve(target);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

const getId = new Promise((resolve, reject) => {
  if (!location.pathname.match(/^\/(?:secret_)?image_maker\/\w+\/?$/)) return reject(new Error());
  const listener = event => {
    if (event.source !== window || event.origin !== window.origin) return;
    const { type, action, data } = Object.create(event.data ?? null);
    if (type === 'FROM_EMBED' && action === 'GET_ID' && data) {
      event.stopPropagation();
      window.removeEventListener('click', listener);
      resolve(data);
    }
  }
  window.addEventListener('message', listener);
  document.body.appendChild(Object.assign(document.createElement('script'),
    { src: chrome.runtime.getURL('js/embed.js') }));
});

const Recipe = class {
  fileHandle;
  backQueue;
  forwardQueue;
  saveIndex;

  constructor(fileHandle=null, backQueue=[], forwardQueue=[], saveIndex=0) {
    this.fileHandle = fileHandle;
    this.backQueue = backQueue;
    this.forwardQueue = forwardQueue;
    this.saveIndex = saveIndex;
    this.updateName();
  }

  static fromHistoryState(historyState) {
    const _recipe = historyState?.recipe ?? {};
    return new Recipe(_recipe?.fileHandle, _recipe?.backQueue,
      _recipe?.forwardQueue, _recipe?.saveIndex);
  }

  savefileHandle(handle, state) {
    if (handle) this.fileHandle = handle;
    if (!this.fileHandle) return;
    if (state) this.push(state);
    this.saveIndex = this.backQueue.length;
    this.updateName();
    return this;
  }

  updateName() {
    const recipeName = document.querySelector('#recipeName');
    recipeName.textContent = this.fileHandle?.name ?? '';
    recipeName.classList.toggle('unsaved', !this.isSaved());
    return this;
  }

  get state() {
    return this.backQueue[this.backQueue.length - 1];
  }

  push(state) {
    if (this.backQueue[this.backQueue.length - 1] == state) return;
    this.backQueue.push(state);
    this.forwardQueue = [];
    if (this.saveIndex > this.backQueue.length) this.saveIndex = 0;
    this.updateName();
    return this;
  }

  back() {
    if (this.backQueue.length <= 1) return;
    this.forwardQueue.push(this.backQueue.pop());
    this.updateName();
    return this;
  }

  forward() {
    if (this.forwardQueue.length == 0) return;
    this.backQueue.push(this.forwardQueue.pop());
    this.updateName();
    return this;
  }

  isSaved() {
    return this.saveIndex == this.backQueue.length;
  }
}

const getDropFileHandle = event => {
  if (!(event instanceof Event && event?.type === 'drop')) return;
  for (const item of event?.dataTransfer?.items ?? [])
    if (item.kind === 'file') return item.getAsFileSystemHandle();
  return new Error('no files in drop items');
}

const sanitizeData = data => {
  const itemKeys = ['itmId', 'cId', 'xCnt', 'yCnt', 'spCnt', 'sNo', 'rotaCnt'];
  return Object.fromEntries(Object.entries(data)
    .filter(([k, v]) => k && Number.isInteger(+k))
    .map(([k, v]) => [k, Object.fromEntries(itemKeys
      .map(ik => [ik, v[ik]])
      .filter(([ik, iv]) => Number.isInteger(iv)))]));
}

const openFile = async (event) => {
  const options = {
    types: [{
      description: 'PicrewRecipes',
      accept: { 'application/json': ['.json'] }
    }]
  };
  const fh = await (getDropFileHandle(event) || window.showOpenFilePicker(options).then(fh => fh[0])).catch(err => err);
  if (fh instanceof Error) return (fh.name !== 'AbortError') && alert(fh);
  const file = await fh.getFile();

  const data = await file.text().then(t => JSON.parse(t)).catch(e => e);
  if (data instanceof Error) return alert(new Error(chrome.i18n.getMessage('invalid_file_format')));

  const mid = window.mid;
  const did = data.imageMakerId;
  const dpath = (data.secretId) ? `/secret_image_maker/${data.secretId}` : `/image_maker/${did}`;
  const i18n = chrome.i18n.getMessage;
  const confirmJump = () => confirm(i18n('jump_page', [dpath]));
  const confirmDiffLoad = () => confirm(i18n('diff_id') + '\n' + i18n('continue_load_confirm'));
  const confirmMissLoad = () => confirm(i18n('miss_id') + '\n' + i18n('continue_load_confirm'));
  if (mid == did) {
    if (!mid) return alert(new Error(i18n('miss_id')));
  } else {
    if (did && (!mid || confirmJump())) history.pushState(history.state, '', dpath);
    else if (!mid || did && !confirmDiffLoad()) return;
    if (mid && !did && !confirmMissLoad()) return;
  }
  const state = JSON.stringify(sanitizeData(data));
  window.recipe = new Recipe().savefileHandle(fh, state);
  const storageKey = 'picrew.local.data.' + ((location.pathname == dpath) ? did : mid);
  localStorage[storageKey] = state;
  location.reload();
}

const saveFile = async (saveAs = false) => {
  const recipe = window.recipe;
  const mid = window.mid;
  if (!mid) return;
  const options = {
    suggestedName: recipe.fileHandle?.name ?? 'picrew_recipe.json',
    types: [{
      description: 'PicrewRecipes',
      accept: { 'application/json': ['.json'] }
    }]
  };
  const fh = (!saveAs && recipe.fileHandle) || await window.showSaveFilePicker(options).catch(err => err);
  if (fh instanceof Error) return (fh.name !== 'AbortError') && alert(fh);
  try {
    const wt = await fh.createWritable();
    const state = recipe.state;
    const data = JSON.parse(state);
    data.imageMakerId = mid;
    const sid = location.pathname.match(/^\/secret_image_maker\/(\w+)/)?.[1];
    if (sid) data.secretId = sid;
    await wt.write(JSON.stringify(data));
    await wt.close();
    recipe.savefileHandle(fh, state);
  } catch(err) {
    alert(err);
  }
}

const reset = (force = false) => {
  if (!force && !confirm(chrome.i18n.getMessage('reset_confirm'))) return;
  const mid = window.mid;
  if (mid) localStorage.removeItem('picrew.local.data.' + mid);
  history.replaceState(null, '');
  window.removeEventListener('beforeunload', historyStateUpdate);
  location.reload();
}

const historyStateUpdate = e => {
  const state = Object.assign(history.state ?? {}, {recipe: window.recipe});
  history.replaceState(state, '');
}

const setDropEvent = () => {
  let tid;
  window.addEventListener('dragover', event => {
    event.preventDefault();
    clearInterval(tid);
    tid = setTimeout(() => document.body.classList.remove('ondragover'), 100);
    document.body.classList.add('ondragover');
  });

  window.addEventListener('drop', event => {
    event.preventDefault();
    openFile(event);
  });
}

const setContextMenuListener = () => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message) {
      case 'open':
        openFile();
        break;
      case 'save':
        saveFile();
        break;
      case 'save_as':
        saveFile(true);
        break;
      case 'reset':
        reset();
        break;
    }
  });
}

const setShortCut = () => {
  shortcut.add('Ctrl+O', openFile);
  shortcut.add('Ctrl+S', e => saveFile());
  shortcut.add('Shift+Ctrl+S', e => saveFile(true));
  shortcut.add('Ctrl+R', reset);
}

const insertMenuBar = async () => {
  document.body.insertAdjacentHTML('afterbegin', `<div class="prl-menu-bar" id="prlMenuBar">
    <button id="prlOpen"   class="prl-menu-item prl-button" title="Ctrl+O">Open</button>
    <button id="prlSave"   class="prl-menu-item prl-button" disabled title="Ctrl+S">Save</button>
    <button id="prlSaveAs" class="prl-menu-item prl-button" disabled title="Shift+Ctrl+S">SaveAs</button>
    <button id="prlReset"  class="prl-menu-item prl-button" title="Ctrl+R">Reset</button>
    <span id="recipeName"  class="prl-menu-item prl-recipie-name"></span>
  </div>`);
  const menubar = document.querySelector('#prlMenuBar');
  menubar.querySelector('#prlOpen').addEventListener('click', e => openFile(e));
  menubar.querySelector('#prlSave').addEventListener('click', e => saveFile());
  menubar.querySelector('#prlSaveAs').addEventListener('click', e => saveFile(true));
  menubar.querySelector('#prlReset').addEventListener('click', e => reset());

  window.addEventListener('beforeunload', historyStateUpdate);

  const mid = window.mid = await getId.catch(e=>null);
  if (!mid) return;

  const recipe = window.recipe = Recipe.fromHistoryState(history.state);
  recipe.push(localStorage['picrew.local.data.' + mid]);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== window.origin) return;
    const { type, action, data: { newValue } } = Object.create(event.data ?? null);
    if (type === 'FROM_EMBED' && action === 'UPDATE_STORAGE' && newValue) {
      event.stopPropagation();
      recipe.push(localStorage['picrew.local.data.' + mid]);
    }
  });
  menubar.querySelectorAll('.prl-button:disabled').forEach(item => item.disabled = false);
}


{
  waitForSelector('#__layout .Error-Title').then(t =>
    (t.textContent.trim() === '500')
    && confirm(chrome.i18n.getMessage('local_data_broken'))
    && reset(true));

  insertMenuBar();
  setDropEvent();
  setContextMenuListener();
  setShortCut();
}