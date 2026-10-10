#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const file = process.argv[2];
if (require.main === module && !file) {
  throw new Error('Usage: node scripts/execute-sql-file.cjs <sql-file>');
}

function loadEnv(filePath) {
  const result = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index < 1 || line.trim().startsWith('#')) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}

function splitStatements(sql) {
  const results = [];
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
      if (statement) results.push(statement);
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
  if (trailing) results.push(trailing);
  return results;
}

async function main() {
  const env = { ...loadEnv(path.join(__dirname, '..', '.env')), ...process.env };
  const connection = await mysql.createConnection({
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USERNAME,
  });
  try {
    const sqlFile = path.resolve(process.cwd(), file);
    const sql = fs.readFileSync(sqlFile, 'utf8');
    await connection.beginTransaction();
    const sqlStatements = splitStatements(sql);
    for (const statement of sqlStatements) {
      await connection.query(statement);
    }
    await connection.commit();
    console.log(`Executed ${sqlStatements.length} SQL statements.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { splitStatements };
