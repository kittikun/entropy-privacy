# entropy-privacy

The public website for **[The Aurora Chronicles](https://store.steampowered.com/app/4262410/The_Aurora_Chronicles/)** — an episodic sci-fi visual novel by **Entropy** (個人事業主, Tokyo, Japan; developed as *kittikun*).

Live at **https://entropy.kittikun.jp**, served from GitHub Pages (custom domain via `CNAME`, Cloudflare-proxied). **Pushing to `main` is the deploy** — there is no separate build step for the English pages.

## What's here

| Path | Page |
|------|------|
| `index.html` | Landing page — hero, dual CTA (Steam + free itch.io demo), pillars, episode trailers, follow links |
| `support/index.html` | Support page with a Turnstile-gated email reveal |
| `privacy-policy/index.html` | **Game** privacy policy (Steam / iOS / Android) |
| `privacy-policy/website/index.html` | **Website** privacy & cookies notice (GA4, `_ga` cookies) |
| `consent.js` | GA4 Consent Mode v2 + region-gated cookie banner, loaded by every page |
| `assets/` | Icons + the 1200×630 share image (`assets/capsule.jpg`) |
| `sitemap.xml`, `robots.txt`, `CNAME`, `favicon.ico` | Discoverability, domain, and icons |
| `press/` | Press kit zip (large; blocked from crawlers in `robots.txt`) |

The two privacy documents are deliberately **separate**: the game policy describes the anonymous-only shipping build, while the website notice covers GA4/cookies. They are never merged — doing so would make the game policy's "no tracking" claims untrue.

Each page is **self-contained**: it inlines its own `<style>` block and design tokens. There is no shared stylesheet, so a token, footer, nav, or favicon-link change must be repeated across every page (and the banner CSS in `consent.js`) or they drift.

## Localization (en / fr / ja)

The site ships in English, French, and Japanese. The **English pages in the repo root are the source of truth**; the `/fr/` and `/ja/` trees are generated and must **never** be hand-edited (they're overwritten on the next build).

The toolchain lives in `i18n/` (see `i18n/README.md` for detail):

```
python i18n\build.py extract     # refresh the string list after editing any English page
# translate i18n\strings\en.json -> fr.json / ja.json (same keys, translated values)
python i18n\build.py generate    # build the /fr and /ja mirrors
python i18n\build.py sitemap     # refresh sitemap.xml
```

`generate` swaps the translatable text, sets `<html lang>`, injects the canonical +
`hreflang` alternates and the in-hero language switcher (English · Français · 日本語),
and rewrites internal nav links per language. The Turnstile widget, the worker URL,
`consent.js`, and `assets/` are never touched, so the email reveal keeps working under
`/fr/` and `/ja/`.

## Contact form worker

The support page's email reveal is backed by a small Cloudflare Worker in a separate
repo, **entropy-privacy-worker**. It verifies a Turnstile token and returns the contact
address; the email is never in the page source. Committing that repo only versions it —
it goes live via `wrangler deploy`, not git push.

## Conventions

- Files are UTF-8 (no BOM), LF line endings.
- Accent color `#64b4ff`, matching the in-game Evo accent. Don't introduce a second accent.
- Footer is identical on every page; `© 2025–2026 Entropy. All rights reserved.`
