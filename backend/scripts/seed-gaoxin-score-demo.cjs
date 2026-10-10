const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const demo = {
  code: 'DEMO_GAOXIN_SCORE_20260716',
  creditCode: 'DEMO-GX-20260716-001',
  declarationNo: 'DEMO-GX-20260716-001',
  name: '高企评分演示企业（请勿用于申报）',
};

function readEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(path.resolve(__dirname, '../.env'), 'utf8')
      .split(/\r?\n/u)
      .filter((line) => line && !line.trim().startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

async function seed() {
  const env = readEnv();
  const connection = await mysql.createConnection({
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT),
    user: env.DB_USERNAME,
  });

  await connection.beginTransaction();
  try {
    const [existing] = await connection.query(
      'SELECT id FROM biz_enterprise WHERE code = ? OR credit_code = ? LIMIT 1',
      [demo.code, demo.creditCode],
    );
    if (existing.length > 0) {
      throw new Error('高企评分演示企业已存在，请勿重复创建');
    }

    const [projects] = await connection.query(
      "SELECT id, name FROM biz_policy_project WHERE policy_type = '高新技术企业' ORDER BY id ASC LIMIT 1",
    );
    if (projects.length === 0) {
      throw new Error('未找到高新技术企业项目，已取消写入');
    }

    const [enterpriseResult] = await connection.query(
      `INSERT INTO biz_enterprise (
        code, name, short_name, credit_code, legal_person, contact_name,
        contact_phone, contact_email, industry, enterprise_type, province,
        city, district, address, profile_status, status, source, remark
      ) VALUES (?, ?, '高企评分演示', ?, '演示负责人', '演示联系人',
        '13800000000', 'demo-gaoxin@example.test', '软件和信息技术服务业',
        '有限责任公司', '浙江省', '杭州市', '滨江区', '杭州市滨江区演示路1号',
        'completed', 1, 'demo_seed', '高企评分演示数据，请勿用于真实申报')`,
      [demo.code, demo.name, demo.creditCode],
    );
    const enterpriseId = enterpriseResult.insertId;

    await connection.query(
      `INSERT INTO biz_enterprise_basic_info (
        enterprise_id, name, alias, legal_person_name, credit_code,
        establish_time, reg_location, business_scope, industry, province,
        city, district, email, phone_number, reg_status
      ) VALUES (?, ?, '高企评分演示', '演示负责人', ?, '2020-01-01',
        '杭州市滨江区演示路1号', '软件产品研发、技术服务和技术咨询',
        '软件和信息技术服务业', '浙江省', '杭州市', '滨江区',
        'demo-gaoxin@example.test', '13800000000', '存续')`,
      [enterpriseId, demo.name, demo.creditCode],
    );

    const snapshot = JSON.stringify({
      scheme: { capabilities: { exportPackage: false, gaoxinScore: true, score: true } },
    });
    const [declarationResult] = await connection.query(
      `INSERT INTO biz_client_declaration (
        declaration_no, enterprise_id, enterprise_name, project_id, project_name,
        policy_type, status, current_node_name, progress, missing_material_count,
        snapshot_json, scheme_version
      ) VALUES (?, ?, ?, ?, ?, '高新技术企业认定', 'draft',
        '资料准备', 40, 0, ?, 'demo-v1')`,
      [
        demo.declarationNo,
        enterpriseId,
        demo.name,
        projects[0].id,
        projects[0].name,
        snapshot,
      ],
    );

    const [ipResult] = await connection.query(
      `INSERT INTO biz_enterprise_property_record (
        enterprise_id, record_type, ip_code, soft_work_name, soft_work_type,
        soft_work_status, soft_work_num, apply_date, authorize_date, obtain_method,
        inventor, ip_level, right_holder, is_core_ip, advanced_degree,
        support_effect, remark, status
      ) VALUES (?, 'intellectual_property', 'IP-DEMO-001',
        '智能数据分析平台核心算法', 1, 2, 'ZLDEMO20260001', '2023-01-10',
        '2024-03-15', '自主研发', '演示研发团队', 'I类', ?, 1,
        '国内领先的智能分析算法', '对主要产品/服务提供核心支持',
        '参与编制国家标准（演示证明）', 1)`,
      [enterpriseId, demo.name],
    );
    const ipId = ipResult.insertId;

    const [rdResult] = await connection.query(
      `INSERT INTO biz_enterprise_property_record (
        enterprise_id, record_type, ky_project_num, ky_project_name, init_date,
        end_date, ky_project_leader, rd_organization_method, core_technology,
        innovation_points, status
      ) VALUES (?, 'research_project', 'RD-DEMO-001', '智能数据分析平台研发项目',
        '2023-01-01', '2025-12-31', '演示研发负责人', '自主研发组织实施',
        '智能数据处理与分析', '多源数据智能融合', 1)`,
      [enterpriseId],
    );
    const rdId = rdResult.insertId;

    const [psResult] = await connection.query(
      `INSERT INTO biz_enterprise_property_record (
        enterprise_id, record_type, ps_code, ps_name, tech_field,
        high_tech_income, tech_description, status
      ) VALUES (?, 'product_service', 'PS-DEMO-001', '智能数据分析平台',
        '电子信息', '1960', '面向企业数据分析与决策的智能软件平台', 1)`,
      [enterpriseId],
    );
    const psId = psResult.insertId;

    for (const [year, revenue, rdExpense] of [
      ['2023', '1000', '100'],
      ['2024', '1400', '140'],
      ['2025', '1960', '196'],
    ]) {
      await connection.query(
        `INSERT INTO biz_enterprise_finance_record (
          enterprise_id, record_type, year, xxsr, zxc, net_assets, fz, yffy,
          high_tech_income, status, remark
        ) VALUES (?, 'financial', ?, ?, ?, ?, '0', ?, ?, 1,
          '高企评分演示财务数据')`,
        [enterpriseId, year, revenue, revenue, revenue, rdExpense, revenue],
      );
    }

    for (const [fileTitle, fileRemark] of [
      ['研发组织管理制度及研发投入核算与辅助账', '研发组织管理、研发投入核算体系、研发费用辅助账演示资料'],
      ['研发机构、科研条件与产学研合作管理办法', '内部研发机构、科研条件和产学研合作演示资料'],
      ['科技成果转化组织实施及激励奖励制度', '成果转化组织实施、激励奖励和创新创业平台演示资料'],
      ['科技人员培养、职工技能培训、人才引进与绩效奖励制度', '科技人员培养进修、职工技能培训、人才引进和绩效奖励演示资料'],
    ]) {
      await connection.query(
        `INSERT INTO biz_enterprise_document_record (
          enterprise_id, file_title, file_class, file_status, file_version,
          file_start_date, file_remark, status
        ) VALUES (?, ?, 1, 1, 'v1.0', '2023-01-01', ?, 1)`,
        [enterpriseId, fileTitle, fileRemark],
      );
    }

    for (const year of [2023, 2024, 2025]) {
      for (let index = 1; index <= 5; index += 1) {
        await connection.query(
          `INSERT INTO biz_enterprise_property_record (
            enterprise_id, record_type, transformation_code, transformation_name,
            transformation_year, transformation_method, transformation_income,
            customer_name, application_scene, proof_files, related_ip_ids,
            related_rd_ids, related_ps_ids, remark, status
          ) VALUES (?, 'transformation', ?, ?, ?, '自行投资实施转化', '120',
            '演示客户', '智能数据分析平台应用', 'demo-proof.pdf', ?, ?, ?,
            '高企评分演示成果转化资料', 1)`,
          [
            enterpriseId,
            `CG-DEMO-${year}-${String(index).padStart(2, '0')}`,
            `智能数据分析技术成果转化-${year}-${index}`,
            String(year),
            JSON.stringify([ipId]),
            JSON.stringify([rdId]),
            JSON.stringify([psId]),
          ],
        );
      }
    }

    await connection.commit();
    console.log(JSON.stringify({
      declarationId: String(declarationResult.insertId),
      enterpriseId: String(enterpriseId),
      enterpriseName: demo.name,
      ipCount: 1,
      transformationCount: 15,
    }));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

seed().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
