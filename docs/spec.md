# Obsidian Fountain Export — Plugin Spec

> Status: Complete

## Overview

**Plugin name:** Fountain Export  
**Plugin ID:** `fountain-export`

An Obsidian plugin that exports Fountain syntax files into nicely formatted PDF documents. No settings UI — fixed format with a per-export Save As dialog.

---

## 1. Export Triggers

Export can be initiated from three entry points:

- **Right-click context menu** on any file in the file explorer
- **Command palette** command (e.g., "Export Fountain to PDF")
- **Ellipsis menu** (top-right of the file view) when any file is open

## 2. Output Location

A **"Save As" dialog** is shown each time, letting the user choose where to save the PDF. No default output folder; the user decides per export.

---

## 3. PDF Formatting

Uses a **fixed standard screenplay format** — no user customization:

- Paper: US Letter
- Font: Courier 12pt
- Margins and element indentation follow WGA/industry standard screenplay conventions

---

## 4. Fountain Feature Coverage

All standard Fountain elements are rendered using the afterwriting library, which already handles parsing and PDF generation. The plugin wraps and streamlines that pipeline.

### Frontmatter / Title Page

- The Fountain frontmatter block (key: value pairs at the top of the file) is **stripped** before export
- A `title: <base filename>` field is prepended to the content before parsing, generating a title page from the filename

### Reference Implementation

`private/afterwriting/` contains a standalone HTML-based tool used as reference only. Any packages needed from it should be added to the plugin's own `package.json`.

---

## 5. File Type Scope

Menu options and commands are always visible (static). Any file can be exported — the user is trusted to invoke export on appropriate files.

---

## 6. Error Handling

- **Cancelled dialog**: Silently abort — no notification shown
- **Export failure** (write errors or any error thrown from the pipeline): Show an Obsidian error notification toast

---

## 7. Technical Architecture

### Approach: Direct Node.js PDF Pipeline

Obsidian runs on Electron, which provides full Node.js APIs. No browser iframe or WebView needed.

The afterwriting source (`private/afterwriting-labs/`) already has a working CLI (`awc.js`) proving this pipeline works headlessly. The plugin extracts and ports the relevant pieces.

### Dependencies (npm)

| Package | Role |
|---|---|
| `aw-parser` | Fountain syntax parser |
| `aw-liner` | Token line processor |
| `pdfkit` | PDF generation (Node.js native) |

### Work Required

- **Port `pdfmaker.js`**: afterwriting's PDF rendering/layout logic is wrapped in RequireJS `define()` and a DI framework (Protoplast). Port to plain TypeScript/ESM, keeping only the Node.js `fs.createWriteStream` output path.
- **Strip frontmatter + inject title**: Pre-process Fountain text before parsing — strip the frontmatter block and prepend a `title: <base filename>` Fountain field.
- **Wire Save As dialog**: Use Electron's `dialog.showSaveDialog()` to get the output path, then pipe `pdfkit` output to that path.

### Desktop Only

The plugin uses Electron's `dialog.showSaveDialog()` and Node.js `fs` APIs — it is **desktop only** (`isDesktopOnly: true` in `manifest.json`). Mobile is not supported.

### Community Submission

This plugin is intended for publication to the Obsidian community plugins directory.

- Porting `pdfmaker.js` to readable TypeScript (not minified) is required — Obsidian reviewers audit all bundled code
- `manifest.json` must include: `id`, `name`, `version` (`1.0.0`), `minAppVersion` (`1.12`), `description`, `author`, `authorUrl` (`https://github.com/jaidetree`), `isDesktopOnly: true`
- A `README.md` covering installation, usage, and limitations is required before submission

### Key Reference Files

- `private/afterwriting-labs/js/utils/pdfmaker.js` — PDF layout/rendering
- `private/afterwriting-labs/js/core/model/script-model.js` — parse + line pipeline
- `private/afterwriting-labs/js/core/controller/pdf-controller.js` — orchestration
