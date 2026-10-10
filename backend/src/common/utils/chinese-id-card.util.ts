export type ChineseIdCardIdentity = {
  age: number;
  ageRange: 1 | 2 | 3 | 4;
  birthDate: string;
  gender: 1 | 2;
};

export function normalizeChineseIdCard(value?: null | string): null | string {
  const normalized = value?.replace(/\s+/gu, '').toUpperCase() ?? '';
  return normalized || null;
}

export function parseChineseIdCard(
  value?: null | string,
  referenceDate = new Date(),
): ChineseIdCardIdentity | null {
  const idCard = normalizeChineseIdCard(value) ?? '';
  if (!/^\d{17}[\dX]$/u.test(idCard)) {
    return null;
  }

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = '10X98765432';
  const checkIndex = idCard
    .slice(0, 17)
    .split('')
    .reduce(
      (sum, digit, index) => sum + Number(digit) * (weights[index] ?? 0),
      0,
    ) % 11;
  if (checkCodes[checkIndex] !== idCard[17]) {
    return null;
  }

  const year = Number(idCard.slice(6, 10));
  const month = Number(idCard.slice(10, 12));
  const day = Number(idCard.slice(12, 14));
  const birthDate = new Date(year, month - 1, day);
  if (
    year < 1900 ||
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  let age = referenceDate.getFullYear() - year;
  if (
    referenceDate.getMonth() < month - 1 ||
    (referenceDate.getMonth() === month - 1 && referenceDate.getDate() < day)
  ) {
    age -= 1;
  }
  if (age < 0 || age > 150) {
    return null;
  }

  return {
    age,
    ageRange: age <= 30 ? 1 : age <= 40 ? 2 : age <= 50 ? 3 : 4,
    birthDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    gender: Number(idCard[16]) % 2 === 1 ? 1 : 2,
  };
}
