// Local-only encryption service for extension-created Glyph Forge compatible records.
const PBKDF2_ROUNDS = 100000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
let pendingRecord = null;
let pendingTheme = 'Kaleidoscope';

async function deriveKey(passphrase, salt, usages) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, usages);
}

async function sealText(text, passphrase) {
  if (!passphrase) throw new Error('A passphrase is required.');
  if (!text.trim()) throw new Error('There is no text to encrypt.');
  const payload = JSON.stringify({
    v: 1,
    defaultKey: 'ALL',
    nodes: [{ id: Date.now(), note: 'C', priority: 1, content: text }]
  });
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(payload)));
  const record = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.length);
  record.set(salt, 0);
  record.set(iv, SALT_BYTES);
  record.set(ciphertext, SALT_BYTES + IV_BYTES);
  return Array.from(record);
}

async function savePending(record, theme) {
  pendingRecord = record;
  pendingTheme = theme;
  if (chrome.storage?.session) {
    await chrome.storage.session.set({ pendingRecord: record, pendingTheme: theme });
  }
}

async function loadPending() {
  if (chrome.storage?.session) {
    const stored = await chrome.storage.session.get(['pendingRecord', 'pendingTheme']);
    if (stored?.pendingRecord) {
      return {
        record: stored.pendingRecord,
        theme: stored.pendingTheme || 'Kaleidoscope'
      };
    }
  }
  return pendingRecord ? { record: pendingRecord, theme: pendingTheme } : null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'ENCRYPT_PAYLOAD') {
    sealText(message.text || '', message.pin)
      .then(record => savePending(record, message.theme || 'Kaleidoscope'))
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (message.action === 'GET_PENDING_DATA') {
    loadPending()
      .then(data => sendResponse(data
        ? { success: true, record: data.record, theme: data.theme }
        : { success: false }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
