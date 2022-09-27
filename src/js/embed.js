{
  const mid = window?.__NUXT__?.state?.imageMakerId ?? null;
  window.postMessage({ type: 'FROM_EMBED', action: 'GET_ID', data: mid }, window.origin);
  
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
}