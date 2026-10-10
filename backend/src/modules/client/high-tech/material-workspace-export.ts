import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  Footer,
  PageNumber,
  AlignmentType,
  TableLayoutType,
  VerticalAlignTable,
} from 'docx';
import {
  BOOK_FORM_SECTIONS,
  HR_OVERVIEW_ROWS,
  HR_STRUCTURE_GROUPS,
  SYSTEM_DOC_TYPES,
} from './material-workspace-catalog';
import {
  activeRows,
  DocumentTarget,
  FEE_FIELDS,
  FRAMEWORK_FIELDS,
  feeValue,
  MaterialWorkspace,
  MONTH_FIELDS,
  monthAverage,
  PS_FIELDS,
  RD_FIELDS,
  STAFF_FIELDS,
  STANDARD_FIELDS,
  targetContent,
  WorkspaceSource,
} from './material-workspace';

import {
  MAIN_SITUATION_COLUMN_WIDTHS,
  mainSituationRows,
  MainSituationCell,
} from './main-situation-table';

type FormCell = MainSituationCell & { value: string };
export type MaterialBlock =
  | { title: string; pageBreakBefore?: boolean }
  | { text: string; keepNext?: boolean }
  | { formRows: FormCell[][]; columnWidths: number[] }
  | { humanResources: Record<string, string> }
  | { headers: string[]; rows: string[][] };
