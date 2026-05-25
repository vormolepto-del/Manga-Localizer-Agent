# Architecture · Manga Localizer Agent

> Concept-stage spec. The artifact today is a landing page + interactive demo + a Jisho-API proof-of-life script. This document describes the runtime we're scaffolding toward in M1–M2.

---

## Design constraints

The agent is built around four constraints that distinguish it from a generic "translate this image" tool:

1. **Visual grammar matters.** Manga is text inside bubbles inside panels. Translation that ignores bubble fit, panel order, and SFX placement produces output that no scanlator or licensed studio can use.
2. **Cultural transcreation > literal accuracy.** A literal translation of an idiom, joke, or cultural reference frequently produces a worse reading experience than a free adaptation. The agent must reason about whether to preserve, swap, or footnote.
3. **Per-page cost has to fit fan-scanlation budgets.** A scanlator group running 200 pages a week cannot afford GPT-4-level pricing on every bubble. The pipeline routes ~80% of work through a cheap tier so the smart tier is reserved for the decisions that need it.
4. **Layers must be replaceable.** Every group has its own conventions — preferred font pool, honorific policy, SFX mapping style. The agent exposes each layer as a swappable module rather than a black box.

---

## Four-layer pipeline

```
INPUT page.png → [01 Perception] → [02 Translation] → [03 Transcreation] → [04 Typesetting] → OUTPUT page_xx.png
```

Each layer reads from a shared `Page` object and writes a structured patch back. The pipeline is async-first so a batch of pages can run with bounded concurrency.

### 01 · Perception (cheap tier)

**Inputs:** raw page image (PNG/JPG), optional series glossary.
**Outputs:** `BubblePolygon[]`, `OcrText[]`, `SfxText[]`, `PanelOrder` (RTL/LTR).

| Sub-task                | Implementation                                                | Why cheap tier |
|------------------------|---------------------------------------------------------------|----------------|
| Bubble detection       | OpenCV contour + ML mask refiner (manga-tuned)                | Pixel ops, no reasoning |
| OCR (JP/CN/KR)         | Tesseract + manga-specific finetune                           | Bounded vocabulary |
| SFX detection          | Outside-bubble text region heuristic                          | Pure CV |
| Panel order            | Reading-order classifier (RTL vs LTR layouts)                 | Single binary decision |

The perception layer never calls an LLM. It produces structured JSON that the next layer consumes.

### 02 · Translation (cheap tier)

**Inputs:** `OcrText[]`, prior 3-panel context cache, character profile cache, target language(s).
**Outputs:** `RawTranslation[]` per target language.

| Sub-task                  | Implementation                                          | Why cheap tier |
|--------------------------|---------------------------------------------------------|----------------|
| Per-bubble translate     | LLM with 3-panel context + character voice cache       | Bounded prompt, factual mapping |
| Honorific mapping        | Rule table per target language                          | Deterministic |
| Style register selection | Lookup from character profile (formal/casual/dialect)   | Cache hit |

This layer is deliberately non-creative. It produces a raw, faithful translation. The transcreation layer is where freedom lives.

### 03 · Transcreation (smart tier)

**Inputs:** `RawTranslation[]`, cultural-reference DB, SFX mapping policy.
**Outputs:** `TranscreatedText[]`, optional `Footnote[]`.

This is the only layer that needs the smart tier. It handles the four problems that defeat literal translation:

1. **SFX onomatopoeia.** どきどき → "thump-thump" / "deg-degan" / 砰砰 — each target language has its own conventions and the scanlator's policy decides whether to preserve, transliterate, or replace.
2. **Idiom transcreation.** "Even a cat's paw" → "I need an extra pair of hands" requires understanding both the meaning and the natural target-language equivalent.
3. **Pun reconstruction.** Kanji-based puns rarely survive translation. The agent attempts to reconstruct an equivalent pun in the target language, falling back to a footnote when no equivalent exists.
4. **Cultural reference handling.** こたつ → keep with footnote (EN), swap to "warm bed" (ID), preserve as 被炉 (CN). The decision matrix is series-specific and tunable.

### 04 · Typesetting (cheap + smart, mixed)

**Inputs:** `TranscreatedText[]`, `BubblePolygon[]`, font pool, optional style guide.
**Outputs:** `TypesetPage` (PSD layers or composited PNG).

