chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    type: "normal",
    id: "open",
    title: "Open (Ctrl+O)",
    contexts: ["all"],
    documentUrlPatterns: ["https://picrew.me/*image_maker/*", "https://picrew.me/", "https://picrew.me/search*", "https://picrew.me/discovery*"]
  });
  chrome.contextMenus.create({
    type: "normal",
    id: "save",
    title: "Save (Ctrl+S)",
    contexts: ["all"],
    documentUrlPatterns: ["https://picrew.me/*image_maker/*"]
  });
  chrome.contextMenus.create({
    type: "normal",
    id: "save_as",
    title: "SaveAs (Shift+Ctrl+S)",
    contexts: ["all"],
    documentUrlPatterns: ["https://picrew.me/*image_maker/*"]
  });
  chrome.contextMenus.create({
    type: "normal",
    id: "reset",
    title: "Reset (Ctrl+R)",
    contexts: ["all"],
    documentUrlPatterns: ["https://picrew.me/*image_maker/*", "https://picrew.me/", "https://picrew.me/search*", "https://picrew.me/discovery*"]
  });
});

chrome.contextMenus.onClicked.addListener((item, tab) => {
  chrome.tabs.sendMessage(tab.id, item.menuItemId);
});
