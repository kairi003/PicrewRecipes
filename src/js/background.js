chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    type: "normal",
    id: "open",
    title: "Open (Ctrl+O)",
    documentUrlPatterns: ["https://picrew.me/image_maker/*"]
  });
  chrome.contextMenus.create({
    type: "normal",
    id: "save",
    title: "Save (Ctrl+S)",
    documentUrlPatterns: ["https://picrew.me/image_maker/*"]
  });
  chrome.contextMenus.create({
    type: "normal",
    id: "save_as",
    title: "SaveAs (Shift+Ctrl+S)",
    documentUrlPatterns: ["https://picrew.me/image_maker/*"]
  });
  chrome.contextMenus.create({
    type: "normal",
    id: "reset",
    title: "Reset (Ctrl+R)",
    documentUrlPatterns: ["https://picrew.me/image_maker/*"]
  });
});

chrome.contextMenus.onClicked.addListener((item, tab) => {
  chrome.tabs.sendMessage(tab.id, item.menuItemId);
});
