# Kaleidoscope Glyph (KGLYPH2)

Save your AI notes and rules as one small encrypted picture, then restore them later as a short prompt. Everything runs on your own device. No server, no account.

Two versions, fully compatible with each other:

| Version | How to run |
| :--- | :--- |
| `glyph.html` | Double-click to open in a browser. Works offline. Simple Mode for first-time users, with an Advanced drawer for keys, token budget and prompt preview. |
| `glyph.py` | `pip install cryptography pillow`, then `python glyph.py demo` (demo passkey: `demo-password`), `python glyph.py save notes.json`, `python glyph.py load file.png`. |

Older copies of the page are kept in [`versions/`](versions/README.md) so you can see how it looked in the past.

After editing any script in `glyph.html`, run `python update_csp.py glyph.html` to refresh its security hashes.

## Private AI chat (beta, `glyph.html` only)
Press nothing and the page never touches the network. If your browser supports WebGPU, a chat card lets you run a small AI inside the browser, using your notes as its instructions. It checks the download size first, shows progress with Cancel Download, and has Stop Generating, New chat and Unload AI. *Suggest notes* proposes notes from the chat; nothing is added until you press Keep. Clear Session empties the chat and frees the AI's memory.

What the security policy allows for this (and nothing else): the AI software from `cdn.jsdelivr.net/npm/` (pinned to `@mlc-ai/web-llm@0.2.82`), `'wasm-unsafe-eval'` so the AI can run, and model files from `huggingface.co`, `*.huggingface.co`, `*.hf.co` and `raw.githubusercontent.com`. Your notes, messages and passkey are never sent. Not yet tested against a real model on a real GPU: please report problems.

## Important to know
- **Messaging apps can strip the hidden data.** WhatsApp, iMessage and screenshots re-save pictures and drop the locked data. After saving, press **Copy locked text** and keep that text as a backup. In Load Glyph, open "Paste locked text instead" to unlock from it. The text runs from `---BEGIN KALEIDOSCOPE GLYPH---` to `---END KALEIDOSCOPE GLYPH---` and is the same locked data, so it is just as private: it needs the passkey. A cut-off copy is refused with a clear message.
- **Picture styles.** In Save Glyph you can pick Classic Kaleidoscope, Golden Spiral or Fibonacci Lattice to tell your glyphs apart by sight. The choice is stored inside the locked data (so only you know what each style means) and is restored when you unlock, including for Quick Re-Save. glyph.py can open these glyphs but drops the style if it re-saves them.
- **Day / Night mode.** The ☀ Day / 🌙 Night button (top right) switches the look. First visit follows your device setting; your choice is remembered on this device only.
- **One box for notes.** Paste a chat summary or type a rule and press Enter: each line becomes its own note (bullets and numbering are removed). Shift+Enter adds a new line.
- **Simple front page.** The big box at the top is all most people need: paste, then Save Glyph, or Load Glyph, then Copy prompt. Musical Key, the size limit, the prompt preview and the rule editor live under ⚙ Advanced Controls (closed by default).
- **Fibonacci Lattice** is now a woven mandala with 12- or 16-fold symmetry drawn from the glyph's fingerprint.
- **No passkey recovery.** Lose the passkey and the notes are gone. A 4-word passphrase is suggested.
- **Re-saving the PNG can erase the notes** (resize, screenshot, JPEG/WebP, many chat apps). Keep the original file.
- **The glyph is not smaller than your data.** The PNG is about 300 KB; the saving comes from sending short distilled notes to an AI instead of the whole chat.
- The browser cannot guarantee that memory is wiped. Use *Clear Session* and close the tab on shared computers.
- Not reviewed for healthcare or other regulated use.
- MIT license, provided AS IS.

Format details: [`docs/SPEC-kglyph2.md`](../../docs/SPEC-kglyph2.md).

![Pipeline](../../docs/glyph-pipeline.png)
