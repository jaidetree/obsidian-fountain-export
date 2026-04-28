# Fountain Export — Task Breakdown

> Tracks implementation of `docs/spec.md`. Work top-to-bottom; later sections depend on earlier ones.

---

## Section 1: Project Scaffolding & Configuration

### 1.1 — Update `manifest.json`

Replace the sample plugin manifest with correct values for community submission.

**File:** `manifest.json`

Set the following fields exactly:

```json
{
  "id": "fountain-export",
  "name": "Fountain Export",
  "version": "1.0.0",
  "minAppVersion": "1.12",
  "description": "Export Fountain screenplay files to PDF using industry-standard formatting.",
  "author": "jaide",
  "authorUrl": "https://github.com/jaidetree",
  "isDesktopOnly": true
}
```

Remove `fundingUrl` (not needed). Do not change `versions.json` yet.

**Acceptance criteria:** `manifest.json` passes Obsidian's plugin validator schema — all required fields present, `isDesktopOnly: true`, `minAppVersion: "1.12"`.

---

### 1.2 — Install npm dependencies

**File:** `package.json` (updated by npm)

Run:
```bash
npm install aw-parser aw-liner pdfkit
npm install --save-dev @types/pdfkit
```

After install, verify that `aw-parser`, `aw-liner`, and `pdfkit` appear in `dependencies` in `package.json`.

**Note:** Do not install lodash, d3, or Protoplast. The ported code must avoid those dependencies entirely.

**Note on type declarations:** `aw-parser` and `aw-liner` likely have no `@types/` packages. If TypeScript errors on `import awParser from 'aw-parser'`, add a local shim in `src/types/vendor.d.ts`:
```ts
declare module 'aw-parser';
declare module 'aw-liner';
```

**Acceptance criteria:** `node_modules/aw-parser`, `node_modules/aw-liner`, and `node_modules/pdfkit` all exist.

---

### 1.3 — Remove settings boilerplate

The plugin has no settings UI per spec. Remove the settings infrastructure.

- Delete `src/settings.ts`
- In `src/main.ts`, remove all imports from `./settings`, remove `SampleSettingTab`, remove `SampleModal`, remove `loadSettings`/`saveSettings`, remove the ribbon icon, remove the status bar item, remove the `registerDomEvent` click listener, remove the `registerInterval`. Leave only the class shell and `onload`/`onunload` stubs.

**Acceptance criteria:** `src/main.ts` compiles without errors and contains no references to settings, modals, or sample boilerplate. File is under 30 lines.

---

### 1.4 — Rewrite `src/main.ts` as a clean plugin skeleton

Replace the gutted `src/main.ts` with a minimal, correctly-structured plugin class. It should:

- Import `Plugin` from `obsidian`
- Export a default class `FountainExportPlugin extends Plugin`
- Have an async `onload()` that calls two registration helpers (stubs for now, to be filled in Section 5):
  - `registerCommands(this)` — imported from `./commands`
  - `registerMenus(this)` — imported from `./menus`
- Have an empty `onunload()` method

Create stub files for the imports:
- `src/commands.ts` — exports `registerCommands(plugin: Plugin): void` (empty body)
- `src/menus.ts` — exports `registerMenus(plugin: Plugin): void` (empty body)

**Acceptance criteria:** `npm run build` succeeds. No TypeScript errors.

---

### 1.5 — Create `src/` subdirectory structure

Create the module subdirectories that later tasks populate. These directories must exist before creating files in them.

**Directories to create:**
```
src/pdf/
src/fountain/
src/export/
src/types/
```

Run:
```bash
mkdir -p src/pdf src/fountain src/export src/types
```

