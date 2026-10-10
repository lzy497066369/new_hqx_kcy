#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const SQL_ROOT = path.join(BACKEND_ROOT, 'sql');
const MANIFEST_PATH = path.join(SQL_ROOT, 'migrations', 'manifest.json');
const MIGRATION_TABLE = 'sys_schema_migration';

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const index = line.indexOf('=');
    if (index < 0) {
      continue;
    }
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    action: args.has('--adopt-current')
      ? 'adopt-current'
      : args.has('--apply')
        ? 'apply'
        : args.has('--status')
          ? 'status'
          : 'plan',
    allowUntrackedHistory: args.has('--allow-untracked-history'),
    confirmAdoptCurrent: args.has('--confirm-adopt-current'),
  };
}

function loadManifest() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const seen = new Set();
  for (const migration of manifest.migrations) {
    if (seen.has(migration.id)) {
      throw new Error(`迁移 ID 重复：${migration.id}`);
    }
    seen.add(migration.id);
    if (!fs.existsSync(path.join(SQL_ROOT, migration.file))) {
      throw new Error(`迁移文件不存在：${migration.file}`);
    }
  }
  return manifest;
}

function checksum(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function splitStatements(sql) {
  const statements = [];
  let buffer = '';
  let delimiter = ';';
  let index = 0;
  let lineStart = true;

  while (index < sql.length) {
    if (lineStart) {
      const lineEnd = sql.indexOf('\n', index);
      const end = lineEnd < 0 ? sql.length : lineEnd + 1;
      const line = sql.slice(index, end);
      const match = line.match(/^\s*DELIMITER\s+(\S+)\s*(?:\r?\n)?$/i);
      if (match) {
        delimiter = match[1];
        index = end;
        lineStart = true;
        continue;
      }
    }

    if (sql.startsWith(delimiter, index)) {
      const statement = buffer.trim();
      if (statement) {
        statements.push(statement);
      }
      buffer = '';
      index += delimiter.length;
      lineStart = false;
      continue;
    }

    const char = sql[index];
    buffer += char;
    lineStart = char === '\n';
    index += 1;
  }

  const trailing = buffer.trim();
  if (trailing) {
    statements.push(trailing);
  }
  return statements;
}

function createConnection(env) {
  return mysql.createConnection({
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT || 3306),
    timezone: '+08:00',
    user: env.DB_USERNAME,
  });
}

async function tableExists(connection) {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [MIGRATION_TABLE],
  );
  return rows.length > 0;
}

async function getApplied(connection) {
  if (!(await tableExists(connection))) {
    return new Map();
  }
  const [rows] = await connection.query(
    `SELECT migration_id, checksum FROM \`${MIGRATION_TABLE}\` ORDER BY id`,
  );
  return new Map(rows.map((row) => [row.migration_id, row.checksum]));
}

async function ensureMigrationTable(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS \`${MIGRATION_TABLE}\` (
      \`id\` BIGINT NOT NULL AUTO_INCREMENT,
      \`migration_id\` VARCHAR(128) NOT NULL,
      \`checksum\` CHAR(64) NOT NULL,
      \`applied_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_sys_schema_migration_id\` (\`migration_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
}

function getMigrationRows(manifest, applied = new Map()) {
  return manifest.migrations.map((migration) => {
    const filePath = path.join(SQL_ROOT, migration.file);
    const fileChecksum = checksum(filePath);
    const appliedChecksum = applied.get(migration.id);
    return {
      ...migration,
      checksum: fileChecksum,
      state: !appliedChecksum
        ? 'pending'
        : appliedChecksum === fileChecksum
          ? 'applied'
          : 'checksum_mismatch',
    };
  });
}

function printRows(rows) {
  for (const row of rows) {
    console.log(`${row.state.padEnd(17)} ${row.id}  ${row.file}`);
  }
}

async function apply(connection, rows) {
  const mismatches = rows.filter((row) => row.state === 'checksum_mismatch');
  if (mismatches.length) {
    throw new Error(
      `已执行迁移的文件内容发生变化：${mismatches.map((row) => row.id).join(', ')}`,
    );
  }

  await ensureMigrationTable(connection);
  for (const row of rows.filter((item) => item.state === 'pending')) {
    const filePath = path.join(SQL_ROOT, row.file);
    const statements = splitStatements(fs.readFileSync(filePath, 'utf8'));
    console.log(`applying ${row.id} (${statements.length} statements)`);
    try {
      for (const statement of statements) {
        await connection.query(statement);
      }
      await connection.query(
        `INSERT INTO \`${MIGRATION_TABLE}\` (migration_id, checksum) VALUES (?, ?)`,
        [row.id, row.checksum],
      );
    } catch (error) {
      throw new Error(`迁移失败：${row.id}。未登记该迁移；请修复后重新执行。原因：${error.message}`);
    }
  }
}

async function adoptCurrent(connection, rows) {
  await ensureMigrationTable(connection);
  const applied = await getApplied(connection);
  if (applied.size > 0) {
    throw new Error('迁移登记表已有记录，不能认领当前结构。');
  }

  for (const row of rows) {
    await connection.query(
      `INSERT INTO \`${MIGRATION_TABLE}\` (migration_id, checksum) VALUES (?, ?)`,
      [row.id, row.checksum],
    );
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const { action } = options;
  const manifest = loadManifest();

  if (action === 'plan') {
    console.log(`新环境基线：sql/${manifest.baseline.file}`);
    console.log('已有库迁移计划：');
    printRows(getMigrationRows(manifest));
    console.log('只读查看状态：npm run db:migrate:status');
    console.log('从已知 2026-07-04 基线执行历史链：npm run db:migrate -- --apply --allow-untracked-history');
    console.log('认领已上线旧库当前结构：npm run db:migrate -- --adopt-current --confirm-adopt-current');
    return;
  }

  const envPath = process.env.ENV_PATH
    ? path.resolve(process.env.ENV_PATH)
    : path.join(BACKEND_ROOT, '.env');
  const env = { ...loadEnv(envPath), ...process.env };
  const connection = await createConnection(env);

  try {
    const applied = await getApplied(connection);
    const rows = getMigrationRows(manifest, applied);
    printRows(rows);
    if (action === 'apply') {
      if (applied.size === 0 && !options.allowUntrackedHistory) {
        throw new Error(
          '当前库没有迁移登记，拒绝直接执行历史 SQL。仅当该库明确是 2026-07-04 基线时，才可追加 --allow-untracked-history；其他旧库请先完成结构核对，再使用 --adopt-current --confirm-adopt-current 认领。',
        );
      }
      await apply(connection, rows);
      console.log('迁移执行完成。');
    }
    if (action === 'adopt-current') {
      if (!options.confirmAdoptCurrent) {
        throw new Error(
          '认领当前结构会将历史迁移登记为已执行。请先完成数据库备份和结构核对，再追加 --confirm-adopt-current。',
        );
      }
      await adoptCurrent(connection, rows);
      console.log('当前结构已认领；后续新增迁移将从此状态继续登记。');
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
