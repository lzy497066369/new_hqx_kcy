#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function normalizeExtractedPdfText(value) {
  return String(value ?? '')
    .replace(/\u0000/gu, '')
    .replace(/[ \t\r\f\v]+/gu, ' ')
    .replace(/\n{2,}/gu, '\n')
    .trim();
}

function countIpPdfFieldHits(value) {
  return [
    /软件\s*名\s*称/u,
    /著作权\s*人|权利\s*人/u,
    /登记号/u,
    /开发完成日期/u,
    /首次发表日期/u,
    /登记日期/u,
    /中华人民共和国国家版权局/u,
    /计算机软件著作权登记证书/u,
    /软著|软件著作权/u,
    /\d{4}SR\d{4,8}/iu,
  ].reduce((count, keyword) => count + (keyword.test(value) ? 1 : 0), 0);
}

function countFinancePdfFieldHits(value) {
  return [
    /资产负债表/u,
    /利润表/u,
    /营业收入/u,
    /研究费用|研发费用/u,
    /利润总额/u,
    /净利润/u,
    /资产合计|资产总计/u,
    /负债合计/u,
  ].reduce((count, keyword) => count + (keyword.test(value) ? 1 : 0), 0);
}

function isReadablePdfText(value, fieldHitScore, scene) {
  if (value.length < 80) {
    return false;
  }
  const pdfInternalHits = (
    value.match(/\/Filter|FlateDecode|endstream|endobj|xref|trailer/giu) ?? []
  ).length;
  const chineseChars = (value.match(/[\u4E00-\u9FA5]/gu) ?? []).length;
  const chineseRatio = chineseChars / Math.max(value.length, 1);

  return (
    pdfInternalHits < 3 &&
    chineseRatio > 0.08 &&
    (scene === 'finance' || fieldHitScore >= 2)
  );
}

async function extractWithPdfParse(filePath) {
  try {
    const loaded = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const pdfParse =
      typeof loaded === 'function'
        ? loaded
        : typeof loaded.default === 'function'
          ? loaded.default
          : null;
    if (pdfParse) {
      const result = await pdfParse(buffer);
      return normalizeExtractedPdfText(result.text ?? '');
    }

    if (typeof loaded.PDFParse === 'function') {
      const parser = new loaded.PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return normalizeExtractedPdfText(result.text ?? '');
      } finally {
        await parser.destroy?.();
      }
    }
    throw new Error('pdf-parse does not expose a supported text parser');
  } catch (error) {
    const fallbackText = extractWithToUnicodeMap(fs.readFileSync(filePath));
    return fallbackText
      ? fallbackText
      : {
          error:
            error && typeof error === 'object' && 'message' in error
              ? error.message
              : String(error),
          text: '',
        };
  }
}

function extractWithToUnicodeMap(buffer) {
  const streams = extractFlateDecodedStreams(buffer);
  const unicodeMap = buildToUnicodeMap(streams);
  if (unicodeMap.size === 0) {
    return '';
  }

  return normalizeExtractedPdfText(
    streams
      .filter((stream) => /(?:<[\dA-Fa-f]+>|\((?:\\.|[^\\()])*\))\s*Tj/u.test(stream))
      .flatMap((stream) => [
        ...[...stream.matchAll(/<([\dA-Fa-f]+)>\s*Tj/gu)].map((match) =>
          decodeHexText(match[1] ?? '', unicodeMap),
        ),
        ...[...stream.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/gu)].map((match) =>
          decodeLiteralText(match[1] ?? '', unicodeMap),
        ),
      ])
      .filter(Boolean)
      .join(' '),
  );
}

function extractFlateDecodedStreams(buffer) {
  const rawPdf = buffer.toString('latin1');
  const streams = [];
  const pattern =
    /<<(?:.|\r|\n)*?\/Filter\s*\/FlateDecode(?:.|\r|\n)*?>>\s*stream\r?\n/gu;
  let match;
  while ((match = pattern.exec(rawPdf))) {
    const start = pattern.lastIndex;
    const end = rawPdf.indexOf('endstream', start);
    if (end <= start) {
      continue;
    }
    try {
      streams.push(zlib.inflateSync(buffer.subarray(start, end)).toString('latin1'));
    } catch {}
  }
  return streams;
}

