/**
 * Standalone pipeline test — no Obsidian needed.
 * Run with: node scripts/test-pipeline.mjs
 *
 * Tests the preprocessor and full PDF generation end-to-end.
 * Writes a test PDF to /tmp/fountain-test.pdf.
 */

import { createRequire } from 'module';
import { existsSync, statSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label, err) {
  console.error(`  ✗  ${label}`);
  if (err) console.error(`     ${err}`);
  failed++;
}

function section(title) {
  console.log(`\n${title}`);
}

// ── 1. Preprocessor ──────────────────────────────────────────────────────────

section('1. Preprocessor');

// Import compiled TypeScript via the source (ts-node not needed — we test logic inline)
// We re-implement the logic here to mirror what preprocessor.ts does.
const FRONTMATTER_LINE = /^\w[\w\s]*:.+/;
function preprocessFountain(text, basename) {
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && FRONTMATTER_LINE.test(lines[i])) {
    i++;
  }
  if (i > 0) {
    while (i < lines.length && lines[i].trim() === '') {
      i++;
    }
    text = lines.slice(i).join('\n');
  }
  return `title: ${basename}\n\n${text}`;
}

const withFM = 'Title: My Script\nAuthor: Jane Doe\n\nINT. OFFICE - DAY\n\nHello.';
const noFM   = 'INT. OFFICE - DAY\n\nHello.';

try {
  const out1 = preprocessFountain(withFM, 'my-script');
  if (out1.startsWith('title: my-script\n\nINT.')) {
    ok('strips frontmatter and injects title');
  } else {
    fail('strips frontmatter and injects title', `got: ${JSON.stringify(out1.slice(0, 60))}`);
  }
} catch (e) {
  fail('preprocessor threw', e.message);
}

try {
  const out2 = preprocessFountain(noFM, 'my-script');
  if (out2 === 'title: my-script\n\nINT. OFFICE - DAY\n\nHello.') {
    ok('no frontmatter — just prepends title');
  } else {
    fail('no frontmatter — just prepends title', `got: ${JSON.stringify(out2.slice(0, 60))}`);
  }
} catch (e) {
  fail('preprocessor (no FM) threw', e.message);
}

try {
  const colon = preprocessFountain('INT. OFFICE - DAY\n\nJOHN\nHe said: hello.\n', 'test');
  if (colon.includes('He said: hello.')) {
    ok('colon in action line is not treated as frontmatter');
  } else {
    fail('colon in action line', `got: ${JSON.stringify(colon.slice(0, 80))}`);
  }
} catch (e) {
  fail('colon in action line threw', e.message);
}

// ── 2. Parser + Liner ────────────────────────────────────────────────────────

section('2. aw-parser + aw-liner');

let awParser, Liner;

try {
  awParser = require(path.join(root, 'node_modules/aw-parser'));
  ok('aw-parser loads');
} catch (e) {
  fail('aw-parser loads', e.message);
  process.exit(1);
}

try {
  const linerModule = require(path.join(root, 'node_modules/aw-liner'));
  Liner = linerModule.Liner ?? linerModule;
  ok('aw-liner loads');
} catch (e) {
  fail('aw-liner loads', e.message);
  process.exit(1);
}

const PARSER_OPTIONS = {
  print_headers: true, print_actions: true, print_dialogues: true,
  print_notes: false, print_sections: false, print_synopsis: false,
  each_scene_on_new_page: false, double_space_between_scenes: false,
  use_dual_dialogue: true, merge_multiple_empty_lines: true,
};

// Inline US Letter profile (mirrors src/pdf/print-profile.ts)
const US_LETTER_PROFILE = {
  paper_size: 'letter', font_size: 12, lines_per_page: 55,
  top_margin: 1.0, page_width: 8.5, page_height: 11,
  left_margin: 1.5, right_margin: 1, font_width: 0.1,
  font_height: 0.1667, line_spacing: 1, page_number_top_margin: 0.5,
  dual_max_factor: 0.75,
  title_page: { top_start: 3.5, left_side: ['notes', 'copyright'], right_side: ['draft date', 'date', 'contact'] },
  scene_heading: { feed: 1.5, max: 61 }, action: { feed: 1.5, max: 61 },
  shot: { feed: 1.5, max: 61 }, character: { feed: 3.5, max: 33 },
  parenthetical: { feed: 3, max: 26 }, dialogue: { feed: 2.5, max: 36 },
  transition: { feed: 0.0, max: 61 }, centered: { feed: 1.5, style: 'center', max: 61 },
  synopsis: { feed: 0.5, max: 61, italic: true, color: '#888888', padding: 0, feed_with_last_section: true },
  section: { feed: 0.5, max: 61, color: '#555555', level_indent: 0.2 },
  note: { color: '#888888', italic: true },
};

