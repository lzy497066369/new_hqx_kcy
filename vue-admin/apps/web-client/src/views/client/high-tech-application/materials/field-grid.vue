<script setup lang="ts">
import type { MaterialField } from './catalog';
const props = defineProps<{
  fields: MaterialField[];
  values: Record<string, string>;
  disabled?: boolean;
  prefix?: string;
  year?: number;
  readonlyKeys?: string[];
  onGenerate?: (key: string) => void;
}>();
const emit = defineEmits<{ generate: [key: string]; change: [] }>();
function label(field: MaterialField) {
  const year = /^year([123])_/.exec(field.key);
  return year && props.year
    ? `${props.year - 4 + Number(year[1])}年 ${field.label}`
    : field.label;
}
function update(key: string, event: Event) {
  props.values[key] = (event.target as HTMLInputElement).value;
  emit('change');
}
</script>
<template>
  <div class="mw-fields">
    <label
      v-for="field in fields"
      :key="field.key"
      :class="{ 'mw-wide': field.type === 'textarea' }"
    >
      <span>{{ label(field) }}</span>
      <textarea
        v-if="field.type === 'textarea'"
        :value="values[field.key] || ''"
        :aria-label="`${prefix || ''}${label(field)}`"
        :disabled="disabled"
        rows="6"
        maxlength="50000"
        @input="update(field.key, $event)"
      />
      <select
        v-else-if="field.options"
        :value="values[field.key] || ''"
        :aria-label="`${prefix || ''}${label(field)}`"
        :disabled="disabled || readonlyKeys?.includes(field.key)"
        @change="update(field.key, $event)"
      >
        <option v-if="!field.options.some((o) => o.value === '')" value="">
          请选择
        </option>
        <option
          v-for="option in field.options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <input
        v-else
        :type="field.type === 'number' ? 'number' : 'text'"
        :value="values[field.key] || ''"
        :aria-label="`${prefix || ''}${label(field)}`"
        :min="
          field.type === 'number' && !/_(net_assets|profit)$/.test(field.key)
            ? 0
            : undefined
        "
        step="any"
        :disabled="disabled || readonlyKeys?.includes(field.key)"
        maxlength="5000"
        @input="update(field.key, $event)"
      />
      <button
        v-if="field.type === 'textarea' && onGenerate"
        type="button"
        class="mw-link"
        :disabled="disabled"
        @click="emit('generate', field.key)"
      >
        AI 撰写{{ field.label }}
      </button>
    </label>
  </div>
</template>
