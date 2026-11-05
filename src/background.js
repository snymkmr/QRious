const LINK_MENU_ID = "qrious-create-qr-for-link";
const LINK_REQUEST_PREFIX = "qrious-link-request:";
const LINK_REQUEST_TTL_MS = 5 * 60 * 1000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: LINK_MENU_ID,
      title: "Create QR for this link",
      contexts: ["link"],
      targetUrlPatterns: ["http://*/*", "https://*/*"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== LINK_MENU_ID || !/^https?:/i.test(info.linkUrl || "")) {
    return;
  }

  void openLinkQr(info.linkUrl);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "consume-link" || typeof message.requestId !== "string") {
    return false;
  }

  const popupUrl = chrome.runtime.getURL("popup.html");
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(popupUrl) ||
    !/^[\da-f-]{36}$/i.test(message.requestId)
  ) {
    sendResponse(null);
    return false;
  }

  void consumeLinkRequest(message.requestId).then(sendResponse, () => sendResponse(null));
  return true;
});

async function openLinkQr(url) {
  const requestId = crypto.randomUUID();
  const storageKey = `${LINK_REQUEST_PREFIX}${requestId}`;

  try {
    await removeExpiredLinkRequests();
    await chrome.storage.session.set({
      [storageKey]: { url, createdAt: Date.now() },
    });

    const qrPage = new URL("popup.html", chrome.runtime.getURL("/"));
    qrPage.searchParams.set("link", requestId);
    await chrome.tabs.create({ url: qrPage.href });
  } catch (error) {
    await chrome.storage.session.remove(storageKey);
    console.error("Could not open a QR code for this link.", error);
  }
}

async function consumeLinkRequest(requestId) {
  const storageKey = `${LINK_REQUEST_PREFIX}${requestId}`;
  const stored = await chrome.storage.session.get(storageKey);
  const request = stored[storageKey];
  await chrome.storage.session.remove(storageKey);

  if (!request || Date.now() - request.createdAt > LINK_REQUEST_TTL_MS) {
    return null;
  }

  return { url: request.url };
}

async function removeExpiredLinkRequests() {
  const stored = await chrome.storage.session.get(null);
  const expiredKeys = Object.entries(stored)
    .filter(
      ([key, request]) =>
        key.startsWith(LINK_REQUEST_PREFIX) &&
        Date.now() - request.createdAt > LINK_REQUEST_TTL_MS,
    )
    .map(([key]) => key);

  if (expiredKeys.length) {
    await chrome.storage.session.remove(expiredKeys);
  }
}
