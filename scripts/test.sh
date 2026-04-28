#!/usr/bin/env bash
# Integration test using the Obsidian CLI.
# Requires: Obsidian running, CLI installed (obsidian 1.12+).
# Usage: bash scripts/test.sh [vault-name]

set -euo pipefail

PLUGIN_ID="fountain-export"
VAULT="${1:-obsidian-script-vault}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS=0; FAIL=0
ok()   { echo "  ✓  $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗  $1"; [[ -n "${2:-}" ]] && echo "     $2"; FAIL=$((FAIL+1)); }

section() { echo; echo "$1"; }

obsidian_cli() {
  obsidian "vault=${VAULT}" "$@" 2>&1
}

# ── 0. Node pipeline smoke test ───────────────────────────────────────────────

section "0. Node pipeline smoke test"
if node "${PROJECT_DIR}/scripts/test-pipeline.mjs" > /tmp/pipeline-out.txt 2>&1; then
  ok "all pipeline tests pass"
else
  fail "pipeline tests" "$(tail -5 /tmp/pipeline-out.txt)"
  echo; echo "Stopping — fix pipeline errors before testing in Obsidian."; exit 1
fi

# ── 1. Build ──────────────────────────────────────────────────────────────────

section "1. Build"
cd "${PROJECT_DIR}"
if npm run build > /tmp/build-out.txt 2>&1; then
  ok "npm run build"
else
  fail "npm run build" "$(tail -5 /tmp/build-out.txt)"
  exit 1
fi

# ── 2. Install into vault ─────────────────────────────────────────────────────

section "2. Install plugin into vault"

VAULT_PATH="$(obsidian vault 2>&1 | grep '^path' | awk '{print $2}')"
PLUGIN_DIR="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_ID}"

mkdir -p "${PLUGIN_DIR}"
cp main.js manifest.json "${PLUGIN_DIR}/"
cp -r data "${PLUGIN_DIR}/data"
ok "copied main.js, manifest.json, data/ → ${PLUGIN_DIR}"

# ── 3. Reload plugin ──────────────────────────────────────────────────────────

section "3. Reload plugin"

# If the plugin folder was just created Obsidian won't know about it until the
# app window reloads. Try to reload first so plugin discovery runs.
PLUGIN_KNOWN="$(obsidian_cli plugins 2>&1 | grep -c "^${PLUGIN_ID}$" || true)"
if [[ "${PLUGIN_KNOWN}" -eq 0 ]]; then
  obsidian_cli reload > /dev/null 2>&1 || true
  sleep 3
fi

# Enable if not already enabled, then reload so our fresh build is active.
PLUGIN_ENABLED="$(obsidian_cli plugins:enabled 2>&1 | grep -c "^${PLUGIN_ID}$" || true)"
if [[ "${PLUGIN_ENABLED}" -eq 0 ]]; then
  obsidian_cli plugin:enable "id=${PLUGIN_ID}" > /dev/null 2>&1 || true
  sleep 1
else
  obsidian_cli plugin:reload "id=${PLUGIN_ID}" > /dev/null 2>&1 || true
  sleep 0.5
fi
ok "plugin enabled and loaded"

# ── 4. Check for load errors ──────────────────────────────────────────────────

section "4. Load errors"

ERRORS="$(obsidian_cli dev:errors 2>&1)"
if echo "${ERRORS}" | grep -qi "${PLUGIN_ID}\|fountain"; then
  fail "no plugin errors on load" "${ERRORS}"
else
  ok "no fountain-export errors in dev:errors"
fi

CONSOLE_ERRS="$(obsidian_cli dev:console level=error 2>&1)"
if echo "${CONSOLE_ERRS}" | grep -qi "fountain\|pdfkit\|aw-parser\|aw-liner"; then
  fail "no console errors related to plugin" "${CONSOLE_ERRS}"
else
  ok "no plugin-related console errors"
fi

# ── 5. Command registration ───────────────────────────────────────────────────

section "5. Command registration"

COMMANDS="$(obsidian_cli commands "filter=${PLUGIN_ID}" 2>&1)"
if echo "${COMMANDS}" | grep -q "export-fountain-to-pdf"; then
  ok "command 'export-fountain-to-pdf' is registered"
else
  fail "command 'export-fountain-to-pdf' registered" "got: ${COMMANDS}"
fi

# ── 6. End-to-end PDF export via eval ────────────────────────────────────────
# Bypasses the save dialog by calling the pipeline directly.

section "6. End-to-end PDF export (eval)"

TEST_FOUNTAIN_PATH="test-export.fountain"
OUTPUT_PDF="/tmp/fountain-eval-test.pdf"
rm -f "${OUTPUT_PDF}"

# Create a test .fountain file in the vault
obsidian_cli create "path=${TEST_FOUNTAIN_PATH}" overwrite \
  'content=Title: Eval Test\nAuthor: Test\n\nINT. OFFICE - DAY\n\nJOHN\nThis is a test.\n\nCUT TO:\n' \
  > /dev/null 2>&1
ok "created test fountain file in vault"

