const waitForSelector = query => new Promise((resolve, reject) => {
  const target = document.querySelector(query);
  if (target) return target;
  const observer = new MutationObserver((mutationsList, observer) => {
    for(const mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes) {
        const target = document.querySelector(query);
        if (target) {
          observer.disconnect();
          return resolve(target);
        }
      }
    }
  });
  observer.observe(document.body, {childList: true, subtree: true});
});

const getState = () => new Promise(resolve => {
  if (window.state) return resolve(window.state);
  window.postMessage({type: 'FROM_CONTENT', action: 'GET_STATE'});
  const listener = event => {
    const {type, action, data} = event.data ?? {};
    if (type === 'FROM_EMBED' && action === 'GET_STATE' && data) {
      window.removeEventListener('click', listener);
      resolve(window.state=data);
    }
  }
  window.addEventListener('message', listener);
});

const getDropFileHandle = event => {
  for (const item of event?.dataTransfer?.items ?? [])
    if (item.kind === 'file') return item.getAsFileSystemHandle();
  return new Error('no files in drop items');
}

const openFile = async (event) => {
  const options = {
    types: [{
      description: 'PicrewRecipes',
      accept: {'application/json': ['.json']}
    }]
  };
  const fh = await ((event instanceof Event && event?.type === 'drop') ? getDropFileHandle(event)
    : window.showOpenFilePicker(options).then(fh=>fh[0]).catch(err=>err));
  if (fh instanceof Error) return (fh.name !== 'AbortError') && alert(fh);
  const file = await fh.getFile();

  const data = await file.text().then(t=>JSON.parse(t)).catch(e=>e);
  if (data instanceof Error) return alert(new Error(chrome.i18n.getMessage('invalid_file_format')));
  if (data.imageMakerId === void(0)) {
    if (!confirm(chrome.i18n.getMessage('missing_id'))) return;
  } else if (data.imageMakerId !== window.mid) {
    if (!confirm(chrome.i18n.getMessage('wrong_id'))) return;
  }
  const zeroConf = (await getState())?.config?.zeroConf ?? {};
  console.log(zeroConf);
  for (const [k1, v1] of Object.entries(zeroConf))
    for (const k2 of Object.keys(v1)) {
      console.log(zeroConf[k1][k2], data[k1]?.[k2])
      zeroConf[k1][k2] = data[k1]?.[k2] ?? zeroConf[k1][k2];
  }

  idbKeyval.set('recipeFileHandle.'+mid, fh);
  localStorage['picrew.local.data.'+mid] = JSON.stringify(zeroConf);
  location.reload();
}

const saveFile = async (saveAs=false) => {
  const options = {
    suggestedName: window.recipeFileHandle?.name ?? 'picrew_recipe.json',
    types: [{
      description: 'PicrewRecipes',
      accept: {'application/json': ['.json']}
    }]
  };
  const fh = (!saveAs && window.recipeFileHandle) || await window.showSaveFilePicker(options).catch(err=>err);
  if (fh instanceof Error) return (fh.name !== 'AbortError') && alert(fh);
  try {
    const wt = await fh.createWritable();
    const data = JSON.parse(localStorage['picrew.local.data.'+mid]);
    data.imageMakerId = window.mid;
    await wt.write(JSON.stringify(data));
    await wt.close();
    window.recipeFileHandle = fh;
    const fn = fh?.name ?? '';
    document.querySelector('#recipeName').textContent = fn;
  } catch {}
}

const reset = (force=false) => {
  if (!force && !confirm(chrome.i18n.getMessage('reset_confirm'))) return;
  localStorage.removeItem('picrew.local.data.'+mid);
  location.reload();
}

const pageExpansion = async (target) => {
  const fh = window.recipeFileHandle = await idbKeyval.get('recipeFileHandle.'+mid);
  const fn = fh?.name ?? '';
  await idbKeyval.del('recipeFileHandle.'+mid);
  target.insertAdjacentHTML('afterbegin', `<div class="prl-menu-bar">
    <button id="prlOpen" class="prl-button prl-menu-item" title="Ctrl+O">Open</button>
    <button id="prlSave" class="prl-button prl-menu-item" title="Ctrl+S">Save</button>
    <button id="prlSaveAs" class="prl-button prl-menu-item" title="Shift+Ctrl+S">SaveAs</button>
    <span id="recipeName" class="prl-recipie-name prl-menu-item">${fn}</span>
  </div>`);
  target.querySelector('#prlOpen').addEventListener('click', e=>openFile(e));
  target.querySelector('#prlSave').addEventListener('click', e=>saveFile());
  target.querySelector('#prlSaveAs').addEventListener('click', e=>saveFile(true));
}


window.mid = location.pathname.match(/(?<=image_maker\/)\d+/)?.[0] ?? '';

waitForSelector('#image-maker .play-Container_Imagemaker').then(pageExpansion);
waitForSelector('#__layout .Error-Title').then(t=>
  (t.textContent.trim() === '500') 
  && confirm(chrome.i18n.getMessage('local_data_broken')) 
  && reset(true));

document.head.appendChild(Object.assign(document.createElement('script'),
  {async: true, src: chrome.runtime.getURL('js/embed.js')}));

let tid;
window.addEventListener('dragover', event => {
  event.preventDefault();
  clearInterval(tid);
  tid = setTimeout(()=>document.body.classList.remove('ondragover'), 100);
  document.body.classList.add('ondragover');
});

window.addEventListener('drop', event => {
  event.preventDefault();
  openFile(event);
});

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

shortcut.add('Ctrl+O', openFile);
shortcut.add('Ctrl+S', e=>saveFile());
shortcut.add('Shift+Ctrl+S', e=>saveFile(true));
shortcut.add('Ctrl+R', reset);
