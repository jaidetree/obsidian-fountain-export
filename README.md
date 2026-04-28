# Fountain Export

An Obsidian plugin that exports Fountain screenplay files to PDF using industry-standard WGA formatting (US Letter, Courier 12pt, standard margins).

## What it does

Fountain Export reads any file open in your vault and renders it as a properly formatted screenplay PDF. It uses the [afterwriting](https://afterwriting.com) parsing pipeline (`aw-parser`, `aw-liner`) and [PDFKit](https://pdfkit.org) for PDF generation. The output format is fixed — US Letter, Courier 12pt, WGA-standard margins and element indentation. No settings UI needed.

## Installation

**Manual install:**

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/jaidetree/obsidian-fountain-export/releases).
2. Create the folder `<your-vault>/.obsidian/plugins/fountain-export/`.
3. Copy both files into that folder.
4. Open Obsidian → Settings → Community plugins → enable **Fountain Export**.

## Usage

With a Fountain file open (or any file selected), trigger export via any of these entry points:

- **Command palette:** Run `Export Fountain to PDF`
- **Right-click context menu:** Right-click any file in the file explorer → `Export to PDF`
- **Ellipsis menu:** Click the `···` (more options) icon in the editor header → `Export to PDF`

A native Save As dialog will appear. Choose a location and filename for the PDF. The plugin generates a title page from the file's base name, strips any existing Fountain frontmatter, and writes the PDF to the chosen path.

## Limitations

- **Desktop only.** This plugin uses Electron's native dialog and Node.js file system APIs. It does not work on Obsidian Mobile.
- **No settings UI.** The format is fixed at US Letter, Courier 12pt, WGA-standard margins. There is no customization.
- **Any file can be exported.** The plugin does not restrict export to `.fountain` files. It is your responsibility to invoke export on appropriate Fountain-formatted files.

## Dependencies / Credits

- [afterwriting](https://afterwriting.com) — Fountain parsing and PDF layout pipeline
- [aw-parser](https://github.com/adambuczek/aw-parser) — Fountain syntax parser
- [aw-liner](https://github.com/adambuczek/aw-liner) — Fountain token line processor
- [PDFKit](https://pdfkit.org) — Node.js PDF generation
