#!/usr/bin/env python3
"""Aurora Chronicles website localization build tool.

English root pages (index.html, support/index.html, ...) are the hand-authored
source of truth. This tool reads them, swaps the translatable spans defined in
findmap.json for the strings in strings/<lang>.json, injects the language
switcher + hreflang/canonical, rewrites internal nav links, and writes the
/fr/... and /ja/... mirrors. English is never edited by this tool.

Subcommands:
  extract   live EN pages + findmap          -> strings/en.json   (+ --check)
  stub      strings/en.json                   -> strings/fr.json, strings/ja.json
  generate  EN pages + findmap + strings/<l>  -> <lang>/... pages
  sitemap   config                            -> sitemap.xml

Matching is whitespace-insensitive: a findmap string written on one line with
single spaces matches the hard-wrapped source. Replacement is span-local and
never alters surrounding markup. Optional before/after act as fixed-width
look-behind / look-ahead to disambiguate short repeated words (e.g. nav labels).
"""

import argparse
import datetime
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # repo root (i18n/ lives directly under it)


def load_json(path):
    with open(os.path.join(HERE, path), encoding="utf-8") as f:
        return json.load(f)


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # newline="" keeps LF exactly as written (no CRLF translation on Windows).
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


# ---- matching --------------------------------------------------------------

def build_regex(find, before="", after=""):
    """Whitespace-insensitive literal matcher with optional fixed-width context."""
    tokens = find.split()
    core = r"\s+".join(re.escape(t) for t in tokens)
    pat = ""
    if before:
        pat += "(?<=" + re.escape(before) + ")"
    pat += core
    if after:
        pat += "(?=" + re.escape(after) + ")"
    return re.compile(pat, re.S)


def entries_for(findmap, page_key):
    """Page entries + common entries, longest find first (handles nesting)."""
    items = list(findmap.get(page_key, [])) + list(findmap.get("common", []))
    return sorted(items, key=lambda e: len(e["find"]), reverse=True)


def text_swap(html, entries, strings, report=None):
    for e in entries:
        val = strings.get(e["key"])
        if val is None:
            if report is not None:
                report.append(("MISSING_KEY", e["key"]))
            continue
        rx = build_regex(e["find"], e.get("before", ""), e.get("after", ""))
        html, n = rx.subn(lambda m: val, html)  # lambda: val is literal, no group refs
        if n == 0 and report is not None:
            report.append(("NO_MATCH", e["key"], e["find"][:48]))
    return html


# ---- url helpers -----------------------------------------------------------

def page_url(cfg, lang, path):
    d = cfg["domain"]
    if lang == cfg["default"]:
        return f"{d}/{path}"
    return f"{d}/{lang}/{path}"


def out_file(out_root, cfg, lang, path):
    if lang == cfg["default"]:
        return os.path.join(out_root, path, "index.html")
    return os.path.join(out_root, lang, path, "index.html")


# ---- injection -------------------------------------------------------------

VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
HERO = '<header class="hero">'

SWITCHER_CSS = """
  /* i18n language switcher */
  .hero .topbar{ position:absolute; top:1rem; right:1.1rem; }
  .lang-inline{ display:inline-flex; align-items:center; gap:.55rem; font-size:.84rem; letter-spacing:.01em; }
  .lang-inline a{ color:var(--muted); text-decoration:none; padding:.35rem .1rem; transition:color .15s; }
  .lang-inline a:hover{ color:var(--text); }
  .lang-inline .active{ color:var(--accent); font-weight:500; }
  .lang-inline .sep{ color:var(--muted); opacity:.5; }
  @media (max-width:560px){ .hero .topbar{ position:static; margin-bottom:1rem; } }"""


def strip_injections(html):
    html = re.sub(r"\s*<link rel=\"canonical\"[^>]*>", "", html)
    html = re.sub(r"\s*<link rel=\"alternate\" hreflang=\"[^\"]*\"[^>]*>", "", html)
    html = re.sub(r"\n?<!--i18n:[a-z-]+-->.*?<!--/i18n:[a-z-]+-->", "", html, flags=re.S)
    html = re.sub(r"\n?  /\* i18n language switcher \*/.*?max-width:560px\)\{[^}]*\}[^}]*\}", "", html, flags=re.S)
    return html


