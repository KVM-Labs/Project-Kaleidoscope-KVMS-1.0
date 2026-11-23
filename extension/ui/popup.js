const statusMsg = document.getElementById('msg');

function setStatus(message, isError = false) {
  statusMsg.style.color = isError ? '#ef4444' : '#10b981';
  statusMsg.textContent = message;
}

async function collectActiveTabText(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const host = location.hostname;
      const messages = [];
      const add = (role, el) => {
        const text = el.innerText?.trim();
        if (text) messages.push(`[${role}]: ${text}`);
      };

      if (host.includes('chatgpt.com')) {
        document.querySelectorAll('[data-message-author-role]').forEach(el => {
          add((el.getAttribute('data-message-author-role') || 'message').toUpperCase(), el);
        });
      } else if (host.includes('claude.ai')) {
        document.querySelectorAll('[data-testid*="message"], [class*="message"].group').forEach(el => {
          const role = el.querySelector('[data-testid*="user"], [class*="human"]') ? 'USER' : 'ASSISTANT';
          add(role, el);
        });
      } else if (host.includes('gemini.google.com')) {
        document.querySelectorAll('user-query, model-response').forEach(el => {
          add(el.matches('user-query') ? 'USER' : 'ASSISTANT', el);
        });
      }

      if (!messages.length) {
        document.querySelectorAll('.message-content, [data-message-author-role], p').forEach(el => add('TEXT', el));
      }
      const selection = window.getSelection()?.toString().trim();
      if (selection) messages.unshift(`[MANUAL_SELECTION]: ${selection}`);
      return [...new Set(messages)].join('\n\n').trim();
    }
  });
  return results?.[0]?.result || '';
}

document.getElementById('expBtn').addEventListener('click', async () => {
  const pin = document.getElementById('pinInput').value;
  const theme = document.getElementById('themeSelect').value;
  const manualText = document.getElementById('manualTextInput').value.trim();
  if (!pin) return setStatus('Enter a passphrase first.', true);

  setStatus('Collecting text…');
  let text = manualText;
  if (!text) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return setStatus('No active tab found.', true);
      text = await collectActiveTabText(tab.id);
    } catch (error) {
      return setStatus(`Could not read this page: ${error.message}`, true);
    }
  }
  if (!text) return setStatus('No chat text found. Paste text above and try again.', true);

  setStatus('Encrypting locally and preparing glyph…');
  chrome.runtime.sendMessage({ action: 'ENCRYPT_PAYLOAD', text, pin, theme }, response => {
    if (chrome.runtime.lastError || !response?.success) {
      return setStatus(response?.error || chrome.runtime.lastError?.message || 'Could not encrypt the data.', true);
    }
    chrome.tabs.create({ url: chrome.runtime.getURL('ui/canvas_renderer.html') }, () => {
      if (chrome.runtime.lastError) setStatus(`Encrypted, but could not open the glyph: ${chrome.runtime.lastError.message}`, true);
      else setStatus('Glyph ready. Download should begin in the new tab.');
    });
  });
});

document.getElementById('impBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('ui/restore.html') }, () => {
    if (chrome.runtime.lastError) setStatus(`Could not open restore: ${chrome.runtime.lastError.message}`, true);
  });
});