function buildToUnicodeMap(streams) {
  const unicodeMap = new Map();
  for (const stream of streams.filter((item) => item.includes('begincmap'))) {
    for (const match of stream.matchAll(
      /<([\dA-Fa-f]+)>\s*<([\dA-Fa-f]+)>\s*<([\dA-Fa-f]+)>/gu,
    )) {
      const startCode = Number.parseInt(match[1] ?? '', 16);
      const endCode = Number.parseInt(match[2] ?? '', 16);
      const startUnicode = Number.parseInt(match[3] ?? '', 16);
      if (
        !Number.isFinite(startCode) ||
        !Number.isFinite(endCode) ||
        !Number.isFinite(startUnicode) ||
        endCode < startCode ||
        endCode - startCode > 2000
      ) {
        continue;
      }
      for (let code = startCode; code <= endCode; code += 1) {
        unicodeMap.set(
          code.toString(16).padStart(4, '0'),
          String.fromCodePoint(startUnicode + code - startCode),
        );
      }
    }
  }
  return unicodeMap;
}

function decodeHexText(hexText, unicodeMap) {
  let text = '';
  for (let index = 0; index < hexText.length; index += 4) {
    text += unicodeMap.get(hexText.slice(index, index + 4).toLowerCase()) ?? '';
  }
  return text;
}

function decodeLiteralText(value, unicodeMap) {
  const bytes = decodeLiteralBytes(value);
  let text = '';
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const code = ((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0);
    text += unicodeMap.get(code.toString(16).padStart(4, '0')) ?? '';
  }
  return text;
}

function decodeLiteralBytes(value) {
  const bytes = [];
  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index);
    if (charCode !== 92) {
      bytes.push(charCode & 0xff);
      continue;
    }

    index += 1;
    if (index >= value.length) {
      break;
    }
    const escaped = value[index] ?? '';
    if (/[0-7]/u.test(escaped)) {
      let octal = escaped;
      for (
        let count = 0;
        count < 2 && index + 1 < value.length && /[0-7]/u.test(value[index + 1] ?? '');
        count += 1
      ) {
        index += 1;
        octal += value[index] ?? '';
      }
      bytes.push(Number.parseInt(octal, 8) & 0xff);
      continue;
    }

    const escapedBytes = {
      b: 8,
      f: 12,
      n: 10,
      r: 13,
      t: 9,
      '(': 40,
      ')': 41,
      '\\': 92,
    };
    bytes.push(escapedBytes[escaped] ?? (escaped.charCodeAt(0) & 0xff));
  }
  return bytes;
}

async function main() {
  const sceneArgIndex = process.argv.indexOf('--scene');
  const scene =
    sceneArgIndex >= 0 && process.argv[sceneArgIndex + 1] === 'finance'
      ? 'finance'
      : 'ip';
  const filePath = process.argv.find(
    (item, index) =>
      index > 1 &&
      item !== '--scene' &&
      process.argv[index - 1] !== '--scene',
  );
  if (!filePath) {
    console.error('用法：node scripts/verify-ip-pdf-text.cjs [--scene ip|finance] <pdf-file>');
    process.exit(2);
  }

  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`文件不存在：${absolutePath}`);
    process.exit(2);
  }

  const extracted = await extractWithPdfParse(absolutePath);
  const text = typeof extracted === 'string' ? extracted : extracted.text;
  const fieldHitScore =
    scene === 'finance' ? countFinancePdfFieldHits(text) : countIpPdfFieldHits(text);
  const readable = isReadablePdfText(text, fieldHitScore, scene);

  console.log(`文件：${absolutePath}`);
  console.log(`场景：${scene}`);
  console.log(`状态：${readable ? 'success' : text ? 'unreadable' : 'empty'}`);
  console.log(`字段命中：${fieldHitScore}`);
  console.log(`文本长度：${text.length}`);
  if (typeof extracted !== 'string' && extracted.error) {
    console.log(`解析错误：${extracted.error}`);
  }
  console.log('文本预览：');
  console.log(text.slice(0, 1000) || '(无可提取文本)');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
