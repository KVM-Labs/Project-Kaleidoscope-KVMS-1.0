document.getElementById('expBtn').addEventListener('click', async () => {
const pinValue = document.getElementById('pinInput').value;
const manualTextInput = document.getElementById('manualTextInput');
const manualText = manualTextInput ? manualTextInput.value.trim() : "";
const statusMsg = document.getElementById('msg');

if (!pinValue) {
statusMsg.style.color = "#ef4444";
statusMsg.innerText = "Error: Key required.";
return;
}

statusMsg.style.color = "#3b82f6";
statusMsg.innerText = "Processing system vault...";

// 1. Check if the user manually pasted text into our backup fallback text box
if (manualText.length > 0) {
chrome.runtime.sendMessage({
action: "ENCRYPT_PAYLOAD",
text: manualText,
pin: pinValue
}, (cryptoResponse) => {
if (cryptoResponse && cryptoResponse.success) {
statusMsg.style.color = "#10b981";
statusMsg.innerText = "Vault Matrix Opening...";
// Instantly open the canvas tab—the canvas will automatically pull the data!
chrome.tabs.create({ url: chrome.runtime.getURL('ui/canvas_renderer.html') });
}
});
return;
}

// 2. Automated Webpage Scraper Fallback Route
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (!tab) return;

chrome.scripting.executeScript({
target: { tabId: tab.id },
func: () => {
let elements = document.querySelectorAll('.message-content, [class*="message"], [data-message-author-role], p');
let cleanText = "";
elements.forEach(el => cleanText += el.innerText.trim() + "\n\n");
return cleanText.trim();
}
}, (injectionResults) => {
const extractedText = (injectionResults && injectionResults[0] && injectionResults[0].result) ? injectionResults[0].result : "Default Blueprint Context Data";

chrome.runtime.sendMessage({
action: "ENCRYPT_PAYLOAD",
text: extractedText,
pin: pinValue
}, (cryptoResponse) => {
if (cryptoResponse && cryptoResponse.success) {
statusMsg.style.color = "#10b981";
statusMsg.innerText = "Vault Matrix Opening...";
chrome.tabs.create({ url: chrome.runtime.getURL('ui/canvas_renderer.html') });
}
});
});
});