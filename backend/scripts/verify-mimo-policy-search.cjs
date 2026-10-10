const fs = require('node:fs');
const path = require('node:path');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function findKeys(value, predicate, hits = []) {
  if (!value || typeof value !== 'object') {
    return hits;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      findKeys(item, predicate, hits);
    }
    return hits;
  }
  for (const [key, child] of Object.entries(value)) {
    if (predicate(key, child)) {
      hits.push({ key, value: child });
    }
    findKeys(child, predicate, hits);
  }
  return hits;
}

function findUrls(value, urls = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>，。]+/g)) {
      urls.add(match[0]);
    }
    return urls;
  }
  if (!value || typeof value !== 'object') {
    return urls;
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    findUrls(child, urls);
  }
  return urls;
}

async function main() {
  loadEnv(path.resolve(__dirname, '../.env'));

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured');
  }

  const baseUrl = (process.env.AI_BASE_URL || 'https://api.xiaomimimo.com/v1').replace(
    /\/$/,
    '',
  );
  const model = process.env.AI_MODEL || 'mimo-v2.5-pro';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages: [
        {
          content:
            '你是政策官方来源搜索验证助手。必须使用联网搜索工具查找公开政策网页，输出 JSON。',
          role: 'system',
        },
        {
          content:
            '请联网搜索 2025 年浙江省科技厅或中国政府网站发布的政策通知，返回 {"results":[{"title":"","url":"","snippet":""}],"warnings":[]}。不要凭记忆回答。',
          role: 'user',
        },
      ],
      model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      thinking: { type: 'disabled' },
      tool_choice: 'auto',
      tools: [
        {
          force_search: true,
          limit: 5,
          max_keyword: 3,
          type: 'web_search',
        },
      ],
    }),
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    method: 'POST',
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`MiMo request failed: ${response.status} ${rawText}`);
  }

  const raw = JSON.parse(rawText);
  const sourceKeyHits = findKeys(raw, (key) =>
    /annotation|citation|search|source|tool/i.test(key),
  );
  const urls = [...findUrls(raw)].slice(0, 5);
  const content = raw.choices?.[0]?.message?.content ?? '';
  let parsedContent = null;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    parsedContent = null;
  }
  const contentUrls = [...findUrls(parsedContent ?? content)].slice(0, 5);

  console.log(
    JSON.stringify(
      {
        contentUrlCount: contentUrls.length,
        contentUrls,
        hasSearchRelatedRawKeys: sourceKeyHits.length > 0,
        model: raw.model ?? model,
        rawSearchRelatedKeys: [...new Set(sourceKeyHits.map((item) => item.key))],
        rawUrlCount: urls.length,
        rawUrls: urls,
        usageKeys:
          raw.usage && typeof raw.usage === 'object' ? Object.keys(raw.usage) : [],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
