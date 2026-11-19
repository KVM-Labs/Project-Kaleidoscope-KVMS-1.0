#!/usr/bin/env python3
"""
Kaleidoscope Glyph - V1 starter (file format KGLYPH2)
================================

Saves an AI session's rules and notes into ONE picture (a PNG "glyph").

What it does, in plain words
  1. You give it a list of small notes ("nodes"). Each node has:
       - some text            (the rule or fact)
       - a musical note       (C, C#, D ... B) that says what kind of note it is
       - a priority, 1 to 10  (10 = most important)
  2. It locks everything (and a title for the glyph) with your passkey (AES-256
     encryption) and hides the locked data inside a PNG image file. The title is
     inside the lock, so it only shows after you unlock.
  3. The picture is drawn from a fingerprint of the locked data. The same file
     always shows the same picture, and every new save gets a new picture.
     The picture reveals nothing about what is inside. A thin label along the
     bottom shows only the format, the save time and an 8-character glyph ID:
         KVMS-1.0 · 2026-11-15 14:30 · ID: 1a2b3c4d
  4. Later you open the glyph with your password, choose a "key" (which notes
     to listen to) and a size limit, and it prints a short prompt you can paste
     into any AI chat.

Needs: Python 3.9 or newer, plus three packages
  pip install cryptography pillow numpy

How to run it
  python glyph.py demo
        Makes a sample glyph (demo_glyph.png) and reads it back.

  python glyph.py save my_notes.json [my_glyph.png] [--title "Project X"]
        Locks your notes into a glyph. It asks you for a passkey.
        Leave the file name out and it is named for you:
        KVMS_YYYY-MM-DD_HHMM_XXXXXXXX.png

  python glyph.py load my_glyph.png --key C-major --budget 300
        Opens the glyph and prints the prompt.
        --key    all  |  C-major  |  A-minor  |  C,E,G   (a list of notes)
        --budget the most "tokens" (roughly 4 letters each) to send

What my_notes.json looks like
  {
    "labels": {"C": "Coding rules", "D": "Tone"},
    "nodes": [
      {"note": "C", "text": "Write all code in Python 3.", "priority": 8},
      {"note": "D", "text": "Explain things in plain language.", "priority": 9}
    ]
  }
  ("labels" is optional. It gives each note a friendly name.)

Good to know
  * Forget the passkey and the glyph cannot be opened. There is no reset.
  * Old KGLYPH1 glyphs still open. New glyphs are KGLYPH2, which stores its own
    lock-strength settings inside the file (and refuses unsafe ones).
  * The hidden data lives in the PNG's file data, not in the pixels. If a website
    or app re-saves or shrinks the image, the hidden data can be lost. Send the
    glyph as a file or attachment, and keep a backup copy.
  * When you paste the prompt into a cloud AI, that company can read it.
"""

import argparse
import base64
import colorsys
import datetime
import getpass
import hashlib
import json
import math
import os
import random
import struct
import time
import zlib

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from PIL.PngImagePlugin import PngInfo
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

# ---------------------------------------------------------------------------
# The 12 notes ("the keyboard")
# ---------------------------------------------------------------------------

NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLATS = {"DB": "C#", "EB": "D#", "GB": "F#", "AB": "G#", "BB": "A#"}
MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]  # which of the 12 notes a major key uses
MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]  # which of the 12 notes a minor key uses

# File format pieces
MAGIC_V1 = b"KGLYPH1"   # old files: fixed lock settings (N=32768, r=8, p=1)
MAGIC = b"KGLYPH2"      # new files: lock settings are stored in the file header
SALT_LEN = 16
NONCE_LEN = 12
PNG_FIELD = "kaleidoscope"   # the name of the hidden slot inside the PNG
MAX_PAYLOAD = 500_000        # bytes; keeps the hidden data safely small
LABEL_PREFIX = "KVMS-1.0"    # the visible format label on every glyph

