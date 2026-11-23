// Draw the encrypted record as themed artwork and place it in a kvMk PNG chunk.
const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const SIZE = 512;
const CENTER = SIZE / 2;

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seededRandom(record) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', record));
  const seed = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  return mulberry32(seed);
}

function drawKaleidoscope(rand) {
  ctx.fillStyle = '#101014'; ctx.fillRect(0, 0, SIZE, SIZE);
  const slices = 12;
  for (let layer = 0; layer < 14; layer++) {
    const hue = Math.floor(rand() * 360);
    const inner = 30 + rand() * 200;
    const outer = inner + 20 + rand() * 60;
    const a1 = rand() * Math.PI / slices;
    const a2 = a1 + rand() * Math.PI / slices;
    ctx.fillStyle = `hsla(${hue}, 80%, ${40 + rand() * 25}%, 0.72)`;
    for (let s = 0; s < slices; s++) for (const flip of [1, -1]) {
      ctx.save(); ctx.translate(CENTER, CENTER); ctx.rotate(s * 2 * Math.PI / slices); ctx.scale(1, flip);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a1) * inner, Math.sin(a1) * inner);
      ctx.lineTo(Math.cos(a1) * outer, Math.sin(a1) * outer);
      ctx.lineTo(Math.cos(a2) * outer, Math.sin(a2) * outer);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(CENTER - 13, CENTER - 13, 26, 26);
}

function drawPixel(rand) {
  const palette = ['#101014', '#172554', '#2563eb', '#06b6d4', '#facc15', '#f97316', '#f8fafc'];
  const cell = 8;
  ctx.fillStyle = palette[0]; ctx.fillRect(0, 0, SIZE, SIZE);
  for (let y = 0; y < SIZE / cell; y++) {
    for (let x = 0; x < SIZE / cell; x++) {
      if (rand() > 0.54) {
        ctx.fillStyle = palette[1 + Math.floor(rand() * (palette.length - 1))];
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(CENTER - 16, CENTER - 16, 32, 32);
  ctx.fillStyle = '#101014'; ctx.fillRect(CENTER - 8, CENTER - 8, 16, 16);
}

function drawBauhaus(rand) {
  const colors = ['#f44336', '#f4c542', '#2463eb', '#f7f3e8', '#161616'];
  ctx.fillStyle = '#f7f3e8'; ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 34; i++) {
    const x = rand() * SIZE, y = rand() * SIZE;
    const radius = 12 + rand() * 74;
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.72 + rand() * 0.28;
    const shape = Math.floor(rand() * 3);
    if (shape === 0) {
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    } else if (shape === 1) {
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    } else {
      ctx.beginPath(); ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y + radius); ctx.lineTo(x - radius, y + radius); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#161616'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(CENTER, CENTER, 38, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#161616'; ctx.fillRect(CENTER - 8, CENTER - 8, 16, 16);
}

async function drawGlyph(record, theme) {
  const rand = await seededRandom(record);
  if (theme === 'Pixel') drawPixel(rand);
  else if (theme === 'Bauhaus') drawBauhaus(rand);
  else drawKaleidoscope(rand);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function injectPngChunk(png, type, payload) {
  if (png.length < 20) throw new Error('Canvas did not create a valid PNG.');
  const iend = png.length - 12;
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(payload.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length, false);
  chunk.set(typeBytes, 4);
  chunk.set(payload, 8);
  const crcInput = new Uint8Array(payload.length + 4);
  crcInput.set(typeBytes); crcInput.set(payload, 4);
  view.setUint32(payload.length + 8, crc32(crcInput), false);
  const result = new Uint8Array(png.length + chunk.length);
  result.set(png.subarray(0, iend)); result.set(chunk, iend); result.set(png.subarray(iend), iend + chunk.length);
  return result;
}

async function main() {
  const reply = await chrome.runtime.sendMessage({ action: 'GET_PENDING_DATA' });
  if (!reply?.success || !reply.record) throw new Error('No encrypted data found. Return to the extension and export again.');
  const record = new Uint8Array(reply.record);
  if (record.length < 44) throw new Error('The encrypted record is incomplete.');
  const theme = ['Bauhaus', 'Pixel', 'Kaleidoscope'].includes(reply.theme) ? reply.theme : 'Kaleidoscope';
  await drawGlyph(record, theme);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render PNG artwork.');
  const png = new Uint8Array(await blob.arrayBuffer());
  const finalPng = injectPngChunk(png, 'kvMk', record);
  const url = URL.createObjectURL(new Blob([finalPng], { type: 'image/png' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'memory-glyph.png'; document.body.appendChild(link); link.click(); link.remove();
  statusEl.textContent = `Saved memory-glyph.png using ${theme} artwork. Keep the original file; image apps may remove its encrypted data.`;
  const again = document.createElement('a');
  again.href = url; again.download = 'memory-glyph.png'; again.textContent = ' Download again';
  statusEl.append(again);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
main().catch(error => { statusEl.textContent = `Export failed: ${error.message}`; });
