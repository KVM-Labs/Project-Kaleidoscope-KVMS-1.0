# Project Kaleidoscope: Harmonic Context Routing and Local-First Encrypted Visual State Storage for Large Language Models

**Authors:** IC&MC (KVM Labs)  
**Version:** 1.0 (Reference Specification)  
**Date:** November 2026  
**Repository:** [github.com/KVM-Labs/Project-Kaleidoscope-KVMS-1.0](https://github.com/KVM-Labs/Project-Kaleidoscope-KVMS-1.0)  
**Website:** [kvm-labs.github.io](https://kvm-labs.github.io/)

---

## Abstract

Modern Large Language Models (LLMs) suffer from three structural bottlenecks in daily multi-turn workflows: **rapidly growing token cost** (stateless models re-read the full conversation history on every turn, so the total number of tokens processed over a session grows quadratically with the number of turns), **vendor lock-in** (proprietary cloud memory silos), and **privacy exposure** when storing sensitive project instructions on external servers.

This paper introduces **Project Kaleidoscope**, a client-side context compression and portable memory protocol developed by **KVM Labs**. Project Kaleidoscope distills conversational constraints into atomic, priority-weighted JSON nodes, seals them locally via **PBKDF2-HMAC-SHA256** and **AES-256-GCM** authenticated encryption, and embeds the ciphertext inside a lossless PNG binary chunk (`kvMk`). To give each file a recognizable visual identity that reveals nothing about the text of the notes, the system renders a deterministic 12-fold symmetric kaleidoscope glyph seeded from the **SHA-256 hash of the encrypted ciphertext**; the picture is decorative, and integrity is provided by the authenticated encryption, not by the picture. Finally, we introduce **Harmonic Context Routing (HCR)** and **6-Stream Graph Traversal**, an intuitive musical-key bitmasking and token-budgeting layer that bounds the size of the active prompt by a user-set token budget (250 tokens by default), however many notes are stored, while keeping cryptographic keys exclusively in the user's hands.

---

## 1. Introduction & Problem Statement

Interacting with frontier LLMs requires sending the accumulated message history $M = \{m_1, m_2, \dots, m_n\}$ alongside every new prompt $m_{n+1}$. Consequently, the total number of tokens processed (and billed) over a session grows quadratically, $O(n^2)$, and the context window fills a little more with every turn. Users rapidly exhaust rolling usage caps, suffer from "context drift" as older instructions get buried, and must repeatedly re-explain project constraints when starting fresh threads or switching between AI providers.

Existing workarounds fail to solve storage privacy and human usability simultaneously:
* **Cloud Memory Silos:** Vendor-managed memory features lock user context inside a single ecosystem and retain sensitive project rules on third-party servers.
* **Raw JSON / Vector Databases:** Local Retrieval-Augmented Generation (RAG) and manual tag schemas require complex infrastructure and force non-technical users to manage brittle metadata queries.
* **Optical Text Screenshots:** Recent optical context compression methods render raw text as images, which still exposes unencrypted content visually and introduces Optical Character Recognition (OCR) fragility.

**Project Kaleidoscope** resolves these trade-offs by decoupling **cryptographic storage** from **deterministic visual fingerprinting** and replacing complex query languages with a tactile **12-note musical interface**.

---

## 2. Cryptographic Visual State Architecture

Writing unencrypted data into surface pixels would expose it to anyone who opens the image, and any scheme that stores data in pixel values is sensitive to lossy re-encoding and camera capture. Project Kaleidoscope instead stores an *encrypted* record in a separate chunk of a standard Portable Network Graphics (`.png`) file, treating the file as a dual-purpose **Cryptographic Visual Artifact (CVA)**. Section 2.4 compares this with storing the encrypted record in the pixels themselves.

### 2.1 Atomic Node Schema
Instead of saving verbose conversational transcripts, session state is distilled into self-contained, atomic rules:

```json
{
  "v": 1,
  "defaultKey": "C_MAJOR",
  "nodes": [
    {
      "id": 1731312000,
      "note": "C",
      "priority": 1,
      "content": "Use Python 3.12 with strict type hints and zero external bloat."
    }
  ]
}
```

### 2.2 Client-Side Authenticated Encryption
All cryptographic operations execute 100% locally in the client environment (via Python `cryptography` or the browser `Web Crypto API`):
1. **Key Derivation:** A user-supplied passkey $P$ and a cryptographically random 16-byte salt $S$ are processed through **PBKDF2-HMAC-SHA256** (100,000 iterations) to derive a 256-bit key $K$.
2. **Authenticated Encryption:** The serialized JSON payload is encrypted using **AES-256-GCM** with a random 12-byte initialization vector $IV$, producing ciphertext $C$ and a 128-bit authentication tag that prevents silent tampering.
3. **Lossless PNG Chunk Injection:** The binary tuple $(S \parallel IV \parallel C)$ is injected into a custom ancillary PNG chunk named `kvMk` immediately preceding the terminal `IEND` chunk, complete with a valid CRC-32 checksum.

### 2.3 Ciphertext-Seeded Art Generation
So that the visual artwork reveals nothing about the text of the underlying rules, the kaleidoscope renderer is seeded only from the cryptographic digest of the ciphertext:

$$H = \text{SHA-256}(C)$$

The first 32 bits of $H$ initialize a deterministic Pseudo-Random Number Generator (PRNG) that plots 12-fold radially symmetric geometric layers. Any change to the encrypted data produces an entirely new visual pattern, so the picture is a visual fingerprint of that particular saved file. Because every save uses a fresh salt and initialization vector, saving identical notes twice also produces two different pictures. A small central geometric anchor represents the glyph's `defaultKey` (circle for C Major, triangle for A Minor, diamond for G Major, square for the C Triad and Chromatic sets); this centre shape is the one deliberately visible detail, so an observer can tell which starting key set was chosen. The reader does not check the picture against the data: integrity comes from the AES-GCM authentication tag over the ciphertext, and the picture itself is not authenticated.

### 2.4 Design Alternative: Encrypted Data in the Pixels
The encrypted record can instead be hidden in the least significant bit of each red, green and blue value of the image, which changes every colour value by at most 1 out of 255 and is invisible to the eye. This variant is implemented in the repository (`web-vault/pixel-vault/`) and specified in `docs/SPEC-pixel-vault.md`; the chunk-based variant used in this paper is specified in `docs/SPEC-glyph-forge.md`. In testing, the two behave as follows:

| | Encrypted record in a PNG chunk (this paper) | Encrypted record in the pixels |
| :--- | :--- | :--- |
| **Capacity** | No practical limit (800 KB of notes tested) | About 96 KB of locked data in a 512×512 image (a 147 KB test text compressed to 57 KB) |
| **Plain lossless re-save as PNG** | Data lost | Data identical |
| **Resize, or JPEG/WebP conversion** | Data lost | Data lost |

Neither variant survives lossy handling, so each is paired with a separate encrypted backup file. Which is preferable depends on whether capacity or resilience to lossless re-saves matters more.

---

## 3. Harmonic Context Routing (HCR)

Managing dozens of project tags creates cognitive friction. **Harmonic Context Routing (HCR)** maps project domains onto the 12-tone equal-temperament chromatic scale:

$$\mathcal{N} = \{\text{C}, \text{C}\sharp, \text{D}, \text{D}\sharp, \text{E}, \text{F}, \text{F}\sharp, \text{G}, \text{G}\sharp, \text{A}, \text{A}\sharp, \text{B}\}$$

Each note corresponds to an assignable domain label (e.g., `C` = Core Rules, `E` = Security, `F#` = UI Styling, `G` = Tone/Persona). A **Musical Key** or **Chord** acts as a 12-bit binary bitmask $M \in \{0, 1\}^{12}$ that unlocks harmonious subsets of memory while keeping unrelated domains dormant:

| Musical Signature | Active Chromatic Mask | Active Notes | Operational Focus |
| :--- | :--- | :--- | :--- |
| **C Major** | `[1,0,1,0,1,1,0,1,0,1,0,1]` | C, D, E, F, G, A, B | Full-stack development & core architecture |
| **A Minor** | `[1,0,1,0,1,1,0,1,0,1,0,1]` | A, B, C, D, E, F, G | Auditing, constraints, & edge-case review |
| **G Major** | `[1,0,1,0,1,0,1,1,0,1,0,1]` | G, A, B, C, D, E, F# | Frontend styling, UI, & persona tuning |
| **C Major Triad** | `[1,0,0,0,1,0,0,1,0,0,0,0]` | C, E, G | Ultra-lean execution (Core + Security + Tone) |
| **Chromatic (All)** | `[1,1,1,1,1,1,1,1,1,1,1,1]` | All 12 Notes | Complete project rehydration |

> **Note.** C Major and A Minor are relative keys and contain the same seven notes, so in this version their masks are identical and the two presets select exactly the same nodes. The "Operational Focus" column describes how a user might use each preset; it is not something the mask itself can express. Telling them apart would need an additional rule, for example giving the root note (A for A Minor) special weight, or using a different scale such as harmonic minor (A, B, C, D, E, F, G#).

Users can select preset musical keys via the glyph's central anchor symbol or toggle individual notes on an interactive 12-key visual bar to dynamically reshape the AI's active context window in real time.

---

## 4. Multi-Directional Graph Traversal (The 6 Streams)

Once HCR filters the unlocked nodes to the active musical key, the rehydration engine orders and truncates the context using **6 Traversal Streams** paired with a strict **Max Token Budget** $B_{\text{max}}$:

| Stream ID | Traversal Metaphor | Algorithmic Sort Order | Primary Use Case |
| :--- | :--- | :--- | :--- |
| **Stream 1** | Left-to-Right ➔ Top-to-Bottom | Chronological (`id` ascending) | Step-by-step feature construction |
| **Stream 2** | Right-to-Left ➔ Bottom-to-Top | Reverse Chronological (`id` descending) | Debugging recent regressions & rollbacks |
| **Stream 3** | Left-to-Right ➔ Bottom-to-Top | Chromatic Reverse (`B` ➔ `C`) | Bottom-up edge-case & constraint loading |
| **Stream 4** | Right-to-Left ➔ Top-to-Bottom | Chromatic Forward (`C` ➔ `B`) | Top-down architectural persona enforcement |
| **Stream 5** | Spiral Inward (Outside ➔ Center) | Priority Descending (`P10` ➔ `P1`) | Broad context gathering & blind-spot audits |
| **Stream 6** | Spiral Outward (Center ➔ Outside) | Priority Ascending (`P1` ➔ `P10`) | **Strict Token-Budgeted Priority Execution** |

### Greedy Token-Budget Cutoff
Under **Stream 6**, nodes are sorted from highest priority (`P1`) to lowest (`P10`). The loader estimates token weight $t_i \approx \lceil \text{len}(\text{content}_i) / 4 \rceil$ and accumulates nodes until $\sum t_i > B_{\text{max}}$, halting immediately. Combined with 12-note harmonic filtering, this bounds prompt overhead to a deterministic ceiling (250 tokens by default, adjustable by the user) regardless of total project size.

---

## 5. Security Model, Limitations & Future Work

### 5.1 Threat Model Boundaries
* **Protected (At Rest & In Transit):** Session rules stored inside `kvMk` PNG files remain confidential to anyone without the user's passkey, and any change to the encrypted data is detected when the file is opened (AES-GCM). The picture reveals nothing about the text of the rules, apart from the centre shape that shows which starting key set was chosen; the picture itself is not authenticated and could be replaced without detection.
* **Out of Scope (Active Cloud Inference):** Once the user copies the rehydrated micro-prompt into a third-party cloud LLM (e.g., Claude, GPT, Gemini), that provider processes the active subset in plaintext. Project Kaleidoscope minimizes exposure by transmitting only the minimal active slice rather than the entire project archive.
* **Transport Integrity:** Because the payload resides in an ancillary PNG chunk (`kvMk`), it is lost whenever a program rewrites the image without carrying unknown chunks over. This includes lossy re-encoding to JPEG/WebP by social media and mobile photo galleries, but also a plain lossless re-save: in testing, re-saving a glyph as an ordinary PNG with a common image library removed the chunk although the picture was unchanged. Glyphs must therefore be stored and transferred as unmodified files, and the same encrypted record is also saved as a separate `.kvmk` backup file (see `docs/SPEC-glyph-forge.md`), which image handling cannot damage.

### 5.2 Future Extensions
Future iterations under **KVM Labs** will explore Reed-Solomon forward error correction (`reedsolo`) and perspective homography (`OpenCV`) to support physical, camera-scannable printed glyphs, alongside local small-language-model (SLM) auto-routing to select musical keys automatically from user intent.

---

## 6. Reference Implementations

* **CLI Engine (`glyph.py`):** Cross-platform Python implementation utilizing `cryptography` and `Pillow`.
* **Web / Mobile Vault (`index.html`):** Zero-dependency browser application utilizing `Web Crypto API` and `HTML5 Canvas`, cross-compatible with the `kvMk` binary specification.

(KVM Labs)