**Acceptance criteria:** All four subdirectories exist under `src/`. `npm run build` still succeeds (empty directories don't break TypeScript).

---

## Section 2: PDF Pipeline — Port `pdfmaker.js`

The core of the plugin. `private/afterwriting-labs/js/utils/pdfmaker.js` is a 505-line RequireJS module that must be ported to TypeScript ESM. It depends on `pdfkit`, a few helper utilities, and Node.js `fs`. Read the full source before starting.

### 2.1 — Create `src/pdf/print-profile.ts`

Port the US Letter print profile from `private/afterwriting-labs/js/utils/print-profiles.js` as a hardcoded TypeScript constant. The plugin uses only the US Letter format — no user selection needed.

**Reference:** `private/afterwriting-labs/js/utils/print-profiles.js` lines 9–95.

The US Letter profile inherits from the A4 base profile (lines 9–80) with these overrides (lines 83–95):
- `paper_size: 'letter'`
- `lines_per_page: 55`
- `page_width: 8.5`
- `page_height: 11`
- `scene_heading.max`, `action.max`, `shot.max`, `transition.max`, `section.max`, `synopsis.max` all set to `61` (US_DEFAULT_MAX)

All other fields come from the A4 base (top_margin, left_margin, right_margin, font_width, font_height, font_size, line_spacing, page_number_top_margin, dual_max_factor, title_page, character, parenthetical, dialogue, centered, note, etc.).

**File to create:** `src/pdf/print-profile.ts`

Export:
```ts
export interface PrintProfile { /* ... all fields */ }
export const US_LETTER_PROFILE: PrintProfile = { /* hardcoded merged values */ };
```

Do not import `browser.js` or `PrintProfileUtil` — this is a plain static constant.

**Acceptance criteria:** `US_LETTER_PROFILE` matches the merged A4+US Letter values from the reference file. TypeScript compiles cleanly.

---

### 2.2 — Create `src/pdf/helper.ts`

Port the three helper functions that `pdfmaker.js` uses from `private/afterwriting-labs/js/utils/helper.js`. Only port what pdfmaker.js actually calls — do not port `format_time`, `double_id`, `pairs`, `eights`, etc.

**Reference:** `private/afterwriting-labs/js/utils/helper.js` lines 64–135.

Functions to port:

1. **`versionGenerator(current?: string)`** (was `version_generator`) — returns a counter function that tracks hierarchical section numbers like `"1.2.3"`. Called in pdfmaker as `section_number = helper.version_generator()` then `section_number(level)` to bump and get the string.

2. **`blankText(text: string): string`** (was `blank_text`) — replaces every character with a space. Implementation: `(text || '').replace(/./g, ' ')`.

3. **`getIndentation(text: string): string`** (was `get_indentation`) — returns leading whitespace. Implementation: match `^(\s+)` and return the capture or `''`.

**File to create:** `src/pdf/helper.ts`

**Acceptance criteria:** All three functions are exported, TypeScript-typed, and match reference behavior exactly.

---

### 2.3 — Create `src/pdf/pdfmaker.ts`

Port `private/afterwriting-labs/js/utils/pdfmaker.js` to TypeScript ESM. This is the largest task. Read the entire source file before starting.

**Source file:** `private/afterwriting-labs/js/utils/pdfmaker.js` (505 lines)

**Mechanical transformations:**

1. Remove the `define('utils/pdfmaker', function(require) { ... })` wrapper. The file becomes a plain ES module.
2. Change `var PDFDocument = require('pdfkit')` → `import PDFDocument from 'pdfkit'`
3. Change `var helper = require('utils/helper')` → `import { versionGenerator, blankText, getIndentation } from './helper'`
4. Replace all `helper.version_generator()` → `versionGenerator()`, `helper.blank_text(x)` → `blankText(x)`, `helper.get_indentation(x)` → `getIndentation(x)`
5. In `create_simplestream`, the `require(fsmodule)` trick (lines 31–33) becomes a top-level `import fs from 'fs'` (Node.js fs — already external in esbuild config via `builtinModules`)
6. Remove the browser/blob path in `simplestream.end` — the plugin only uses the `filepath` path (lines 35–42 in the original). Delete the `else` branch that creates a Blob URL.
7. Change `return module;` at the end to `export { get_pdf }` (named export)
8. Convert `var` to `const`/`let` throughout. Keep function declarations as-is or convert to arrow functions — your choice, but stay consistent.
9. Add TypeScript types to the exported `get_pdf` function signature: `opts` should be typed using the `PrintProfile` type from `./print-profile.ts`.

**Do not change any rendering logic** — `generate()`, `initDoc()`, `finishDoc()`, `get_title_page_token()`, all drawing code — port faithfully. The only changes are module format, removed RequireJS wrapper, TypeScript types, and the deleted browser path.

**File to create:** `src/pdf/pdfmaker.ts`

**Acceptance criteria:** File compiles with `tsc --noEmit`. No RequireJS or Protoplast references. `get_pdf` is a named export. The `create_simplestream` function uses only the `filepath` path (no Blob/URL.createObjectURL).

---

## Section 3: Fountain Pre-processing

### 3.1 — Create `src/fountain/preprocessor.ts`

Before parsing, the plugin must transform raw Fountain text:

1. **Strip the frontmatter block**: Fountain frontmatter is a block of `Key: Value` lines at the very start of the file, before any blank line. Detect and remove it. The pattern: if the file starts with lines matching `/^\w[\w\s]*:.+/` (key-value pairs) before the first blank line, strip that entire block (including the trailing blank line).

2. **Inject title from filename**: After stripping frontmatter, prepend `title: <basename>\n\n` to the content, where `<basename>` is the file's base name without the `.fountain` extension (or whatever extension it has). The `basename` is passed in as a parameter.

**File to create:** `src/fountain/preprocessor.ts`

Export:
```ts
export function preprocessFountain(text: string, basename: string): string
```

**Example:**
- Input text starts with `"Title: My Script\nAuthor: Jane\n\nINT. OFFICE - DAY\n..."`
- Basename: `"my-screenplay"`
- Output: `"title: my-screenplay\n\nINT. OFFICE - DAY\n..."`

**Edge cases:**
- File has no frontmatter: just prepend title field
- Frontmatter-detection should not accidentally strip scene headings or action lines that happen to contain a colon

**Acceptance criteria:** Unit-testable pure function. TypeScript compiles cleanly. Handles files with and without frontmatter.

---

## Section 4: Export Pipeline Orchestration

### 4.1 — Create `src/export/pipeline.ts`

Wire `aw-parser`, `aw-liner`, and `pdfmaker` into a single async export function.

**Reference pipeline from** `private/afterwriting-labs/js/core/model/script-model.js`:

```
text
  → aw-parser.parser.parse(text, parserOptions) → parsed (with .tokens)
  → new Liner(aw-parser.helpers).line(parsed.tokens, linerOptions) → parsed.lines
  → pdfmaker.get_pdf({ parsed, print, config, filepath, callback })
```

**File to create:** `src/export/pipeline.ts`

Before calling this function, the caller (Section 5) handles frontmatter stripping and title injection via `preprocessFountain`.

```ts
import awParser from 'aw-parser';
import Liner from 'aw-liner';
import { get_pdf } from '../pdf/pdfmaker';
import { US_LETTER_PROFILE } from '../pdf/print-profile';

export function exportFountain(text: string, outputPath: string): Promise<void>
```

**Parser options** (hardcoded for standard screenplay output — check `script-model.js` lines 22–38 for the full list):
```js
{
  print_headers: true,
  print_actions: true,
  print_dialogues: true,
  print_notes: false,
  print_sections: false,
  print_synopsis: false,
  each_scene_on_new_page: false,
  double_space_between_scenes: false,
  use_dual_dialogue: true,
  merge_multiple_empty_lines: true,
}
```

**Liner options** (from `script-model.js` lines 40–46):
```js
{
  print: US_LETTER_PROFILE,
  text_more: '(MORE)',
  text_contd: "(CONT'D)",
  split_dialogue: true,
}
```

**PDF config** (hardcoded fixed format per spec — see `pdf-controller.js` lines 30–46 for the full list):
```js
{
  print_title_page: true,
  print_header: '',
  print_footer: '',
  print_watermark: '',
  scene_continuation_top: false,
  scene_continuation_bottom: false,
  show_page_numbers: true,
  embolden_scene_headers: false,
  underline_scene_headers: false,
  number_sections: false,
  scenes_numbers: 'none',
}
```

Wrap the `get_pdf` callback in a Promise so the caller can `await` completion.

**Acceptance criteria:** TypeScript compiles cleanly. `exportFountain(text, '/tmp/test.pdf')` would produce a valid PDF if called with parsed Fountain text.

---

### 4.2 — Create `src/export/dialog.ts`

Wrap Electron's `dialog.showSaveDialog()` to get the output path from the user.

**File to create:** `src/export/dialog.ts`

```ts
export async function showSaveDialog(defaultName: string): Promise<string | null>
```

- Import `dialog` from `electron` (already external in esbuild config)
- Call `dialog.showSaveDialog({ defaultPath: defaultName, filters: [{ name: 'PDF', extensions: ['pdf'] }] })`
- If `result.canceled` is `true`, return `null`
- Otherwise return `result.filePath`

**Note — Electron `remote` deprecation:** Obsidian runs in the renderer process; `dialog` is a main-process API and must be accessed via `remote`. The correct pattern depends on Obsidian's bundled Electron version:

- **Older Obsidian (Electron < 14):** `remote` is available directly from `'electron'`:
  ```ts
  const { remote } = require('electron');
  const { dialog } = remote;
  ```
- **Newer Obsidian (Electron ≥ 14):** `remote` was moved to `@electron/remote` and may be `null` or missing from the main `'electron'` module. Use:
  ```ts
  const { dialog } = require('@electron/remote');
  ```

To detect at runtime which is available:
```ts
let dialog: Electron.Dialog;
const electronRemote = (require('electron') as any).remote;
if (electronRemote) {
  dialog = electronRemote.dialog;
} else {
  dialog = require('@electron/remote').dialog;
}
```

If `@electron/remote` is needed and not available, install it: `npm install @electron/remote`. This is the most likely source of runtime issues — test manually in Obsidian desktop before declaring this task complete.

**Acceptance criteria:** Calling `showSaveDialog('screenplay.pdf')` opens a native OS save dialog. Returns `null` if cancelled, a string path otherwise.

---

## Section 5: Plugin Entry Points

### 5.1 — Implement `src/commands.ts`

Register the command palette command for export.

**File to modify:** `src/commands.ts`

```ts
import { Plugin, Notice } from 'obsidian';
import { runExport } from './export/runner';

export function registerCommands(plugin: Plugin): void {
  plugin.addCommand({
    id: 'export-fountain-to-pdf',
    name: 'Export Fountain to PDF',
    callback: async () => {
      const activeFile = plugin.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice('No file is currently open.');
        return;
      }
      await runExport(plugin, activeFile);
    },
  });
}
```

**Acceptance criteria:** Command appears in Obsidian command palette as "Export Fountain to PDF". Triggering it on an open file initiates export.

---

### 5.2 — Implement `src/menus.ts`

Register the right-click context menu (file explorer) and the ellipsis menu (active file view). Both are handled by the same `'file-menu'` workspace event in Obsidian.

**File to modify:** `src/menus.ts`

```ts
import { Plugin, TFile, Menu } from 'obsidian';
import { runExport } from './export/runner';

export function registerMenus(plugin: Plugin): void {
  plugin.registerEvent(
    plugin.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
      menu.addItem((item) => {
        item
          .setTitle('Export to PDF')
          .setIcon('file-output')
          .onClick(async () => {
            await runExport(plugin, file);
          });
      });
    })
  );
}
```

**Note:** The `'file-menu'` event fires for both the file explorer right-click AND the editor's ellipsis (more options) menu. One registration handles all three spec entry points (explorer context menu + ellipsis menu). The command palette entry is handled separately in `commands.ts`.

**Acceptance criteria:** Right-clicking a file in the file explorer shows "Export to PDF". The ellipsis menu on an open file also shows "Export to PDF".

---

### 5.3 — Create `src/export/runner.ts`

Single entry point that coordinates the full export flow: read file → preprocess → show dialog → export → handle errors.

**File to create:** `src/export/runner.ts`

```ts
import { Plugin, TFile, Notice } from 'obsidian';
import { preprocessFountain } from '../fountain/preprocessor';
import { showSaveDialog } from './dialog';
import { exportFountain } from './pipeline';

export async function runExport(plugin: Plugin, file: TFile): Promise<void> {
  // 1. Read file content
  const text = await plugin.app.vault.read(file);

  // 2. Get basename without extension for title injection
  const basename = file.basename; // Obsidian TFile.basename strips the extension

  // 3. Pre-process: strip frontmatter, inject title
  const processed = preprocessFountain(text, basename);

  // 4. Show save dialog
  const defaultName = basename + '.pdf';
  const outputPath = await showSaveDialog(defaultName);
  if (outputPath === null) return; // silently abort if cancelled

  // 5. Export
  try {
    await exportFountain(processed, outputPath);
  } catch (err) {
    console.error('Fountain Export failed:', err);
    new Notice('Fountain Export failed. See console for details.');
  }
}
```

**Acceptance criteria:** Full export flow works end-to-end. Cancelled dialog produces no notification. Export errors show a Notice toast.

---

## Section 6: Error Handling

Error handling is embedded in `src/export/runner.ts` (Section 5.3) per the spec:

- **Cancelled dialog** (`outputPath === null`): `return` silently. No Notice, no log.
- **Export failure** (any thrown error from `exportFountain` or file-read): Catch in try/catch, log to console, show `new Notice('Fountain Export failed. See console for details.')`.

No additional work needed beyond what is specified in 5.3. Verify the two branches explicitly during manual testing.

---

### 6.1 — Manual end-to-end testing in Obsidian desktop

Load the built plugin in a real Obsidian vault and verify the full user flow.

**Setup:** Copy `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/fountain-export/` and enable the plugin in Settings → Community plugins. Open a `.fountain` file.

**Checklist:**

- [ ] **Command palette:** Open command palette, run "Export Fountain to PDF" — save dialog appears with `<basename>.pdf` as the default name
- [ ] **Right-click context menu:** Right-click a `.fountain` file in the file explorer — "Export to PDF" item appears and triggers the save dialog
- [ ] **Ellipsis menu:** Open a `.fountain` file, click the ellipsis (more options) icon in the editor header — "Export to PDF" item appears and triggers the save dialog
- [ ] **Cancel dialog:** Click Cancel in the save dialog — no Notice is shown, no error in console
- [ ] **Successful export:** Complete a save dialog — a valid PDF is written to the chosen path and opens correctly
- [ ] **Export failure:** Trigger a failure (e.g. unwritable path) — a Notice toast appears: "Fountain Export failed. See console for details." and the error is logged to the developer console

**Acceptance criteria:** All six checklist items pass. No uncaught exceptions in the Obsidian developer console.

---

## Section 7: Build & Bundling

### 7.1 — Verify esbuild handles pdfkit correctly

`pdfkit` has complex internal dependencies (fontkit, zlib, etc.) that may require special esbuild handling.

**File to check/modify:** `esbuild.config.mjs`

Verify the following after `npm run build`:
1. `main.js` is produced without errors
2. No "Cannot find module" runtime errors when the plugin loads in Obsidian
3. pdfkit's use of dynamic `require()` for fonts doesn't break bundling

If pdfkit fails to bundle, common fixes:
- Add `platform: 'node'` to the esbuild context options (it's currently missing — esbuild defaults to browser platform which breaks Node.js APIs in dependencies)
- pdfkit uses `__dirname` in some paths — ensure `platform: 'node'` is set so esbuild handles this correctly

**Externals — required:** `platform: 'node'` alone is not enough. Node built-ins and Electron must be listed explicitly in the `external` array, or esbuild will try to bundle them and fail. Add to the esbuild context options:
```js
external: ['electron', 'fs', 'path', 'os', 'crypto', 'stream', 'zlib', 'util', 'events', 'buffer']
```
The Obsidian sample plugin template may already list `electron` as external — verify and extend the list to cover all built-ins that pdfkit and its sub-dependencies use.

**pdfkit font bundling:** pdfkit embeds fonts as binary data (`.afm` and `.ttf` files inside `node_modules/pdfkit/js/data/`). esbuild may fail or produce a broken bundle when it encounters these binary assets. If `npm run build` errors with font-related messages, choose one of:
1. Mark `pdfkit` itself as external (simplest — it ships pre-built): add `'pdfkit'` to the `external` array. Obsidian will load it from `node_modules` at runtime via Node's native `require`.
2. Add esbuild loaders for the asset types: `loader: { '.afm': 'binary', '.ttf': 'binary' }`. This inlines the fonts into the bundle but may increase bundle size significantly.

Option 1 (marking pdfkit external) is the recommended starting point.

**Expected esbuild config change:** Add `platform: 'node'` and extend the `external` array in `esbuild.config.mjs`.

**Acceptance criteria:** `npm run build` succeeds. Loading the plugin in Obsidian desktop produces no module-load errors in the developer console.

---

### 7.2 — Verify `tsconfig.json` for Node.js compatibility

The plugin uses Node.js built-in APIs (`fs`, `path`) directly. TypeScript must be able to resolve their types.

**File to check:** `tsconfig.json`

Verify or add the following in `compilerOptions`:
```json
{
  "types": ["node"],
  "moduleResolution": "node"
}
```

If `@types/node` is not installed, run:
```bash
npm install --save-dev @types/node
```

Also check that `module` is `"commonjs"` or `"ESNext"` — not `"ES5"` — since the esbuild pipeline handles the final output format.

**Acceptance criteria:** `tsc --noEmit` succeeds without errors on `import fs from 'fs'` or `import path from 'path'`.

---

## Section 8: Community Submission Readiness

### 8.1 — Write `README.md`

Replace the existing `README.md` (currently sample plugin boilerplate) with plugin-specific documentation required for community submission.

**File to modify:** `README.md`

Required sections per spec:
1. **What it does** — one-paragraph description: exports Fountain screenplay files to PDF using industry-standard WGA formatting (US Letter, Courier 12pt, standard margins)
2. **Installation** — manual install instructions: copy `main.js`, `manifest.json` to `<vault>/.obsidian/plugins/fountain-export/` and enable in Settings → Community plugins
3. **Usage** — the three ways to trigger export: right-click context menu, command palette ("Export Fountain to PDF"), ellipsis menu on open file
4. **Limitations** — desktop only (uses Electron APIs), no mobile support; no settings UI (format is fixed); any file type can be exported (user's responsibility to use on Fountain files)
5. **Dependencies / Credits** — mention afterwriting, aw-parser, aw-liner, pdfkit

**Acceptance criteria:** README covers installation, usage, and limitations. No sample plugin content remains.

---

### 8.2 — Final manifest validation checklist

Before tagging a release, verify `manifest.json` against the Obsidian community plugin requirements:

- [ ] `id`: `"fountain-export"` (matches the plugin folder name)
- [ ] `name`: `"Fountain Export"`
- [ ] `version`: `"1.0.0"`
- [ ] `minAppVersion`: `"1.12"`
- [ ] `description`: non-empty, plain text, no markdown
- [ ] `author`: `"jaide"`
- [ ] `authorUrl`: `"https://github.com/jaidetree"`
- [ ] `isDesktopOnly`: `true`
- [ ] No `fundingUrl` (optional — omit unless needed)
- [ ] `versions.json` updated: `{ "1.0.0": "1.12" }` (see task 8.3)

**Acceptance criteria:** All checklist items pass. Plugin loads in a fresh Obsidian vault after manual install.

---

### 8.3 — Update `versions.json`

`versions.json` maps plugin versions to minimum Obsidian app versions. It must be updated before release — Obsidian uses this to gate update delivery.

**File to modify:** `versions.json`

Set the contents to:
```json
{
  "1.0.0": "1.12"
}
```

This maps plugin version `1.0.0` → minimum Obsidian version `1.12` (matching `minAppVersion` in `manifest.json`).

**Acceptance criteria:** `versions.json` exists at the repo root and contains the mapping above. On subsequent releases, append new entries — do not overwrite existing ones.

---

## Implementation Order

1. 1.1 → 1.2 → 1.3 → 1.4 → 1.5 (scaffolding; create directories before writing module files)
2. 7.2 (tsconfig check — do before writing any TypeScript that uses Node APIs)
3. 2.1 → 2.2 → 2.3 (PDF pipeline, sequential — each builds on prior)
4. 3.1 (preprocessor, independent)
5. 4.1 → 4.2 (pipeline + dialog, 4.1 needs 2.x and 3.x done)
6. 5.3 → 5.1 → 5.2 (runner first, then wire into commands + menus)
7. 7.1 (build verification — do after all code is written)
8. 6 / 6.1 (error handling is embedded in 5.3 — verify all branches and entry points during manual test)
9. 8.1 → 8.2 → 8.3 (docs/submission last)
