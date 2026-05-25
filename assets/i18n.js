// Manga Localizer Agent — language toggle
// Same pattern as Nelayan but extended to 4 langs (JP shown as quoted source samples).
// Toggle UI lang only — JP source text in comparison panels stays JP regardless.
(function () {
  const KEY = 'mla_lang';
  const langs = ['en', 'id', 'cn'];
  function apply(lang) {
    if (!langs.includes(lang)) lang = 'en';
    langs.forEach((l) => {
      document.querySelectorAll('[data-lang-' + l + ']').forEach((el) => {
        if (l === lang) el.classList.add('active');
        else el.classList.remove('active');
      });
    });
    document.querySelectorAll('.lang-switch button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    document.documentElement.lang = lang === 'cn' ? 'zh' : lang;
  }
  function init() {
    let saved;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    apply(saved || 'en');
    document.querySelectorAll('.lang-switch button').forEach((btn) => {
      btn.addEventListener('click', () => apply(btn.dataset.lang));
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