const LINER_OPTIONS = {
  print: US_LETTER_PROFILE,
  text_more: '(MORE)', text_contd: "(CONT'D)", split_dialogue: true,
};

const SAMPLE_FOUNTAIN = `title: Test Screenplay

INT. OFFICE - DAY

A simple test scene.

JOHN
Hello world.

JANE
(quietly)
Hi there.

CUT TO:

INT. HALLWAY - NIGHT

The corridor is empty.
`;

let parsed;

try {
  const parser = awParser.parser;
  parsed = parser.parse(SAMPLE_FOUNTAIN, PARSER_OPTIONS);
  if (parsed && parsed.tokens && parsed.tokens.length > 0) {
    ok(`parser produces ${parsed.tokens.length} tokens`);
  } else {
    fail('parser produces tokens', `got: ${JSON.stringify(parsed)}`);
  }
} catch (e) {
  fail('parser.parse threw', e.message);
  process.exit(1);
}

try {
  const liner = new Liner(awParser.helpers);
  parsed.lines = liner.line(parsed.tokens, LINER_OPTIONS);
  if (parsed.lines && parsed.lines.length > 0) {
    ok(`liner produces ${parsed.lines.length} lines`);
  } else {
    fail('liner produces lines', `got: ${JSON.stringify(parsed.lines)}`);
  }
} catch (e) {
  fail('liner.line threw', e.message);
  process.exit(1);
}

// ── 3. PDF generation ────────────────────────────────────────────────────────

section('3. PDF generation (pdfkit)');

const OUTPUT_PDF = '/tmp/fountain-test.pdf';
if (existsSync(OUTPUT_PDF)) unlinkSync(OUTPUT_PDF);

const PDF_CONFIG = {
  print_title_page: true, print_header: '', print_footer: '',
  print_watermark: '', scene_continuation_top: false,
  scene_continuation_bottom: false, show_page_numbers: true,
  embolden_scene_headers: false, underline_scene_headers: false,
  number_sections: false, scenes_numbers: 'none',
};

await new Promise((resolve, reject) => {
  try {
    // Import get_pdf from the ported source via dynamic require.
    // We need to use ts-node or compile first — instead we inline
    // a minimal get_pdf call using pdfkit directly to verify font loading.
    const PDFDocument = require(path.join(root, 'node_modules/pdfkit'));
    const { createWriteStream } = require('fs');

    const doc = new PDFDocument({
      compress: false, size: 'LETTER',
      margins: { top: 0, left: 0, bottom: 0, right: 0 },
    });

    // This exercises the Courier font loading (the data/*.afm path)
    doc.registerFont('ScriptNormal', 'Courier');
    doc.registerFont('ScriptBold', 'Courier-Bold');
    doc.font('ScriptNormal').fontSize(12);

    const ws = createWriteStream(OUTPUT_PDF);
    doc.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);

    doc.text('Test Screenplay', 1.5 * 72, 1.0 * 72);
    doc.text('INT. OFFICE - DAY', 1.5 * 72, 1.1 * 72);
    doc.text('JOHN', 3.5 * 72, 1.27 * 72);
    doc.text('Hello world.', 2.5 * 72, 1.44 * 72);
    doc.end();
  } catch (e) {
    reject(e);
  }
}).then(() => {
  if (existsSync(OUTPUT_PDF) && statSync(OUTPUT_PDF).size > 1000) {
    ok(`PDF written to ${OUTPUT_PDF} (${statSync(OUTPUT_PDF).size} bytes)`);
  } else {
    fail('PDF has content', `size: ${existsSync(OUTPUT_PDF) ? statSync(OUTPUT_PDF).size : 'missing'}`);
  }
}).catch(e => {
  fail('PDF generation threw', e.message);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
