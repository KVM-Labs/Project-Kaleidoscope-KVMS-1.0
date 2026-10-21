README.md
======================================================================
DEVELOPER BLUEPRINT: PROJECT README (README.md)
======================================================================
File Name: README.md
Format: Markdown Standard

# Project Kaleidoscope (KVMS-1.0)
## A Universal, High-Density Visual Data Standard for Offline AI Context Restoration

Project Kaleidoscope is a privacy-first, zero-cloud browser extension engineered to establish a universal standard for cross-browser human-AI interaction. It eliminates AI context-loss and reduces cloud data-center server strains by allowing users to compress, locally encrypt (AES-256-GCM), and render deep AI chat histories into a highly compact visual image file (a "Memory Glyph") that resembles abstract art. 

When a user drops their 50KB custom PNG back into a fresh, blank multimodal AI interface, the universal browser extension aligns the visual matrix, prompts for a passkey PIN, and instantly rehydrates the AI's cognitive context offline.

---

## 🎨 The 3-Axis Visual Data Layer Multiplexing Architecture
Unlike fragile high-density matrix grids, Kaleidoscope utilizes distinct, high-contrast geometric paths rendered across a fixed 512x512 canvas coordinate matrix:
1. **Axis A - Geometric Shape Vector (Intent):** Different shape structures (Triangles, Squares, Circles, Pentagons) categorize instruction types, system rules, and data schemas.
2. **Axis B - Spatial Positioning (Context Map):** Exact X,Y pixel coordinates map chronological priorities and conceptual dependency vectors with a strict (0,0) origin point.
3. **Axis C - Color Multiplexing (Variables):** Standard Red (Tech Stack), Green (Progress Completion), and Blue (Security Access Flags) RGB channels act as direct bit-multipliers to encode background variables.

---

## 📂 Project Repository Directory Tree
To deploy the extension locally, ensure your directory matches the following local tree layout:

```text
project-kaleidoscope/
├── manifest.json
├── icons/
│   ├── kaleidoscope_16.png
│   ├── kaleidoscope_48.png
│   └── kaleidoscope_128.png
├── background/
│   └── worker.js
├── scripts/
│   └── content_scraper.js
└── ui/
    ├── popup.html
    └── canvas_renderer.html
```

---

## 🛠️ Universal Local Installation & Setup Guide

To load and test this prototype extension locally inside your preferred modern web browser, follow the corresponding pipeline steps:

### For Chromium Browsers (Google Chrome, Brave, Microsoft Edge, Opera)
1. Open your browser and navigate to the extensions management console:
   * **Chrome:** `chrome://extensions`
   * **Brave:** `brave://extensions`
   * **Edge:** `edge://extensions`
2. Toggle the **Developer Mode** switch in the top-right corner to **ON**.
3. Click the **Load unpacked** button that appears in the top-left toolbar.
4. Select your root local folder: `project-kaleidoscope/`. The extension will instantly parse your `manifest.json` file and mount into your active browser profile.

### For Mozilla Firefox
1. Launch Firefox and type `about:debugging` into the URL search bar.
2. Click on **This Firefox** in the left sidebar menu.
3. Click the **Load Temporary Add-on...** button.
4. Select your local `manifest.json` file from your project folder to register the service worker background layers.

---

## 🔓 Verification & Runtime Usage
1. Navigate to any supported AI environment (`chatgpt.com`, `claude.ai`, or `://google.com`).
2. Click the Kaleidoscope puzzle piece icon in your browser toolbar to reveal the floating sidebar panel.
3. Enter your local secure validation passkey PIN and select your preferred visual camouflage layout style (e.g., Bauhaus Abstract Art).
4. Tap **Export Current Session** to locally compress, encrypt, and instantly download your functional visual context asset file.

---

## ⚖️ Legal Disclaimer & Open-Source License

### Disclaimer
This software is a proof-of-concept prototype provided "as-is" for educational, research, and workflow optimization purposes. The author makes no warranties regarding the absolute security of the underlying local encryption or performance stability across future third-party AI website DOM updates. The author is not responsible for any data loss, platform-level restrictions, browser service disruptions, or any form of data misuse arising from the deployment of this visual data standard.

### License

Copyright (c) 2026 KVM Labs

Project Kaleidoscope is released under the open-source **MIT License**. 
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
======================================================================
