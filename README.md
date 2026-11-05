# QRious

A Chrome extension that makes a QR code for the page in the active tab.

## Try it in Chrome

1. Run `npm install`, then `npm run build`.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. Open a normal web page and click the QRious toolbar icon.

The popup shows the QR code and page title. **Copy** copies a high-resolution
PNG image with the page title above the QR code to the clipboard; **Download**
saves the same print-size image. Right-click a web link and choose
**Create QR for this link** to open a QR code for its destination without
navigating there.

## How it works

The Manifest V3 `activeTab` permission lets the extension read the URL of the
tab you are currently viewing after you click its toolbar icon. The popup asks
Chrome for the active tab, then passes its URL to the `qrcode` JavaScript
library. That library encodes the text into the QR standard's grid of black and
white modules and draws the result on a canvas. The library is bundled into the
extension, so QR generation does not send the URL anywhere and works offline.
For a context-menu link, the destination is handed to the extension page through
session storage and removed after it is read. The request stays in memory only,
expires after five minutes, and stale requests are cleared the next time the
context menu is used.

The build command uses esbuild to bundle the QR library and extension code into
`dist/popup.js`.
