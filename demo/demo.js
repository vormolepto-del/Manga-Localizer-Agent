// Manga Localizer Agent — interactive demo runtime.
//
// Two modes:
//   scripted — deterministic, no API key. Pre-baked per-layer tool calls.
//   live     — bring your own OpenAI-compatible endpoint. Layer 02 + 03 call
//              the LLM for translation + transcreation. Layers 01 + 04 stay
//              scripted (OCR + typesetting are mock for the demo).
//
// Key stays in localStorage. fetch() goes browser → provider directly.
(function () {
  'use strict';

  const PROVIDER_KEY = 'mla_provider';
  const PRESETS = {
    mimo:    { base: 'https://api.mimo.xiaomi.com/v1', model: 'mimo-orbit-max' },
    openai:  { base: 'https://api.openai.com/v1',      model: 'gpt-4o-mini'    },
    groq:    { base: 'https://api.groq.com/openai/v1', model: 'llama-3.1-70b-versatile' },
    xai:     { base: 'https://api.x.ai/v1',            model: 'grok-2-mini'    },
    together:{ base: 'https://api.together.xyz/v1',    model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
    custom:  { base: '', model: '' },
  };

  // ── Sample panels: per-phase tool-call traces + final transcreated bubbles ──
  // Each phase[N].calls is a list of structured tool calls rendered into that
  // phase's <ul class="tool-calls">. Format:
  //   { name, args, out, latency }
  const SAMPLES = {
    idiom: {
      jp:  { bubble: '猫の手も借りたい',                sfx: '' },
      en:  { bubble: "I need an extra pair of hands.", sfx: '' },
      id:  { bubble: "Lagi butuh tangan lebih nih.",    sfx: '' },
      cn:  { bubble: "忙得连猫都想雇",                   sfx: '' },
      phase1: [
        { name: 'bubble_detector',  args: 'page=01.png',                       out: '1 polygon · 240×88px',    latency: 32 },
        { name: 'ocr.jp',           args: 'bbox=[210,140,450,228]',            out: '"猫の手も借りたい"',         latency: 84 },
        { name: 'sfx_detector',     args: 'page=01.png, outside_bubbles=true', out: '0 SFX regions',           latency: 18 },
        { name: 'panel_order',      args: 'page=01.png',                       out: 'RTL',                     latency: 12 },
      ],
      phase2: [
        { name: 'character_cache',  args: 'speaker_id=auto',                    out: 'no profile match · use neutral',   latency: 4 },
        { name: 'context_window',   args: 'last_n=3',                           out: '0 prior panels (page start)',      latency: 2 },
        { name: 'idiom_check',      args: 'jp="猫の手も借りたい"',               out: '⚠ idiom flagged · escalate to L3', latency: 6 },
      ],
      phase3: [
        { name: 'idiom_db.lookup',  args: 'jp="猫の手も借りたい"',                                                  out: 'match · "extreme busyness"',                     latency: 9 },
        { name: 'transcreate.en',   args: 'meaning="extreme busyness", style=natural',                              out: '"I need an extra pair of hands."',                latency: 320 },
        { name: 'transcreate.id',   args: 'meaning="extreme busyness", style=conversational',                       out: '"Lagi butuh tangan lebih nih."',                  latency: 280 },
        { name: 'transcreate.cn',   args: 'meaning="extreme busyness", style=preserve_cat_image',                   out: '"忙得连猫都想雇"',                                latency: 295 },
      ],
      phase4: [
        { name: 'bubble_fit.calc',  args: 'polygon=240×88, font=Wild_Words',  out: 'EN ✓ · ID ✓ · CN ✓',          latency: 14 },
        { name: 'order_flipper',    args: 'src=RTL, target_lang=en|id',       out: 'flip both',                   latency: 6 },
        { name: 'compositor',       args: 'output=page_xx.png',               out: '3 PNGs ready',                latency: 95 },
      ],
    },

    sfx: {
      jp:  { bubble: 'えっ?',     sfx: 'どきどき' },
      en:  { bubble: 'Huh?',      sfx: 'thump-thump' },
      id:  { bubble: 'Hah?',      sfx: 'deg-degan' },
      cn:  { bubble: '诶？',      sfx: '砰砰' },
      phase1: [
        { name: 'bubble_detector',  args: 'page=02.png',                       out: '1 polygon · 120×80px',    latency: 28 },
        { name: 'ocr.jp',           args: 'bbox=[180,90,300,170]',             out: '"えっ?"',                   latency: 41 },
        { name: 'sfx_detector',     args: 'page=02.png, outside_bubbles=true', out: '1 region · "どきどき"',     latency: 52 },
        { name: 'panel_order',      args: 'page=02.png',                       out: 'RTL',                     latency: 11 },
      ],
      phase2: [
        { name: 'character_cache',  args: 'speaker_id=auto',                   out: 'series_glossary hit · "Yui · casual"', latency: 5 },
        { name: 'context_window',   args: 'last_n=3',                          out: '2 prior panels · romantic tension',    latency: 3 },
        { name: 'register.detect',  args: 'bubble="えっ?"',                    out: 'interjection · simple cross-lang map', latency: 7 },
      ],
      phase3: [
        { name: 'sfx_mapper',       args: 'jp="どきどき", target=en, policy=westernize',     out: '"thump-thump"',  latency: 220 },
        { name: 'sfx_mapper',       args: 'jp="どきどき", target=id, policy=native',          out: '"deg-degan"',    latency: 180 },
        { name: 'sfx_mapper',       args: 'jp="どきどき", target=cn, policy=phoneme_match',   out: '"砰砰"',          latency: 195 },
      ],
      phase4: [
        { name: 'bubble_fit.calc',  args: 'polygon=120×80, font=Anime_Ace',           out: 'EN ✓ · ID ✓ · CN ✓',                            latency: 12 },
        { name: 'sfx_styler',       args: 'sfx=any, italic=true, bold=true, skew=8°', out: 'EN/ID/CN styled',                             latency: 22 },
        { name: 'compositor',       args: 'output=page_xx.png, sfx_layer=true',       out: '3 PNGs ready · SFX outside polygon preserved', latency: 110 },
      ],
    },

    honorific: {
      jp:  { bubble: '田中先輩、おはようございます',  sfx: '' },
      en:  { bubble: "Good morning, Tanaka-senpai.",  sfx: '' },
      id:  { bubble: "Selamat pagi, Kak Tanaka.",     sfx: '' },
      cn:  { bubble: "田中前辈，早上好。",             sfx: '' },
      phase1: [
        { name: 'bubble_detector',  args: 'page=03.png',                       out: '1 polygon · 280×100px',          latency: 34 },
        { name: 'ocr.jp',           args: 'bbox=[150,60,430,160]',             out: '"田中先輩、おはようございます"',  latency: 92 },
        { name: 'sfx_detector',     args: 'page=03.png, outside_bubbles=true', out: '0 SFX regions',                  latency: 16 },
        { name: 'panel_order',      args: 'page=03.png',                       out: 'RTL',                            latency: 13 },
      ],
      phase2: [
        { name: 'character_cache',  args: 'speaker_id=auto',                   out: 'series_glossary hit · "Kohei · polite junior"', latency: 5 },
        { name: 'honorific.detect', args: 'bubble="田中先輩、..."',              out: '先輩 attached to "田中" · senior+1yr',           latency: 8 },
        { name: 'context_window',   args: 'last_n=3',                          out: '1 prior panel · school setting',                latency: 3 },
      ],
      phase3: [
        { name: 'honorific.map',    args: 'jp=先輩, target=en, policy=preserve_loanword',  out: '"-senpai" (kept)',  latency: 4 },
        { name: 'honorific.map',    args: 'jp=先輩, target=id, policy=closest_register',   out: '"Kak" (sibling)',   latency: 4 },
        { name: 'honorific.map',    args: 'jp=先輩, target=cn, policy=direct_equivalent',  out: '"前辈"',             latency: 4 },
        { name: 'transcreate.bulk', args: 'bubble="田中先輩、おはよう...", langs=[en,id,cn]', out: '3 bubbles ready',  latency: 410 },
      ],
      phase4: [
        { name: 'bubble_fit.calc',  args: 'polygon=280×100, font=Wild_Words',  out: 'EN ✓ · ID ✓ · CN ✓',  latency: 13 },
        { name: 'order_flipper',    args: 'src=RTL, target_lang=en|id',        out: 'flip both',           latency: 6 },
        { name: 'compositor',       args: 'output=page_xx.png',                out: '3 PNGs ready',        latency: 88 },
      ],
    },

    pun: {
      jp:  { bubble: 'パンが好きパン!',              sfx: '' },
      en:  { bubble: "I'm a pan-demic bread fan!",   sfx: '' },
      id:  { bubble: "Aku roti-banget sama roti!",   sfx: '' },
      cn:  { bubble: "我对面包简直\"包\"满热情！",    sfx: '' },
      phase1: [
        { name: 'bubble_detector',  args: 'page=04.png',                       out: '1 polygon · 200×90px',     latency: 30 },
        { name: 'ocr.jp',           args: 'bbox=[195,110,395,200]',            out: '"パンが好きパン!"',         latency: 56 },
        { name: 'sfx_detector',     args: 'page=04.png, outside_bubbles=true', out: '0 SFX regions',            latency: 18 },
        { name: 'panel_order',      args: 'page=04.png',                       out: 'LTR (yonkoma layout)',     latency: 14 },
      ],
      phase2: [
        { name: 'context_window',   args: 'last_n=3',                          out: '2 prior panels · comedy tone',  latency: 3 },
        { name: 'pun.detect',       args: 'jp="パンが好きパン!"',               out: '⚠ pun · "パン" repeated',        latency: 9 },
        { name: 'register.detect', args: 'bubble="パンが..."',                  out: 'comedic emphasis · escalate L3', latency: 5 },
      ],
      phase3: [
        { name: 'pun.reconstruct',  args: 'jp="パンが好きパン!", target=en, policy=homophone',  out: '"pan-demic bread fan"',  latency: 480 },
        { name: 'pun.reconstruct',  args: 'jp="パンが好きパン!", target=id, policy=intensifier', out: '"roti-banget"',          latency: 420 },
        { name: 'pun.reconstruct',  args: 'jp="パンが好きパン!", target=cn, policy=kanji_bridge', out: '"包" pun (wrap/love)',   latency: 510 },
        { name: 'policy.confirm',   args: 'pun_preservation > literal',                          out: 'artistic choice logged', latency: 2 },
      ],
      phase4: [
        { name: 'bubble_fit.calc',  args: 'polygon=200×90, font=Wild_Words',  out: 'EN ✓ · ID ✓ · CN ✓ (CN tight)',  latency: 15 },
        { name: 'compositor',       args: 'output=page_xx.png',               out: '3 PNGs ready',                   latency: 92 },
      ],
    },

    culture: {
      jp:  { bubble: 'こたつでおでん食べたい',           sfx: '' },
      en:  { bubble: "I want oden under the kotatsu.*",  sfx: '' },
      id:  { bubble: "Pengen makan soto di kasur anget.", sfx: '' },
      cn:  { bubble: "好想钻被炉吃关东煮啊",              sfx: '' },
      phase1: [
        { name: 'bubble_detector',  args: 'page=05.png',                       out: '1 polygon · 260×95px',                latency: 35 },
        { name: 'ocr.jp',           args: 'bbox=[170,80,430,175]',             out: '"こたつでおでん食べたい"',              latency: 78 },
        { name: 'sfx_detector',     args: 'page=05.png, outside_bubbles=true', out: '0 SFX regions',                       latency: 17 },
        { name: 'panel_order',      args: 'page=05.png',                       out: 'RTL',                                 latency: 12 },
      ],
      phase2: [
        { name: 'context_window',   args: 'last_n=3',                              out: '3 prior panels · winter setting',  latency: 4 },
        { name: 'culture_ref.scan', args: 'bubble="こたつでおでん..."',              out: '2 refs: こたつ · おでん',           latency: 11 },
        { name: 'register.detect',  args: 'bubble="...食べたい"',                   out: 'casual longing · escalate L3',     latency: 5 },
      ],
      phase3: [
        { name: 'culture.decide',   args: 'ref=こたつ, target=en, policy=preserve+footnote',     out: '"kotatsu*" + footnote',         latency: 280 },
        { name: 'culture.decide',   args: 'ref=おでん, target=en, policy=preserve+footnote',     out: '"oden" (footnote shared)',      latency: 240 },
        { name: 'culture.decide',   args: 'ref=こたつ, target=id, policy=functional_swap',       out: '"kasur anget" (warm bed)',      latency: 310 },
        { name: 'culture.decide',   args: 'ref=おでん, target=id, policy=functional_swap',       out: '"soto" (warm stew)',            latency: 290 },
        { name: 'culture.decide',   args: 'ref=こたつ, target=cn, policy=loanword_natural',      out: '"被炉" (CN-JP loan)',           latency: 220 },
        { name: 'culture.decide',   args: 'ref=おでん, target=cn, policy=loanword_natural',      out: '"关东煮" (CN-JP loan)',          latency: 230 },
      ],
      phase4: [
        { name: 'bubble_fit.calc',  args: 'polygon=260×95, font=Wild_Words',  out: 'EN ✓ · ID ✓ · CN ✓',         latency: 14 },
        { name: 'footnote_layer',   args: 'lang=en, marker="*"',              out: '1 footnote · bottom margin', latency: 9 },
        { name: 'order_flipper',    args: 'src=RTL, target_lang=en|id',       out: 'flip both',                  latency: 6 },
        { name: 'compositor',       args: 'output=page_xx.png',               out: '3 PNGs ready',               latency: 102 },
      ],
    },
  };

  // ── Provider state ──
  function loadProvider() {
    try {
      const raw = localStorage.getItem(PROVIDER_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { mode: 'scripted', preset: 'openai', base: PRESETS.openai.base, model: PRESETS.openai.model, key: '' };
  }
  function saveProvider(p) {
    try { localStorage.setItem(PROVIDER_KEY, JSON.stringify(p)); } catch (e) {}
  }
  let provider = loadProvider();

  const $ = (id) => document.getElementById(id);

  function syncProviderUI() {
    $('prov-mode').value = provider.mode;
    $('prov-preset').value = provider.preset;
    $('prov-base').value = provider.base;
    $('prov-model').value = provider.model;
    $('prov-key').value = provider.key;
    const pill = $('prov-mode-pill');
    if (provider.mode === 'live') {
      pill.textContent = 'LIVE';
      pill.classList.add('live');
    } else {
      pill.textContent = 'SCRIPTED';
      pill.classList.remove('live');
    }
  }

  function bindProvider() {
    $('prov-mode').addEventListener('change', (e) => {
      provider.mode = e.target.value;
      saveProvider(provider);
      syncProviderUI();
    });
    $('prov-preset').addEventListener('change', (e) => {
      provider.preset = e.target.value;
      const p = PRESETS[provider.preset];
      provider.base = p.base;
      provider.model = p.model;
      saveProvider(provider);
      syncProviderUI();
    });
    ['prov-base', 'prov-model', 'prov-key'].forEach((id) => {
      $(id).addEventListener('input', (e) => {
        const k = id.replace('prov-', '');
        provider[k] = e.target.value;
        saveProvider(provider);
      });
    });
  }

  // ── Sample picker ──
  let activeSample = 'idiom';
  function bindSamples() {
    document.querySelectorAll('.sample').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sample').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeSample = btn.dataset.sample;
      });
    });
  }

  // ── Phase rendering ──
  function resetPhases() {
    [1, 2, 3, 4].forEach((n) => {
      const phase = $('phase-' + n);
      phase.classList.remove('active', 'done');
      const pill = phase.querySelector('.phase-pill');
      pill.dataset.status = 'idle';
      const list = phase.querySelector('.tool-calls');
      list.innerHTML = '';
      list.dataset.empty = 'true';
      const empty = document.createElement('li');
      empty.className = 'tool-empty';
      empty.dataset.langEn = '';
      empty.classList.add('active');
      empty.textContent = n === 1 ? '— pipeline not started —' : `— waiting for layer ${n - 1} —`;
      list.appendChild(empty);
    });
  }

  function activatePhase(n) {
    const phase = $('phase-' + n);
    phase.classList.add('active');
    phase.querySelector('.phase-pill').dataset.status = 'running';
    const list = phase.querySelector('.tool-calls');
    list.innerHTML = '';
    list.dataset.empty = 'false';
    phase.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function completePhase(n) {
    const phase = $('phase-' + n);
    phase.classList.remove('active');
    phase.classList.add('done');
    phase.querySelector('.phase-pill').dataset.status = 'done';
  }

  function pushToolCall(n, call, isLive) {
    const list = $('phase-' + n).querySelector('.tool-calls');
    const li = document.createElement('li');
    li.className = 'tool-call';
    const liveTag = isLive ? '<span class="live-tag">live</span>' : '';
    const latency = call.latency != null ? `<span class="latency">${call.latency}ms</span>` : '';
    li.innerHTML = `
      <span class="marker${isLive ? ' live' : ''}"></span>
      <span class="body">${liveTag}<span class="tool-name">${call.name}</span>(<span class="arg">${call.args}</span>) <span class="out">→ ${call.out}</span>${latency}</span>
    `;
    list.appendChild(li);
  }

  // ── LLM call (live mode) ──
  async function callLLM(systemPrompt, userPrompt) {
    if (!provider.base || !provider.model || !provider.key) {
      throw new Error('Missing base URL / model / API key');
    }
    const url = provider.base.replace(/\/$/, '') + '/chat/completions';
    const t0 = Date.now();
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + provider.key,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 200));
    }
    const j = await r.json();
    return {
      content: j.choices?.[0]?.message?.content?.trim() || '',
      latency: Date.now() - t0,
    };
  }

  // ── Result card render ──
  function renderResults(sample) {
    $('r-jp').textContent = sample.jp.bubble;
    $('r-sfx-jp').textContent = sample.jp.sfx;
    ['en', 'id', 'cn'].forEach((l) => {
      $('r-' + l).textContent = sample[l].bubble;
      $('r-' + l).classList.remove('empty');
      $('r-sfx-' + l).textContent = sample[l].sfx;
    });
  }

  // ── Pipeline runner ──
  async function runPipeline() {
    const sample = SAMPLES[activeSample];
    const grid = $('result-grid');
    const runBtn = $('run-btn');

    resetPhases();
    grid.hidden = true;
    runBtn.disabled = true;

    // Phase 1 — Perception (always scripted)
    activatePhase(1);
    for (const call of sample.phase1) {
      pushToolCall(1, call, false);
      await sleep(80 + Math.random() * 60);
    }
    completePhase(1);
    await sleep(150);

    // Phase 2 — Translation
    activatePhase(2);
    if (provider.mode === 'live') {
      try {
        const sys = 'You are a manga localizer doing a raw faithful translation. Given a Japanese bubble, output ONLY the literal raw EN translation. No quotes, no commentary.';
        const { content, latency } = await callLLM(sys, `Raw translate: ${sample.jp.bubble}`);
        pushToolCall(2, { name: 'llm.translate.raw', args: `model="${provider.model}"`, out: `"${content.slice(0, 60)}${content.length > 60 ? '…' : ''}"`, latency }, true);
      } catch (err) {
        pushToolCall(2, { name: 'llm.translate.raw', args: 'live=true', out: '⚠ ' + err.message + ' · falling back to scripted', latency: 0 }, true);
      }
      for (const call of sample.phase2.slice(0, 2)) {
        pushToolCall(2, call, false);
        await sleep(80);
      }
    } else {
      for (const call of sample.phase2) {
        pushToolCall(2, call, false);
        await sleep(80 + Math.random() * 60);
      }
    }
    completePhase(2);
    await sleep(150);

    // Phase 3 — Transcreation (smart tier)
    activatePhase(3);
    const transcreated = { en: null, id: null, cn: null };
    if (provider.mode === 'live') {
      // Show non-LLM scripted calls first
      for (const call of sample.phase3) {
        if (!call.name.startsWith('transcreate.') && !call.name.startsWith('pun.reconstruct') && !call.name.startsWith('culture.decide') && !call.name.startsWith('sfx_mapper') && !call.name.startsWith('honorific.map')) {
          pushToolCall(3, call, false);
          await sleep(60);
        }
      }
      const sys = 'You are a manga localizer doing cultural transcreation, NOT literal translation. Given a Japanese bubble, output ONLY the localized bubble text — no quotes, no notes. Preserve tone and intent; transcreate idioms, SFX, honorifics, cultural refs naturally.';
      const langPrompts = {
        en: 'natural English, manga-conventions, idioms transcreated to EN equivalents',
        id: 'casual conversational Bahasa Indonesia, idioms transcreated to ID equivalents',
        cn: 'natural Simplified Chinese for manga reader, idioms preserved or transcreated',
      };
      for (const lang of ['en', 'id', 'cn']) {
        try {
          const { content, latency } = await callLLM(sys, `Transcreate this Japanese manga bubble into ${langPrompts[lang]}:\n${sample.jp.bubble}`);
          transcreated[lang] = content || sample[lang].bubble;
          pushToolCall(3, { name: 'llm.transcreate.' + lang, args: `model="${provider.model}"`, out: `"${content.slice(0, 50)}${content.length > 50 ? '…' : ''}"`, latency }, true);
        } catch (err) {
          transcreated[lang] = sample[lang].bubble;
          pushToolCall(3, { name: 'llm.transcreate.' + lang, args: 'live=true', out: '⚠ fallback · ' + err.message.slice(0, 50), latency: 0 }, true);
        }
        await sleep(50);
      }
    } else {
      for (const call of sample.phase3) {
        pushToolCall(3, call, false);
        await sleep(120 + Math.random() * 100);
      }
      transcreated.en = sample.en.bubble;
      transcreated.id = sample.id.bubble;
      transcreated.cn = sample.cn.bubble;
    }
    completePhase(3);
    await sleep(150);

    // Phase 4 — Typesetting (always scripted)
    activatePhase(4);
    for (const call of sample.phase4) {
      pushToolCall(4, call, false);
      await sleep(70 + Math.random() * 60);
    }
    completePhase(4);
    await sleep(200);

    // Show result grid with final transcreated text
    const finalSample = {
      jp: sample.jp,
      en: { bubble: transcreated.en || sample.en.bubble, sfx: sample.en.sfx },
      id: { bubble: transcreated.id || sample.id.bubble, sfx: sample.id.sfx },
      cn: { bubble: transcreated.cn || sample.cn.bubble, sfx: sample.cn.sfx },
    };
    renderResults(finalSample);
    grid.hidden = false;
    grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    runBtn.disabled = false;
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ── Init ──
  document.addEventListener('DOMContentLoaded', () => {
    syncProviderUI();
    bindProvider();
    bindSamples();
    $('run-btn').addEventListener('click', runPipeline);
  });
})();
