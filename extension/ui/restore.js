const fileInput = document.getElementById('glyphFile');
const passphraseInput = document.getElementById('passphrase');
const statusEl = document.getElementById('status');
const result = document.getElementById('result');
const promptEl = document.getElementById('prompt');

function fail(message) { statusEl.style.color = '#f87171'; statusEl.textContent = message; }
function succeed(message) { statusEl.style.color = '#34d399'; statusEl.textContent = message; }

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
function readUint32(bytes, offset) {
  if (offset + 4 > bytes.length) throw new Error('The PNG is truncated.');
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}
function extractRecord(bytes) {
  if (bytes.length >= 4 && bytes[0] === 0x4b && bytes[1] === 0x56 && bytes[2] === 0x4d && bytes[3] === 0x4b) {
    const record = bytes.slice(4);
    if (record.length < 44) throw new Error('The .kvmk backup is incomplete or damaged.');
    return record;
  }
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 8 || !signature.every((value, i) => bytes[i] === value)) {
    throw new Error('Choose a Kaleidoscope PNG or a .kvmk backup file.');
  }
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length || end < offset) throw new Error('The PNG contains a truncated or invalid chunk.');
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = new TextDecoder().decode(typeBytes);
    if (type === 'kvMk') {
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      const expectedCrc = readUint32(bytes, offset + 8 + length);
      const crcInput = new Uint8Array(4 + length);
      crcInput.set(typeBytes); crcInput.set(data, 4);
      if (crc32(crcInput) !== expectedCrc) throw new Error('The glyph data chunk failed its integrity check. Try the original PNG or .kvmk backup.');
      if (data.length < 44) throw new Error('The encrypted data in this PNG is incomplete.');
      return data.slice();
    }
    if (type === 'IEND') break;
    offset = end;
  }
  throw new Error('No Kaleidoscope kvMk data was found. The PNG may have been resized, re-saved, converted, or may belong to another glyph format. Try the original file or .kvmk backup.');
}

async function deriveKey(passphrase, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}
function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.nodes)) throw new Error('The decrypted record is not a supported memory-node payload.');
  const nodes = payload.nodes.map(node => {
    if (!node || typeof node.content !== 'string') throw new Error('The decrypted record contains an invalid note.');
    return {
      note: typeof node.note === 'string' ? node.note : 'C',
      priority: Number.isFinite(Number(node.priority)) ? Number(node.priority) : 1,
      content: node.content
    };
  });
  if (!nodes.length) throw new Error('The glyph contains no notes.');
  return nodes;
}

async function unlock() {
  result.style.display = 'none';
  promptEl.value = '';
  const file = fileInput.files?.[0];
  const passphrase = passphraseInput.value;
  if (!file) return fail('Select a PNG glyph or .kvmk backup first.');
  if (!passphrase) return fail('Enter the passphrase used when this glyph was created.');
  statusEl.style.color = '#a1a1aa'; statusEl.textContent = 'Reading and decrypting locally…';
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const record = extractRecord(bytes);
    const salt = record.subarray(0, 16);
    const iv = record.subarray(16, 28);
    const ciphertext = record.subarray(28);
    const key = await deriveKey(passphrase, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
    const nodes = validatePayload(payload);
    const lines = nodes.map(node => `- [${node.note} | P${node.priority}] ${node.content}`);
    promptEl.value = `Restored Kaleidoscope context\nApply these constraints:\n${lines.join('\n')}`;
    document.getElementById('summary').textContent = `Restored ${nodes.length} note${nodes.length === 1 ? '' : 's'} from ${file.name}.`;
    result.style.display = 'block';
    succeed('Glyph unlocked. Review the restored text before copying it.');
  } catch (error) {
    fail(error.name === 'OperationError'
      ? 'Could not unlock this file. The passphrase may be wrong, or the encrypted data may be damaged.'
      : `Restore failed: ${error.message}`);
  }
}

document.getElementById('unlock').addEventListener('click', unlock);
document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(promptEl.value);
    succeed('Prompt copied to clipboard.');
  } catch (_error) {
    promptEl.focus(); promptEl.select();
    const copied = document.execCommand('copy');
    if (copied) succeed('Prompt copied to clipboard.');
    else fail('Copy was blocked. Select the text and copy it manually.');
  }
});
document.getElementById('clear').addEventListener('click', () => {
  promptEl.value = ''; passphraseInput.value = ''; fileInput.value = '';
  result.style.display = 'none'; statusEl.textContent = 'Restored text and passphrase cleared from the page.';
});
