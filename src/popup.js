import QRCode from "qrcode";

const status = document.querySelector("#status");
const canvas = document.querySelector("#qr");
const pageTitle = document.querySelector("#page-title");
const actions = document.querySelector("#actions");
const copyButton = document.querySelector("#copy");
const downloadButton = document.querySelector("#download");

let currentUrl;

async function showQrCode() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.url || !/^https?:/.test(tab.url)) {
      status.textContent = "This page doesn't have a shareable web URL.";
      return;
    }

    currentUrl = tab.url;
    await QRCode.toCanvas(canvas, currentUrl, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
    });

    pageTitle.textContent = tab.title?.trim() || new URL(currentUrl).hostname;
    canvas.hidden = false;
    pageTitle.hidden = false;
    actions.hidden = false;
    status.textContent = "Scan to open this page.";
  } catch (error) {
    console.error("Could not create a QR code for this page.", error);
    status.textContent = "Couldn't create a QR code for this page.";
  }
}

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentUrl);
    status.textContent = "URL copied.";
  } catch (error) {
    console.error("Could not copy the page URL.", error);
    status.textContent = "Couldn't copy the URL.";
  }
});

downloadButton.addEventListener("click", () => {
  try {
    const filename = pageTitle.textContent
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/^[.]+|[.]+$/g, "")
      .slice(0, 100) || "page";
    const image = createDownloadImage();
    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = image.toDataURL("image/png");
    link.click();
    status.textContent = "QR image saved.";
  } catch (error) {
    console.error("Could not save the QR image.", error);
    status.textContent = "Couldn't save the QR image.";
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

function createDownloadImage() {
  const imageWidth = 280;
  const cardInset = 8;
  const lineHeight = 22;
  const qrSize = canvas.width;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("Could not create an image canvas.");

  context.font = "600 16px system-ui, sans-serif";
  const titleLines = wrapText(context, pageTitle.textContent, imageWidth - 40);
  const panelTop = cardInset + 24 + titleLines.length * lineHeight + 10;
  const qrPanelPadding = 8;
  const qrPanelSize = qrSize + qrPanelPadding * 2;
  const imageHeight = panelTop + qrPanelSize + 16 + cardInset;
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
    16,
  );
  context.fillStyle = "#fff";
  context.fill();

  context.font = "600 16px system-ui, sans-serif";
  context.fillStyle = "#172033";
  context.textAlign = "center";
  context.textBaseline = "top";
  titleLines.forEach((line, index) => {
    context.fillText(line, imageWidth / 2, cardInset + 24 + index * lineHeight);
  });

  const panelX = (imageWidth - qrPanelSize) / 2;
  roundedRectPath(context, panelX, panelTop, qrPanelSize, qrPanelSize, 14);
  context.fillStyle = "#edf2ff";
  context.fill();

  const qrX = (imageWidth - qrSize) / 2;
  const qrY = panelTop + qrPanelPadding;
  roundedRectPath(context, qrX, qrY, qrSize, qrSize, 10);
  context.save();
  context.clip();
  context.drawImage(canvas, qrX, qrY, qrSize, qrSize);
  context.restore();

  return image;
}

showQrCode();
