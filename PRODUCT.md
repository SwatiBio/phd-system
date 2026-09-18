# PRODUCT.md

## Register

Product. A private daily instrument: design serves the work (logging, tracking, reading), never performs.

## Users

One user: a PhD student running a multi-year research project. Opens the site several times a day from a laptop and a phone, usually between tasks, for 10-30 second visits. The guide (supervisor) sees the printed weekly logbook, not the app.

## Purpose

"Today" is the daily page: log what you did (the ritual, many times a day), glance at what's due and what's next, keep papers moving. Everything else (logbook print view, tasks, timeline, review) lives on its own pages.

## Personality

Quiet, fast, honest. A notebook that is already open. Nothing begs for attention; the page's main job (logging an entry) is the visually primary thing; everything else is calm, glanceable, secondary. Feels like a plain instrument, not a product.

## Design principles

1. Capture beats polish: fewer pixels between thought and saved entry.
2. Hierarchy by frequency: the log input dominates; glanceable info (due, milestone) reads in seconds; weekly stuff (papers) sits lowest.
3. Boxes are earned: a border appears when content needs containment, not to decorate.
4. Copy is plain: no system-speak, no marketing voice.

## Anti-references

- Generic SaaS dashboard: rows of identical icon cards, gradient banners, hero metrics.
- Startup landing: big type, product screenshots, buzzwords.

## Stack / context

Static HTML pages served by a Cloudflare Worker from a GitHub-backed vault. Tailwind (CDN) + Basecoat CSS + a small project stylesheet (`site/lib/app.css`). Inter, Phosphor icons. Light/dark via `.dark` class.
