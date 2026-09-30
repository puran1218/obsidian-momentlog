# Obsidian Timelog

Capture the small moments that are easy to lose.

Daily notes are useful when you sit down to write. Timelog is for everything in between: what you're doing, what just happened, a quick thought, or a photo you want to remember. Add it in a few seconds and keep going with your day.

Timelog keeps the interaction deliberately small: **write or add a photo → record → move on**. Every moment stays in ordinary Markdown inside your vault.

## How to use

1. Open **Timelog** from the ribbon or run **Open Timelog** from the command palette.
2. Write a short note, or paste, drag, or choose one or more images.
3. Select **Record** or press `Cmd/Ctrl + Enter`.
4. Your newest moments appear at the top of today's timeline.
5. Use the day navigation to look back, or edit and delete moments when needed.

That's the whole workflow.

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

## Settings

Timelog only needs two settings:

- **Daily note folder** — defaults to `Timelog`
- **Daily note file format** — defaults to `YYYY-MM-DD`

By default Timelog writes to:

```
Timelog/YYYY-MM-DD.md
```

If you already use Daily Notes, set Timelog's folder and file-name format to the same values. Timelog only manages its own `## Timelog` entries.

Images are stored under:

```
<folder>/attachments/YYYY-MM-DD/
```

## Markdown stays the source of truth

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

The HTML comments give Timelog stable entry boundaries while keeping the note readable and usable without the plugin.

## Install manually

Run:

```bash
npm install
npm run build
```

The ready-to-install plugin is produced at:

```
dist/timelog/
├── main.js
├── manifest.json
└── styles.css
```

Copy the entire `timelog` folder into:

```
<vault>/.obsidian/plugins/
```

The final layout should be:

```
<vault>/.obsidian/plugins/timelog/
├── main.js
├── manifest.json
└── styles.css
```

Reload Obsidian, then enable **Timelog** under **Settings → Community plugins**.

## Install on iPhone or iPad

Timelog does not use desktop-only APIs, so the same plugin files can run in Obsidian Mobile.

For a manual install, get the `timelog` folder above into the iOS vault at:

```
<your vault>/.obsidian/plugins/timelog/
```

If the vault is stored in iCloud Drive, the easiest route is usually to copy that folder into the vault from a Mac or Windows PC and let iCloud sync it to the device. Then open Obsidian on iOS and enable **Timelog** under **Settings → Community plugins**.

For beta testing directly from GitHub, BRAT is another convenient option once a matching GitHub release is available.

## Commands

- **Open Timelog**
- **Capture a moment**

There is also a clock icon in the ribbon.

## Development

```bash
npm install
npm run dev
```

Production build and installable package:

```bash
npm run build
```

## Scope

Timelog is intentionally a capture tool, not a journaling system.

**Capture → Moment → Day**
