# KVMS-1.0: Local-First Encrypted Memory Glyph Format

**Status:** Draft 1 · **License:** MIT (same as this repository) · **Reference implementation:** `web-vault/pixel-vault/index.html` (the section between `CORE START` and `CORE END`)

> This file describes the **pixel format**, where the locked data is hidden inside the picture's pixels. The other page in this repository, Glyph Forge, hides its data in a different way: see [SPEC-glyph-forge.md](SPEC-glyph-forge.md).

## 1. In plain words

KVMS-1.0 describes how to turn a block of text (for example, a saved AI chat) into a single encrypted record, and how to carry that record in one of two containers:

1. a **glyph**: a 512×512 PNG picture with the record hidden inside its pixels, or
2. a **`.kvms` file**: the same record in a small plain file, used as a backup.

Nothing is sent to any server. Only someone who knows the passphrase can read the text back.

The key words MUST, SHOULD and MAY are used as in RFC 2119.

## 2. What this standard does and does not promise

It promises:

- The text is encrypted with AES-256-GCM, with a key derived from the passphrase. Without the passphrase, the data cannot be read, and any change to it is detected.
- The record can be decoded by any program that follows this document.

It does **not** promise:

- **Secrecy that a glyph exists.** The glyph's header is stored unencrypted (section 6.2), so anyone can recognise it as a glyph. Only the contents are protected.
- **Protection from the AI provider.** If a restored chat is pasted into a cloud AI service, that service sees it. KVMS protects the stored copy, not the live conversation.
- **Survival through lossy handling.** Resizing, recompressing, screenshotting, or converting the PNG destroys the data permanently. There is no error correction.
- **Protection from weak passphrases.** See section 9.

## 3. Pipeline

```
text ──UTF-8──▶ bytes ──DEFLATE──▶ compressed ──AES-256-GCM──▶ record ──▶ glyph (PNG)  or  .kvms file
```

1. Encode the text as UTF-8.
2. Compress it with raw DEFLATE (RFC 1951, no zlib or gzip wrapper).
3. Encrypt the result as described in section 4.
4. Wrap the result in the record layout of section 5.
5. Store the record in a glyph (section 6) or a file (section 7).

## 4. Encryption

| Item | Value |
|---|---|
| Passphrase handling | Normalise to Unicode **NFKC**, then encode as UTF-8. This makes the same typed passphrase work across devices. |
| Key derivation | **PBKDF2-HMAC-SHA-256**, 256-bit output |
| Salt | 16 bytes from a cryptographically secure random generator, **new for every save** |
| Iterations | Stored in the record. Encoders SHOULD use at least **600,000**. Decoders MUST accept 1 to 5,000,000 and MUST reject anything else. |
| Cipher | **AES-256-GCM** |
| IV (nonce) | 12 bytes from a cryptographically secure random generator, **new for every save** |
| Tag | 128 bits, appended to the end of the ciphertext |
| Additional authenticated data | none |

The decoder reverses the pipeline: derive the key, decrypt and check the tag, DEFLATE-decompress, decode UTF-8.

## 5. Record layout

All numbers are big-endian. The record is the thing that goes into a glyph or a file.

| Offset | Size | Field | Value |
|---|---|---|---|
| 0 | 1 | `saltLen` | 16 |
| 1 | 1 | `ivLen` | 12 |
| 2 | 4 | `iterations` | PBKDF2 iteration count |
| 6 | `saltLen` | `salt` | random |
| 6 + `saltLen` | `ivLen` | `iv` | random |
| 6 + `saltLen` + `ivLen` | rest | `ciphertext` | AES-GCM output, ending in the 16-byte tag |

Fixed overhead: 6 + 16 + 12 + 16 = **50 bytes**. Decoders MUST read `saltLen` and `ivLen` from the record rather than assume them, and MUST reject a record whose lengths run past its end.

## 6. Container A: the glyph (PNG)

### 6.1 Image requirements

- Exactly **512 × 512** pixels, stored as a **lossless PNG**.
- Encoders MUST write every pixel with **alpha = 255** (fully opaque). Browsers handle transparent pixels in ways that can silently alter colour values; opaque pixels avoid that.
- Decoders MUST NOT resize, colour-convert, or otherwise alter pixel values before reading. Decoders MUST ignore alpha.

### 6.2 Where the bits go

The record is hidden in the **least significant bit** (the last bit) of the **red, green, and blue** values of the pixels. Each colour value changes by at most 1 out of 255, which is not visible. Alpha is never touched.

- Pixels are numbered in row order: pixel `p` is at column `p mod 512`, row `⌊p / 512⌋`.
- Bits are numbered from 0. **Bit `i` is stored in channel `i mod 3` (0 = red, 1 = green, 2 = blue) of pixel `⌊i / 3⌋`.**
- Bytes are written in order, and within each byte the **most significant bit comes first**.

Example: the first byte of every glyph is `0x4B` (binary `0100 1011`). Its bits go to:

| Pixel | Red | Green | Blue |
|---|---|---|---|
| 0 | 0 | 1 | 0 |
| 1 | 0 | 1 | 0 |
| 2 | 1 | 1 | (next byte begins here) |

### 6.3 Stream layout

The bit stream starts with a 7-byte header, followed by the record.

