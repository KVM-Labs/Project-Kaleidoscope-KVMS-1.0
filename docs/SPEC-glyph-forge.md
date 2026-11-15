# KVMS-1.0: Glyph Forge format (notes in a PNG chunk)

**Status:** Draft 1 · **License:** MIT (same as this repository) · **Reference implementation:** `web-vault/glyph-forge/index.html`

## 1. In plain words

Glyph Forge saves a small set of **notes** (rules, constraints, preferences) as one encrypted record. The record is carried in one of two containers:

1. a **glyph**: a 512×512 PNG picture with the record tucked into a hidden section of the file, or
2. a **`.kvmk` file**: the same record in a small plain file, used as a backup.

Nothing is sent to any server. Only someone who knows the passphrase can read the notes back. The page then turns the notes into a text prompt that you copy into an AI chat. The AI never reads the picture.

For the other format in this repository, which hides data in the picture's pixels, see [SPEC-pixel-vault.md](SPEC-pixel-vault.md). The two are **not** interchangeable.

The key words MUST, SHOULD and MAY are used as in RFC 2119.

## 2. What this format does and does not promise

It promises:

- The notes are encrypted with AES-256-GCM, with a key derived from the passphrase. Without the passphrase they cannot be read, and any change to the encrypted data is detected.
- Any program that follows this document can read the record.
- There is no practical size limit. The hidden section of a PNG can be very large (the PNG rules allow about 2 GB). The reference page was tested with 800 KB of notes.

It does **not** promise:

- **That the glyph is secret.** The hidden section has a recognisable name (`kvMk`), and its size shows roughly how much text is inside.
- **That the data survives being rewritten.** Anything that re-saves, converts, resizes, "optimizes" or screenshots the image can drop the hidden section. A plain re-save as an ordinary PNG, with no change to the picture at all, removed it in testing. Keep the original file and a `.kvmk` backup.
- **Protection from the AI provider.** Once you paste the restored prompt into a cloud AI, that service sees it.
- **Protection from weak passphrases.** See section 9.

## 3. The notes (what is inside the encryption)

Before encryption the notes are written as one JSON text (UTF-8, no compression):

```json
{"v":1,"defaultKey":"C_MAJOR","nodes":[{"id":1,"note":"C","priority":1,"content":"Write clean, modular code."}]}
```

| Field | Meaning |
|---|---|
| `v` | Format version inside the data. Currently `1`. |
| `defaultKey` | Which note set the reader starts with: `C_MAJOR`, `A_MINOR`, `G_MAJOR`, `C_TRIAD`, or `ALL` (section 8). |
| `nodes` | The list of notes. |
| `nodes[].id` | A number that is larger for newer notes (the page uses the time it was added). Used for "oldest first" ordering. |
| `nodes[].note` | One of the 12 note names: `C C# D D# E F F# G G# A A# B`. Used as a category tag. The page labels them (C = core rules, E = security, and so on), but the label is not stored. |
| `nodes[].priority` | A number, 1 is most important. |
| `nodes[].content` | The text of the note. |

Readers SHOULD ignore fields they do not know, and MUST treat `content` as plain text, never as markup.

## 4. Encryption

| Item | Value |
|---|---|
| Passphrase handling | The text exactly as typed, encoded as UTF-8. It is **not** normalised, so the same accented characters typed on two devices could differ. |
| Key derivation | **PBKDF2-HMAC-SHA-256**, **100,000** iterations, 256-bit output. The count is fixed by this format and is not stored. |
| Salt | 16 random bytes, **new for every save** |
| Cipher | **AES-256-GCM** |
| IV (nonce) | 12 random bytes, **new for every save** |
| Tag | 128 bits, appended to the end of the ciphertext |
| Additional authenticated data | none |

## 5. The record

The record is the thing that goes into a glyph or a file. It has no header.

| Offset | Size | Field |
|---|---|---|
| 0 | 16 | `salt` |
| 16 | 12 | `iv` |
| 28 | rest | `ciphertext`, ending in the 16-byte tag |

Fixed overhead is 16 + 12 + 16 = **44 bytes**. A record shorter than 29 bytes is not valid.

Because nothing outside the encrypted data says which version or iteration count was used, a future change to either needs a new container name (for example a chunk called `kvM2`) rather than a changed record.

## 6. Container A: the glyph (PNG)

### 6.1 The hidden section

The record is stored as one PNG **chunk** with these properties:

- chunk type: `kvMk` (the four letters k, v, M, k). Under the PNG naming rules this is a private, non-essential, safe-to-copy chunk, so programs that do not know it may ignore it.
- chunk data: the record, exactly as in section 5.
- placed **immediately before the `IEND` chunk**.
- the usual PNG checks: a 4-byte length in front, and a CRC-32 over the type and data at the end.

A glyph MUST contain exactly one `kvMk` chunk. Readers use the first one they find.

### 6.2 The picture

The image is 512 × 512 and is **decoration only**. Readers MUST ignore the pixels. The reference page draws a 12-fold flower pattern whose colours and shapes come from the SHA-256 hash of the ciphertext, so the same data always gives the same picture and the picture says nothing about the contents.

One detail does reveal something: the small shape in the centre depends on `defaultKey`.

| Centre shape | `defaultKey` |
|---|---|
| circle | `C_MAJOR` |
| triangle | `A_MINOR` |
| diamond | `G_MAJOR` |
| square | `C_TRIAD` or `ALL` |

