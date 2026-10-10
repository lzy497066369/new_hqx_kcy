<script setup lang="ts">
const props = defineProps<{
  fields: string[][];
  rows: Record<string, string>[];
  disabled?: boolean;
  readonly?: boolean;
  title: string;
  numeric?: string[];
  removable?: boolean;
}>();
const emit = defineEmits<{
  remove: [row: Record<string, string>];
  change: [];
}>();
function edit(row: Record<string, string>, key: string, event: Event) {
  row[key] = (event.target as HTMLInputElement).value;
  emit('change');
}
</script>
<template>
  <div class="mw-table-scroll">
    <table class="mw-table" :aria-label="title">
      <thead>
        <tr>
          <th v-for="field in fields" :key="field[0]">{{ field[1] }}</th>
          <th v-if="removable">操作</th>
          <th v-if="$slots.actions">材料制作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.id || index">
          <td v-for="field in fields" :key="field[0]">
            <template v-if="readonly">{{ row[field[0]!] || '—' }}</template>
            <input
              v-else
              :aria-label="`${title}第${index + 1}行${field[1]}`"
              :value="row[field[0]!] || ''"
              :type="numeric?.includes(field[0]!) ? 'number' : 'text'"
              :min="numeric?.includes(field[0]!) ? 0 : undefined"
              step="any"
              :disabled="disabled"
              maxlength="5000"
              @input="edit(row, field[0]!, $event)"
            />
          </td>
          <td v-if="removable">
            <button
              type="button"
              class="mw-danger"
              :disabled="disabled"
              @click="emit('remove', row)"
            >
              删除
            </button>
          </td>
          <td v-if="$slots.actions"><slot name="actions" :row="row" /></td>
        </tr>
        <tr v-if="!rows.length">
          <td
            :colspan="
              fields.length + (removable ? 1 : 0) + ($slots.actions ? 1 : 0)
            "
            class="mw-empty"
          >
            暂无{{ title }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
