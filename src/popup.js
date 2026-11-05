import QRCode from "qrcode";

const status = document.querySelector("#status");
const canvas = document.querySelector("#qr");
const pageTitle = document.querySelector("#page-title");
const actions = document.querySelector("#actions");
const copyButton = document.querySelector("#copy");
const downloadButton = document.querySelector("#download");
const linkRequestId = new URLSearchParams(window.location.search).get("link");
const isLinkView = new URLSearchParams(window.location.search).has("link");
const DISPLAY_QR_SIZE = 220;
const PRINT_SCALE = 4;
const PRINT_QR_SIZE = DISPLAY_QR_SIZE * PRINT_SCALE;

const QR_OPTIONS = {
  margin: 2,
  errorCorrectionLevel: "M",
};

let currentUrl;

async function showQrCode() {
  try {
    let page;

    if (isLinkView) {
      document.body.classList.add("standalone");
      document.querySelector("h1").textContent = "QR for this link";
      document.title = "QR for this link";

      if (!linkRequestId) {
        status.textContent = "This link QR request is invalid.";
        return;
      }

      page = await chrome.runtime.sendMessage({
        type: "consume-link",
        requestId: linkRequestId,
      });
    } else {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      page = { url: tab?.url, title: tab?.title };
    }

    if (!page?.url || !/^https?:/i.test(page.url)) {
      status.textContent = isLinkView
        ? "This link QR request has expired. Use the context menu again."
        : "This page doesn't have a shareable web URL.";
      return;
    }

    currentUrl = page.url;
    await QRCode.toCanvas(canvas, currentUrl, {
      width: isLinkView ? 320 : DISPLAY_QR_SIZE,
      ...QR_OPTIONS,
    });

    pageTitle.textContent = page.title?.trim() || new URL(currentUrl).hostname;
    canvas.setAttribute(
      "aria-label",
      isLinkView ? "QR code for the selected link" : "QR code for the current page",
    );
    canvas.hidden = false;
    pageTitle.hidden = false;
    actions.hidden = false;
    status.textContent = isLinkView
      ? "Scan to open this link."
      : "Scan to open this page.";
  } catch (error) {
    console.error("Could not create a QR code for this page.", error);
    status.textContent = "Couldn't create a QR code for this page.";
  }
}

copyButton.addEventListener("click", async () => {
  copyButton.disabled = true;
  status.textContent = "Preparing QR image…";

  try {
    const qrCanvas = await createQrCanvas();
    const qrBlob = await canvasToPngBlob(qrCanvas);
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": qrBlob }),
    ]);
    status.textContent = "QR image copied.";
  } catch (error) {
    console.error("Could not copy the QR image.", error);
    status.textContent = "Couldn't copy the QR image.";
  } finally {
    copyButton.disabled = false;
  }
});

downloadButton.addEventListener("click", async () => {
  downloadButton.disabled = true;
  status.textContent = "Preparing a print-size QR image…";

  try {
    const filename = pageTitle.textContent
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/^[.]+|[.]+$/g, "")
      .slice(0, 100) || "page";
    const image = await createDownloadImage();
    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = image.toDataURL("image/png");
    link.click();
    status.textContent = "QR image saved.";
  } catch (error) {
    console.error("Could not save the QR image.", error);
    status.textContent = "Couldn't save the QR image.";
  } finally {
    downloadButton.disabled = false;
  }
});

function wrapText(context, text, maxWidth) {
  const lines = [];
  let line = "";

  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const parts = [];
    let part = "";
    for (const character of Array.from(word)) {
      if (part && context.measureText(part + character).width > maxWidth) {
        parts.push(part);
        part = character;
      } else {
        part += character;
      }
    }
    if (part) parts.push(part);

    for (const segment of parts) {
      const candidate = line ? `${line} ${segment}` : segment;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = segment;
      } else {
        line = candidate;
      }
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : ["Page QR"];
}

function roundedRectPath(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

async function createQrCanvas(size = PRINT_QR_SIZE) {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, currentUrl, {
    width: size,
    ...QR_OPTIONS,
  });
  return qrCanvas;
}

function canvasToPngBlob(sourceCanvas) {
  return new Promise((resolve, reject) => {
    sourceCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not encode the QR image as PNG."));
      }
    }, "image/png");
  });
}

async function createDownloadImage() {
  const scale = PRINT_SCALE;
  const imageWidth = 280 * scale;
  const cardInset = 8 * scale;
  const lineHeight = 22 * scale;
  const qrCanvas = await createQrCanvas();
  const qrSize = qrCanvas.width;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("Could not create an image canvas.");

  context.font = `600 ${16 * scale}px system-ui, sans-serif`;
  const titleLines = wrapText(
    context,
    pageTitle.textContent,
    imageWidth - 40 * scale,
  );
  const panelTop =
    cardInset + 24 * scale + titleLines.length * lineHeight + 10 * scale;
  const qrPanelPadding = 8 * scale;
  const qrPanelSize = qrSize + qrPanelPadding * 2;
  const imageHeight = panelTop + qrPanelSize + 16 * scale + cardInset;
  const image = context.canvas;
  image.width = imageWidth;
  image.height = imageHeight;

  context.fillStyle = "#f1f5ff";
  context.fillRect(0, 0, imageWidth, imageHeight);
  roundedRectPath(
    context,
    cardInset,
    cardInset,
    imageWidth - cardInset * 2,
    imageHeight - cardInset * 2,
    16 * scale,
  );
  context.fillStyle = "#fff";
  context.fill();

  context.font = `600 ${16 * scale}px system-ui, sans-serif`;
  context.fillStyle = "#172033";
  context.textAlign = "center";
  context.textBaseline = "top";
  titleLines.forEach((line, index) => {
    context.fillText(
      line,
      imageWidth / 2,
      cardInset + 24 * scale + index * lineHeight,
    );
  });

  const panelX = (imageWidth - qrPanelSize) / 2;
  roundedRectPath(
    context,
    panelX,
    panelTop,
    qrPanelSize,
    qrPanelSize,
    14 * scale,
  );
  context.fillStyle = "#edf2ff";
  context.fill();

  const qrX = (imageWidth - qrSize) / 2;
  const qrY = panelTop + qrPanelPadding;
  roundedRectPath(context, qrX, qrY, qrSize, qrSize, 10 * scale);
  context.save();
  context.clip();
  context.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  context.restore();

  return image;
}

showQrCode();
