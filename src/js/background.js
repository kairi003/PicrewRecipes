let forcePCViewEnabled = true;

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
  chrome.contextMenus.create({
    type: "checkbox",
    id: "force_pc_view",
    title: "Force PC View",
    checked: forcePCViewEnabled,
    contexts: ["all"],
    documentUrlPatterns: ["https://picrew.me/*"]
  });
});

chrome.contextMenus.onClicked.addListener((item, tab) => {
  if (item.menuItemId == 'force_pc_view') forcePCViewEnabled = item.checked;
  chrome.tabs.sendMessage(tab.id, item.menuItemId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request === 'force_pc_view_enabled') {
    sendResponse(forcePCViewEnabled);
    return true
  }
});