# Lock settings ("scrypt"): N = memory/work, r = block size, p = repeats.
DEFAULT_N, DEFAULT_R, DEFAULT_P = 2 ** 15, 8, 3
V1_N, V1_R, V1_P = 2 ** 15, 8, 1
# Safety limits, checked BEFORE any slow work, so a booby-trapped glyph cannot
# make your computer run out of memory or hang.
MIN_N, MAX_N = 2 ** 14, 2 ** 17      # N must be a power of two in this range
MAX_R, MAX_P = 8, 8
# The packed data is padded up to one of these sizes before locking, so the
# file size does not reveal how much text you wrote.
BUCKETS = (16_384, 65_536, 262_144, 499_000)
HEADER_V2_LEN = len(MAGIC) + 4 + 1 + 1 + SALT_LEN + NONCE_LEN   # 41 bytes

NO_DATA_MSG = ("No hidden glyph data found. This image was probably compressed, "
               "resized or re-saved by an app or website. Use the original glyph file.")
WRONG_KEY_MSG = "Wrong passkey, or the glyph file was modified."
NOT_GLYPH_MSG = "This does not look like a Kaleidoscope glyph."
UNSAFE_MSG = ("This glyph asks for lock settings outside the safe limits, "
              "so it was not opened.")


def normalize_note(name):
    """Turns 'c', 'Db', 'f#' ... into one of the 12 official note names."""
    n = name.strip().upper()
    n = FLATS.get(n, n)
    if n not in NOTES:
        raise ValueError("'%s' is not a note. Use one of: %s" % (name, ", ".join(NOTES)))
    return n


def parse_key(text):
    """
    Turns what you type after --key into a set of notes.
      'all'      -> None (listen to every note)
      'C-major'  -> the 7 notes of C major
      'A-minor'  -> the 7 notes of A minor
      'C,E,G'    -> exactly those notes
    """
    t = text.strip()
    if t.lower() == "all":
        return None
    low = t.lower()
    for suffix, steps in (("-major", MAJOR_STEPS), ("-minor", MINOR_STEPS)):
        if low.endswith(suffix):
            root = NOTES.index(normalize_note(t[: -len(suffix)]))
            return {NOTES[(root + s) % 12] for s in steps}
    return {normalize_note(p) for p in t.split(",") if p.strip()}


def show_key(active):
    """A tiny keyboard picture: [C] means the note is on, c# means it is off."""
    return " ".join(
        "[%s]" % n if (active is None or n in active) else n.lower() for n in NOTES
    )


# ---------------------------------------------------------------------------
# Notes ("nodes") and the session
# ---------------------------------------------------------------------------

