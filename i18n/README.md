# Website localization (i18n)

Fans out the English site into `/fr/` and `/ja/` mirrors.

## The one rule

**The English pages in the repo root are the source of truth.** Keep editing
`index.html`, `support/index.html`, `privacy-policy/index.html`, and
`privacy-policy/website/index.html` exactly as you do today. This toolchain
*reads* them and generates the localized copies. **Never hand-edit anything
under `/fr/` or `/ja/`** — it gets overwritten on the next `generate`.

## Workflow

```
# 1. (after editing any English page) refresh the string list
C:\Python314\python.exe i18n\build.py extract

# 2. hand i18n\strings\en.json to the localization project.
#    It comes back as fr.json / ja.json (same keys, translated values).
#    Drop those into i18n\strings\.

# 3. build the localized pages
C:\Python314\python.exe i18n\build.py generate

# 4. refresh the sitemap, then review + commit
C:\Python314\python.exe i18n\build.py sitemap
```

To preview before translations exist, generate with fake tagged strings:

```
C:\Python314\python.exe i18n\build.py generate fr ja --pseudo --out i18n\_build
```

`--out` writes to a scratch folder instead of the live tree. Delete it when done.

## What `generate` does to each page

- swaps the translatable spans (from `findmap.json`) for the language's strings
- sets `<html lang="fr">` / `"ja"`
- injects `<link rel="canonical">` + `hreflang` alternates (en / fr / ja / x-default)
- on the landing page, points `og:url` and the JSON-LD `url` at the language URL
  (the capsule image URL is left alone)
- injects the inline language switcher (English · Français · 日本語) in the hero
- rewrites internal nav links so `/support` becomes `/fr/support`, etc. — the
  switcher's cross-language links are the only ones that point at another language

The Turnstile widget, worker URL, `/consent.js`, and `/assets/*` are never touched,
so the support-page email reveal keeps working under `/fr/` and `/ja/`.

## Files

| file | what it is |
|------|------------|
| `config.json` | domain, languages, page→URL map, nav links to rewrite, landing url-swaps |
| `findmap.json` | the clean English source strings + their keys (drives everything) |
| `build.py` | the tool: `extract` / `stub` / `generate` / `sitemap` |
| `strings/en.json` | generated baseline — the handoff file for translators |
| `strings/fr.json`, `strings/ja.json` | the translated strings (currently English stubs) |

## Rules for translators

Translate **only the human-readable text**. Inside each string, keep verbatim:

- all HTML tags and attributes: `<strong>`, `<code>`, `<a href="...">`, `&mdash;`,
  `&middot;`, `&amp;`, `&ldquo;`/`&rdquo;`, `&rarr;`, `&lt;id&gt;`, etc.
- all URLs, including the third-party privacy-policy links in the legal pages
  (Google, Apple, Steam, Unity, Supabase, RevenueCat). Translate the link *text*
  only, never the `href`.
- brand and proper names: **The Aurora Chronicles**, **Entropy**, **Steam**, **FRV
  Aurora**, crew names (Kira, Marcus, Amara, Jax), platform/service names, and the
  episode titles unless the localization project has agreed canonical translations
  for *First Light* / *The Garden*.
- code/literal tokens: `_ga`, `youtube-nocookie.com`, `100%`, `個人事業主`.

Note: pillar 4 ("Fully voiced") describes the English voice acting — keep that
meaning; it is not a claim of localized VO.

The landing copy already has agreed FR/JA translations in
`D:\code\aurora\Promotional Content\AppStore_Metadata.md` — reuse those for the
landing strings.

## Going live

The English pages do **not** get a switcher or `hreflang` until at least one
translation is real, so we don't ship dead `/fr` `/ja` links. Once `fr.json` /
`ja.json` are translated and `generate` has produced the mirrors, we add the
switcher + `hreflang` to the English pages and publish.

## Still to decide

The handoff calls for a "the English version governs" line on the **FR/JA legal
pages** (privacy + cookies). It needs final wording (a legal/translation call) and
a placement decision before it's wired in. Planned mechanism: a `legal_notice_pages`
flag in `config.json` plus a translated notice injected after `<main>` on non-English
legal pages only. Not built yet.

## Notes

- Files are UTF-8, LF line endings. `build.py` preserves LF on write.
- `extract --check` validates the findmap against the live pages without writing
  anything; it reports any string that no longer matches (e.g. after an English edit).
