# Manga Localizer Agent

Cross-language manga, manhwa, and manhua localization. Translates the bubble, transcreates the SFX, keeps the joke, lays out the page.

> **Status: concept artifact, pre-MVP.** Trilingual landing, interactive demo, architecture spec, live Jisho probe. CLI and trained bubble detector are next.

**Live demo:** *enabled after the repo is pushed and GitHub Pages flips on — link drops here once it's live.*

---

## Why generic translators fall short

A weekly fan-scanlation chapter is roughly 18 pages × 6 bubbles × 4 SFX. That's ~108 bubbles and ~72 onomatopoeia decisions per chapter. A generic translator flattens all that into a CSV of strings. The medium breaks.

What a real chapter actually requires:

- **Bubble fit.** A 12-character JP line might expand to 28 characters in EN. The polygon doesn't grow — font, leading, and line breaks recalculate per bubble.
- **SFX onomatopoeia.** `どきどき` is "thump-thump" in EN, "deg-degan" in ID, "砰砰" in ZH — not "doki doki" for general readers. SFX is a tunable artistic policy, not a hard rule.
- **Honorifics.** `先輩` keeps as "senpai" for fan scanlation, becomes "upperclassman" for licensed EN, drops entirely for some ID releases.
- **Kanji puns.** A pun on `橋` (hashi, bridge) and `箸` (hashi, chopsticks) is dead in literal translation. Reconstruct an equivalent — or footnote the choice.
- **Cultural references.** `こたつ` (kotatsu) — preserve, swap to "heated table", or footnote? Context-aware call, surfaced for review.
- **Panel order.** Japanese pages read right-to-left. EN/ID readers expect LTR. Flip the reading order when the target market expects it.

---

## The four layers

```
01  PERCEPTION    OCR + bubble polygon detection + SFX-outside-bubbles + panel order classification
02  TRANSLATION   per-bubble translate against rolling 3-panel context + character voice cache + honorifics
03  TRANSCREATION SFX onomatopoeia + idiom + pun reconstruction + cultural ref decision  ← reasoning lives here
04  TYPESETTING   bubble fit + font match + SFX styling + RTL→LTR flip if target expects it
```

The first two are cheap. The third is where the model has to actually think. The fourth is geometry with a touch of style.

Architecture details: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Cost shape

A scanlation group running 200 pages a week makes ~1,200 LLM calls a week. Most are small, fast, cheap.

```
~80%  cheap tier  — perception, raw translate, format, geometry
~20%  smart tier  — transcreation, creative decisions
```

Only the transcreation calls — onomatopoeia, idiom, pun, cultural — earn the smart tier. The same routing logic fits any tiered model family.

---

## Bring-your-own-LLM

The demo's transcreation layer accepts an OpenAI-compatible key. Paste it in the demo's settings panel; it routes through your provider (MiMo, OpenAI, Groq, xAI, Together, or any custom endpoint). The key stays in `localStorage`. Nothing is logged.

---

## Live linguistic probe

The data layer is real, not mocked. A small script hits the public Jisho dictionary API and returns canonical readings, parts of speech, and example senses for any JP word.

```bash
python3 scripts/jisho_probe.py 先輩
python3 scripts/jisho_probe.py 猫の手も借りたい --limit 3
python3 scripts/jisho_probe.py どきどき --raw
```

No key required. Endpoint: `jisho.org/api/v1/search/words`.

---

## What ships today

- Trilingual landing page (EN / ID / 中文) describing the architecture.
- Interactive demo with five sample challenges — idiom, SFX, honorific, pun, cultural reference — running scripted reasoning across the four layers, plus a live LLM mode for the transcreation layer.
- Architecture document covering layer interfaces, module boundaries, and cost-tier routing.
- Live Jisho probe script.

## What does not ship yet

- A working CLI that takes a PNG and emits structured output.
- Bubble polygon detection trained on a real manga dataset.
- A typesetter that writes back into the cleaned page.

---

## Roadmap

- **M0 — today.** Concept artifact: landing, interactive demo, architecture spec, Jisho probe.
- **M1 — next.** CLI: PNG manga panel in, JSON out (bubble bbox + translation + SFX mapping). Bring-your-own-LLM wired end-to-end.
- **M2.** Web SPA: drag-drop a page, inline localization preview, typesetter manual fix-up tool.
- **M3.** Scanlator group integration — Discord bot, batch upload queue, team review workflow, per-series glossary persistence.

---

## The open problem this agent does not pretend to solve

**SFX policy is artistic.** A literal `どきどき` → "doki doki" satisfies fan-scanlation conventions and breaks for general readers. The agent exposes SFX mapping as a tunable knob, not a single right answer. Fan groups and licensed studios will set it differently. Defaults ship per target language; the typesetter UI surfaces the decision for override.

---

## Out of scope

- **Pirate distribution pipelines.** This is a translation tool. Source rights stay with the publisher.
- **Voice acting / dub generation.** Manga is print-first. Audio is a different problem.
- **Auto-coloring.** Color is artistic intent, not a localization decision.
- **Full studio replacement.** Smart-tier output is a draft. The human stays in the loop.

---

## Repository layout

```
manga-localizer-agent/
├── index.html              landing — EN/ID/中文 hero, four-layer overview, cost shape
├── assets/
│   ├── style.css           ink-paper theme + manga screen-tone accents
│   ├── i18n.js             persistent EN/ID/中文 toggle
│   ├── hero.svg            JP/EN/ID/中文 side-by-side comparison panels
│   ├── architecture.svg    four-layer pipeline diagram
│   └── favicon.svg         漫 + MLA mark
├── demo/
│   ├── index.html          interactive demo, five sample challenges
│   ├── demo.css
│   └── demo.js             scripted reasoning + live LLM mode
├── docs/
│   └── ARCHITECTURE.md     layer interfaces, module boundaries, cost-tier routing
├── scripts/
│   └── jisho_probe.py      live Jisho dictionary API probe
├── README.md
├── LICENSE                 MIT
└── .gitignore
```

---

## License

MIT. Free to study, fork, and ship.

Built for translators. The bubble has to fit. The joke has to land. The cat has to stay.
