// ui/canvas_renderer.js
// Draws the kaleidoscope picture, hides the sealed record inside it (PNG chunk "kvMk"), and downloads it.
// The picture is seeded from SHA-256 of the sealed data only, so it shows nothing about the text (paper section 2.3).

const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const SIZE = 512, C = SIZE / 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function drawGlyph(ciphertext) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", ciphertext));
  const seed = ((hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3]) >>> 0;
  const rand = mulberry32(seed);
  ctx.fillStyle = "#101014"; ctx.fillRect(0, 0, SIZE, SIZE);
  const SLICES = 12;
  for (let layer = 0; layer < 14; layer++) {
    const hue = Math.floor(rand() * 360);
    const r1 = 30 + rand() * 200, r2 = r1 + 20 + rand() * 60;
    const a1 = rand() * (Math.PI / SLICES), a2 = a1 + rand() * (Math.PI / SLICES);
    ctx.fillStyle = `hsla(${hue}, 80%, ${40 + rand() * 25}%, 0.65)`;
    for (let s = 0; s < SLICES; s++) {
      for (const flip of [1, -1]) {            // mirror each slice for the kaleidoscope look
        ctx.save();
        ctx.translate(C, C);
        ctx.rotate((s * 2 * Math.PI) / SLICES);
        ctx.scale(1, flip);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
        ctx.lineTo(Math.cos(a1) * r2, Math.sin(a1) * r2);
        ctx.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
  // Centre mark: a square means the default key is "ALL" (all 12 notes), same as Glyph Forge.
  ctx.fillStyle = "#ffffff"; ctx.fillRect(C - 13, C - 13, 26, 26);
}

// ---- PNG chunk helpers (same method as Glyph Forge) ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function injectPngChunk(png, type, payload) {
  const iendPos = png.length - 12;
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + payload.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length, false);
  chunk.set(typeBytes, 4);
  chunk.set(payload, 8);
  const crcInput = new Uint8Array(4 + payload.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(payload, 4);
  view.setUint32(8 + payload.length, crc32(crcInput), false);
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, iendPos), 0);
  out.set(chunk, iendPos);
  out.set(png.subarray(iendPos), iendPos + chunk.length);
  return out;
}

async function main() {
  const reply = await chrome.runtime.sendMessage({ action: "GET_PENDING_DATA" });
  if (!reply || !reply.success || !reply.record) {
    statusEl.textContent = "No sealed data found. Go back to the extension and click Export again.";
    return;
  }
  const record = new Uint8Array(reply.record);
  await drawGlyph(record.subarray(28));             // 16 salt + 12 iv, the rest is ciphertext
  const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
  const plain = new Uint8Array(await blob.arrayBuffer());
  const finalPng = injectPngChunk(plain, "kvMk", record);
  const url = URL.createObjectURL(new Blob([finalPng], { type: "image/png" }));
  const link = document.createElement("a");
  link.href = url; link.download = "memory-glyph.png";
  document.body.appendChild(link); link.click();
  statusEl.innerHTML = 'Saved as <b>memory-glyph.png</b>. Keep it as a raw file (do not re-save, resize or post it online). ' +
    '<a href="' + url + '" download="memory-glyph.png">Download again</a>';
}
main().catch(err => { statusEl.textContent = "Error: " + err.message; });