def head_block(cfg, path):
    urls = {l: page_url(cfg, l, path) for l in cfg["languages"]}
    en = page_url(cfg, cfg["default"], path)
    lines = [f'<link rel="canonical" href="{{self}}">']
    for l in cfg["languages"]:
        lines.append(f'<link rel="alternate" hreflang="{l}" href="{urls[l]}">')
    lines.append(f'<link rel="alternate" hreflang="x-default" href="{en}">')
    body = "\n".join(lines)
    return "<!--i18n:head-->\n" + body + "\n<!--/i18n:head-->"


def switcher_block(cfg, lang, path):
    parts = []
    for l in cfg["languages"]:
        label = cfg["switcher_labels"][l]
        if l == lang:
            parts.append(f'<span class="active" aria-current="true">{label}</span>')
        else:
            parts.append(f'<a href="{page_url(cfg, l, path).replace(cfg["domain"], "")}" hreflang="{l}">{label}</a>')
    inner = '<span class="sep">\u00b7</span>'.join(parts)
    return ('<!--i18n:switcher-->\n'
            '    <div class="topbar"><nav class="lang-inline" aria-label="Language">'
            + inner +
            '</nav></div>\n    <!--/i18n:switcher-->')


def decorate(html, cfg, lang, page):
    path = page["path"]
    self_url = page_url(cfg, lang, path)
    # landing url swaps (og:url, JSON-LD url) -> language URL
    for s in page.get("url_swaps", []):
        html = html.replace(s, s.replace(page_url(cfg, cfg["default"], path), self_url))
    html = strip_injections(html)
    if lang != cfg["default"]:
        for link in sorted(cfg["nav_links"], key=len, reverse=True):
            html = html.replace(f'href="{link}"', f'href="/{lang}{link}"')
    html = html.replace('<html lang="en">', f'<html lang="{lang}">', 1)
    head = head_block(cfg, path).replace("{self}", self_url)
    html = html.replace(VIEWPORT, VIEWPORT + "\n" + head, 1)
    html = html.replace("</style>", SWITCHER_CSS + "\n</style>", 1)
    html = html.replace(HERO, HERO + "\n    " + switcher_block(cfg, lang, path), 1)
    return html


# ---- subcommands -----------------------------------------------------------

def cmd_extract(args):
    cfg = load_json("config.json")
    fm = load_json("findmap.json")
    en = {}
    problems = []
    for page in cfg["pages"]:
        html = read(os.path.join(ROOT, page["src"]))
        for e in entries_for(fm, page["key"]):
            rx = build_regex(e["find"], e.get("before", ""), e.get("after", ""))
            n = len(rx.findall(html))
            if n == 0:
                problems.append(f"  NO_MATCH  [{page['key']}] {e['key']}: {e['find'][:60]!r}")
            prev = en.get(e["key"])
            if prev is not None and prev != e["find"]:
                problems.append(f"  CONFLICT  {e['key']}: {prev!r} != {e['find']!r}")
            en[e["key"]] = e["find"]
    if problems:
        print("findmap problems:")
        print("\n".join(problems))
        if args.check:
            sys.exit(1)
    en = dict(sorted(en.items()))
    if not args.check:
        write(os.path.join(HERE, "strings", "en.json"),
              json.dumps(en, ensure_ascii=False, indent=2) + "\n")
        print(f"wrote strings/en.json ({len(en)} keys)")
    else:
        print(f"check OK: {len(en)} keys, {len(problems)} problems")


def cmd_stub(args):
    en = load_json("strings/en.json")
    for lang in args.langs:
        path = os.path.join(HERE, "strings", f"{lang}.json")
        if os.path.exists(path) and not args.force:
            print(f"skip {lang}.json (exists; use --force)")
            continue
        write(path, json.dumps(en, ensure_ascii=False, indent=2) + "\n")
        print(f"wrote strings/{lang}.json ({len(en)} keys, English placeholders)")


