// background/worker.js
console.log("Kaleidoscope Brain: Service Worker Active.");

let pendingPayload = null;

async function deriveKeyFromPIN(pin) {
const encoder = new TextEncoder();
const hash = await crypto.subtle.digest('SHA-256', encoder.encode(pin || "0000"));
return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptData(text, pin) {
const encoder = new TextEncoder();
const data = encoder.encode(text || "Sample data payload.");
const key = await deriveKeyFromPIN(pin);
const iv = crypto.getRandomValues(new Uint8Array(12));
const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data);

return {
iv: Array.from(iv),
ciphertext: Array.from(new Uint8Array(encryptedBuffer))
};
}

// System Message Hub Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
if (message.action === "ENCRYPT_PAYLOAD") {
encryptData(message.text, message.pin)
.then(payload => {
pendingPayload = payload; // Lock data securely into global cache memory
sendResponse({ success: true, payload: payload });
})
.catch(err => {
sendResponse({ success: false, error: err.message });
});
return true;
}

if (message.action === "GET_PENDING_DATA") {
// Send the stored data array back to the canvas tab
sendResponse({ success: true, payload: pendingPayload });
return false;
}
});