import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import JSZip = require('jszip');
export type MaterialUpload = { originalname: string; buffer: Buffer };
export async function staffImportTemplate() {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('企业人员明细', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: '序号', width: 10 },
    { header: '姓名', width: 16 },
    { header: '身份证号', width: 24 },
    { header: '是否签订合同', width: 18 },
    { header: '是否缴纳社保', width: 18 },
    { header: '学历', width: 16 },
    { header: '职称', width: 16 },
    { header: '是否科技人员', width: 18 },
  ];
  sheet.columns.forEach((column) => { column.numFmt = '@'; });
  const header = sheet.getRow(1);
  header.height = 28;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.autoFilter = 'A1:H1';
  for (let row = 2; row <= 101; row++) {
    sheet.getRow(row).height = 24;
    for (const column of [4, 5, 8]) {
      sheet.getCell(row, column).dataValidation = {
        type: 'list', allowBlank: true, formulae: ['"是,否"'],
        showErrorMessage: true, errorTitle: '填写值不正确', error: '请选择是或否',
      };
    }
  }
  const instructions = workbook.addWorksheet('填写说明');
  instructions.columns = [{ header: '项目', width: 18 }, { header: '填写规则', width: 90 }];
  instructions.addRows([
    ['数据位置', '在“企业人员明细”工作表第2行起填写，每行一人；请勿修改表头或合并单元格。'],
    ['人员记录', '姓名必须填写；空白姓名行不会导入。模板不包含示例人员。'],
    ['身份证号', '以文本格式填写，保留完整号码及末尾的X，勿使用数字格式或公式。'],
    ['是否字段', '是否签订合同、是否缴纳社保、是否科技人员填写“是”或“否”；未知可留空。'],
    ['其他字段', '学历、职称按实际情况填写；序号可留空，应用导入结果时自动编号。'],
    ['导入方式', '保存为.xlsx后上传，最多2000人、文件不超过20MB；核对预览后应用，将替换当前人员明细。'],
  ]);
  instructions.getRow(1).font = { bold: true };
  instructions.getColumn(2).alignment = { wrapText: true, vertical: 'middle' };
  instructions.eachRow((row, index) => { row.height = index === 1 ? 26 : 42; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
async function zip(buffer: Buffer) {
  if (buffer.length > 20 * 1024 * 1024)
    throw new BadRequestException('文件不得超过20MB');
  const archive = await JSZip.loadAsync(buffer);
  const entries = Object.values(archive.files);
  if (entries.length > 3000) throw new BadRequestException('文件内容过多');
  let size = 0;
  for (const item of entries) {
    size += Number(
      (item as unknown as { _data?: { uncompressedSize?: number } })._data
        ?.uncompressedSize || 0,
    );
    if (size > 60 * 1024 * 1024)
      throw new BadRequestException('文件解压后过大');
  }
  return archive;
}
export async function readMaterialUpload(
  file: MaterialUpload,
): Promise<{ text: string; sheets: { name: string; rows: string[][] }[] }> {
  if (
    !file ||
    !/\.(xlsx|xlsm|xls|docx)$/i.test(file.originalname) ||
    file.buffer.length > 20 * 1024 * 1024
  )
    throw new BadRequestException('请上传20MB以内的Excel或Word文件');
  let buffer = file.buffer;
  if (/\.xls$/i.test(file.originalname)) {
    const folder = await mkdtemp(join(tmpdir(), 'hqx-audit-'));
    try {
      await writeFile(join(folder, 'source.xls'), buffer, { mode: 0o600 });
      await promisify(execFile)(
        process.env.HIGH_TECH_SOFFICE_PATH || 'soffice',
        [
          `-env:UserInstallation=${pathToFileURL(join(folder, 'profile')).href}`,
          '--headless',
          '--convert-to',
          'xlsx',
          '--outdir',
          folder,
          join(folder, 'source.xls'),
        ],
        { timeout: 60000, maxBuffer: 1024 * 1024 },
      );
      buffer = await readFile(join(folder, 'source.xlsx'));
    } catch {
      throw new BadRequestException('旧版Excel转换失败，请另存为.xlsx后上传');
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
  try {
    const archive = await zip(buffer);
    if (/\.docx$/i.test(file.originalname)) {
      const xml = await archive.file('word/document.xml')?.async('string');
      if (!xml) throw new Error();
      const text = xml
        .replace(/<\/w:(p|tr)>/g, '\n')
        .replace(/<\/w:tc>/g, '\t')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      if (text.length > 180000)
        throw new BadRequestException('文档内容过长，请按年度拆分');
      return { text, sheets: [] };
    }
    const workbook = new Workbook();
    await workbook.xlsx.load(
      buffer as unknown as Parameters<Workbook['xlsx']['load']>[0],
    );
    const sheets = workbook.worksheets.map((sheet) => {
      if (sheet.rowCount > 3000 || sheet.columnCount > 150)
        throw new BadRequestException('表格过大，请按年度拆分');
      const rows: string[][] = [];
      sheet.eachRow((row) => {
        const values: string[] = [];
        for (let i = 1; i <= Math.min(sheet.columnCount, 150); i++) {
          const cell = row.getCell(i);
          const v = cell.value;
          values.push(
            cell.type === 6 && v && typeof v === 'object' && 'result' in v
              ? String(v.result ?? '')
              : cell.text,
          );
        }
        rows.push(values);
      });
      return { name: sheet.name, rows };
    });
    const text = sheets
      .map(
        (s) =>
          `工作表：${s.name}\n${s.rows.map((r) => r.join('\t')).join('\n')}`,
      )
      .join('\n');
    if (text.length > 180000)
      throw new BadRequestException('表格内容过长，请拆分后上传');
    return { text, sheets };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('文件无法读取，请检查格式或加密状态');
  }
}
export function staffFromSheets(sheets: { name: string; rows: string[][] }[]) {
  const aliases: Record<string, string[]> = {
    seq: ['序号', '编号'],
    name: ['姓名', '员工姓名'],
    id_no: ['身份证号', '身份证号码'],
    contract: ['是否签订合同', '劳动合同', '是否签订劳动合同'],
    social_security: ['是否缴纳社保', '社保', '是否缴纳社会保险'],
    education: ['学历'],
    title: ['职称'],
    is_tech: ['是否科技人员', '是否研发人员', '是否科技研发人员'],
  };
  for (const sheet of sheets) {
    const headerIndex = sheet.rows.findIndex((r) =>
      r.some((v) => aliases.name.includes(v.trim())),
    );
    if (headerIndex < 0) continue;
    const headers = sheet.rows[headerIndex].map((s) => s.trim());
    const rows = sheet.rows
      .slice(headerIndex + 1)
      .map((r, index) =>
        Object.fromEntries(
          Object.entries(aliases).map(([key, names]) => [
            key,
            r[headers.findIndex((h) => names.includes(h))]?.trim() ||
              (key === 'seq' ? String(index + 1) : ''),
          ]),
        ),
      )
      .filter((r) => r.name);
    if (rows.length > 2000) throw new BadRequestException('人员名单最多2000行');
    if (!rows.length) throw new BadRequestException('人员名单为空');
    return rows;
  }
  throw new BadRequestException(
    '未找到姓名列，请使用包含姓名、身份证号、学历、职称及是否科技人员的Excel',
  );
}