def estimate_tokens(text):
    """Rough size guess: about 4 letters per token. Good enough for a budget."""
    return max(1, len(text) // 4)


def clean_title(title):
    """Trims the title and keeps it to 80 characters. Empty becomes 'Untitled'."""
    t = " ".join(str(title or "").split())
    return t[:80] if t else "Untitled"


def build_session(nodes, labels=None, title=None):
    """Checks your notes and packs them into one session."""
    clean = []
    for i, n in enumerate(nodes):
        text = str(n.get("text", "")).strip()
        if not text:
            raise ValueError("Note number %d has no text." % (i + 1))
        priority = int(n.get("priority", 5))
        clean.append({
            "note": normalize_note(str(n.get("note", "C"))),
            "text": text,
            "priority": max(1, min(10, priority)),
            "tokens": estimate_tokens(text),
        })
    clean_labels = {normalize_note(k): str(v) for k, v in (labels or {}).items()}
    return {
        "version": 2,
        "title": clean_title(title),
        "saved_at": int(time.time()),
        "labels": clean_labels,
        "nodes": clean,
    }


# ---------------------------------------------------------------------------
# Locking and unlocking (AES-256-GCM)
# ---------------------------------------------------------------------------

def pad_packed(packed):
    """packed zlib bytes -> 4-byte length + data + zeros, up to the next size bucket."""
    body = struct.pack(">I", len(packed)) + packed
    for size in BUCKETS:
        if len(body) <= size:
            return body + b"\0" * (size - len(body))
    raise ValueError("Too much text for one glyph (limit %d bytes). Trim some notes and try again." % MAX_PAYLOAD)


def unpad_packed(plain):
    """Reverses pad_packed. Early KGLYPH2 files had no padding (zlib data starts with 0x78)."""
    if plain[:1] == b"\x78":
        return plain
    if len(plain) < 4:
        raise ValueError(NOT_GLYPH_MSG)
    (n,) = struct.unpack(">I", plain[:4])
    if n > len(plain) - 4:
        raise ValueError(NOT_GLYPH_MSG)
    return plain[4:4 + n]


def _check_params(n, r, p):
    """Refuses lock settings that are unsafe or silly. Runs before any slow work."""
    ok = (MIN_N <= n <= MAX_N and (n & (n - 1)) == 0 and 1 <= r <= MAX_R and 1 <= p <= MAX_P)
    if not ok:
        raise ValueError(UNSAFE_MSG)


def _derive_key(password, salt, n=DEFAULT_N, r=DEFAULT_R, p=DEFAULT_P):
    """Stretches your passkey into a strong 32-byte lock key (slow on purpose)."""
    _check_params(n, r, p)
    return Scrypt(salt=salt, length=32, n=n, r=r, p=p).derive(password.encode("utf-8"))


def encrypt_session(session, password, n=DEFAULT_N, r=DEFAULT_R, p=DEFAULT_P):
    """
    Session -> locked bytes (KGLYPH2). Layout:
      "KGLYPH2" | N (4 bytes) | r (1) | p (1) | salt (16) | nonce (12) | locked data
    Everything before the locked data (the header) is also signed into the lock,
    so changing any lock setting makes opening fail.
    """
    _check_params(n, r, p)
    salt = os.urandom(SALT_LEN)
    nonce = os.urandom(NONCE_LEN)
    header = MAGIC + struct.pack(">IBB", n, r, p) + salt + nonce
    plain = pad_packed(zlib.compress(json.dumps(session, ensure_ascii=False).encode("utf-8")))
    locked = AESGCM(_derive_key(password, salt, n, r, p)).encrypt(nonce, plain, header)
    return header + locked


def decrypt_session(payload, password):
    """Locked bytes -> session. Opens KGLYPH2, and old KGLYPH1 files too."""
    if payload.startswith(MAGIC):
        if len(payload) < HEADER_V2_LEN + 16:
            raise ValueError(NOT_GLYPH_MSG)
        n, r, p = struct.unpack(">IBB", payload[len(MAGIC):len(MAGIC) + 6])
        _check_params(n, r, p)                       # limits first, work second
        header = payload[:HEADER_V2_LEN]
        salt = header[len(MAGIC) + 6:len(MAGIC) + 6 + SALT_LEN]
        nonce = header[len(MAGIC) + 6 + SALT_LEN:]
        locked = payload[HEADER_V2_LEN:]
        aad = header
    elif payload.startswith(MAGIC_V1):
        if len(payload) < len(MAGIC_V1) + SALT_LEN + NONCE_LEN + 16:
            raise ValueError(NOT_GLYPH_MSG)
        n, r, p = V1_N, V1_R, V1_P
        start = len(MAGIC_V1)
        salt = payload[start:start + SALT_LEN]
        nonce = payload[start + SALT_LEN:start + SALT_LEN + NONCE_LEN]
        locked = payload[start + SALT_LEN + NONCE_LEN:]
        aad = MAGIC_V1
    else:
        raise ValueError(NOT_GLYPH_MSG)
    try:
        plain = AESGCM(_derive_key(password, salt, n, r, p)).decrypt(nonce, locked, aad)
    except InvalidTag:
        raise ValueError(WRONG_KEY_MSG) from None
    return json.loads(zlib.decompress(unpad_packed(plain)).decode("utf-8"))


# ---------------------------------------------------------------------------
# The artwork (drawn from the fingerprint, never from your text)
# ---------------------------------------------------------------------------

def _pick(rng, options):
    """Picks one item using only rng.random(), so results stay the same everywhere."""
    return options[int(rng.random() * len(options))]


def make_art(fingerprint, size=768):
    """
    Draws a kaleidoscope from a fingerprint (32 bytes).
    Same fingerprint in, same picture out.
    """
    rng = random.Random(int.from_bytes(fingerprint, "big"))
    folds = _pick(rng, [5, 6, 7, 8, 9, 10, 12])
    background = (12, 10, 24)

    # A palette of 6 colors that belong together
    base_hue = rng.random()
    offsets = sorted([0.0, 0.08, 0.16, 0.33, 0.5, 0.66, 0.83], key=lambda _: rng.random())[:5]
    palette = []
    for offset in offsets:
        hue = (base_hue + offset) % 1.0
        saturation = 0.55 + 0.45 * rng.random()
        brightness = 0.6 + 0.4 * rng.random()
        r, g, b = colorsys.hsv_to_rgb(hue, saturation, brightness)
        palette.append((int(r * 255), int(g * 255), int(b * 255)))

    # Scatter shapes inside one thin slice of the canvas
    c = (size - 1) / 2
    slice_angle = math.pi / folds
    base = Image.new("RGB", (size, size), background)
    draw = ImageDraw.Draw(base, "RGBA")  # "RGBA" lets shapes be see-through
    for _ in range(110):
        distance = (rng.random() ** 0.8) * c * 0.95
        angle = rng.random() * slice_angle
        x = c + distance * math.cos(angle)
        y = c + distance * math.sin(angle)
        s = 8 + (rng.random() ** 2) * size * 0.08  # mostly small, a few big
        color = _pick(rng, palette)
        see_through = color + (130 + int(rng.random() * 100),)
        outline_only = rng.random() < 0.25
        kind = _pick(rng, ["circle", "triangle", "hexagon", "star"])
        spin = rng.random() * math.tau
        if kind == "circle":
            box = [x - s, y - s, x + s, y + s]
            if outline_only:
                draw.ellipse(box, outline=color, width=2)
            else:
                draw.ellipse(box, fill=see_through)
        else:
            sides = {"triangle": 3, "hexagon": 6, "star": 10}[kind]
            points = []
            for k in range(sides):
                reach = s * 0.45 if (kind == "star" and k % 2) else s
                a = spin + math.tau * k / sides
                points.append((x + reach * math.cos(a), y + reach * math.sin(a)))
            if outline_only:
                draw.line(points + [points[0]], fill=color, width=2)
            else:
                draw.polygon(points, fill=see_through)

    # Mirror that one slice all the way around the circle
    ys, xs = np.mgrid[0:size, 0:size]
    dx, dy = xs - c, ys - c
    radius = np.hypot(dx, dy)
    theta = np.arctan2(dy, dx) % math.tau
    t = theta % (2 * slice_angle)
    t = np.where(t > slice_angle, 2 * slice_angle - t, t)
    sx = np.clip(np.rint(c + radius * np.cos(t)).astype(int), 0, size - 1)
    sy = np.clip(np.rint(c + radius * np.sin(t)).astype(int), 0, size - 1)
    out = np.asarray(base)[sy, sx].copy()
    out[radius > c] = background
    return Image.fromarray(out)


# ---------------------------------------------------------------------------
# Saving and loading glyph files
# ---------------------------------------------------------------------------

def _stamp(session):
    """The save time as a local date and time (used in the label and file name)."""
    return datetime.datetime.fromtimestamp(session.get("saved_at") or time.time())


def glyph_label(session, fid):
    """The visible label: KVMS-1.0 · YYYY-MM-DD HH:MM · ID: XXXXXXXX"""
    return "%s \u00b7 %s \u00b7 ID: %s" % (LABEL_PREFIX, _stamp(session).strftime("%Y-%m-%d %H:%M"), fid)


def glyph_filename(session, fid):
    """KVMS_YYYY-MM-DD_HHMM_XXXXXXXX.png"""
    return "KVMS_%s_%s.png" % (_stamp(session).strftime("%Y-%m-%d_%H%M"), fid)


def _label_font(px):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
                 "DejaVuSansMono.ttf", "/System/Library/Fonts/Menlo.ttc",
                 "C:\\Windows\\Fonts\\consola.ttf"):
        try:
            return ImageFont.truetype(path, px)
        except OSError:
            continue
    return ImageFont.load_default(size=px)


