const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const JSZip = require("jszip");
const { emptyHighTechDraft } = require("../dist/modules/client/high-tech/high-tech.model");
const { emptyWorkspace } = require("../dist/modules/client/high-tech/material-workspace");
const {
  BOOK_FORM_SECTIONS,
} = require("../dist/modules/client/high-tech/material-workspace-catalog");
const {
  bookBlocks,
  renderWord,
} = require("../dist/modules/client/high-tech/material-workspace-export");

async function main() {
  const ts = require('typescript');
  const loadLayout = (path) => {
    const source = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    const exports = {};
    require('node:vm').runInNewContext(source, { exports });
    return JSON.stringify([exports.MAIN_SITUATION_COLUMN_WIDTHS, exports.mainSituationRows(2028)]);
  };
  assert.equal(
    loadLayout(join(__dirname, '../src/modules/client/high-tech/main-situation-table.ts')),
    loadLayout(join(__dirname, '../../vue-admin/apps/web-client/src/views/client/high-tech-application/materials/main-situation-table.ts')),
    'Editing and export layouts must stay identical',
  );
  const draft = emptyHighTechDraft();
  const w = emptyWorkspace(2028);
  Object.assign(w.fields, {
    company_name: "布局验证企业",
    tech_field: "电子信息、通信技术",
    year1_profit: "-2.50",
    rd_basic: "0",
    accident: "no",
  });
  const before = JSON.stringify(w);
  const blocks = bookBlocks(w, draft);
  const mainIndex = blocks.findIndex((block) => block.title === "一、主要情况表");
  const table = blocks[mainIndex + 2];
  assert.equal(blocks[mainIndex].pageBreakBefore, true);
  assert.equal(blocks[mainIndex + 1].keepNext, true);
  const cells = table.formRows.flat();
  assert.deepEqual(
    cells
      .filter((cell) => cell.field)
      .map((cell) => cell.field)
      .sort(),
    BOOK_FORM_SECTIONS.find((section) => section.key === "main")
      .fields.map((field) => field.key)
      .filter((key) => key !== "company_name")
      .sort(),
  );
  assert.equal(cells.find((cell) => cell.field === "rd_basic").value, "0");
  assert.equal(cells.find((cell) => cell.field === "accident").value, "否");
  assert.equal(cells.find((cell) => cell.field === "year1_profit").value, "-2.50");
  assert.equal(cells.find((cell) => cell.field === "year2_sales").value, "【待补充】");
  assert.ok(cells.some((cell) => cell.label === "2025"));
  assert.ok(cells.some((cell) => cell.label === "2027"));
  const word = await renderWord("申请书排版验证", blocks.slice(mainIndex, mainIndex + 3));
  const xml = await (await JSZip.loadAsync(word)).file("word/document.xml").async("string");
  assert.equal((xml.match(/<w:tr>/g) || []).length, 12);
  assert.equal((xml.match(/<w:vMerge w:val="restart"/g) || []).length, 4);
  assert.equal((xml.match(/<w:vMerge w:val="continue"/g) || []).length, 6);
  assert.ok(xml.includes('<w:gridSpan w:val="6"'));
  assert.ok(xml.includes('<w:tblLayout w:type="fixed"'));
  assert.ok((xml.match(/<w:keepNext\/>/g) || []).length > 30);
  assert.ok(xml.includes("布局验证企业"));
  assert.ok(xml.includes("-2.50"));
  assert.equal(JSON.stringify(w), before, "Export must not modify the saved workspace");
  console.log(
    "Main situation table passed: field coverage, client/export parity, dynamic years, zero and negative values, empty fields, Word grid and merges, unchanged source data.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
