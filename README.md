<div align="center">

# 漫 Manga Localizer Agent

**An autonomous AI agent for cross-language manga, manhwa, and manhua localization.**
*Keeps the bubbles, the SFX, and the joke. Not just translation.*

[![Live Demo](https://img.shields.io/badge/live-demo-1a1a1a?style=for-the-badge&logo=safari&logoColor=white)](#)
[![Try the Agent](https://img.shields.io/badge/try-the%20agent-c0392b?style=for-the-badge&logo=openai&logoColor=white)](#)
[![Status](https://img.shields.io/badge/status-concept%20stage%20%C2%B7%20pre--MVP-1d6f47?style=for-the-badge)](#roadmap)
[![License: MIT](https://img.shields.io/badge/license-MIT-6e6e6e?style=for-the-badge)](./LICENSE)

</div>

---

## 🔗 Live

| | |
|---|---|
| 🪟 **Landing page** | _to be deployed_ |
| 🛟 **Interactive demo** | _to be deployed_ |
| 🌐 **Languages** | Japanese · English · Bahasa Indonesia · 简体中文 |
| ⚙️ **Live LLM mode** | Bring your own OpenAI-compatible key (MiMo · OpenAI · Groq · xAI · Together · Custom) |

---

## 🎯 Why this exists

Manga, manhwa, and manhua aren't text — they're **text inside a visual grammar.** Existing tools translate words; they don't preserve bubbles, SFX, panel order, honorifics, or the joke.

| Problem | What generic translators do | What this agent does |
|---|---|---|
| 🗨️ Speech bubble fit | Truncate or overflow | Calculate polygon area, pick font + leading |
| 💥 SFX `どきどき` | Romanize to "doki doki" | Transcreate to "thump-thump" / "deg-degan" / "砰砰" |
| 🥇 Honorific `先輩` | Drop or misrender | Map per target language convention |
| 😂 Kanji pun | Drop or footnote-only | Reconstruct equivalent target-language pun |
| 🍢 Cultural ref `こたつ` | Drop or romanize | Decide: preserve, swap, or footnote |
| 📖 Panel order RTL | Ignore | Flip to LTR for EN/ID readers when needed |

This is the gap between "machine translation that *works*" and "machine translation that *ships*."

---

## 🧭 Four-layer agent loop

<table>
<tr>
<th>Layer</th>
<th>What it does</th>
<th>Tier</th>
</tr>
<tr>
<td><strong>01 · Perception 👁️</strong></td>
<td>OCR speech bubbles, detect bubble polygons via CV, find SFX outside bubbles, classify panel reading order (RTL/LTR).</td>
<td>cheap</td>
</tr>
<tr>
<td><strong>02 · Translation 📝</strong></td>
<td>Per-bubble translate against last 3-panel context, character voice cache, honorific mapping per target language.</td>
<td>cheap</td>
</tr>
<tr>
<td><strong>03 · Transcreation ✨</strong></td>
<td>SFX onomatopoeia mapping. Idiom transcreation (not literal). Kanji-pun reconstruction. Cultural reference: keep, swap, or footnote.</td>
<td><strong>smart</strong></td>
</tr>
<tr>
<td><strong>04 · Typesetting 🖋️</strong></td>
<td>Bubble fit calculation, font matching (Wild Words / Mangat), SFX styling (italic + bold + skew), RTL→LTR panel flip when needed.</td>
<td>cheap + smart</td>
</tr>
</table>

---

## ⚖️ Cost-tier routing

```
┌────────────────────────────── 100% ──────────────────────────────┐
│                                                                  │
│  cheap tier                                       smart tier     │
│  ████████████████████████████████████████████░░░░░░░░░░░░░░░░░░  │
│  ~80%  perception · raw translate · format        ~20% transcreate│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

> 🟢 **Cheap tier** — OCR · bubble detection · raw translate with context · honorific mapping · bubble fit · font matching · RTL→LTR flip.
>
> 🟡 **Smart tier** — SFX onomatopoeia mapping · idiom transcreation · pun reconstruction · cultural reference handling · SFX styling preset selection.

**Why this matters for unit economics.** A scanlator running 200 pages/week with ~6 bubbles/page makes ~1,200 LLM calls/week. Most need to be small fast cheap calls. The smart tier is reserved for actual creative decisions. ~80/20 is the shape that fits a fan-scanlation budget — and a natural fit for a tiered model family that bills cheap calls cheaply.

---

## 🌐 Why this is a multilingual showcase

The agent operates across **four languages with three direction matrices**:

```
JP → EN     // Western fan scanlation, official EN licensing
JP → ID     // ASEAN reader market, growing legitimate licensing
JP → CN     // CN reader market, both fan and licensed
KR → EN/ID  // Manhwa boom in ASEAN
CN → EN/ID  // Manhua cross-export
```

Cultural transcreation across these direction pairs is **reasoning that requires native fluency in source AND target**, not just word-level mapping. This is exactly the territory where multilingual model families shine over English-only tooling.

---

## ✨ What makes this build legible

- 🎨 **Hand-drawn comparison panels** — JP/EN/ID/CN side-by-side showing the same scene transcreated, not just translated.
- 🌐 **Trilingual landing UI** — EN / ID / CN, language toggle persists across sessions.
- 🛟 **Interactive demo** — pick from 5 sample challenges (idiom · SFX · honorific · pun · cultural ref), watch the four layers run with their tool calls and decisions visible.
- ⚙️ **Bring-your-own-LLM mode** — paste an OpenAI-compatible key, the demo's transcreation layer becomes a live call to your provider.
- 🔍 **Live data probe** — `scripts/jisho_probe.py` hits the public Jisho dictionary API to demonstrate the agent's linguistic data layer is real, not mocked.
- ✅ **Honest framing** — concept-stage, pre-MVP, scope cuts spelled out. No over-claim.

---

## 🚫 What's intentionally not in scope

- **Pirate scanlation pipeline.** The agent is a tool, not a distribution platform. Source rights stay with the publisher.
- **Voice acting / dub generation.** Manga is a print medium first. Audio is out of scope.
- **Auto-coloring of black-and-white pages.** Color is artistic intent, not a localization decision.
- **Full studio replacement.** A human translator stays in the loop on smart-tier output. The agent accelerates, it does not replace.

---

## ⚠️ Biggest open risk

> **SFX onomatopoeia is a creative policy, not a solved problem.**
>
> A literal `どきどき` → "doki doki" satisfies fans of Japanese conventions but breaks for general EN/ID/CN readers. The SFX mapper is a tunable artistic policy — fan scanlators and licensed studios choose differently. We expose this as a knob, not pretend there's a single right answer.

---

## 🔍 Live Jisho probe (no auth required)

```bash
python3 scripts/jisho_probe.py 先輩
python3 scripts/jisho_probe.py 猫の手も借りたい --limit 3
python3 scripts/jisho_probe.py どきどき --raw
```

Hits `jisho.org/api/v1/search/words` — the public Japanese dictionary API, no key needed. Returns canonical readings, parts of speech, and example senses. Proof-of-life for the agent's linguistic data layer.

---

## 🗺️ Roadmap

| Stage | What | When |
|:---:|---|---|
| **M0** ✅ | Concept · landing · interactive demo · architecture spec · Jisho probe | Today |
| **M1** ⏳ | CLI proof: PNG manga panel → JSON output (bubble bbox + translation + SFX mapping). Bring-your-own-LLM mode. | Next |
| **M2** | Web SPA: drag-drop a page, see it localized inline, manual fix-up tool for typesetters. | Q3 |
| **M3** | Scanlator group integration — Discord bot, batch upload, team review workflow, glossary persistence per series. | Q4+ |

---

## 📁 Project structure

```
manga-localizer-agent/
├── index.html                  # landing page (EN/ID/CN, hero + 4-layer + cost-tier)
├── assets/
│   ├── style.css               # ink-paper light theme, manga-screen-tone accents
│   ├── i18n.js                 # language toggle (persistent)
│   ├── hero.svg                # JP/EN/ID/CN side-by-side comparison panels
│   ├── architecture.svg        # four-layer pipeline diagram
│   └── favicon.svg             # 漫 + MLA mark
├── demo/
│   ├── index.html              # interactive demo with 5 sample challenges
│   ├── demo.css
│   └── demo.js                 # scripted runtime + live LLM mode
├── docs/
│   └── ARCHITECTURE.md         # four-layer pipeline + cost-tier + module boundaries
├── scripts/
│   └── jisho_probe.py          # live Jisho public API probe
├── README.md
├── LICENSE
└── .gitignore
```

---

## 📜 License

MIT — see [LICENSE](./LICENSE). Free to study, fork, and ship.

---

<div align="center">

*Built for translators, not to replace them.* 漫
*The bubble has to fit. The joke has to land. The cat has to stay.*

</div>