def cmd_generate(args):
    cfg = load_json("config.json")
    fm = load_json("findmap.json")
    out_root = os.path.abspath(args.out) if args.out else ROOT
    langs = args.langs or [l for l in cfg["languages"] if l != cfg["default"]]
    for lang in langs:
        if args.pseudo:
            base = load_json("strings/en.json")
            strings = {k: (v if lang == cfg["default"] else f"[{lang}] {v}") for k, v in base.items()}
        else:
            strings = load_json(f"strings/{lang}.json")
        untranslated = 0
        for page in cfg["pages"]:
            html = read(os.path.join(ROOT, page["src"]))
            report = []
            html = text_swap(html, entries_for(fm, page["key"]), strings, report)
            html = decorate(html, cfg, lang, page)
            dest = out_file(out_root, cfg, lang, page["path"])
            write(dest, html)
            for r in report:
                print(f"  [{lang}/{page['key']}] {' '.join(map(str, r))}")
        if not args.pseudo and lang != cfg["default"]:
            base = load_json("strings/en.json")
            same = [k for k, v in strings.items() if base.get(k) == v]
            if same:
                print(f"  WARNING {lang}: {len(same)} string(s) still equal English (untranslated)")
        print(f"generated {lang} -> {out_root}")


def cmd_sitemap(args):
    cfg = load_json("config.json")
    lastmod = args.date
    ns = ('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
          'xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    out = ['<?xml version="1.0" encoding="UTF-8"?>', f"<urlset {ns}>"]
    for page in cfg["pages"]:
        for lang in cfg["languages"]:
            out.append("  <url>")
            out.append(f"    <loc>{page_url(cfg, lang, page['path'])}</loc>")
            for alt in cfg["languages"]:
                out.append(f'    <xhtml:link rel="alternate" hreflang="{alt}" '
                           f'href="{page_url(cfg, alt, page["path"])}"/>')
            out.append(f'    <xhtml:link rel="alternate" hreflang="x-default" '
                       f'href="{page_url(cfg, cfg["default"], page["path"])}"/>')
            if lastmod:
                out.append(f"    <lastmod>{lastmod}</lastmod>")
            out.append("  </url>")
    out.append("</urlset>")
    dest = os.path.join(os.path.abspath(args.out) if args.out else ROOT, "sitemap.xml")
    write(dest, "\n".join(out) + "\n")
    print(f"wrote {dest} ({len(cfg['pages']) * len(cfg['languages'])} urls)")


def main():
    p = argparse.ArgumentParser(description="Aurora website i18n build tool")
    sub = p.add_subparsers(dest="cmd", required=True)

    pe = sub.add_parser("extract", help="build strings/en.json from live EN pages")
    pe.add_argument("--check", action="store_true", help="validate findmap only, no write")
    pe.set_defaults(func=cmd_extract)

    ps = sub.add_parser("stub", help="create fr/ja string files from en.json")
    ps.add_argument("langs", nargs="*", default=["fr", "ja"])
    ps.add_argument("--force", action="store_true")
    ps.set_defaults(func=cmd_stub)

    pg = sub.add_parser("generate", help="write localized pages")
    pg.add_argument("langs", nargs="*", help="languages (default: all non-English)")
    pg.add_argument("--out", help="output root (default: repo root)")
    pg.add_argument("--pseudo", action="store_true", help="fake [lang]-tagged strings for testing")
    pg.set_defaults(func=cmd_generate)

    pm = sub.add_parser("sitemap", help="regenerate sitemap.xml for all langs")
    pm.add_argument("--out", help="output root (default: repo root)")
    pm.add_argument("--date", default=datetime.date.today().isoformat(),
                    help="lastmod date (YYYY-MM-DD); defaults to today")
    pm.set_defaults(func=cmd_sitemap)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
