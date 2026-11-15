(() => {
    const hostname = window.location.hostname;
    let chatLog = "";

    console.log("[Kaleidoscope] Scraper activated on: " + hostname);

    if (hostname.includes("chatgpt.com")) {
        const messageElements = document.querySelectorAll('div[data-message-author-role]');
        messageElements.forEach(msg => {
            const role = msg.getAttribute('data-message-author-role');
            const textContent = msg.innerText.trim();
            if (textContent && !textContent.includes("Something went wrong")) {
                chatLog += `[${role.toUpperCase()}]: ${textContent}\n\n`;
            }
        });
    } else if (hostname.includes("claude.ai")) {
        const allBlocks = document.querySelectorAll('div[class*="message"], div[class*="text"]');
        allBlocks.forEach(block => {
            const text = block.innerText.trim();
            if (text && !text.includes("Something went wrong") && !text.includes("error")) {
                if (block.className.includes("user")) {
                    chatLog += `[USER]: ${text}\n\n`;
                } else if (block.className.includes("claude") || block.className.includes("assistant")) {
                    chatLog += `[ASSISTANT]: ${text}\n\n`;
                }
            }
        });
    } else if (hostname.includes("google.com")) {
        const userQueries = document.querySelectorAll('user-query');
        const modelResponses = document.querySelectorAll('model-response');
        userQueries.forEach((query, index) => {
            const userText = query.innerText.trim();
            chatLog += `[USER]: ${userText}\n\n`;
            if (modelResponses[index]) {
                const aiText = modelResponses[index].innerText.trim();
                if (!aiText.includes("Something went wrong")) {
                    chatLog += `[ASSISTANT]: ${aiText}\n\n`;
                }
            }
        });
    }

    const finalizedPayload = chatLog.trim();
    if (finalizedPayload.length === 0) {
        const selection = window.getSelection().toString().trim();
        if (selection) {
            chrome.runtime.sendMessage({ action: "processScrapedText", data: `[MANUAL_SELECTION]: ${selection}` });
            return;
        }
        chrome.runtime.sendMessage({ action: "scraperError", error: "No text data extracted." });
    } else {
        chrome.runtime.sendMessage({ action: "processScrapedText", data: finalizedPayload });
    }
})();