<script setup lang="ts">
import type {
  FlowNode,
  FlowNodeRole,
  FlowNodeType,
  FlowTemplate,
  FlowTimeRule,
} from './declaration-scheme-types';

import { computed, shallowRef } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { Button, DatePicker, Input, Select, Tooltip } from 'antdv-next';
import dayjs from 'dayjs';

const props = defineProps<{
  modelValue: FlowTemplate;
  qualificationOptions?: Array<{ label: string; value: string }>;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: FlowTemplate] }>();

const nodes = computed(() => props.modelValue.nodes ?? []);
const selectedIndex = shallowRef(0);
const selectedNode = computed(() => nodes.value[selectedIndex.value]);

const typeOptions = [
  { label: '时间自动流转', value: 'auto' },
  { label: '流程结束', value: 'end' },
];
const roleOptions = [
  { label: '系统自动', value: '' },
  { label: '企业处理', value: 'enterprise' },
  { label: '顾问审核', value: 'consultant' },
];
function update(next: FlowNode[]) {
  emit('update:modelValue', { nodes: next.map((node) => ({ ...node })) });
}

function addNode() {
  selectedIndex.value = nodes.value.length;
  update([
    ...nodes.value,
    {
      code: `node_${nodes.value.length + 1}`,
      description: '',
      name: '新流程节点',
      role: 'enterprise',
      timeRule: { mode: 'date_range' },
      type: 'auto',
    },
  ]);
}

function removeNode(index: number) {
  const next = nodes.value.filter((_, itemIndex) => itemIndex !== index);
  selectedIndex.value = Math.min(selectedIndex.value, Math.max(next.length - 1, 0));
  update(next);
}

function moveNode(index: number, offset: -1 | 1) {
  const target = index + offset;
  if (target < 0 || target >= nodes.value.length) return;
  const next = nodes.value.map((item) => ({ ...item }));
  const current = next[index];
  const destination = next[target];
  if (!current || !destination) return;
  next[index] = destination;
  next[target] = current;
  selectedIndex.value = target;
  update(next);
}

function updateNode<K extends keyof FlowNode>(index: number, field: K, value: FlowNode[K]) {
  update(nodes.value.map((node, itemIndex) =>
    itemIndex === index ? { ...node, [field]: value } : node,
  ));
}

function updateSelectedNode<K extends keyof FlowNode>(field: K, value: FlowNode[K]) {
  updateNode(selectedIndex.value, field, value);
}

function updateTimeRule<K extends keyof FlowTimeRule>(field: K, value: FlowTimeRule[K]) {
  const index = selectedIndex.value;
  update(nodes.value.map((node, itemIndex) => itemIndex === index
    ? { ...node, timeRule: { ...node.timeRule, mode: 'date_range', [field]: value } }
    : node));
}

function toDateValue(value?: string) {
  return value ? dayjs(value) : null;
}

function updateDateRange(field: 'startDate' | 'endDate', value: unknown) {
  const date = value && typeof (value as { format?: unknown }).format === 'function'
    ? (value as { format: (format: string) => string }).format('YYYY-MM-DDTHH:mm:ss')
    : undefined;
  updateTimeRule(field, date);
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <div class="font-medium text-gray-900">流程模板</div>
      <p class="mt-1 text-xs text-gray-500">每个节点均配置固定开始日期和截止日期；日期可重叠，重叠节点会同时开启并在各自截止时自动完成，角色仅用于接收提醒。</p>
    </div>

    <div v-if="nodes.length" class="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div class="space-y-2">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500">流程节点</div>
        <div
          v-for="(node, index) in nodes"
          :key="`${index}-${node.code}`"
          :class="[
            'rounded border p-3 transition-colors',
            index === selectedIndex ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white',
          ]"
          @click="selectedIndex = index"
        >
          <div class="flex items-start gap-2">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
              {{ index + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-gray-900">{{ node.name || '未命名节点' }}</div>
              <div class="mt-1 text-xs text-gray-500">{{ node.code || '未设置编码' }}</div>
            </div>
            <div class="flex shrink-0 gap-1">
              <Tooltip title="上移节点">
                <Button :disabled="index === 0" shape="circle" size="small" @click.stop="moveNode(index, -1)">
                  <IconifyIcon icon="lucide:arrow-up" />
                </Button>
              </Tooltip>
              <Tooltip title="下移节点">
                <Button :disabled="index === nodes.length - 1" shape="circle" size="small" @click.stop="moveNode(index, 1)">
                  <IconifyIcon icon="lucide:arrow-down" />
                </Button>
              </Tooltip>
              <Tooltip title="移除节点">
                <Button danger shape="circle" size="small" @click.stop="removeNode(index)">
                  <IconifyIcon icon="lucide:trash-2" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
        <Button block type="dashed" @click="addNode">
          <IconifyIcon icon="lucide:plus" class="mr-1" />
          添加流程节点
        </Button>
      </div>

      <div v-if="selectedNode" class="space-y-5 rounded border border-gray-200 bg-white p-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <div class="font-medium text-gray-900">节点详情</div>
            <div class="mt-1 text-xs text-gray-500">第 {{ selectedIndex + 1 }} 个节点</div>
          </div>
          <Button danger type="text" @click="removeNode(selectedIndex)">删除节点</Button>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <div class="mb-1 text-xs text-gray-500">节点编码</div>
            <Input :value="selectedNode.code" placeholder="节点编码" @update:value="updateSelectedNode('code', $event)" />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">节点名称</div>
            <Input :value="selectedNode.name" placeholder="节点名称" @update:value="updateSelectedNode('name', $event)" />
          </div>
          <div class="md:col-span-2">
            <div class="mb-1 text-xs text-gray-500">节点介绍</div>
            <Input :value="selectedNode.description" placeholder="说明本节点的办理内容和交付要求" @update:value="updateSelectedNode('description', $event)" />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">节点类型</div>
            <Select class="w-full" :options="typeOptions" :value="selectedNode.type" @update:value="updateSelectedNode('type', $event as FlowNodeType)" />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">处理角色</div>
            <Select class="w-full" :options="roleOptions" :value="selectedNode.role ?? ''" @update:value="updateSelectedNode('role', $event as FlowNodeRole)" />
          </div>
        </div>

        <div class="border-t border-gray-100 pt-4">
          <div class="mb-3 font-medium text-gray-900">自动流转时间</div>
          <div class="grid gap-3 md:grid-cols-2">
            <div>
              <div class="mb-1 text-xs text-gray-500">开始时间</div>
              <DatePicker show-time class="w-full" :value="toDateValue(selectedNode.timeRule?.startDate)" @update:value="updateDateRange('startDate', $event)" />
            </div>
            <div>
              <div class="mb-1 text-xs text-gray-500">结束时间</div>
              <DatePicker show-time class="w-full" :value="toDateValue(selectedNode.timeRule?.endDate)" @update:value="updateDateRange('endDate', $event)" />
            </div>
          </div>
        </div>

        <div class="border-t border-gray-100 pt-4">
          <div class="mb-3 font-medium text-gray-900">节点数据准入条件</div>
          <Select
            class="w-full"
            mode="multiple"
            :options="props.qualificationOptions"
            :value="selectedNode.qualificationPresetIds ?? []"
            placeholder="选择一个或多个准入条件预设"
            @update:value="updateSelectedNode('qualificationPresetIds', $event as string[])"
          />
        </div>

      </div>
    </div>

    <div v-else class="border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500">
      尚未配置流程节点。
      <Button class="ml-2" size="small" type="dashed" @click="addNode">添加第一个节点</Button>
    </div>
  </div>
</template>