def add_label(image, text):
    """Draws the visible label on a dark strip along the bottom of the picture."""
    size = image.size[0]
    strip = 44
    out = image.convert("RGBA")
    overlay = Image.new("RGBA", out.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rectangle([0, size - strip, size, size], fill=(12, 10, 24, 235))
    d.line([0, size - strip, size, size - strip], fill=(70, 227, 200, 160), width=1)
    font = _label_font(17)
    box = d.textbbox((0, 0), text, font=font)
    x = (size - (box[2] - box[0])) / 2 - box[0]
    y = size - strip / 2 - (box[3] - box[1]) / 2 - box[1]
    d.text((x, y), text, font=font, fill=(236, 233, 255, 255))
    return Image.alpha_composite(out, overlay).convert("RGB")


def build_glyph(session, password, n=DEFAULT_N, r=DEFAULT_R, p=DEFAULT_P):
    """Locks the session and draws the picture. Returns (image, payload, glyph ID)."""
    payload = encrypt_session(session, password, n, r, p)
    if len(payload) > MAX_PAYLOAD:
        raise ValueError("Too much text for one glyph (limit %d bytes). Trim some notes and try again." % MAX_PAYLOAD)
    fingerprint = hashlib.sha256(payload).digest()
    fid = fingerprint.hex()[:8]
    image = add_label(make_art(fingerprint), glyph_label(session, fid))
    return image, payload, fid


def _write_png(image, payload, path):
    info = PngInfo()
    info.add_text(PNG_FIELD, base64.b64encode(payload).decode("ascii"))
    image.save(path, "PNG", pnginfo=info)


def save_glyph(session, password, path, n=DEFAULT_N, r=DEFAULT_R, p=DEFAULT_P):
    """Locks the session, draws the art, hides the locked data in the PNG at `path`."""
    image, payload, fid = build_glyph(session, password, n, r, p)
    _write_png(image, payload, path)
    return fid  # a short ID you can compare by eye


def save_glyph_auto(session, password, folder=".", **kw):
    """Same, but names the file KVMS_YYYY-MM-DD_HHMM_XXXXXXXX.png. Returns (path, ID)."""
    image, payload, fid = build_glyph(session, password, **kw)
    path = os.path.join(folder, glyph_filename(session, fid))
    _write_png(image, payload, path)
    return path, fid


def read_payload(path):
    """Pulls the locked bytes out of a glyph file."""
    with Image.open(path) as image:
        image.load()
        text = image.info.get(PNG_FIELD)
    if not text:
        raise ValueError(NO_DATA_MSG)
    try:
        return base64.b64decode(text, validate=True)
    except ValueError:
        raise ValueError(NOT_GLYPH_MSG) from None


def load_glyph(path, password):
    """Opens a glyph. Returns (session, short ID). The title is in session["title"]."""
    payload = read_payload(path)
    session = decrypt_session(payload, password)
    return session, hashlib.sha256(payload).hexdigest()[:8]


# ---------------------------------------------------------------------------
# Turning a session into a prompt (this is where the "key" and budget work)
# ---------------------------------------------------------------------------

def make_prompt(session, active_notes=None, budget=None):
    """
    1. Keep only notes that are on in the key (None = keep all).
    2. Sort by priority, highest first.
    3. Add notes until the next one would go over the budget, then stop.
       (Stopping, instead of skipping, means a lower-priority note never
       sneaks in ahead of a higher-priority one that did not fit.)
    """
    labels = session.get("labels", {})
    in_key = [
        n for n in session["nodes"]
        if active_notes is None or n["note"] in active_notes
    ]
    in_key.sort(key=lambda n: -n["priority"])  # ties keep their saved order

    chosen, used = [], 0
    for n in in_key:
        if budget is not None and used + n["tokens"] > budget:
            break
        chosen.append(n)
        used += n["tokens"]

    lines = ["Project rules and context (most important first):"]
    for n in chosen:
        label = labels.get(n["note"], n["note"])
        lines.append("- [%s] %s" % (label, n["text"]))

    stats = {
        "loaded": len(chosen),
        "tokens_used": used,
        "skipped_by_key": len(session["nodes"]) - len(in_key),
        "cut_by_budget": len(in_key) - len(chosen),
    }
    return "\n".join(lines), stats


# ---------------------------------------------------------------------------
# Command line
# ---------------------------------------------------------------------------

DEMO = {
    "labels": {"C": "Coding rules", "D": "Tone", "E": "Legal", "G": "Project goals"},
    "nodes": [
        {"note": "G", "text": "We are building a privacy-first AI chat tool called Kaleidoscope.", "priority": 10},
        {"note": "C", "text": "Write all code in Python 3 and keep functions short.", "priority": 8},
        {"note": "D", "text": "Explain things in plain language. The reader is not a programmer.", "priority": 9},
        {"note": "C", "text": "Put a comment above every function saying what it does.", "priority": 5},
        {"note": "E", "text": "Never claim a tool is unhackable.", "priority": 7},
        {"note": "D", "text": "Be friendly, but do not use slang.", "priority": 3},
    ],
}


def ask_password(confirm=False):
    pw = getpass.getpass("Passkey: ")
    if not pw:
        raise ValueError("The passkey cannot be empty.")
    if confirm and getpass.getpass("Type it again: ") != pw:
        raise ValueError("The two passkeys did not match.")
    return pw


def report(session, fid, key_text, budget):
    active = parse_key(key_text)
    prompt, stats = make_prompt(session, active, budget)
    print("Title:   ", session.get("title", "Untitled"))
    print("Glyph ID:", fid)
    print("Key:     ", show_key(active))
    print("Budget:  ", budget if budget is not None else "none")
    print("Loaded %(loaded)d notes (about %(tokens_used)d tokens). "
          "Skipped by key: %(skipped_by_key)d. Cut by budget: %(cut_by_budget)d." % stats)
    print()
    print(prompt)


def cmd_save(notes_file, glyph_file, title=None):
    with open(notes_file, encoding="utf-8") as f:
        data = json.load(f)
    if "nodes" not in data:
        raise ValueError('The notes file needs a "nodes" list. See the top of glyph.py.')
    session = build_session(data["nodes"], data.get("labels"), title or data.get("title"))
    password = ask_password(confirm=True)
    if glyph_file:
        fid = save_glyph(session, password, glyph_file)
    else:
        glyph_file, fid = save_glyph_auto(session, password)
    print("Saved %d notes to %s (glyph ID %s)" % (len(session["nodes"]), glyph_file, fid))


def cmd_load(glyph_file, key_text, budget):
    password = ask_password()
    session, fid = load_glyph(glyph_file, password)
    report(session, fid, key_text, budget)


def cmd_demo():
    password = "demo-password"
    session = build_session(DEMO["nodes"], DEMO["labels"], "Kaleidoscope demo")
    fid = save_glyph(session, password, "demo_glyph.png")
    print("Made demo_glyph.png (glyph ID %s). The demo passkey is: %s\n" % (fid, password))

    loaded, fid = load_glyph("demo_glyph.png", password)
    print("--- Key: C and D only (Coding rules + Tone) ---")
    report(loaded, fid, "C,D", None)
    print("\n--- All notes, but only a 40-token budget ---")
    report(loaded, fid, "all", 40)

    print("\n--- Wrong passkey test ---")
    try:
        load_glyph("demo_glyph.png", "not-the-passkey")
    except ValueError as e:
        print("Error:", e)


def main():
    parser = argparse.ArgumentParser(description="Kaleidoscope Glyph (KGLYPH2)")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("demo", help="make and read a sample glyph")
    s = sub.add_parser("save", help="lock a notes file into a glyph")
    s.add_argument("notes_file")
    s.add_argument("glyph_file", nargs="?", default=None,
                   help="optional; default is KVMS_YYYY-MM-DD_HHMM_XXXXXXXX.png")
    s.add_argument("--title", default=None, help="a title, stored inside the lock")
    l = sub.add_parser("load", help="open a glyph and print the prompt")
    l.add_argument("glyph_file")
    l.add_argument("--key", default="all", help="all | C-major | A-minor | C,E,G")
    l.add_argument("--budget", type=int, default=None, help="max tokens to load")
    args = parser.parse_args()

    try:
        if args.cmd == "demo":
            cmd_demo()
        elif args.cmd == "save":
            cmd_save(args.notes_file, args.glyph_file, args.title)
        else:
            cmd_load(args.glyph_file, args.key, args.budget)
    except (ValueError, OSError) as e:
        print("Error:", e)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
