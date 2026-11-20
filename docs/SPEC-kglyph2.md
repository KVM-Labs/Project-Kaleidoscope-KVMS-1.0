# SPEC: KGLYPH2 (Kaleidoscope Glyph)

**Storage:** base64 of the payload in a PNG `tEXt` chunk named `kaleidoscope`.

**Payload (KGLYPH2):**
`"KGLYPH2"` (7) | N (uint32 BE) | r (1) | p (1) | salt (16) | nonce (12) | AES-256-GCM ciphertext + 16-byte tag

- Key: scrypt(passkey, salt, N, r, p) to 32 bytes. Defaults N=32768, r=8, p=3.
- AAD: the first 41 bytes (everything before the ciphertext).
- Caps checked before any slow work: N a power of two from 2^14 to 2^17, r 1..8, p 1..8.
- Plaintext: 4-byte BE length | zlib(JSON session) | zero padding to a bucket of 16,384 / 65,536 / 262,144 / 499,000 bytes. (Earlier unpadded KGLYPH2 files, whose first byte is 0x78, are still read.) Maximum payload: 500,000 bytes.
- Session JSON (version 2): `title`, notes with `note`, `text`, `priority`, labels. The title is inside the encrypted data.

**KGLYPH1 (read only):** `"KGLYPH1"` | salt | nonce | ciphertext; AAD = the magic; N=32768, r=8, p=1.

**Visible label:** `KVMS-1.0 · YYYY-MM-DD HH:MM · ID: XXXXXXXX`, where ID is the first 8 hex characters of SHA-256 of the payload. File name: `KVMS_YYYY-MM-DD_HHMM_XXXXXXXX.png`.
