# Web vault: two pages that run in your browser

Double-click either `index.html` to open it. Nothing is uploaded anywhere.

| Folder | Use it to | Where the locked data hides |
|---|---|---|
| `glyph-forge/` | Save a set of **notes** (rules, constraints, preferences) as a flower-shaped glyph, then restore them and copy a ready-made prompt for an AI chat. Has a note-key filter and token budget. | In a hidden section of the PNG file |
| `pixel-vault/` | Lock any **text** (for example a pasted chat) into a picture. | In the faintest colour differences of the pixels |

Both lock with a passphrase using AES-256-GCM, and both warn you to keep a backup file, because photo apps and messengers can damage the image. Their file formats are described in [`../docs/SPEC-glyph-forge.md`](../docs/SPEC-glyph-forge.md) and [`../docs/SPEC-pixel-vault.md`](../docs/SPEC-pixel-vault.md). The two formats are not interchangeable.
