# Kaleidoscope Glyph (KGLYPH2)

Save your AI notes and rules as one small encrypted picture, then restore them later as a short prompt. Everything runs on your own device. No server, no account.

Two versions, fully compatible with each other:

| Version | How to run |
| :--- | :--- |
| `glyph.html` | Double-click to open in a browser. Works offline. Simple Mode for first-time users, with an Advanced drawer for keys, token budget and prompt preview. |
| `glyph.py` | `pip install cryptography pillow`, then `python glyph.py demo` (demo passkey: `demo-password`), `python glyph.py save notes.json`, `python glyph.py load file.png`. |

After editing any script in `glyph.html`, run `python update_csp.py glyph.html` to refresh its security hashes.

## Private AI chat (beta, `glyph.html` only)
Press nothing and the page never touches the network. If your browser supports WebGPU, a chat card lets you run a small AI inside the browser, using your notes as its instructions. It checks the download size first, shows progress with Cancel Download, and has Stop Generating, New chat and Unload AI. *Suggest notes* proposes notes from the chat; nothing is added until you press Keep. Clear Session empties the chat and frees the AI's memory.

What the security policy allows for this (and nothing else): the AI software from `cdn.jsdelivr.net/npm/` (pinned to `@mlc-ai/web-llm@0.2.82`), `'wasm-unsafe-eval'` so the AI can run, and model files from `huggingface.co`, `*.huggingface.co`, `*.hf.co` and `raw.githubusercontent.com`. Your notes, messages and passkey are never sent. Not yet tested against a real model on a real GPU: please report problems.

## Important to know
- **No passkey recovery.** Lose the passkey and the notes are gone. A 4-word passphrase is suggested.
- **Re-saving the PNG can erase the notes** (resize, screenshot, JPEG/WebP, many chat apps). Keep the original file.
- **The glyph is not smaller than your data.** The PNG is about 300 KB; the saving comes from sending short distilled notes to an AI instead of the whole chat.
- The browser cannot guarantee that memory is wiped. Use *Clear Session* and close the tab on shared computers.
- Not reviewed for healthcare or other regulated use.
- MIT license, provided AS IS.

Format details: [`docs/SPEC-kglyph2.md`](../../docs/SPEC-kglyph2.md).

![Pipeline](../../docs/glyph-pipeline.png)