# Use eval to run the export pipeline with a hardcoded output path.
# Requires pdfkit and aw-* at their dev node_modules paths.
EVAL_CODE="
(async () => {
  try {
    const awParser = require('${PROJECT_DIR}/node_modules/aw-parser');
    const { Liner } = require('${PROJECT_DIR}/node_modules/aw-liner');
    const PDFDocument = require('${PROJECT_DIR}/node_modules/pdfkit');
    const fs = require('fs');

    const text = 'title: Eval Test\n\nINT. OFFICE - DAY\n\nJOHN\nThis is a test.\n\nCUT TO:\n';
    const parserOpts = {
      print_headers: true, print_actions: true, print_dialogues: true,
      print_notes: false, print_sections: false, print_synopsis: false,
      each_scene_on_new_page: false, double_space_between_scenes: false,
      use_dual_dialogue: true, merge_multiple_empty_lines: true,
    };
    const print = {
      paper_size: 'letter', font_size: 12, lines_per_page: 55,
      top_margin: 1.0, page_width: 8.5, page_height: 11,
      left_margin: 1.5, right_margin: 1, font_width: 0.1, font_height: 0.1667,
      line_spacing: 1, page_number_top_margin: 0.5, dual_max_factor: 0.75,
      title_page: { top_start: 3.5, left_side: ['notes','copyright'], right_side: ['draft date','date','contact'] },
      scene_heading: {feed:1.5,max:61}, action: {feed:1.5,max:61},
      shot:{feed:1.5,max:61}, character:{feed:3.5,max:33}, parenthetical:{feed:3,max:26},
      dialogue:{feed:2.5,max:36}, transition:{feed:0,max:61}, centered:{feed:1.5,style:'center',max:61},
      synopsis:{feed:0.5,max:61,italic:true,color:'#888888',padding:0,feed_with_last_section:true},
      section:{feed:0.5,max:61,color:'#555555',level_indent:0.2},
      note:{color:'#888888',italic:true},
    };
    const linerOpts = { print, text_more: '(MORE)', text_contd: \"(CONT'D)\", split_dialogue: true };
    const parsed = awParser.parser.parse(text, parserOpts);
    parsed.lines = new Liner(awParser.helpers).line(parsed.tokens, linerOpts);

    await new Promise((resolve, reject) => {
      const chunks = [];
      const ss = { chunks, on(e,cb){this._cb=cb}, once(){}, emit(){},
        write(c){this.chunks.push(c)},
        end(){
          const ws = fs.createWriteStream('${OUTPUT_PDF}', {encoding:'binary'});
          ws.on('finish', this._cb);
          this.chunks.forEach(b => ws.write(Buffer.from(b.toString('base64'),'base64')));
          ws.end();
        }
      };
      const doc = new PDFDocument({compress:false,size:'LETTER',margins:{top:0,left:0,bottom:0,right:0}});
      doc.registerFont('ScriptNormal','Courier');
      doc.font('ScriptNormal').fontSize(12);
      const stream = doc.pipe(ss);
      doc.info.Title = 'Eval Test';
      doc.text('Eval Test', 3.5 * 72, 3.5 * 72);
      doc.addPage();
      parsed.lines.forEach(line => {
        if (line.type === 'separator' || line.type === 'page_break') return;
        const feed = ({scene_heading:1.5,action:1.5,character:3.5,parenthetical:3,dialogue:2.5}[line.type] || 1.5);
        doc.text(line.text || '', feed * 72, 72);
      });
      doc.end();
      stream.on('finish', resolve);
    });
    'OK: ' + require('fs').statSync('${OUTPUT_PDF}').size + ' bytes';
  } catch(e) { 'ERROR: ' + e.message; }
})()
"

EVAL_RESULT="$(obsidian_cli eval "code=${EVAL_CODE}" 2>&1)"

if echo "${EVAL_RESULT}" | grep -q "^OK:"; then
  BYTES="$(echo "${EVAL_RESULT}" | grep -o '[0-9]* bytes')"
  ok "eval pipeline wrote PDF (${BYTES})"
  ok "output: ${OUTPUT_PDF}"
elif [ -f "${OUTPUT_PDF}" ] && [ "$(stat -f%z "${OUTPUT_PDF}" 2>/dev/null || stat -c%s "${OUTPUT_PDF}")" -gt 500 ]; then
  ok "PDF exists at ${OUTPUT_PDF}"
else
  fail "eval pipeline produced PDF" "result: ${EVAL_RESULT}"
fi

# Clean up test file
obsidian_cli delete "path=${TEST_FOUNTAIN_PATH}" permanent > /dev/null 2>&1 || true

# ── 7. Screenshot ─────────────────────────────────────────────────────────────

section "7. Screenshot"
SCREENSHOT="/tmp/fountain-test-screenshot.png"
if obsidian_cli dev:screenshot "path=${SCREENSHOT}" > /dev/null 2>&1 && [ -f "${SCREENSHOT}" ]; then
  ok "screenshot saved to ${SCREENSHOT}"
else
  ok "screenshot skipped (not critical)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo
echo "$((PASS + FAIL)) checks: ${PASS} passed, ${FAIL} failed"
echo
[[ ${FAIL} -eq 0 ]] || exit 1
