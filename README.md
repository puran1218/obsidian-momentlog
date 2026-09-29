# Obsidian Timelog

A tiny Obsidian plugin for recording the day as it happens.

Timelog keeps the interaction deliberately small: write a line, paste or drop a photo, and record it. Your entries stay in ordinary Markdown files in your vault.

## What it does

- Quick text capture
- Paste, drag, or choose images
- Automatic local timestamp
- A simple newest-first daily timeline
- Previous day / next day / today navigation
- Edit and delete existing moments
- `Cmd/Ctrl + Enter` to record
- Mobile-friendly and desktop-friendly
- No database, cloud service, or AI

## Markdown stays the source of truth

By default Timelog writes to:

```
Timelog/YYYY-MM-DD.md
```

A note looks like this:

```markdown
# 2026-09-29

## Timelog

<!-- timelog-entry:2026-09-29T13:53:24.000Z -->
### 21:53

Trying a small idea for an Obsidian timelog.

![[Timelog/attachments/2026-09-29/215324.png]]
<!-- /timelog-entry -->
```

The HTML comments give the plugin stable entry boundaries while keeping the note readable without the plugin.

If you already use Daily Notes, set Timelog's folder and file-name format to the same values. Timelog will only manage its own `## Timelog` entries.

## Commands

- **Open Timelog**
- **Capture a moment**

There is also a clock icon in the ribbon.

## Settings

Only two:

- **Daily note folder** — defaults to `Timelog`
- **Daily note file format** — defaults to `YYYY-MM-DD`

Images are stored under `<folder>/attachments/YYYY-MM-DD/`.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

For manual testing, place `manifest.json`, `main.js`, and `styles.css` in:

```
<vault>/.obsidian/plugins/timelog/
```

Then reload Obsidian and enable **Timelog** under Community plugins.

## Scope

Timelog is intentionally a capture tool, not a journaling system. The first version focuses on three things:

**Capture → Moment → Day**
