#!/usr/bin/env python3
"""Decode an IQ Pokyd base dictionary (SLOVNIK.IQP, file signature 1).

Verified against original/slovnik.iqp: 11,207 words, both checksums pass.

Algorithm transcribed from PRECTI_DATABAZI_SLOV_ZE_ZAKLADNIHO_SLOVNIKU
in Aplikace/Slovnik/SLOVNIK.FU, cross-checked against the format
description in Specifik/Binarni/ZAKLSLOV.TXT.

Each entry is "<word>:<info>" where <info> is the paradigm (vzor) byte
plus any irregular-form data. Words are stored in the engine's internal
phonemic form (ch -> *, ni -> n-caron, etc.; see UPRAV_SLOVO_PRO_IQPOKYD),
so e.g. "abecedni" appears as "abeced<n-caron>i".

Usage:
    python tools/dump-dict.py original/slovnik.iqp            # summary
    python tools/dump-dict.py original/slovnik.iqp --all      # every entry
    python tools/dump-dict.py original/slovnik.iqp -o out.txt # to a file
"""

import argparse
import sys

K = ord('K')  # KODOVACI_ZNAK
I = ord('I')
Q = ord('Q')


def dekodovany_znak(c):
    """DEKODOVANY_ZNAK from Slovnik/SLOVNIK.PR."""
    return ((c ^ K) - K) & 0xFF


class Checksums:
    """Kontrolni soucet 1 and 2, per Specifik/Binarni/ZAKLSLOV.TXT."""

    def __init__(self):
        self.s1 = 0
        self.s2 = 0

    def feed(self, v):
        self.s1 = (self.s1 + v) & 0xFF
        self.s2 = ((self.s2 ^ v) + v) & 0xFF


def decode(data):
    """Return (header_text, meta_dict, [entry_bytes, ...])."""
    p = data.index(0)
    header = data[:p].decode('cp1250')
    p += 1

    # A run of random padding "pro zmateni hackera", length stored ^ 'I'.
    pocetzbytecnosti = data[p] ^ I
    p += 1 + pocetzbytecnosti

    klic = data[p] ^ I          # nahodnykodovaciklic
    p += 1

    h = bytearray(data[p:p + 10])
    p += 10
    for i in range(8):
        h[i] = ((h[i] - klic) & 0xFF) ^ K

    meta = {
        'signature': h[0],      # must be 1 for a base dictionary
        'version': (h[1], h[2]),
        'data_version': h[3],
        'kodovaci_znak': h[4],
        'count': (h[5] << 16) | (h[6] << 8) | h[7],
        'header_checksums': (h[8], h[9]),
    }
    if meta['signature'] != 1:
        raise ValueError(f"not a base dictionary (signature {meta['signature']}, expected 1)")

    ck = Checksums()
    prev = b''
    entries = []

    for _ in range(meta['count']):
        # Number of leading characters shared with the previous word.
        while True:
            c = data[p]
            p += 1
            v = (((c ^ Q) - I) & 0xFF) ^ klic
            ck.feed(v)
            if v == 255:
                p += 2          # embedded checkpoint checksums; skip and retry
                continue
            break
        stejnacast = v

        c = data[p]
        p += 1
        delkaslova = (((c ^ Q) - I) & 0xFF) ^ klic
        ck.feed(delkaslova)

        buf = bytearray(prev[:stejnacast])
        while len(buf) < stejnacast:
            buf.append(0)

        poz1, poz2 = 2, stejnacast
        while True:
            if poz2 == delkaslova:
                # The ':' separating word from info is implicit in the stream.
                while len(buf) <= poz2:
                    buf.append(0)
                buf[poz2] = ((ord(':') + K) ^ K) & 0xFF
                poz2 += 1
            c = data[p]
            p += 1
            v = ((((((c ^ stejnacast) - poz1) & 0xFF) ^ Q) - I) & 0xFF) ^ klic
            ck.feed(v)
            while len(buf) <= poz2:
                buf.append(0)
            buf[poz2] = v
            poz1 += 1
            poz2 += 1
            if v == 0:
                break

        entry = bytes(buf[:poz2 - 1])
        prev = entry[:delkaslova]
        entries.append(bytes(dekodovany_znak(b) for b in entry))

    meta['trailing_checksums'] = (data[p], data[p + 1])
    meta['checksums_ok'] = (data[p] == ck.s1 and data[p + 1] == ck.s2)
    meta['computed_checksums'] = (ck.s1, ck.s2)
    return header, meta, entries


def format_entry(entry):
    """Render one entry readably; the info half is mostly non-printable."""
    text = entry.decode('cp1250', errors='replace')
    word, _, info = text.partition(':')
    info_repr = ''.join(
        ch if ch.isprintable() else f'\\x{ord(ch):02x}' for ch in info
    )
    return f"{word}:{info_repr}"


def utf8_stdout():
    """A UTF-8 stdout handle; flush the buffered one first to keep ordering."""
    sys.stdout.flush()
    return open(sys.stdout.fileno(), 'w', encoding='utf-8', closefd=False)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('path')
    ap.add_argument('--all', action='store_true', help='print every entry')
    ap.add_argument('-o', '--output', help='write entries to a UTF-8 file')
    args = ap.parse_args()

    with open(args.path, 'rb') as f:
        data = f.read()

    header, meta, entries = decode(data)

    print(f"header:    {header}")
    print(f"signature: {meta['signature']} (1 = base dictionary)")
    print(f"version:   {meta['version'][0]}.{meta['version'][1]}, data v{meta['data_version']}")
    print(f"words:     {meta['count']} declared, {len(entries)} decoded")
    ok = 'OK' if meta['checksums_ok'] else \
         f"MISMATCH file={meta['trailing_checksums']} computed={meta['computed_checksums']}"
    print(f"checksums: {ok}")

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            for e in entries:
                f.write(format_entry(e) + '\n')
        print(f"wrote {len(entries)} entries to {args.output}")
    elif args.all:
        out = utf8_stdout()
        for e in entries:
            out.write(format_entry(e) + '\n')
    else:
        print("\nsample:")
        sample = entries[:5] + entries[len(entries) // 2:len(entries) // 2 + 5] + entries[-5:]
        out = utf8_stdout()
        for e in sample:
            out.write(f"    {format_entry(e)}\n")


if __name__ == '__main__':
    main()
