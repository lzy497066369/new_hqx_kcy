const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const JSZip = require('jszip');
const { PDFDocument } = require('pdf-lib');
const { HighTechMaterialService } = require('../dist/modules/client/high-tech/high-tech-material.service');
const { HighTechService } = require('../dist/modules/client/high-tech/high-tech.service');
const { emptyHighTechDraft, normalizeHighTechDraft } = require('../dist/modules/client/high-tech/high-tech.model');
const { BOOK_SECTIONS, ATTACHMENT_SECTIONS } = require('../dist/modules/client/high-tech/high-tech-material-catalog');

const rejects = (run, status) => assert.rejects(run, (error) => error.getStatus?.() === status);

async function main() {
  const folder = await mkdtemp(join(tmpdir(), 'high-tech-materials-'));
  const previousFolder = process.env.HIGH_TECH_ATTACHMENT_DIR;
  process.env.HIGH_TECH_ATTACHMENT_DIR = folder;
  try {
    let request;
    const ai = { chat: async (input) => {
      request = input;
      return { content: JSON.stringify(input.messages[0].content.includes('附件撰写助手')
        ? { content: '企业人员情况说明草稿' } : { sections: { profile: '企业简介草稿' } }) };
    } };
    const materials = new HighTechMaterialService(ai);
    const draft = emptyHighTechDraft();
    draft.currentStep = 2;
    for (const key of Object.keys(draft.scores)) draft.scores[key] = 0;
    draft.projects = [{ ...draft.projects[0], activityName: '研发活动', psNumber: 'PS01', achievementName: '研发成果', techField: '技术领域' }];
    const entities = new Map([
      ['101', { draftJson: JSON.stringify(draft), revision: 1 }],
      ['102', { draftJson: JSON.stringify(draft), revision: 1 }],
    ]);
    const repository = { findOne: async ({ where }) => entities.get(where.enterpriseId) ?? null };
    const client = { getClientCompanies: async (userId) => userId === 1 ? [
      { id: '101', name: '企业甲', enterpriseProjects: ['国家高新技术企业'] },
      { id: '102', name: '企业乙', enterpriseProjects: ['国家高新技术企业'] },
    ] : [] };
    const service = new HighTechService(repository, client, null, null, null, null, materials);

    const beforeTemplate = JSON.stringify([...entities]);
    assert.ok(Buffer.isBuffer(await service.materialStaffTemplate(1, '101')));
    await rejects(() => service.materialStaffTemplate(2, '101'), 403);
    await rejects(() => service.materialStaffTemplate(1, 'invalid'), 400);
    assert.equal(JSON.stringify([...entities]), beforeTemplate, '导出模板不修改已保存的申请书');

    assert.equal(BOOK_SECTIONS.length, 12);
    assert.equal(ATTACHMENT_SECTIONS.length, 14);
    assert.equal((await service.generateBook(1, '101', { keys: ['profile'] })).sections.profile, '企业简介草稿');
    assert.equal(request.responseFormat, 'json_object');
    assert.match(request.messages[1].content, /basicInfo/u);
    assert.equal((await service.generateAttachment(1, '101', { key: 'staff_statement' })).content, '企业人员情况说明草稿');
    assert.equal(request.responseFormat, 'json_object');
    assert.match(request.messages[0].content, /不编造/u);
    await rejects(() => service.generateAttachment(1, '101', { key: 'annual_audit' }), 400);
    await rejects(() => service.generateAttachment(2, '101', { key: 'staff_statement' }), 403);
    assert.equal((await service.get(1, '101')).book[0].content, '', '生成只返回草稿，不覆盖已保存内容');
    for (const input of [{ keys: [] }, { keys: ['profile', 'profile'] }, { keys: ['unknown'] }]) {
      await rejects(() => service.generateBook(1, '101', input), 400);
    }
    await rejects(() => service.generateBook(2, '101', { keys: ['profile'] }), 403);
    await rejects(() => service.attachmentList(1, '999'), 403);
    const legacy = { ...draft };
    delete legacy.book;
    delete legacy.attachments;
    entities.set('101', { draftJson: JSON.stringify(legacy), revision: 1 });
    assert.equal((await service.get(1, '101')).book.length, 12);
    assert.equal((await service.get(1, '101')).attachments.length, 14);
    assert.equal((await service.get(1, '101')).attachments[4].content, '');
    assert.equal(normalizeHighTechDraft({ ...legacy, revision: 1 }).book.length, 12);
    const withContent = { ...legacy, attachments: [{ key: 'staff_statement', note: '', content: '企业人员情况说明草稿', reviewed: false }] };
    assert.equal(normalizeHighTechDraft({ ...withContent, revision: 1 }).attachments[4].content, '企业人员情况说明草稿');
    await rejects(async () => normalizeHighTechDraft({ ...legacy, revision: 1, attachments: [{ key: 'staff_statement', note: '', content: '【待补充：人员名单】', reviewed: true }] }), 400);
    entities.set('101', { draftJson: JSON.stringify({ ...draft, attachments: withContent.attachments }), revision: 1 });

    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    const buffer = Buffer.from(await pdf.save());
    await rejects(() => service.attachmentUpload(1, '101', 'wrong', { originalname: 'a.pdf', buffer }), 400);
    await rejects(() => service.attachmentUpload(1, '101', 'ip', { originalname: 'a.pdf', buffer: Buffer.from('not a PDF') }), 400);
    const first = await service.attachmentUpload(1, '101', 'ip', { originalname: '甲.pdf', buffer });
    const second = await service.attachmentUpload(1, '101', 'ip', { originalname: '乙.pdf', buffer });
    await service.attachmentUpload(1, '102', 'ip', { originalname: '其他企业.pdf', buffer });
    assert.equal((await service.attachmentList(1, '101')).length, 2);
    const otherAttachment = (await service.attachmentList(1, '102'))[0];
    await rejects(() => service.attachmentFile(1, '101', otherAttachment.id), 404);
    assert.deepEqual((await service.attachmentReorder(1, '101', 'ip', { ids: [second.id, first.id] })).map(({ id }) => id), [second.id, first.id]);
    await rejects(() => service.attachmentReorder(1, '101', 'ip', { ids: [first.id, first.id] }), 400);
    assert.equal((await PDFDocument.load(await service.attachmentPdf(1, '101'))).getPageCount(), 2);
    const archive = await JSZip.loadAsync(await service.materialZip(1, '101'));
    assert.ok(archive.file('高新技术企业认定申请书.docx'));
    const ipFolder = '04-IP（知识产权）相关材料/';
    const summaryName = `${ipFolder}01-知识产权汇总表.pdf`;
    assert.ok(archive.file(summaryName), 'Empty IP summary still exports a PDF table');
    assert.ok((await PDFDocument.load(await archive.file(summaryName).async('nodebuffer'))).getPageCount() > 0);

    assert.ok(archive.file('04-IP（知识产权）相关材料/02-乙.pdf'));
    assert.ok(archive.file('04-IP（知识产权）相关材料/03-甲.pdf'));
    assert.ok(archive.file('05-企业人员相关资料/企业人员相关资料-草稿.docx'));
    const attachmentWord = await JSZip.loadAsync(await archive.file('05-企业人员相关资料/企业人员相关资料-草稿.docx').async('nodebuffer'));
    const attachmentXml = await attachmentWord.file('word/document.xml').async('string');
    assert.match(attachmentXml, /企业人员情况说明草稿/u);
    assert.equal(Object.keys(archive.files).filter((name) => name.endsWith('/说明.txt')).length, 14);
    const ipDraft = emptyHighTechDraft();
    ipDraft.ipSummary = [
      { id: 'ip-a', number: 'IP01', name: '智能监测方法', patentType: '发明专利', legalStatus: '授权', patentNumber: 'CN123456789B', patentee: '测试企业甲', grantDate: '2024-01-01', applicationDate: '2023-01-01' },
      { id: 'ip-missing', number: 'IP02', name: '暂无附件的知识产权', patentType: '实用新型', legalStatus: '授权', patentNumber: 'CN234567890U', patentee: '测试企业甲', grantDate: '2024-02-01', applicationDate: '2023-02-01' },
      { id: 'ip-b', number: 'IP03', name: '数据采集系统', patentType: '实用新型', legalStatus: '授权', patentNumber: 'CN345678901U', patentee: '测试企业甲', grantDate: '2024-03-01', applicationDate: '2023-03-01' },
    ];
    const pdfB = await materials.upload('ip-order', 'ip', { originalname: '同名证明.pdf', buffer }, 'ip/ip-b');
    const legacyPdf = await materials.upload('ip-order', 'ip', { originalname: '历史证明.pdf', buffer });
    const pdfA1 = await materials.upload('ip-order', 'ip', { originalname: '同名证明.pdf', buffer }, 'ip/ip-a');
    const pdfA2 = await materials.upload('ip-order', 'ip', { originalname: '补充证明.pdf', buffer }, 'ip/ip-a');
    await materials.reorder('ip-order', 'ip', { ids: [pdfB.id, legacyPdf.id, pdfA2.id, pdfA1.id] });
    const ordered = await JSZip.loadAsync(await materials.zip('ip-order', ipDraft, '测试企业甲'));
    const exportedPdfs = Object.values(ordered.files).filter((file) => file.name.startsWith(ipFolder) && file.name.endsWith('.pdf'));
    assert.deepEqual(exportedPdfs.map((file) => file.name), [
      summaryName,
      `${ipFolder}02-补充证明.pdf`,
      `${ipFolder}03-同名证明.pdf`,
      `${ipFolder}04-同名证明.pdf`,
      `${ipFolder}05-历史证明.pdf`,
    ], 'Summary first, then summary row order, existing order within an IP, legacy attachments last');
    for (const file of exportedPdfs.slice(1))
      assert.deepEqual(await file.async('nodebuffer'), buffer, 'Original PDFs are preserved');
    const summaryBuffer = await ordered.file(summaryName).async('nodebuffer');
    const summaryText = (await require('pdf-parse')(summaryBuffer)).text.replace(/\s/g, '');
    for (const phrase of ['知识产权汇总表', '编号', '名称', '专利类型', '法律状态', '专利号', '专利权人', '授权日期', ...ipDraft.ipSummary.map((row) => row.name)])
      assert.ok(summaryText.includes(phrase), `Summary PDF contains ${phrase}`);
    assert.ok(summaryText.indexOf('IP01') < summaryText.indexOf('IP02'));
    assert.ok(summaryText.indexOf('IP02') < summaryText.indexOf('IP03'));
    if (process.env.HIGH_TECH_VERIFY_PDF === '1')
      await require('node:fs/promises').writeFile('/tmp/hqx-ip-summary-qa.pdf', summaryBuffer);
    await service.attachmentRemove(1, '101', first.id);
    await rejects(() => service.attachmentFile(1, '101', first.id), 404);
    assert.equal((await service.attachmentList(1, '102')).length, 1);
    console.log('High-tech materials verification passed');
  } finally {
    if (previousFolder === undefined) delete process.env.HIGH_TECH_ATTACHMENT_DIR;
    else process.env.HIGH_TECH_ATTACHMENT_DIR = previousFolder;
    await rm(folder, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