const text = (value: unknown) => String(value ?? '').trim() || '【待补充】';
function table(
  fields: string[][],
  rows: Record<string, string>[],
): MaterialBlock {
  return {
    headers: fields.map((f) => f[1]!),
    rows: rows.map((row) => fields.map((f) => text(row[f[0]!]))),
  };
}
export function ipSummaryBlock(draft: WorkspaceSource): MaterialBlock {
  return table(
    [
      ['number', '编号'],
      ['name', '名称'],
      ['patentType', '专利类型'],
      ['legalStatus', '法律状态'],
      ['patentNumber', '专利号'],
      ['patentee', '专利权人'],
      ['grantDate', '授权日期'],
    ],
    draft.ipSummary,
  );
}
export function bookBlocks(
  w: MaterialWorkspace,
  draft: WorkspaceSource,
): MaterialBlock[] {
  const blocks: MaterialBlock[] = [];
  for (const section of BOOK_FORM_SECTIONS) {
    blocks.push({ title: section.title, pageBreakBefore: section.key === 'main' });
    if (section.key === 'main') {
      blocks.push(
        { text: `企业名称：${text(w.fields.company_name)}`, keepNext: true },
        {
          columnWidths: MAIN_SITUATION_COLUMN_WIDTHS,
          formRows: mainSituationRows(w.applicationYear).map((row) =>
            row.map((cell) => ({
              ...cell,
              value: cell.field
                ? cell.field === 'accident'
                  ? { yes: '是', no: '否' }[w.fields.accident || ''] || '【待补充】'
                  : text(w.fields[cell.field])
                : cell.label!,
            })),
          ),
        },
      );
    } else if (section.key === 'hr')
      blocks.push({ humanResources: w.fields });
    else if (section.fields.length)
      blocks.push({
        headers: ['项目', '内容'],
        rows: section.fields.map((f) => {
          const match = /^year([123])_/.exec(f.key);
          return [
            match
              ? `${w.applicationYear - 4 + Number(match[1])}年 ${f.label}`
              : f.label,
            f.key === 'accident'
              ? { yes: '是', no: '否' }[w.fields[f.key] || ''] || '【待补充】'
              : text(w.fields[f.key]),
          ];
        }),
      });
    if (section.key === 'ip') blocks.push(ipSummaryBlock(draft));
    if (section.key === 'hr')
      blocks.push(table(STAFF_FIELDS, activeRows(w, 'staff')));
    if (section.key === 'rd' || section.key === 'ps')
      for (const row of activeRows(w, section.key)) {
        blocks.push({ title: `${row.no} ${row.name}` });
        blocks.push({
          headers: ['项目', '内容'],
          rows: (section.key === 'rd' ? RD_FIELDS : PS_FIELDS).map(
            ([key, label]) => [label!, text(row[key!])],
          ),
        });
      }
    if (section.key === 'fee')
      for (const offset of [3, 2, 1]) {
        const year = w.applicationYear - offset;
        const rows = activeRows(w, 'fees').filter(
          (r) => r.year === String(year),
        );
        blocks.push({ title: `${year}年度研究开发费用（万元）` });
        for (let start = 0; start < Math.max(rows.length, 1); start += 4) {
          const chunk = rows.slice(start, start + 4);
          blocks.push({
            headers: ['科目', ...chunk.map((r) => r.no!), '本表合计'],
            rows: FEE_FIELDS.map(([key, label]) => {
              const values = chunk.map((r) => feeValue(r, key!));
              return [
                label!,
                ...values.map(text),
                values.some(Boolean)
                  ? values.reduce((s, n) => s + Number(n || 0), 0).toFixed(2)
                  : '【待补充】',
              ];
            }),
          });
        }
      }
    if (section.key === 'standards')
      blocks.push(table(STANDARD_FIELDS, activeRows(w, 'standards')));
    const legacyKeys =
      section.key === 'innovation'
        ? [
            'innovation_ip',
            'innovation_transform',
            'innovation_organization',
            'innovation_staff',
          ]
        : [section.key];
    for (const old of draft.book.filter(
      (item) => legacyKeys.includes(item.key) && item.content.trim(),
    )) {
      if (!section.fields.some((f) => w.fields[f.key] === old.content))
        blocks.push({ title: '原有草稿补充内容' }, { text: old.content });
    }
  }
  return blocks;
}
export function documentBlocks(
  w: MaterialWorkspace,
  target: DocumentTarget,
): MaterialBlock[] {
  if (target.key === 'staff/tables') {
    const rows = activeRows(w, 'months');
    const average = (type: 'total' | 'tech') => {
      const nums = rows.map((r) => monthAverage(r, type));
      return nums.length === 12 && nums.every((v) => v !== null)
        ? (nums.reduce<number>((sum, n) => sum + (n ?? 0), 0) / 12).toFixed(2)
        : '【待补充】';
    };
    return [
      { title: `${w.applicationYear - 1}年12月份研发人员名单` },
      table(STAFF_FIELDS, activeRows(w, 'staff')),
      { title: '企业职工总数、科技人员数统计表' },
      {
        headers: [
          ...MONTH_FIELDS.map((f) => f[1]!),
          '月平均职工总数',
          '月平均科技人员数',
        ],
        rows: rows.map((r) => [
          ...MONTH_FIELDS.map(([key]) => text(r[key!])),
          text(monthAverage(r, 'total')),
          text(monthAverage(r, 'tech')),
        ]),
      },
      {
        text: `年平均职工总数：${average('total')}；年平均科技人员数：${average('tech')}`,
      },
    ];
  }
  if (target.key === 'ps/summary')
    return [
      table(
        [
          ['no', '编号'],
          ['name', '产品名称'],
          ['revenue', '上年度销售收入（万元）'],
          ['field', '技术领域'],
          ['rds', '研发项目'],
          ['ip', '知识产权'],
        ],
        activeRows(w, 'ps'),
      ),
      ...(targetContent(w, target) ? [{ text: targetContent(w, target) }] : []),
    ];
  if (target.key === 'achievement/summary')
    return [
      table(
        [
          ['no', '成果编号'],
          ['name', '成果名称'],
          ['year', '年度'],
          ['rd', '研发项目'],
          ['ip', '知识产权'],
          ['ps', '产品'],
        ],
        activeRows(w, 'achievements'),
      ),
      ...activeRows(w, 'achievements').flatMap((r) => [
        { title: `${r.no} ${r.name}` },
        {
          text:
            w.documents[`achievement/${r.id}/description`]?.content ||
            '【待补充】',
        },
      ]),
    ];
  if (target.key === 'system/summary')
    return [
      { title: '制度框架' },
      { headers: ['制度模块', '制度文件', '管理要点与佐证材料'], rows: FRAMEWORK_FIELDS.map(([key, title]) => [title!, text(w.fields[`system_${key}_files`]), text(w.fields[`system_${key}_points`])]) },
      {
        headers: ['序号', '制度名称', '制作情况'],
        rows: SYSTEM_DOC_TYPES.map((d, i) => [
          String(i + 1),
          d.title,
          w.documents[`system/${d.key}`]?.content
            ? '已有草稿，待企业核实'
            : '待制作',
        ]),
      },
    ];
  return [{ text: text(targetContent(w, target)) }];
}
// A shared 24-column grid supports both the 3-column overview and 5-column structure.
// Keep the form together on one page, with the surrounding application typography.
function humanResourcesTable(fields: Record<string, string>): Table {
  const width = 10106; // A4 content width: 11906 - 2 * 900 twips.
  const columnWidths = Array.from(
    { length: 24 },
    (_, index) =>
      Math.round(((index + 1) * width) / 24) - Math.round((index * width) / 24),
  );
  const rows: TableRow[] = [];
  const addRow = (
    values: string[],
    spans: number[],
    heading = false,
    last = false,
  ) => {
    let column = 0;
    rows.push(
      new TableRow({
        cantSplit: true,
        children: values.map((value, index) => {
          const span = spans[index]!;
          const cellWidth = columnWidths
            .slice(column, column + span)
            .reduce((sum, size) => sum + size, 0);
          column += span;
          return new TableCell({
            columnSpan: span,
            width: { size: cellWidth, type: WidthType.DXA },
            verticalAlign: VerticalAlignTable.CENTER,
            shading: heading ? { fill: 'EAF2F8' } : undefined,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                keepNext: !last,
                spacing: { before: 0, after: 0, line: 300 },
                children: [
                  new TextRun({
                    text: value,
                    bold: heading,
                    size: values.length === 1 ? 24 : 22,
                  }),
                ],
              }),
            ],
          });
        }),
      }),
    );
  };
  addRow(['一、总体情况'], [24], true);
  addRow(['人员类别', '企业职工', '科技人员'], [6, 9, 9], true);
  for (const row of HR_OVERVIEW_ROWS)
    addRow(
      [row.label, text(fields[row.employeeKey]), text(fields[row.techKey])],
      [6, 9, 9],
    );
  addRow(['二、全体人员结构'], [24], true);
  HR_STRUCTURE_GROUPS.forEach((group, index) => {
    addRow(
      [group.label, ...group.fields.map((field) => field.label)],
      [4, 5, 5, 5, 5],
      true,
    );
    addRow(
      ['人数', ...group.fields.map((field) => text(fields[field.key]))],
      [4, 5, 5, 5, 5],
      false,
      index === HR_STRUCTURE_GROUPS.length - 1,
    );
  });
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    rows,
  });
}

