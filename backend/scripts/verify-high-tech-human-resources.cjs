const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const JSZip = require('jszip');
const {
  emptyWorkspace,
  normalizeWorkspace,
  validateWorkspace,
} = require('../dist/modules/client/high-tech/material-workspace');
const {
  emptyHighTechDraft,
} = require('../dist/modules/client/high-tech/high-tech.model');
const {
  bookBlocks,
  renderWord,
} = require('../dist/modules/client/high-tech/material-workspace-export');

async function main() {
  const serverCatalog = await readFile(
    join(
      __dirname,
      '../src/modules/client/high-tech/material-workspace-catalog.ts',
    ),
    'utf8',
  );
  const clientCatalog = await readFile(
    join(
      __dirname,
      '../../vue-admin/apps/web-client/src/views/client/high-tech-application/materials/catalog.ts',
    ),
    'utf8',
  );
  assert.equal(
    clientCatalog,
    serverCatalog,
    'Client and server must expose the same fields and table layout',
  );

  const w = emptyWorkspace(2026);
  w.fields = {
    hr_total: '18',
    hr_tech: '10',
    hr_fulltime: '12',
    hr_tech_fulltime: '6',
    hr_parttime: '4',
    hr_tech_parttime: '3',
    hr_temp: '2',
    hr_tech_temp: '1',
    hr_foreign: '3',
    hr_tech_foreign: '2',
    hr_returnee: '2',
    hr_tech_returnee: '1',
    hr_talent_plan: '1',
    hr_tech_talent_plan: '0',
    edu_phd: '0',
    edu_master: '0',
    edu_bachelor: '7',
    edu_diploma: '11',
    title_senior: '1',
    title_mid: '0',
    title_junior: '0',
    title_tech: '0',
    age_30: '2',
    age_31_40: '12',
    age_41_50: '4',
    age_51: '0',
  };
  assert.deepEqual(
    normalizeWorkspace(JSON.parse(JSON.stringify(w))).fields,
    w.fields,
    'Saving and reloading preserves every count, including zero',
  );
  const legacy = emptyWorkspace(2026);
  legacy.fields = { hr_total: '18', hr_tech: '5', hr_fulltime: '18' };
  assert.deepEqual(
    normalizeWorkspace(legacy).fields,
    legacy.fields,
    'Older drafts remain valid without inventing technology personnel breakdowns',
  );
  for (const value of ['-1', '1.5', 'Infinity', 'invalid']) {
    const invalid = structuredClone(w);
    invalid.fields.hr_tech_returnee = value;
    assert.throws(() => normalizeWorkspace(invalid), /非负整数/);
  }
  const invalid = structuredClone(w);
  invalid.fields.hr_tech_returnee = '3';
  assert.throws(() => validateWorkspace(invalid), /对应企业职工人数/);
  invalid.fields.hr_tech_returnee = '';
  invalid.fields.hr_tech_fulltime = '11';
  assert.throws(() => validateWorkspace(invalid), /科技人员总数/);

  const draft = emptyHighTechDraft();
  const blocks = bookBlocks(w, draft);
  const hrIndex = blocks.findIndex(
    (block) => block.title === '三、人力资源情况表',
  );
  assert.ok(hrIndex >= 0);
  assert.deepEqual(blocks[hrIndex + 1].humanResources, w.fields);
  assert.ok(
    blocks[hrIndex + 2].headers.includes('姓名'),
    'Preserve the existing personnel roster',
  );
  const word = await renderWord(
    '人力资源情况表验证',
    blocks.slice(hrIndex, hrIndex + 2),
  );
  const zip = await JSZip.loadAsync(word);
  const xml = await zip.file('word/document.xml').async('string');
  const rows = [...xml.matchAll(/<w:tr>.*?<\/w:tr>/gs)].map(([row]) =>
    [...row.matchAll(/<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/gs)].map(
      (match) => match[1],
    ),
  );
  assert.deepEqual(
    rows,
    [
      ['一、总体情况'],
      ['人员类别', '企业职工', '科技人员'],
      ['总数（人）', '18', '10'],
      ['其中：在职人员', '12', '6'],
      ['兼职人员', '4', '3'],
      ['临时聘用人员', '2', '1'],
      ['外籍人员', '3', '2'],
      ['留学归国人员', '2', '1'],
      ['人才计划人员', '1', '0'],
      ['二、全体人员结构'],
      ['学历', '博士', '硕士', '本科', '大专及以下'],
      ['人数', '0', '0', '7', '11'],
      ['职称', '高级职称', '中级职称', '初级职称', '高级技工'],
      ['人数', '1', '0', '0', '0'],
      ['年龄', '30岁及以下', '31–40岁', '41–50岁', '51岁及以上'],
      ['人数', '2', '12', '4', '0'],
    ],
    'Exported counts must be in their correct row and column',
  );
  assert.equal((xml.match(/<w:gridCol /g) || []).length, 24);
  assert.equal((xml.match(/<w:cantSplit\/>/g) || []).length, 16);
  const legacyWord = await renderWord('旧草稿', [
    { humanResources: legacy.fields },
  ]);
  const legacyZip = await JSZip.loadAsync(legacyWord);
  const legacyXml = await legacyZip.file('word/document.xml').async('string');
  assert.ok(
    legacyXml.includes('【待补充】'),
    'Unfilled fields retain the existing export placeholder',
  );
  console.log(
    'Human resources verification passed: field parity, saved values, legacy drafts, validation, roster preservation and export row/column mapping.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
