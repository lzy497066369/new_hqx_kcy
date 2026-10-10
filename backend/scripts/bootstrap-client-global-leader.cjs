#!/usr/bin/env node
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

const ROLE_DEFINITIONS = [
  ['global_leader', '总负责人'],
  ['project_teacher', '企业负责人'],
];
const username = process.env.GLOBAL_LEADER_USERNAME || 'zongfuzeren';
const password = process.env.GLOBAL_LEADER_PASSWORD;

if (!password || password.length < 12) {
  throw new Error('请通过 GLOBAL_LEADER_PASSWORD 提供至少 12 位初始密码，不要把密码写入代码或仓库。');
}

function hashPassword(value) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(value, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'hqx_kjqb',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'hqx_kjqb',
  });
  try {
    for (const [code, name] of ROLE_DEFINITIONS) {
      await db.execute(
        `INSERT INTO sys_role (app_code, portal_type, code, name, remark, status)
         VALUES (?, 'client', ?, ?, '总负责人直接分发企业负责人账号', 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), remark = VALUES(remark), status = 1`,
        ['kjqb', code, name],
      );
    }

    const [existingRows] = await db.execute('SELECT id FROM sys_user WHERE username = ? LIMIT 1', [username]);
    const passwordHash = hashPassword(password);
    if (existingRows.length === 0) {
      await db.execute(
        `INSERT INTO sys_user
          (portal_type, username, password, real_name, home_path, dept_name, remark, status)
         VALUES ('client', ?, ?, '总负责人', '/dashboard/workspace', '总负责人', '方案 C 初始账号', 1)`,
        [username, passwordHash],
      );
    } else {
      await db.execute(
        `UPDATE sys_user
         SET portal_type = 'client', password = ?, real_name = '总负责人', home_path = '/dashboard/workspace',
             dept_name = '总负责人', remark = '方案 C 初始账号', status = 1
         WHERE username = ?`,
        [passwordHash, username],
      );
    }

    const [users] = await db.execute('SELECT id FROM sys_user WHERE username = ? LIMIT 1', [username]);
    const userId = users[0].id;
    const [roles] = await db.execute(
      "SELECT id FROM sys_role WHERE app_code = 'kjqb' AND portal_type = 'client' AND code = 'global_leader' LIMIT 1",
    );
    await db.execute(
      `INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`,
      [userId, roles[0].id],
    );
    await db.execute(
      `INSERT INTO sys_user_app (user_id, app_code, portal_type, home_path, is_default, status)
       VALUES (?, 'kjqb', 'client', '/dashboard/workspace', 1, 1)
       ON DUPLICATE KEY UPDATE home_path = VALUES(home_path), is_default = 1, status = 1`,
      [userId],
    );

    // 关闭旧管理端账号，避免继续使用已下线的管理端入口。
    await db.execute(
      "UPDATE sys_user SET status = 0 WHERE username IN ('admin', 'lx1234') AND username <> ?",
      [username],
    );
    await db.execute(
      "UPDATE sys_user_app SET status = 0 WHERE portal_type = 'admin' AND user_id IN (SELECT id FROM sys_user WHERE username IN ('admin', 'lx1234'))",
    );

    console.log(JSON.stringify({ username, password, role: 'global_leader', portal: 'client', userId: String(userId) }, null, 2));
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