export async function renderWord(title: string, blocks: MaterialBlock[]) {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [new TextRun({ text: title, bold: true, size: 36 })],
    }),
  ];
  for (const [blockIndex, block] of blocks.entries()) {
    if ('title' in block)
      children.push(
        new Paragraph({
          text: block.title,
          heading: HeadingLevel.HEADING_1,
          keepNext: true,
          pageBreakBefore: block.pageBreakBefore && blockIndex > 0,
        }),
      );
    else if ('humanResources' in block) {
      children.push(humanResourcesTable(block.humanResources));
      children.push(new Paragraph(''));
    } else if ('text' in block)
      for (const line of block.text.split(/\r?\n/))
        children.push(
          new Paragraph({
            text: line || ' ',
            keepNext: block.keepNext,
            spacing: { after: 120 },
          }),
        );
    else if ('formRows' in block) {
      children.push(
        new Table({
          width: { size: 10106, type: WidthType.DXA },
          columnWidths: block.columnWidths.map((width) => Math.round(10106 * width / 100)),
          layout: TableLayoutType.FIXED,
          rows: block.formRows.map((row, rowIndex) => new TableRow({
            cantSplit: true,
            children: row.map((cell) => new TableCell({
              columnSpan: cell.columnSpan,
              rowSpan: cell.rowSpan,
              verticalAlign: VerticalAlignTable.CENTER,
              margins: { top: 100, bottom: 100, left: 90, right: 90 },
              shading: cell.field ? undefined : { fill: 'F1F6FB' },
              children: cell.value.split(/\r?\n/).map((line) => new Paragraph({
                alignment: AlignmentType.CENTER,
                keepNext: rowIndex < block.formRows.length - 1,
                spacing: { before: 0, after: 0, line: 260 },
                children: [new TextRun({ text: line || ' ', size: 20 })],
              })),
            })),
          })),
        }),
        new Paragraph(''),
      );
    } else {
      const rows = [block.headers, ...block.rows];
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: rows.map(
            (cells, index) =>
              new TableRow({
                tableHeader: index === 0,
                children: cells.map(
                  (value) =>
                    new TableCell({
                      children: String(value)
                        .split(/\r?\n/)
                        .map(
                          (line) =>
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: line || ' ',
                                  bold: index === 0,
                                  size: 20,
                                }),
                              ],
                            }),
                        ),
                      shading: index === 0 ? { fill: 'EAF2F8' } : undefined,
                    }),
                ),
              }),
          ),
        }),
      );
      children.push(new Paragraph(''));
    }
  }
  return Buffer.from(
    await Packer.toBuffer(
      new Document({
        styles: {
          default: {
            document: {
              run: {
                font: process.env.HIGH_TECH_DOCUMENT_FONT || '宋体',
                size: 22,
              },
              paragraph: { spacing: { line: 320 } },
            },
          },
        },
        sections: [
          {
            properties: {
              page: {
                size: { width: 11906, height: 16838 },
                margin: { top: 1000, bottom: 1000, left: 900, right: 900 },
              },
            },
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ children: [PageNumber.CURRENT] })],
                  }),
                ],
              }),
            },
            children,
          },
        ],
      }),
    ),
  );
}
export async function wordToPdf(buffer: Buffer): Promise<Buffer> {
  const folder = await mkdtemp(join(tmpdir(), 'hqx-material-'));
  try {
    await writeFile(join(folder, 'material.docx'), buffer, { mode: 0o600 });
    const executable = process.env.HIGH_TECH_SOFFICE_PATH || 'soffice';
    const env = { ...process.env };
    // Some macOS LibreOffice distributions cannot discover Apple's CJK asset fonts.
    // Keep an explicitly configured fontconfig file; otherwise provide system paths.
    if (process.platform === 'darwin' && !env.FONTCONFIG_FILE) {
      const fontConfig = join(folder, 'fonts.conf');
      await writeFile(
        fontConfig,
        `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig><dir>/System/Library/Fonts</dir><dir>/Library/Fonts</dir>
<dir>/System/Library/AssetsV2/com_apple_MobileAsset_Font8</dir>
<cachedir>${folder.replace(/&/g, '&amp;').replace(/</g, '&lt;')}/font-cache</cachedir></fontconfig>`,
        { mode: 0o600 },
      );
      env.FONTCONFIG_FILE = fontConfig;
    }
    await promisify(execFile)(
      executable,
      [
        `-env:UserInstallation=${pathToFileURL(join(folder, 'profile')).href}`,
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        folder,
        join(folder, 'material.docx'),
      ],
      { env, timeout: 60000, maxBuffer: 1024 * 1024 },
    );
    return await readFile(join(folder, 'material.pdf'));
  } catch {
    throw new ServiceUnavailableException(
      'PDF转换未完成，请检查服务器LibreOffice及中文字体，或先导出Word；草稿已保留',
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
