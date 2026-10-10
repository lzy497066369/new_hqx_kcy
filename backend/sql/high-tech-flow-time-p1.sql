-- 为当前已发布的国家高新技术企业流程补齐单节点时间窗口。
-- 仅更新流程预设 30 及其已发布方案 4，不触碰其他项目或方案。

UPDATE `biz_declaration_preset`
SET `payload_json` = '{"nodes":[{"code":"2026_gq_v4_1","name":"企业经营数据统计","role":"enterprise","type":"auto","description":"按实际经营期整理财务数据、科技人员和研发费用归集资料。","qualificationPresetIds":["25"],"timeRule":{"mode":"date_range","startDate":"2025-01-01T00:00:00","endDate":"2025-12-31T00:00:00"}},{"code":"2026_gq_v4_2","name":"核心知识产权梳理","role":"enterprise","type":"auto","description":"核对知识产权权属、核心支持作用及与主要产品（服务）的关联。","qualificationPresetIds":["26"],"timeRule":{"mode":"date_range","startDate":"2025-01-01T00:00:00","endDate":"2025-12-31T00:00:00"}},{"code":"2026_gq_v4_3","name":"申报材料准备","role":"enterprise","type":"auto","description":"准备人员、成果转化、合同发票、场地设备、培训等佐证材料。","qualificationPresetIds":["27"],"timeRule":{"mode":"date_range","startDate":"2025-10-01T00:00:00","endDate":"2025-12-31T00:00:00"}},{"code":"2026_gq_v4_4","name":"申报书与证据链整理","role":"consultant","type":"manual","description":"整理高企申报书、IP-RD-PS-成果转化证据链和专家评分依据。","qualificationPresetIds":["28"],"timeRule":{"mode":"date_range","startDate":"2026-01-15T00:00:00","endDate":"2026-07-01T00:00:00"}},{"code":"2026_gq_v4_5","name":"专项审计及财务附件准备","role":"consultant","type":"manual","description":"准备研发费用、高新收入等专项审计或鉴证材料，以及序时账、余额表和财务报表。","qualificationPresetIds":["29"],"timeRule":{"mode":"date_range","startDate":"2026-01-01T00:00:00","endDate":"2026-07-01T00:00:00"}},{"code":"2026_gq_v4_6","name":"线上申报与材料报送","role":"enterprise","type":"manual","description":"以企业注册地科技、财政、税务主管部门当年度通知的申报窗口和要求为准。","timeRule":{"mode":"date_range","startDate":"2026-07-01T00:00:00","endDate":"2026-09-01T00:00:00"}},{"code":"2026_gq_v4_7","name":"形式审查、专家评审与现场核查","role":"consultant","type":"manual","description":"根据主管部门通知配合补正、专家评审和现场核查。","timeRule":{"mode":"date_range","startDate":"2026-11-01T00:00:00","endDate":"2026-12-31T00:00:00"}},{"code":"2026_gq_v4_8","name":"公示与备案","role":"consultant","type":"manual","description":"跟进认定机构公示、备案及异议处理。","timeRule":{"mode":"date_range","startDate":"2026-11-01T00:00:00","endDate":"2026-12-31T00:00:00"}},{"code":"2026_gq_v4_9","name":"证书获取与后续维护","role":"enterprise","type":"end","description":"获取证书后持续维护研发、知识产权、财务和年度发展情况报表。","timeRule":{"mode":"date_range","startDate":"2027-01-01T00:00:00","endDate":"2027-12-31T00:00:00"}}]}',
    `updated_at` = NOW()
WHERE `id` = 30
  AND `preset_type` = 'flow'
  AND `status` = 'published';

UPDATE `biz_declaration_scheme` AS scheme
JOIN `biz_declaration_preset` AS preset ON preset.`id` = 30
SET scheme.`flow_template_json` = preset.`payload_json`,
    scheme.`updated_at` = NOW()
WHERE scheme.`id` = 4
  AND scheme.`project_id` = 9
  AND scheme.`status` = 'published';
