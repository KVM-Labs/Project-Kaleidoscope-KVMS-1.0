// background/worker.js
// Seals the text with the user's passkey. Matches WHITEPAPER section 2.2:
//   PBKDF2-HMAC-SHA256 (100,000 rounds, random 16-byte salt) -> AES-256-GCM (random 12-byte IV).
// The saved record is  salt(16) | iv(12) | ciphertext+tag  (same as the "kvMk" PNG chunk used by Glyph Forge).

const PBKDF2_ROUNDS = 100000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

let pendingRecord = null; // backup in case chrome.storage.session is not available

async function deriveKey(passkey, salt) {
  const baseKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passkey), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
}

async function sealText(text, passkey) {
  if (!passkey) throw new Error("A passkey is required.");
  // Same JSON shape as the paper (section 2.1) so Glyph Forge can open the result.
  const payload = JSON.stringify({
    v: 1,
    defaultKey: "ALL",
    nodes: [{ id: Date.now(), note: "C", priority: 1, content: text }]
  });
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passkey, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(payload)));
  const record = new Uint8Array(SALT_BYTES + IV_BYTES + ct.length);
  record.set(salt, 0);
  record.set(iv, SALT_BYTES);
  record.set(ct, SALT_BYTES + IV_BYTES);
  return Array.from(record);
}

async function savePending(record) {
  pendingRecord = record;
  if (chrome.storage && chrome.storage.session) {
    await chrome.storage.session.set({ pendingRecord: record });
  }
}

async function loadPending() {
  if (chrome.storage && chrome.storage.session) {
    const got = await chrome.storage.session.get("pendingRecord");
    if (got && got.pendingRecord) return got.pendingRecord;
  }
  return pendingRecord;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "ENCRYPT_PAYLOAD") {
    sealText(message.text || "", message.pin)
      .then(async record => { await savePending(record); sendResponse({ success: true }); })
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === "GET_PENDING_DATA") {
    loadPending()
      .then(record => sendResponse({ success: !!record, record }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
