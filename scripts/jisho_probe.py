#!/usr/bin/env python3
"""
Jisho API proof-of-life probe — Manga Localizer Agent.

Hits jisho.org's public open-data API (no auth, no rate-limit on light use) to
demonstrate the agent's linguistic data layer is real, not mocked. Returns
canonical readings, parts of speech, and example senses for any Japanese token.

Usage:
    python3 scripts/jisho_probe.py 先輩
    python3 scripts/jisho_probe.py 猫の手も借りたい --limit 3
    python3 scripts/jisho_probe.py どきどき --raw

Endpoint: https://jisho.org/api/v1/search/words?keyword=<query>
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request


JISHO_ENDPOINT = "https://jisho.org/api/v1/search/words"


def fetch(query: str, timeout: float = 10.0) -> dict:
    url = f"{JISHO_ENDPOINT}?keyword={urllib.parse.quote(query)}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "manga-localizer-agent/0.1 (proof-of-life probe)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def render_entry(entry: dict, idx: int) -> None:
    japanese = entry.get("japanese", [])
    primary = japanese[0] if japanese else {}
    word = primary.get("word") or primary.get("reading") or "(unknown)"
    reading = primary.get("reading", "")

    senses = entry.get("senses", [])
    pos_set = set()
    for s in senses:
        pos_set.update(s.get("parts_of_speech", []))

    print(f"  [{idx}] {word}" + (f"  ({reading})" if reading and reading != word else ""))
    if pos_set:
        print(f"      pos: {', '.join(sorted(pos_set))}")
    for j, sense in enumerate(senses[:3]):
        defs = sense.get("english_definitions", [])
        if defs:
            print(f"      → {' / '.join(defs[:4])}")
    if entry.get("is_common"):
        print(f"      common word")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("query", help="Japanese word, phrase, kanji, or romaji")
    parser.add_argument("--limit", type=int, default=5, help="Max entries to render (default: 5)")
    parser.add_argument("--raw", action="store_true", help="Print raw JSON response")
    args = parser.parse_args()

    try:
        data = fetch(args.query)
    except Exception as e:
        print(f"error: jisho api request failed — {e}", file=sys.stderr)
        return 1

    if args.raw:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0

    if data.get("meta", {}).get("status") != 200:
        print(f"error: jisho responded with non-200 — {data.get('meta')}", file=sys.stderr)
        return 1

    entries = data.get("data", [])
    if not entries:
        print(f"no entries found for: {args.query}")
        return 0

    print(f"\njisho · {args.query} · {len(entries)} total entries (showing {min(args.limit, len(entries))})")
    print("─" * 64)
    for i, entry in enumerate(entries[: args.limit], start=1):
        render_entry(entry, i)

    print("─" * 64)
    print(f"source: {JISHO_ENDPOINT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
