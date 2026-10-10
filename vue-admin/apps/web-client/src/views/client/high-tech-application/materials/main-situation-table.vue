<script setup lang="ts">
import { computed } from 'vue';
import type { MaterialField } from './catalog';
import { BOOK_FORM_SECTIONS } from './catalog';
import FieldGrid from './field-grid.vue';
import {
  MAIN_SITUATION_COLUMN_WIDTHS,
  mainSituationRows,
} from './main-situation-table';

const props = defineProps<{
  values: Record<string, string>;
  year: number;
  disabled?: boolean;
  readonlyKeys?: string[];
}>();
const fields = BOOK_FORM_SECTIONS.find(
  (section) => section.key === 'main',
)!.fields;
const fieldByKey = Object.fromEntries(
  fields.map((field) => [field.key, field]),
) as Record<string, MaterialField>;
const rows = computed(() => mainSituationRows(props.year));
</script>

<template>
  <div class="mw-main-situation">
    <FieldGrid
      class="mw-main-company"
      :fields="[fieldByKey.company_name!]"
      :values="values"
      :disabled="disabled"
      :readonly-keys="readonlyKeys"
    />
    <div
      class="mw-main-scroll"
      role="region"
      aria-label="主要情况表，可横向滚动"
      tabindex="0"
    >
      <table class="mw-main-table" aria-label="主要情况表">
        <colgroup>
          <col
            v-for="(width, index) in MAIN_SITUATION_COLUMN_WIDTHS"
            :key="index"
            :style="{ width: `${width}%` }"
          />
        </colgroup>
        <tbody>
          <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
            <component
              :is="cell.field ? 'td' : 'th'"
              v-for="(cell, cellIndex) in row"
              :key="cellIndex"
              :colspan="cell.columnSpan"
              :rowspan="cell.rowSpan"
              :scope="cell.scope"
            >
              <FieldGrid
                v-if="cell.field"
                :fields="[fieldByKey[cell.field]!]"
                :values="values"
                :year="year"
                :disabled="disabled"
                :readonly-keys="readonlyKeys"
              />
              <template v-else>{{ cell.label }}</template>
            </component>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.mw-main-company {
  margin-bottom: 18px;
}
.mw-main-scroll {
  overflow-x: auto;
  border: 1px solid var(--mw-line);
  border-radius: 8px;
}
.mw-main-table {
  width: 100%;
  min-width: 720px;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 1.65;
}
.mw-main-table th,
.mw-main-table td {
  padding: 12px 10px;
  border: 1px solid var(--mw-line);
  vertical-align: middle;
  text-align: center;
  overflow-wrap: anywhere;
}
.mw-main-table th {
  background: #f1f6fb;
  color: #334155;
  font-weight: 500;
}
.mw-main-table tr:first-child > * {
  border-top: 0;
}
.mw-main-table tr:last-child > * {
  border-bottom: 0;
}
.mw-main-table tr > :first-child {
  border-left: 0;
}
.mw-main-table tr > :last-child {
  border-right: 0;
}
.mw-main-table :deep(.mw-fields) {
  display: block;
}
.mw-main-table :deep(.mw-fields > label) {
  display: block;
  position: relative;
}
.mw-main-table :deep(.mw-fields > label > span) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.mw-main-table :deep(input),
.mw-main-table :deep(select) {
  text-align: center;
}
.mw-main-table tr:first-child :deep(input) {
  text-align: left;
}
:global(.dark .mw-main-table th) {
  background: #17243a;
  color: #dbeafe;
}
@media print {
  :global(#material-main) {
    background: #fff;
    color: #000;
    border: 0;
    border-radius: 0;
  }
  :global(#material-main > h2) {
    color: #000;
    border-color: #cbd5e1;
  }
  .mw-main-situation {
    break-inside: avoid;
    background: #fff;
    color: #000;
  }
  .mw-main-scroll {
    overflow: visible;
    border-color: #cbd5e1;
    border-radius: 0;
  }
  .mw-main-table {
    min-width: 0;
    font-size: 10pt;
  }
  .mw-main-table tr {
    break-inside: avoid;
  }
  .mw-main-table th,
  .mw-main-table td {
    border-color: #cbd5e1;
  }
  .mw-main-table td {
    background: #fff;
  }
  .mw-main-table th {
    background: #f1f6fb !important;
    color: #000 !important;
  }
  .mw-main-company :deep(label > span) {
    color: #000 !important;
  }
  .mw-main-situation :deep(input),
  .mw-main-situation :deep(select) {
    border: 0 !important;
    background: transparent !important;
    appearance: none;
    color: #000 !important;
    opacity: 1 !important;
    -webkit-text-fill-color: #000;
  }
}
</style>
