import { BadRequestException } from '@nestjs/common';

export type FinanceAmountUnit = 'thousand_yuan' | 'ten_thousand_yuan' | 'yuan';

export function normalizeFinanceYear(value: unknown): string {
  const year = String(value ?? '').trim();
  if (!/^\d{4}$/u.test(year)) {
    throw new BadRequestException('年度必须为 4 位年份，例如 2024');
  }
  return year;
}

export function normalizeFinanceAmountUnit(value: unknown): FinanceAmountUnit | null {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || text === 'unknown') {
    return null;
  }
  if (text === 'yuan' || text === '元') {
    return 'yuan';
  }
  if (text === 'thousand_yuan' || text === '千元') {
    return 'thousand_yuan';
  }
  if (text === 'ten_thousand_yuan' || text === '万元') {
    return 'ten_thousand_yuan';
  }
  return null;
}

export function normalizeFinanceAmount(
  value: unknown,
  sourceUnit?: FinanceAmountUnit | null,
): null | number {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const rawValue = String(value).trim().replace(/[\s,，]/gu, '');
  const multiplier = /千元$/u.test(rawValue)
    ? 0.1
    : /(?<!万)元$/u.test(rawValue)
      ? 0.0001
      : sourceUnit === 'yuan'
        ? 0.0001
        : sourceUnit === 'thousand_yuan'
          ? 0.1
          : 1;
  const text = rawValue.replace(/(?:万元|千元|元)$/u, '');
  if (!/^-?\d+(?:\.\d+)?$/u.test(text)) {
    throw new BadRequestException('财务金额必须为万元数字');
  }

  const amount = Number(text);
  if (!Number.isFinite(amount)) {
    throw new BadRequestException('财务金额必须为有效数字');
  }
  return Number((amount * multiplier).toFixed(2));
}

export function normalizeFinanceFileClass(value: unknown): null | number {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const fileClass = Number(value);
  if (!Number.isInteger(fileClass) || fileClass < 1 || fileClass > 3) {
    throw new BadRequestException('文件类型仅支持 1 至 3');
  }
  return fileClass;
}

export function normalizeFinanceTaxCategory(value: unknown): null | string {
  const category = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  return category || null;
}