| Offset | Size | Field | Value |
|---|---|---|---|
| 0 | 2 | magic | `0x4B 0x56` (the letters "KV") |
| 2 | 1 | version | `0x01` |
| 3 | 4 | `length` | size of the record in bytes (N) |
| 7 | N | record | as in section 5 |

### 6.4 Capacity

512 × 512 pixels × 3 bits = 786,432 bits = 98,304 bytes. After the 7-byte header, a glyph holds a record of up to **98,297 bytes**. After the 50 bytes of overhead, that is up to **98,247 bytes of compressed text**. Chat text usually compresses to between a third and a half of its size, depending on how repetitive it is, so a glyph typically holds a couple of hundred KB of chat text.

Bits after the end of the record are not used, and decoders MUST ignore them.

### 6.5 The artwork

Everything visible in the picture is **decoration**. It carries no data, no meaning, and no instructions. Decoders MUST ignore it. Because it is purely decorative, it leaks nothing about the contents.

The reference encoder draws a dark background, a purple frame with corner squares, scattered coloured dots, and thin blue lines. It generates this from a pseudo-random sequence seeded from the record's salt, so each glyph looks different. This is informative only: an encoder may draw anything, or use any 512 × 512 image, as long as section 6.1 is respected.

### 6.6 Decoding a glyph

1. Check the image is a PNG of exactly 512 × 512. If not, stop.
2. Read the 7-byte header. If the magic or version do not match, or `length` is 0 or larger than 98,297, report "not a vault glyph".
3. Read `length` bytes of record.
4. Decode the record (section 5) with the passphrase.

Encoders SHOULD decode what they just wrote, before offering it to the user. This catches browser privacy modes that add noise to pixel reads, which would otherwise produce a glyph that cannot be opened.

## 7. Container B: the `.kvms` file

| Offset | Size | Field | Value |
|---|---|---|---|
| 0 | 5 | magic and version | `4B 56 4D 53 01` (the letters "KVMS", then version 1) |
| 5 | rest | record | as in section 5 |

Decoders MUST reject a file whose first five bytes differ. Unlike a glyph, this file survives being copied, synced, and emailed, so it is the recommended backup.

## 8. Errors

When decryption fails, decoders SHOULD show one message for every cause ("wrong passphrase, or the data is damaged"). A wrong passphrase and a damaged record cannot be told apart by design, and a more specific message would only help an attacker.

## 9. Security considerations

- **Passphrase strength is everything.** Anyone who gets a glyph or file can try passphrases on their own computer, as fast as they like, with no limit on attempts. The iteration count slows each guess but cannot save a weak passphrase. A 4-digit PIN is broken in seconds. Implementations SHOULD ask for a long passphrase and warn about short ones.
- **There is no recovery.** If the passphrase is lost, the data is gone.
- **What an observer can learn:** that the image is a glyph, the approximate size of the compressed text (from `length`), the iteration count, and the salt and IV (which are not secret). They cannot learn the text.
- **Compression before encryption** means the stored size reflects how compressible the text is. This is not a practical risk for a single saved file that an attacker cannot influence, but it is noted for completeness.
- **Memory.** A web page or extension can clear what it displays, but cannot guarantee that every copy of the text is erased from memory. Implementations MUST NOT claim otherwise.
- **Cloud photo services.** Saving a glyph to a camera roll that syncs to iCloud, Google Photos, or similar puts the (encrypted) file in those services, and they may recompress it. Keep the original PNG, and keep a `.kvms` backup.
- **Trust in the code.** A page or extension that handles the passphrase can read it. Users should run code they have inspected, from a source they trust.

## 10. Versioning

The version byte in the glyph header (section 6.3) and the file magic (section 7) identify this format as version 1. Decoders MUST reject versions they do not know. The iteration count is stored in each record, so it can be raised without a new version. Changing the cipher, the key derivation, or the bit layout requires a new version.

## 11. Test vector (decode only)

Use this to check a new decoder. It is a record (section 5) that was built independently of the reference implementation.

- **Passphrase:** `test-key`
- **Expected text:** `hello`
- **Iterations:** 1000 (low, for speed; real records use 600,000 or more)
- **Salt:** `000102030405060708090a0b0c0d0e0f`
- **IV:** `101112131415161718191a1b`
- **Compressed plaintext (DEFLATE of "hello"):** `cb48cdc9c90700`

**Record (57 bytes, hex):**

```
100c000003e8000102030405060708090a0b0c0d0e0f101112131415161718191a1b2ae06c3298920f1c6cb327e87047a8ec01f3f461dbf831
```

The same record as a `.kvms` file begins with `4b564d5301100c00…`.

Different DEFLATE programs can produce different (but equally valid) compressed bytes for the same text, so an encoder is not expected to reproduce the ciphertext above. A decoder is expected to turn this record into exactly `hello`.

## 12. Implementation notes

- All the cryptography is available in browsers through the standard Web Crypto API (`SubtleCrypto`) and the Compression Streams API (`deflate-raw`).
- A glyph can be read back in a browser by drawing the PNG onto a canvas and reading its pixels. Some privacy settings (for example fingerprint protection in some browsers) change those pixels. If decoding fails only in one browser, check that first.
- The reference implementation ships a built-in self-test that checks round trips, wrong passphrases, damaged data, size limits, and the "at most 1 per colour" rule.
