import type { HighTechIpItem } from '#/api/client/high-tech';
import { IP_SUMMARY_FIELDS, ipSummaryError, newIpItem } from './model';

/** Build an append-only, validated copy; never mutate the current draft or preview. */
export function prepareRecognizedIpRows(existing: HighTechIpItem[], recognized: HighTechIpItem[]): HighTechIpItem[] {
  if (existing.length + recognized.length > 200) throw new Error('追加后将超过200项，请删除多余的识别结果');
  const rows: HighTechIpItem[] = recognized.map((row) => ({
    id: row.id,
    ...Object.fromEntries(IP_SUMMARY_FIELDS.map(({ key }) => [key, row[key].trim()])),
  }) as HighTechIpItem);
  const error = ipSummaryError(rows);
  if (error) throw new Error(error);
  const normalizeNumber = (value: string) => value.replace(/\s/g, '').replace(/^ZL/i, '').toUpperCase();
  const patents = new Set(existing.map((row) => normalizeNumber(row.patentNumber)).filter(Boolean));
  const ids = new Set(existing.map((row) => row.id));
  for (const [index, row] of rows.entries()) {
    const number = normalizeNumber(row.patentNumber);
    if (patents.has(number)) throw new Error(`第${index + 1}项专利号/登记号重复，请核对或移除该项：${row.patentNumber}`);
    patents.add(number);
    if (ids.has(row.id)) row.id = crypto.randomUUID();
    ids.add(row.id);
  }
  const assigned = [...existing];
  for (const row of rows) {
    if (!row.number || assigned.some((item) => item.number === row.number)) row.number = newIpItem(assigned).number;
    assigned.push(row);
  }
  return rows;
}