Anyone looking at a glyph can therefore tell which of these starting sets was chosen. Nothing else about the notes is visible.

### 6.3 Reading a glyph

1. Check the PNG signature. If it is a JPEG, say so; converting to JPEG destroys the hidden section.
2. Walk the chunks. If there is no `kvMk` chunk, tell the person the image has probably been re-saved, resized or shrunk, and point them to the original file or the `.kvmk` backup. Do **not** report this as "wrong passphrase", because the person cannot fix it by retyping.
3. If the record is shorter than 29 bytes, report that the data is damaged.
4. Decrypt (section 4). If that fails, the passphrase is wrong or the data is damaged.
5. Parse the JSON (section 3).

Encoders SHOULD open the glyph they just made, decrypt it, and check the notes match, before offering it for download.

## 7. Container B: the `.kvmk` file

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | magic: `4B 56 4D 4B` (the letters "KVMK") |
| 4 | rest | the record (section 5) |

Readers MUST reject a file that does not start with the magic. Unlike a glyph, this file survives being copied, synced, emailed, or passed through apps that rewrite images, so it is the recommended backup.

## 8. Turning notes into a prompt (informative)

This section describes what the reference page does with the notes after unlocking. It is not part of the stored format.

**Note sets.** The reader keeps a set of "active" notes and shows only notes whose `note` is in the set. The presets are:

| Preset | Active notes |
|---|---|
| `C_MAJOR` | C D E F G A B |
| `A_MINOR` | A B C D E F G |
| `G_MAJOR` | G A B C D E F# |
| `C_TRIAD` | C E G |
| `ALL` | all 12 |

Note that `C_MAJOR` and `A_MINOR` contain exactly the same seven notes, so as filters they behave identically. Individual notes can also be switched on and off.

**Orderings ("streams").**

| Stream | Order |
|---|---|
| 6 | priority 1 to 10 |
| 5 | priority 10 to 1 |
| 1 | oldest first (`id` ascending) |
| 2 | newest first |
| 3 | note B down to C |
| 4 | note C up to B |

**Budget.** Each note is estimated at `ceil(length of content / 4)` tokens. Notes are added in order until the next one would go over the budget (default 250); the page then **stops**, even if a later, shorter note would have fitted.

**Output.** A header line naming the stream and active notes, the line `Apply these active constraints:`, then one line per note in the form `- [C | P1] text`.

## 9. Security considerations

- **Passphrase strength is everything.** Anyone who gets a glyph or file can try passphrases on their own computer, without limit. The iteration count slows each guess but cannot save a weak passphrase. A short PIN can be broken in seconds. Implementations SHOULD ask for a long passphrase.
- **The iteration count is lower than current advice.** Current guidance for PBKDF2-HMAC-SHA-256 is around 600,000. Raising it changes the format (section 5), so it needs a new container version.
- **There is no recovery.** If the passphrase is lost, the notes are gone.
- **What an observer can learn:** that the file is a glyph, the approximate size of the notes (the record length), the salt and IV (not secret), and the choice among the starting sets in section 6.2. They cannot learn the notes.
- **Nothing outside the record is protected.** The picture can be replaced by another picture carrying the same hidden section, and the file would still open. The notes themselves cannot be altered without detection.
- **No compression.** The record is about as large as the notes. This is fine for the intended use.
- **Cloud photo services.** Saving a glyph to a camera roll that syncs to a cloud service puts the (encrypted) file there, and the service may rewrite it and drop the hidden section. Keep the original file and the `.kvmk` backup.
- **Memory.** A web page can clear what it shows but cannot guarantee that every copy of the notes is erased from memory.
- **Trust in the code.** A page that handles the passphrase can read it. Run code you have inspected, from a source you trust.

## 10. Test vector (decode only)

Use this to check a new reader. It was built with separate code (Node's own crypto), and the reference page opens it.

- **Passphrase:** `test-key`
- **Iterations:** 100,000
- **Salt:** `000102030405060708090a0b0c0d0e0f`
- **IV:** `101112131415161718191a1b`
- **Text before encryption (UTF-8):**

```
{"v":1,"defaultKey":"ALL","nodes":[{"id":1,"note":"C","priority":1,"content":"hello"}]}
```

**Record (131 bytes, hex):**

```
000102030405060708090a0b0c0d0e0f101112131415161718191a1b6d1593d4a7a650e21dc5e6afab0339481fb16dd2a75222cda7d5761d29fc4c771966dc746bc0f1ee31b3d38d23c44628d5597d09f514a4d9a37efde13acade341b1b1e7a03764f67e599a185b9df696f0ceb8043a015553f4cc0cbd21fcf1d20906849cb3d22c1
```

The same record as a `.kvmk` file starts with `4b564d4b000102…`. Because the salt and IV are fixed here, an encoder can reproduce this record exactly. A reader is expected to turn it into the text above, which the page shows as one note: `- [C | P1] hello`.

## 11. Checked against

- A glyph made by the reference page was opened with a separate decoder: valid PNG, 512 × 512, all chunk checksums correct, one `kvMk` chunk directly before `IEND`, and the record decrypted to the JSON in section 3.
- A `.kvmk` file and a PNG built by the separate code (section 10) were both opened by the reference page.
- Glyphs made by the first version of the page and by the revised version open in each other.
