const assert = require('node:assert/strict');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const JSZip = require('jszip');
const { Workbook } = require('exceljs');
const { PDFDocument } = require('pdf-lib');
const {
  emptyHighTechDraft,
} = require('../dist/modules/client/high-tech/high-tech.model');
const {
  HighTechMaterialService,
} = require('../dist/modules/client/high-tech/high-tech-material.service');
const {
  emptyWorkspace,
  syncWorkspace,
  normalizeWorkspace,
  activeRows,
  documentTargets,
  setTargetContent,
  recalculateWorkspace,
  isActiveReference,
} = require('../dist/modules/client/high-tech/material-workspace');
const {
  bookBlocks,
} = require('../dist/modules/client/high-tech/material-workspace-export');
const {
  staffFromSheets,
  readMaterialUpload,
  staffImportTemplate,
} = require('../dist/modules/client/high-tech/material-workspace-import');
async function main() {
  const folder = await mkdtemp(join(tmpdir(), 'hqx-workspace-test-'));
  const previous = process.env.HIGH_TECH_ATTACHMENT_DIR;
  process.env.HIGH_TECH_ATTACHMENT_DIR = folder;
  try {
    const draft = emptyHighTechDraft();
    draft.companyName = '材料迁移测试企业';
    draft.workspace = emptyWorkspace(2026);
    draft.projects = [
      {
        ...draft.projects[0],
        id: 'row-a',
        year: 2023,
        rdNumber: 'RD01',
        activityName: '智能监测系统研发',
        techField: '电子信息',
        researchPeriod: '2023-01—2023-12',
        psNumber: 'PS01',
        ipNumber: 'IP01',
        achievementNumber: 'CG01',
        achievementName: '智能监测成果',
      },
      {
        ...draft.projects[0],
        id: 'row-b',
        year: 2023,
        rdNumber: 'RD01',
        activityName: '智能监测系统研发',
        techField: '电子信息',
        researchPeriod: '2023-01—2023-12',
        psNumber: 'PS02',
        ipNumber: 'IP02',
        achievementNumber: 'CG02',
        achievementName: '监测平台成果',
      },
    ];
    draft.ipSummary = [
      {
        id: 'ip-a',
        number: 'IP01',
        name: '智能监测方法',
        patentType: '发明专利',
        legalStatus: '有效',
        patentNumber: 'TEST-001',
        patentee: draft.companyName,
        grantDate: '2024-01-01',
        applicationDate: '2023-01-01',
      },
    ];
    const w = draft.workspace;
    syncWorkspace(w, draft, draft.companyName);
    assert.equal(activeRows(w, 'rd').length, 1);
    assert.equal(activeRows(w, 'ps').length, 2);
    activeRows(w, 'ps')[0].name = '手工维护的高新产品名称';
    syncWorkspace(w, draft, draft.companyName);
    assert.equal(activeRows(w, 'ps')[0].name, '手工维护的高新产品名称');
    const rdId = activeRows(w, 'rd')[0].id;
    const target = documentTargets(w).find(
      (t) => t.key === `rd/${rdId}/application`,
    );
    setTargetContent(w, target, '科研项目书测试正文');
    w.documents[target.key].reviewed = true;
    draft.projects[0].activityName = '更名后研发活动';
    syncWorkspace(w, draft, draft.companyName);
    assert.equal(w.documents[target.key].reviewed, false);
    assert.equal(w.documents[target.key].content, '科研项目书测试正文');
    draft.projects[1].rdNumber = 'RD02';
    syncWorkspace(w, draft, draft.companyName);
    assert.equal(new Set(activeRows(w, 'rd').map((r) => r.id)).size, 2);
    assert.equal(activeRows(w, 'rd').find((r) => r.no === 'RD01').id, rdId);
    for (const row of activeRows(w, 'fees'))
      Object.assign(row, {
        labor: '10',
        direct: '2.5',
        outsource: '1',
        outsource_cn: '1',
      });
    recalculateWorkspace(w);
    assert.equal(w.fields.rd_total_3y, '81.00');
    activeRows(w, 'fees')
      .filter((r) => r.rdId === rdId)
      .forEach((row) => {
        row.labor = '';
        row.direct = '';
        row.outsource = '';
        row.outsource_cn = '';
      });
    recalculateWorkspace(w);
    assert.equal(w.fields.rd_total_3y, '');
    assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify(w))), w);
    const malicious = structuredClone(w);
    malicious.documents = JSON.parse(
      '{"__proto__":{"content":"x","reviewed":false}}',
    );
    assert.throws(() => normalizeWorkspace(malicious));
    const invalid = structuredClone(w);
    invalid.tables.months[0].start_total = '3';
    invalid.tables.months[0].start_tech = '5';
    assert.throws(() => normalizeWorkspace(invalid), /科技人员/);
    assert.equal(isActiveReference(w, draft, 'rd/missing'), false);
    assert.equal(isActiveReference(w, draft, `rd/${rdId}`), true);
    assert.equal(isActiveReference(w, draft, 'year/2022'), false);
    // Imported personnel overwrite derived fields before validation, persistence and export.
    const staffWorkspace = emptyWorkspace(2026);
    staffWorkspace.fields = { hr_total: '0', hr_tech: '99', edu_phd: '99', hr_foreign: '2' };
    staffWorkspace.tables.staff = [
      { id: 'staff-a', name: '人员甲', id_no: '11010119951231001X', education: '本科', title: '高级技工', is_tech: '是' },
      { id: 'staff-b', name: '人员乙', id_no: '11010119851231001X', education: '硕士研究生', title: '中级', is_tech: '否' },
    ];
    const savedStaff = normalizeWorkspace(JSON.parse(JSON.stringify(staffWorkspace)));
    syncWorkspace(savedStaff, draft, draft.companyName);
    for (const [key, value] of Object.entries({ hr_total: '2', hr_tech: '1', edu_phd: '0', edu_bachelor: '1', edu_master: '1', title_tech: '1', title_mid: '1', age_30: '1', age_31_40: '1', hr_foreign: '2', hr_fulltime: '2', hr_tech_fulltime: '1', hr_parttime: '0', hr_tech_parttime: '0', hr_temp: '0', hr_tech_temp: '0', hr_tech_foreign: '0', hr_returnee: '0', hr_tech_returnee: '0', hr_talent_plan: '0', hr_tech_talent_plan: '0' }))
      assert.equal(savedStaff.fields[key], value, key);
    assert.deepEqual(bookBlocks(savedStaff, draft).find((block) => block.humanResources).humanResources, savedStaff.fields);
    savedStaff.fields.hr_fulltime = '0';
    savedStaff.fields.hr_tech_fulltime = '0';
    savedStaff.tables.staff = [];
    const clearedStaff = normalizeWorkspace(JSON.parse(JSON.stringify(savedStaff)));
    syncWorkspace(clearedStaff, draft, draft.companyName);
    assert.equal(clearedStaff.fields.hr_total, '0');
    assert.equal(clearedStaff.fields.edu_bachelor, '0');
    assert.equal(clearedStaff.fields.hr_foreign, '2');
    assert.equal(clearedStaff.fields.hr_fulltime, '0');
    assert.equal(clearedStaff.fields.hr_tech_fulltime, '0');
    assert.deepEqual(bookBlocks(clearedStaff, draft).find((block) => block.humanResources).humanResources, clearedStaff.fields);
    const calls = [];
    let answer = { content: '基于真实资料编制的测试草稿。' };
    const service = new HighTechMaterialService({
      chat: async (request) => {
        calls.push(request);
        return { content: JSON.stringify(answer) };
      },
    });
    const result = await service.generateDocument(draft, {
      key: `rd/${rdId}/application`,
      words: 1500,
    });
    assert.equal(result.key, target.key);
    assert.match(calls[0].messages[0].content, /不得编造/);
    answer = { content: 'x'.repeat(50001) };
    await assert.rejects(
      () => service.generateDocument(draft, { key: target.key }),
      /原有内容|未完成/,
    );
    const template = await staffImportTemplate();
    const templateWorkbook = new Workbook();
    await templateWorkbook.xlsx.load(template);
    const templateSheet = templateWorkbook.getWorksheet('企业人员明细');
    assert.deepEqual(templateSheet.getRow(1).values.slice(1), [
      '序号', '姓名', '身份证号', '是否签订合同', '是否缴纳社保', '学历', '职称', '是否科技人员',
    ]);
    assert.equal(templateSheet.getCell('C2').numFmt, '@');
    assert.deepEqual(templateSheet.getCell('D2').dataValidation.formulae, ['"是,否"']);
    assert.equal(templateSheet.views[0].ySplit, 1);
    const blankTemplate = await readMaterialUpload({ originalname: '模板.xlsx', buffer: template });
    assert.throws(() => staffFromSheets(blankTemplate.sheets), /人员名单为空/);
    templateSheet.getRow(2).values = ['', '模板人员', '11010119900101123X', '是', '否', '本科', '工程师', '是'];
    const filledTemplate = await readMaterialUpload({
      originalname: '填写后模板.xlsx',
      buffer: Buffer.from(await templateWorkbook.xlsx.writeBuffer()),
    });
    assert.deepEqual(staffFromSheets(filledTemplate.sheets), [{
      seq: '1', name: '模板人员', id_no: '11010119900101123X', contract: '是',
      social_security: '否', education: '本科', title: '工程师', is_tech: '是',
    }]);
    const workbook = new Workbook();
    workbook.addWorksheet('人员').addRows([
      ['姓名', '学历', '是否科技人员'],
      ['测试人员', '本科', '是'],
    ]);
    const staffFile = {
      originalname: '人员.xlsx',
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    };
    const parsed = await readMaterialUpload(staffFile);
    assert.equal(staffFromSheets(parsed.sheets)[0].name, '测试人员');
    const staff = await service.importMaterial(
      '101',
      draft,
      'staff',
      '2025',
      staffFile,
    );
    assert.equal(staff.rows.length, 1);
    answer = {
      fields: { hitech_revenue: '12.5', unexpected: '99' },
      products: [
        { no: 'PS01', revenue: '12.5' },
        { no: 'MISSING', revenue: '99' },
      ],
    };
    const imported = await service.importMaterial(
      '101',
      draft,
      'income',
      '2025',
      staffFile,
    );
    assert.deepEqual(imported.fields, { hitech_revenue: '12.5' });
    assert.equal(imported.products.length, 1);
    assert.equal(imported.file.reference, 'audit/income/2025');
    assert.equal(
      (await service.file('101', imported.file.id)).buffer.length,
      staffFile.buffer.length,
    );
    await assert.rejects(
      () => service.file('102', imported.file.id),
      (e) => e.getStatus() === 404,
    );
    await assert.rejects(
      () => service.importMaterial('101', draft, 'income', '2024', staffFile),
      (e) => e.getStatus() === 400,
    );
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const uploaded = await service.upload(
      '101',
      'ip',
      { originalname: '证明.pdf', buffer: Buffer.from(await pdf.save()) },
      'ip/ip-a',
    );
    const stale = await service.upload(
      '101',
      'rd_project_table',
      { originalname: '历史项目.pdf', buffer: Buffer.from(await pdf.save()) },
      'rd/missing',
    );
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    );
    await service.upload('101', 'business_license', {
      originalname: '图片.png',
      buffer: png,
    });
    const word = await service.exportDocument(draft, {
      key: 'book',
      format: 'word',
    });
    const xml = await (
      await JSZip.loadAsync(word.buffer)
    )
      .file('word/document.xml')
      .async('string');
    for (const phrase of [
      '企业简介',
      '知识产权',
      '研发',
      '高新',
      '手工维护的高新产品名称',
    ])
      assert.ok(xml.includes(phrase));
    assert.ok((xml.match(/<w:tbl>/g) || []).length >= 8);
    const zip = await JSZip.loadAsync(
      await service.zip('101', draft, draft.companyName),
    );
    assert.ok(Object.keys(zip.files).some((n) => n.endsWith('证明.pdf')));
    assert.ok(!Object.keys(zip.files).some((n) => n.endsWith('历史项目.pdf')));
    assert.ok(Object.keys(zip.files).some((n) => n.endsWith('人员.xlsx')));
    const systemDraft = JSON.parse(JSON.stringify(draft));
    const systemWorkspace = systemDraft.workspace;
    systemWorkspace.fields.system_rd_files = '研发项目管理制度';
    systemWorkspace.fields.system_rd_points = '立项评审与费用归集佐证';
    const systemTargets = documentTargets(systemWorkspace).filter(
      (item) => item.category === 'system_docs',
    );
    const selectedSystemTargets = [
      systemTargets.find((item) => /^system\/[^/]+$/.test(item.key) && item.key !== 'system/summary'),
      systemTargets.find((item) => item.key.includes('/evidence/')),
      systemTargets.find((item) => item.key.endsWith('/notice')),
    ];
    selectedSystemTargets.forEach((item, index) => {
      assert.ok(item);
      setTargetContent(systemWorkspace, item, `制度打包验证正文${index}`);
    });
    const systemBundle = await JSZip.loadAsync(
      (await service.exportDocument(systemDraft, { key: 'system-bundle', format: 'zip' })).buffer,
    );
    const systemFiles = Object.values(systemBundle.files).filter((file) => !file.dir);
    assert.equal(systemFiles.length, 4, 'Bundle includes summary, policy, evidence and notice only');
    for (const file of systemFiles) {
      assert.ok(file.name.startsWith('system-') && file.name.endsWith('.docx'));
      const document = await JSZip.loadAsync(await file.async('nodebuffer'));
      const content = await document.file('word/document.xml').async('string');
      if (file.name.startsWith('system-summary-')) {
        assert.ok(content.includes('研发项目管理制度'));
        assert.ok(content.includes('立项评审与费用归集佐证'));
      } else {
        assert.ok(content.includes('制度打包验证正文'));
      }
    }
    await assert.rejects(
      () => service.exportDocument(systemDraft, { key: 'book', format: 'zip' }),
      (error) => error.getStatus() === 400,
    );
    const blockFees = bookBlocks(w, draft).filter(
      (b) => b.headers?.[0] === '科目',
    );
    assert.ok(blockFees.every((b) => b.headers.length <= 6));
    if (process.env.HIGH_TECH_VERIFY_PDF === '1') {
      const output = await service.exportDocument(draft, {
        key: 'book',
        format: 'pdf',
      });
      const rendered = await PDFDocument.load(output.buffer);
      assert.ok(rendered.getPageCount() > 2);
      await writeFile('/tmp/hqx-material-book-qa.pdf', output.buffer);
      await writeFile('/tmp/hqx-material-book-qa.docx', word.buffer);
      const complete = await PDFDocument.load(
        await service.completePdf('101', draft),
      );
      assert.ok(complete.getPageCount() > rendered.getPageCount());
      console.log(
        `PDF verified: book ${rendered.getPageCount()} pages, full attachments ${complete.getPageCount()} pages`,
      );
    }
    await service.remove('101', uploaded.id);
    await service.remove('101', stale.id);
    console.log(
      'Workspace verification passed: linkage, review invalidation, totals, validation, import, AI bounds, enterprise isolation, Word tables, system bundle contents, ZIP and archived attachment exclusion.',
    );
  } finally {
    if (previous === undefined) delete process.env.HIGH_TECH_ATTACHMENT_DIR;
    else process.env.HIGH_TECH_ATTACHMENT_DIR = previous;
    await rm(folder, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