| Sub-task                         | Tier   | Notes |
|---------------------------------|--------|-------|
| Bubble fit calculation          | cheap  | Geometric, polygon area vs text bounding box |
| Font matching                    | cheap  | Lookup against font pool + character mapping |
| SFX styling (italic/skew/etc)    | smart  | Artistic — match SFX dynamism to target language convention |
| Panel order flip (RTL→LTR)       | cheap  | Image transformation, deterministic |

The smart-tier portion of typesetting is small and bounded — it's choosing a styling preset, not generating layout from scratch.

---

## Cost-tier routing (~80/20 split)

```
┌────────────────────────────── 100% ──────────────────────────────┐
│                                                                  │
│  cheap tier                                       smart tier     │
│  ████████████████████████████████████████████░░░░░░░░░░░░░░░░░░  │
│  ~80%  perception + raw translate + format        ~20% transcreate│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Cheap tier (~80% of work):**
- OCR + bubble detection + SFX detection
- Raw per-bubble translation with context cache
- Honorific mapping (rule table)
- Bubble fit calculation
- Font matching from pool
- Panel order flip (RTL→LTR)

**Smart tier (~20% of work):**
- SFX onomatopoeia mapping decision
- Idiom transcreation
- Pun reconstruction
- Cultural reference handling (preserve/swap/footnote)
- SFX styling preset selection

**Why this matters for unit economics:** A scanlator running 200 pages/week cannot afford a GPT-4-level call on every bubble. With a 6-bubble-per-page average, that's 1,200 LLM calls/week per group. Most need to be small fast cheap calls, with the smart tier reserved for actual creative decisions. ~80/20 is the shape that fits.

---

## Module boundaries

The pipeline is intentionally loose-coupled. Each layer can be replaced independently:

```
app/
├── perception/
│   ├── bubble_detector.py       # CV-based, swappable for ML model
│   ├── ocr.py                   # tesseract by default
│   └── sfx_detector.py          # heuristic
├── translation/
│   ├── translator.py            # LLM-backed (any OpenAI-compatible)
│   ├── context_cache.py         # last-3-panel sliding window
│   └── honorific_map.py         # rule table per target lang
├── transcreation/
│   ├── sfx_mapper.py            # policy-driven SFX adaptation
│   ├── idiom_db.py              # JP→{EN,ID,CN} idiom corpus
│   └── pun_reconstructor.py     # LLM-backed
├── typesetting/
│   ├── bubble_fit.py            # geometric
│   ├── font_pool.py             # local font registry
│   └── compositor.py            # PIL-backed PNG output
└── orchestrator/
    ├── pipeline.py              # async runner with bounded concurrency
    └── policy.py                # scanlator-group preferences
```

A scanlator can replace `font_pool.py` with their own typeface preferences without touching the rest of the agent. A licensed studio can swap `transcreation/sfx_mapper.py` for a more conservative policy. The orchestrator coordinates but doesn't mandate.

---

## Persistence

Three durable stores:

1. **Series glossary.** Character names, recurring honorific choices, established translation conventions. Persists per-series across pages.
2. **Idiom DB.** JP→{EN,ID,CN} idiom corpus with confidence scores. Grows as the agent encounters new patterns.
3. **Trace log.** Per-page pipeline trace (which layer made which decision, smart-tier rationale, fallback reasons). Useful for human reviewer audit.

All three are local SQLite by default. Cloud sync is optional, not required.

---

## Out of scope (intentional)

- **Pirate scanlation pipeline.** The agent is a tool for scanlators and licensed studios alike, not a distribution platform.
- **Voice acting / dub generation.** Manga is a print medium. Audio is out of scope.
- **Auto-coloring of black-and-white pages.** Color is artistic intent, not a localization decision.
- **Full studio replacement.** A human translator stays in the loop on smart-tier output. The agent accelerates, it does not replace.

---

## Open risks

1. **SFX onomatopoeia is a tunable policy, not a solved problem.** Fan scanlators and licensed studios make different choices. The agent must expose this as a knob, not pretend there's a single right answer.
2. **OCR accuracy on stylized lettering.** Manga uses creative typography that breaks generic OCR models. Manga-tuned OCR is required, not optional.
3. **Cultural reference handling drifts over time.** Audience familiarity with こたつ vs 被炉 vs "kotatsu" changes by year and region. The agent's reference DB needs ongoing curation.
4. **Smart-tier hallucination on idiom transcreation.** A model that confidently invents a non-existent idiom in the target language is worse than literal translation. We use temperature controls + glossary anchoring + human-in-the-loop review on smart-tier output.
