window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== window.origin) return;
  if (event.data.type === 'FROM_CONTENT') {
    switch (event.data.action) {
      case 'GET_STATE':
        const tid = setInterval(()=>{
          try {
            const data = (window?.__NUXT__?.state) ?? {};
            window.postMessage({ type: 'FROM_EMBED', action: 'GET_STATE', data }, window.origin);
            clearInterval(tid);
          } catch {}
        }, 10);
        break;
    }
  }
}, false);
