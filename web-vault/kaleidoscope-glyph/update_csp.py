#!/usr/bin/env python3
"""Refreshes the Content-Security-Policy in glyph.html after you edit its scripts.
Usage: python update_csp.py [glyph.html]
The page only runs scripts whose fingerprints (SHA-256 hashes) are listed in its
policy. If you change a script and do not run this, the browser will block it."""
import base64, hashlib, re, sys
path = sys.argv[1] if len(sys.argv) > 1 else "glyph.html"
html = open(path, encoding="utf-8").read()
bodies = re.findall(r"<script id=\"[a-z]+\">(.*?)</script>", html, re.S)
if len(bodies) != 2:
    raise SystemExit("Expected the two scripts (core and ui); found %d." % len(bodies))
hashes = " ".join("'sha256-%s'" % base64.b64encode(hashlib.sha256(b.encode("utf-8")).digest()).decode() for b in bodies)
# Step 3B (optional on-device AI chat) needs exactly these extra permissions, used only after a button press:
#   script-src: 'wasm-unsafe-eval' (the AI runs as WebAssembly) and the npm part of cdn.jsdelivr.net (the AI software)
#   connect-src: Hugging Face (+ its download hosts) for the model files, raw.githubusercontent.com for the model's program file
policy = ("default-src 'none'; script-src %s 'wasm-unsafe-eval' https://cdn.jsdelivr.net/npm/; style-src 'unsafe-inline'; img-src blob: data:; "
          "connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com; "
          "base-uri 'none'; form-action 'none'" % hashes)
new, n = re.subn(r'(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)',
                 lambda m: m.group(1) + policy + m.group(2), html)
if n != 1:
    raise SystemExit("Could not find the Content-Security-Policy meta tag.")
open(path, "w", encoding="utf-8").write(new)
print("CSP updated for", path)
