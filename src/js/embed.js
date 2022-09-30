(()=>{
  const iminfo = JSON.parse(JSON.stringify(window?.__NUXT__?.state?.imageMakerInfo ?? null));
  window.postMessage({ type: 'FROM_EMBED', action: 'GET_INFO', data: iminfo }, window.origin);

  const mid = iminfo.id;
  if (!mid) return;
  const st = window.localStorage;
  const _setItem = st.setItem.bind(st);
  st.setItem = (function (key, value) {
    const oldValue = st.getItem(key) ?? null;
    const result = _setItem.apply(null, [key, value]);
    const newValue = st.getItem(key);
    if (key === 'picrew.local.data.'+mid && oldValue !== newValue) {
      const data = {key, oldValue, newValue};
      window.postMessage({ type: 'FROM_EMBED', action: 'UPDATE_STORAGE', data}, window.origin);
    }
    return result;
  }).bind(st);
})();
