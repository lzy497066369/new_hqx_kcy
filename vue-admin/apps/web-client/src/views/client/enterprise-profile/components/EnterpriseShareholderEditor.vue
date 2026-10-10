<script setup lang="ts">
import type { ClientEnterpriseApi } from '#/api/client';

import { computed, reactive, shallowRef } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, InputNumber, Select, Tag, message } from 'antdv-next';

defineOptions({ name: 'ClientEnterpriseShareholderEditor' });

type EditableShareholder = ClientEnterpriseApi.ClientEnterpriseShareholder;

const props = defineProps<{
  shareholders: EditableShareholder[];
}>();

const citizenTypeOptions = [
  { label: '中国公民', value: 1 },
  { label: '外籍人士', value: 2 },
  { label: '企业/其他组织', value: 3 },
];

const draft = reactive<EditableShareholder>({
  citizen_type: 1,
  id: '',
  idcard: '',
  invest_money: null,
  xname: '',
});

const editingId = shallowRef('');

const totalInvestment = computed(() =>
  props.shareholders.reduce(
    (sum, item) => sum + Number(item.invest_money || 0),
    0,
  ),
);

function resetDraft() {
  draft.citizen_type = 1;
  draft.id = '';
  draft.idcard = '';
  draft.invest_money = null;
  draft.xname = '';
  editingId.value = '';
}

function editShareholder(item: EditableShareholder) {
  draft.citizen_type = item.citizen_type ?? 1;
  draft.id = item.id || '';
  draft.idcard = item.idcard ?? '';
  draft.invest_money = item.invest_money ?? null;
  draft.xname = item.xname ?? '';
  editingId.value = item.id || '';
}

function removeShareholder(id?: string) {
  if (!id) {
    return;
  }

  const index = props.shareholders.findIndex((item) => item.id === id);

  if (index >= 0) {
    props.shareholders.splice(index, 1);
  }

  if (editingId.value === id) {
    resetDraft();
  }
}

function saveShareholder() {
  const shareholderName = draft.xname?.trim() || '';
  const shareholderIdCard = draft.idcard?.trim() || '';

  if (!shareholderName) {
    message.warning('请先填写股东姓名');
    return;
  }

  if (!shareholderIdCard) {
    message.warning('请先填写证件号码');
    return;
  }

  const nextShareholder: EditableShareholder = {
    citizen_type: draft.citizen_type ?? 1,
    id: editingId.value || `local-${Date.now()}`,
    idcard: shareholderIdCard,
    invest_money:
      draft.invest_money === null ? null : Number(draft.invest_money || 0),
    xname: shareholderName,
  };

  const index = props.shareholders.findIndex(
    (item) => item.id === editingId.value,
  );

  if (editingId.value && index >= 0) {
    props.shareholders.splice(index, 1, nextShareholder);
  } else {
    props.shareholders.push(nextShareholder);
  }

  resetDraft();
}

function getCitizenTypeLabel(value?: number | null) {
  return (
    citizenTypeOptions.find((item) => item.value === value)?.label || '未设置'
  );
}
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-[1.1fr_420px]">
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="text-sm text-foreground/60">
          共 {{ props.shareholders.length }} 位股东，累计投资额
          {{ totalInvestment.toLocaleString('zh-CN') }}
        </div>
        <Tag color="processing">本地编辑</Tag>
      </div>

      <div
        v-if="!props.shareholders.length"
        class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-foreground/60"
      >
        当前还没有股东信息，请在右侧新增。
      </div>

      <div
        v-for="item in props.shareholders"
        v-else
        :key="item.id"
        class="rounded-lg border border-border px-4 py-4"
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <div class="font-medium">{{ item.xname || '-' }}</div>
              <Tag color="default">
                {{ getCitizenTypeLabel(item.citizen_type) }}
              </Tag>
            </div>
            <div class="mt-2 text-sm text-foreground/60">
              证件号码：{{ item.idcard || '-' }}
            </div>
            <div class="mt-1 text-sm text-foreground/60">
              投资金额：{{ Number(item.invest_money || 0).toLocaleString('zh-CN') }}
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button @click="editShareholder(item)">
              <IconifyIcon icon="lucide:pencil" class="size-4" />
              编辑
            </Button>
            <Button danger @click="removeShareholder(item.id)">
              <IconifyIcon icon="lucide:trash-2" class="size-4" />
              删除
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-lg border border-border bg-background px-4 py-4">
      <div class="text-base font-semibold">
        {{ editingId ? '编辑股东' : '新增股东' }}
      </div>
      <div class="mt-4 space-y-4">
        <div>
          <div class="mb-1 text-sm text-foreground/60">股东姓名</div>
          <Input v-model:value="draft.xname" placeholder="请输入股东姓名" />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">人员类型</div>
          <Select
            v-model:value="draft.citizen_type"
            :options="citizenTypeOptions"
            placeholder="请选择人员类型"
          />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">证件号码</div>
          <Input v-model:value="draft.idcard" placeholder="请输入证件号码" />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">投资金额</div>
          <InputNumber
            v-model:value="draft.invest_money"
            :min="0"
            placeholder="请输入投资金额"
          />
        </div>
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        <Button type="primary" @click="saveShareholder">
          <IconifyIcon icon="lucide:save" class="size-4" />
          保存股东
        </Button>
        <Button @click="resetDraft">
          <IconifyIcon icon="lucide:rotate-ccw" class="size-4" />
          重置
        </Button>
      </div>
    </div>
  </div>
</template>
