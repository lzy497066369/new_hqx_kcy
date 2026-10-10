<script setup lang="ts">
import { Page } from '@vben/common-ui';

import { computed } from 'vue';

import { Tag } from 'antdv-next';

import { enterpriseMetricCatalog } from '../project/modules/enterprise-metric-catalog';

defineOptions({ name: 'PolicyEnterpriseMetricCatalog' });

const groupedFields = computed(() => {
  const groups = new Map<string, typeof enterpriseMetricCatalog>();
  for (const field of enterpriseMetricCatalog) {
    const group = groups.get(field.source) ?? [];
    group.push(field);
    groups.set(field.source, group);
  }
  return [...groups.entries()].map(([source, fields]) => ({ source, fields }));
});

function valueTypeLabel(valueType: 'boolean' | 'number') {
  return valueType === 'boolean' ? '是/否判断' : '数值比较';
}
</script>

<template>
  <Page auto-content-height>
    <div class="enterprise-field-directory">
      <section class="enterprise-field-directory__header">
        <div>
          <div class="enterprise-field-directory__eyebrow">系统固定字段</div>
          <h1>企业指标字段目录</h1>
          <p>这里定义规则可选择的企业资料字段。字段由系统固定取数，不能在此新增或修改。</p>
        </div>
        <div class="enterprise-field-directory__summary">
          <strong>{{ enterpriseMetricCatalog.length }}</strong>
          <span>个可用字段</span>
        </div>
      </section>

      <section class="enterprise-field-directory__notice">
        <div class="enterprise-field-directory__notice-icon">i</div>
        <div>
          <strong>字段取值由企业资料自动计算</strong>
          <p>数值字段按标注单位配置阈值；是/否字段仅需选择“是”或“否”，系统按企业资料自动判断。</p>
        </div>
      </section>

      <section
        v-for="group in groupedFields"
        :key="group.source"
        class="enterprise-field-directory__group"
      >
        <div class="enterprise-field-directory__group-heading">
          <h2>{{ group.source }}</h2>
          <span>{{ group.fields.length }} 个字段</span>
        </div>
        <div class="enterprise-field-directory__fields">
          <article
            v-for="field in group.fields"
            :key="field.key"
            class="enterprise-field-directory__field"
          >
            <div class="enterprise-field-directory__field-main">
              <strong>{{ field.label }}</strong>
              <code>{{ field.key }}</code>
            </div>
            <div class="enterprise-field-directory__field-meta">
              <Tag :color="field.valueType === 'number' ? 'blue' : 'cyan'">
                {{ valueTypeLabel(field.valueType) }}
              </Tag>
              <span>取值单位：{{ field.unit }}</span>
            </div>
          </article>
        </div>
      </section>
    </div>
  </Page>
</template>

<style scoped>
.enterprise-field-directory {
  min-height: 100%;
  padding: 24px;
  background: #f6f8fb;
}

.enterprise-field-directory__header {
  display: flex;
  gap: 24px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 4px 0 20px;
  border-bottom: 1px solid #dfe5ec;
}

.enterprise-field-directory__eyebrow {
  margin-bottom: 7px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 600;
}

.enterprise-field-directory h1,
.enterprise-field-directory h2,
.enterprise-field-directory p {
  margin: 0;
}

.enterprise-field-directory h1 {
  color: #172033;
  font-size: 24px;
  font-weight: 650;
}

.enterprise-field-directory__header p {
  margin-top: 8px;
  color: #667085;
  font-size: 14px;
}

.enterprise-field-directory__summary {
  display: flex;
  gap: 8px;
  align-items: baseline;
  color: #667085;
  white-space: nowrap;
}

.enterprise-field-directory__summary strong {
  color: #0f766e;
  font-size: 28px;
  line-height: 1;
}

.enterprise-field-directory__notice {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin: 20px 0 28px;
  padding: 14px 16px;
  border-left: 3px solid #0f766e;
  background: #ecfdf5;
}

.enterprise-field-directory__notice-icon {
  display: flex;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  background: #0f766e;
  font-family: Georgia, serif;
  font-size: 12px;
  font-weight: 700;
}

.enterprise-field-directory__notice strong {
  color: #134e4a;
  font-size: 14px;
}

.enterprise-field-directory__notice p {
  margin-top: 3px;
  color: #33726b;
  font-size: 13px;
}

.enterprise-field-directory__group + .enterprise-field-directory__group {
  margin-top: 26px;
}

.enterprise-field-directory__group-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.enterprise-field-directory__group-heading h2 {
  color: #344054;
  font-size: 15px;
  font-weight: 650;
}

.enterprise-field-directory__group-heading span {
  color: #98a2b3;
  font-size: 12px;
}

.enterprise-field-directory__fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.enterprise-field-directory__field {
  display: flex;
  min-height: 106px;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px;
  border: 1px solid #e4e7ec;
  border-radius: 6px;
  background: #fff;
}

.enterprise-field-directory__field-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.enterprise-field-directory__field-main strong {
  overflow: hidden;
  color: #1d2939;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enterprise-field-directory__field code {
  overflow: hidden;
  color: #667085;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enterprise-field-directory__field-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
}

.enterprise-field-directory__field-meta span {
  color: #98a2b3;
  font-size: 12px;
}

@media (max-width: 1100px) {
  .enterprise-field-directory__fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .enterprise-field-directory {
    padding: 16px;
  }

  .enterprise-field-directory__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .enterprise-field-directory__fields {
    grid-template-columns: 1fr;
  }
}
</style>
