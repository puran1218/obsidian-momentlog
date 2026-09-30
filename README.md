# Obsidian Timelog

Capture the small moments that are easy to lose.

Daily notes are useful when you sit down to write. Timelog is for everything in between: what you're doing, what just happened, a quick thought, or a photo you want to remember. Add it in a few seconds and keep going with your day.

Timelog keeps the interaction deliberately small: **write or add a photo → record → move on**. Every moment stays in ordinary Markdown inside your vault.

## How to use

The workflow is intentionally small:

1. Open **Timelog**.
2. Write a short note, or add one or more photos.
3. Select **Record** or press `Cmd/Ctrl + Enter`.
4. Your newest moment appears at the top of today's timeline.

Use the day navigation to look back. On desktop, hover a moment to edit or delete it. On mobile, use the **…** menu beside the timestamp.

### Open Timelog on desktop

Select the Timelog clock icon in the left ribbon, or open the Command palette and run **Open Timelog**.

### Open Timelog on mobile

Open Obsidian's ribbon/menu and select **Timelog**. You can also open the Command palette and run **Open Timelog**.

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

Timelog only needs two storage settings:

- **Daily note folder** — defaults to `Timelog`
- **Daily note file format** — defaults to `YYYY-MM-DD`

By default Timelog writes to:

```
Timelog/YYYY-MM-DD.md
```

Images are stored under:

```
<folder>/attachments/YYYY-MM-DD/
```

The Timelog settings page also includes a short quick-start guide, Daily Notes setup instructions, and an **Open Timelog** button.

## Use Timelog with Daily Notes

Timelog works perfectly well on its own. If you also use Obsidian's **Daily Notes** core plugin, both can write to the same daily Markdown file.

To use Timelog's defaults for both:

1. Enable the **Daily Notes** core plugin.
2. Open **Settings → Daily Notes**.
3. Set **New file location** to `Timelog`.
4. Set **Date format** to `YYYY-MM-DD`.
5. Keep Timelog's **Daily note folder** and **Daily note file format** set to those same values.

Now opening a Daily Note and recording a Timelog moment both target the same file. Timelog only manages its own `## Timelog` entries.

If you already have an established Daily Notes folder or date format, do the reverse: leave Daily Notes unchanged and set Timelog's two storage settings to match it.

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

## Release

The release workflow publishes the exact files Obsidian and BRAT expect:

- `main.js`
- `manifest.json`
- `styles.css`
- `timelog-<version>.zip` for convenient manual installation

The release version comes from `manifest.json`.

A merge to `main` automatically checks that version. If a GitHub Release for it does not exist yet, the workflow builds Timelog and publishes the release. If the release already exists, the workflow exits successfully without publishing a duplicate.

You can also trigger the same flow by pushing a semantic-version tag such as `0.1.0`, or manually through **Actions → Release → Run workflow**.

For a tag-based release:

```bash
git tag 0.1.0
git push origin 0.1.0
```

After the release exists, BRAT can install Timelog directly from:

```
https://github.com/puran1218/obsidian-timelog
```

## Scope

Timelog is intentionally a capture tool, not a journaling system.

**Capture → Moment → Day**
