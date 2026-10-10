<script setup lang="ts">
import { HR_OVERVIEW_ROWS, HR_STRUCTURE_GROUPS } from './catalog';

const props = defineProps<{
  values: Record<string, string>;
  disabled?: boolean;
}>();

function update(key: string, event: Event) {
  props.values[key] = (event.target as HTMLInputElement).value;
}
</script>

<template>
  <div
    class="mw-table-scroll mw-hr-scroll"
    role="region"
    aria-label="人力资源情况表，可横向滚动"
    tabindex="0"
  >
    <table class="mw-table mw-hr-table mw-hr-overview" aria-label="总体情况">
      <colgroup>
        <col class="mw-hr-overview-label" />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th colspan="3" class="mw-hr-section" scope="colgroup">
            一、总体情况
          </th>
        </tr>
        <tr>
          <th scope="col">人员类别</th>
          <th scope="col">企业职工</th>
          <th scope="col">科技人员</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in HR_OVERVIEW_ROWS" :key="row.employeeKey">
          <th scope="row">{{ row.label }}</th>
          <td>
            <input
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              :value="values[row.employeeKey] ?? ''"
              :aria-label="`企业职工：${row.label}`"
              :disabled="disabled"
              @input="update(row.employeeKey, $event)"
            />
          </td>
          <td>
            <input
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              :value="values[row.techKey] ?? ''"
              :aria-label="`科技人员：${row.label}`"
              :disabled="disabled"
              @input="update(row.techKey, $event)"
            />
          </td>
        </tr>
      </tbody>
    </table>
    <table
      class="mw-table mw-hr-table mw-hr-structure"
      aria-label="全体人员结构"
    >
      <colgroup>
        <col class="mw-hr-structure-label" />
        <col span="4" />
      </colgroup>
      <thead>
        <tr>
          <th colspan="5" class="mw-hr-section" scope="colgroup">
            二、全体人员结构
          </th>
        </tr>
      </thead>
      <tbody v-for="group in HR_STRUCTURE_GROUPS" :key="group.label">
        <tr>
          <th scope="row">{{ group.label }}</th>
          <th v-for="field in group.fields" :key="field.key" scope="col">
            {{ field.label }}
          </th>
        </tr>
        <tr>
          <th scope="row">人数</th>
          <td v-for="field in group.fields" :key="field.key">
            <input
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              :value="values[field.key] ?? ''"
              :aria-label="`${group.label}：${field.label}人数`"
              :disabled="disabled"
              @input="update(field.key, $event)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
