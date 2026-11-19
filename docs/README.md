# Documents guide

Start here if you are not sure which document to read.

## The format descriptions (match the working code)

There are two, because the two pages in `../web-vault/` store their data differently.

- **[SPEC-glyph-forge.md](SPEC-glyph-forge.md)**: notes stored in a hidden section of the PNG file (`../web-vault/glyph-forge/`).
- **[SPEC-pixel-vault.md](SPEC-pixel-vault.md)**: text stored in the pixels themselves (`../web-vault/pixel-vault/`).

| | Glyph Forge | Pixel Vault |
|---|---|---|
| Stores | structured notes (a note letter, a priority, some text) | any text, such as a pasted chat |
| Room | no practical limit (800 KB of notes tested) | about 96 KB of locked data, which holds a couple of hundred KB of text after shrinking |
| Survives a plain re-save as PNG | No (tested: the hidden data is lost) | Yes (tested: data identical) |
| Survives resizing or JPEG | No | No |
| Backup file | `.kvmk` | `.kvms` |
| Key strength | 100,000 PBKDF2 rounds | 600,000 PBKDF2 rounds |

If a description here and a concept document below disagree about what works today, the format descriptions are right.

## The paper

- **[WHITEPAPER.md](../WHITEPAPER.md)**: the research paper (the ideas, the design and the security model). For exact byte-level details, the format descriptions above are the reference.

## Concept documents (the original vision)

These describe the idea and the plan. Some parts are goals that are not built yet, so where they differ from the format descriptions, the format descriptions are right about what works today.

| File | What it is |
|---|---|
| [project-blueprint.txt](project-blueprint.txt) | Overview of the idea and the three-axis picture design |
| [technical-specification-sheet.txt](technical-specification-sheet.txt) | The original technical concept (earlier than the format descriptions) |
| [interface-blueprint.txt](interface-blueprint.txt) | Planned settings panel layout (not built yet) |
| [developer-blueprint-manifest.txt](developer-blueprint-manifest.txt) | An early draft of the extension's manifest; the real one is `../extension/manifest.json` |
| [environment-target.txt](environment-target.txt) | Which browsers and platforms are targeted |
| [executive-pitch-summary.txt](executive-pitch-summary.txt) | Short pitch for architects and investors |
| [community-proposal.txt](community-proposal.txt) | Forum-style post asking the community for feedback |
| [creative-case-study.txt](creative-case-study.txt) | A story of one person using the tool in a day |

## Archive

Older copies, kept so nothing is lost.

| File | What it is |
|---|---|
| [archive/project-blueprint-second-copy.txt](archive/project-blueprint-second-copy.txt) | A second, slightly different version of the project blueprint |
| [archive/file-checklist.txt](archive/file-checklist.txt) | An early checklist of planned files |

- `glyph_savings.xlsx` — the savings model (illustrative), measured sizes, and an **Evolution Log** tab recording each version of the glyph tool (sizes, features, security changes).
