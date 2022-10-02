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

const getInfo = new Promise((resolve, reject) => {
  if (!location.pathname.match(/^\/(?:secret_)?image_maker\/\w+\/?$/)) return reject(new Error());
  const listener = event => {
    if (event.source !== window || event.origin !== window.origin) return;
    const { type, action, data } = event.data ?? {};
    if (type === 'FROM_EMBED' && action === 'GET_INFO' && data) {
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

  constructor(fileHandle=null, backQueue=[], forwardQueue=[], saveIndex=0, replaceFlag=false) {
    this.fileHandle = fileHandle;
    this.backQueue = backQueue;
    this.forwardQueue = forwardQueue;
    this.saveIndex = saveIndex;
    this.replaceFlag = replaceFlag;
    this.updateWindow();
  }

  static fromHistoryState(historyState) {
    const _recipe = historyState?.recipe ?? {};
    return new Recipe(_recipe?.fileHandle, _recipe?.backQueue,
      _recipe?.forwardQueue, _recipe?.saveIndex, _recipe?.replaceFlag);
  }

  savefileHandle(handle, state) {
    if (handle) this.fileHandle = handle;
    if (!this.fileHandle) return;
    if (state) this.push(state);
    this.saveIndex = this.backQueue.length;
    this.updateWindow();
    return this;
  }

  updateWindow() {
    this.updateName();
    this.updateButton();
    this.updateHistoryStatus();
  }

  updateName() {
    const recipeName = document.querySelector('#recipeName');
    const name = this.fileHandle?.name ?? '';
    recipeName.textContent = name;
    recipeName.classList.toggle('unsaved', !this.isSaved());
    document.title = [name, window.iminfo?.title, 'Picrew'].filter(x=>x).join('｜');
  }

  updateButton() {
    const backButton = document.querySelector('#prlBack');
    const forwardButton = document.querySelector('#prlForward');
    backButton.disabled = this.backQueue.length < 2;
    forwardButton.disabled = this.forwardQueue.length < 1;
  }

  get state() {
    return this.backQueue[this.backQueue.length - 1];
  }

  push(state) {
    if (this.backQueue[this.backQueue.length - 1] == state) {
      this.replaceFlag = false;
      return;
    }
    if (this.replaceFlag) {
      this.backQueue.pop();
      this.backQueue.push(state);
      if (this.saveIndex == this.backQueue.length) this.saveIndex = 0;
    } else {
      this.backQueue.push(state);
      this.forwardQueue = [];
    }
    this.replaceFlag = false;
    if (this.saveIndex > this.backQueue.length) this.saveIndex = 0;
    this.updateWindow();
    return this;
  }

  back(n=1) {
    if (this.backQueue.length <= 1) return;
    this.forwardQueue.push(this.backQueue.pop());
    const mid = window.mid;
    if (!mid) return;
    localStorage['picrew.local.data.'+mid] = this.state;
    this.replaceFlag = true;
    this.updateWindow();
    location.reload();
    return this;
  }

  forward(n=1) {
    if (this.forwardQueue.length == 0) return;
    this.backQueue.push(this.forwardQueue.pop());
    const mid = window.mid;
    if (!mid) return;
    localStorage['picrew.local.data.'+mid] = this.state;
    this.replaceFlag = true;
    this.updateWindow();
    location.reload();
    return this;
  }

  isSaved() {
    return this.saveIndex == this.backQueue.length;
  }

  updateHistoryStatus() {
    const state = Object.assign(history.state ?? {}, {recipe: this});
    history.replaceState(state, '');
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
  // fileopen-flowchart.svg (https://github.com/kairi003/PicrewRecipes)
  if (mid == did) {
    if (!mid) return alert(new Error(i18n('miss_id')));
  } else if (did) {
    if (!mid || confirmJump()) history.pushState(history.state, '', dpath);
    else if (!confirmDiffLoad()) return;
  } else if (!confirmMissLoad()) return;
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
    data.secretId = window.iminfo?.secret_key ?? null;
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
  location.reload();
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
    event.stopPropagation();
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
      case 'back':
        window?.recipe?.back(1);
        break;
      case 'forward':
        window?.recipe?.forward(1);
        break;
      case 'reset':
        reset();
        break;
      case 'force_pc_view':
        location.reload();
        break;
    }
  });
}

const setShortCut = () => {
  shortcut.add('Ctrl+O', openFile);
  shortcut.add('Ctrl+S', e => saveFile());
  shortcut.add('Shift+Ctrl+S', e => saveFile(true));
  shortcut.add('Ctrl+Z', e => window?.recipe?.back(1));
  shortcut.add('Ctrl+Y', e => window?.recipe?.forward(1));
  shortcut.add('Ctrl+R', reset);
}

const insertMenuBar = async () => {
  document.body.insertAdjacentHTML('afterbegin', `<div class="prl-menu-bar" id="prlMenuBar">
    <button id="prlOpen"    class="prl-menu-item prl-button" title="Ctrl+O">Open</button>
    <button id="prlSave"    class="prl-menu-item prl-button" disabled title="Ctrl+S">Save</button>
    <button id="prlSaveAs"  class="prl-menu-item prl-button" disabled title="Shift+Ctrl+S">SaveAs</button>
    <button id="prlReset"   class="prl-menu-item prl-button" title="Ctrl+R">Reset</button>
    <button id="prlBack"    class="prl-menu-item prl-button prl-bf" disabled title="Ctrl+Z">Back</button>
    <button id="prlForward" class="prl-menu-item prl-button prl-bf" disabled title="Ctrl+Y">Forward</button>
    <span id="recipeName"   class="prl-menu-item prl-recipie-name"></span>
  </div>`);
  const menubar = document.querySelector('#prlMenuBar');
  menubar.querySelector('#prlOpen').addEventListener('click', e => openFile(e));
  menubar.querySelector('#prlSave').addEventListener('click', e => saveFile());
  menubar.querySelector('#prlSaveAs').addEventListener('click', e => saveFile(true));
  menubar.querySelector('#prlReset').addEventListener('click', e => reset());
  menubar.querySelector('#prlBack').addEventListener('click', e => window?.recipe?.back(1));
  menubar.querySelector('#prlForward').addEventListener('click', e => window?.recipe?.forward(1));

  const iminfo = window.iminfo = await getInfo.catch(e=>null);
  if (!iminfo) return;
  const mid = window.mid = iminfo?.id;
  if (!mid) return;

  const recipe = window.recipe = Recipe.fromHistoryState(history.state);
  recipe.push(localStorage['picrew.local.data.' + mid]);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== window.origin) return;
    const { type, action, data: {newValue}={} } = event.data ?? {};
    if (type === 'FROM_EMBED' && action === 'UPDATE_STORAGE' && newValue) {
      event.stopPropagation();
      recipe.push(localStorage['picrew.local.data.' + mid]);
    }
  });
  menubar.querySelectorAll('.prl-button:disabled:not(.prl-bf)').forEach(item => item.disabled = false);
}


{
  chrome.runtime.sendMessage('force_pc_view_enabled',
    response => document.body.classList.toggle('view_pc', response));

  waitForSelector('#__layout .Error-Title').then(t =>
    (t.textContent.trim() === '500')
    && confirm(chrome.i18n.getMessage('local_data_broken') + '\n' + chrome.i18n.getMessage('reset_confirm'))
    && reset(true));

  insertMenuBar();
  setDropEvent();
  setContextMenuListener();
  setShortCut();
}