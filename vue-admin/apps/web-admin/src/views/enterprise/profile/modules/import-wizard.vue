<script setup lang="ts">
import type {
  EnterpriseImportConfirmPayload,
  EnterpriseImportPreviewPerson,
  EnterpriseImportPreviewResponse,
  EnterpriseImportSearchItem,
} from '#/api';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Spin,
  Tag,
} from 'antdv-next';

import {
  confirmEnterpriseImportApi,
  previewEnterpriseImportApi,
  searchEnterpriseImportApi,
} from '#/api';
import {
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';

const emit = defineEmits<{
  success: [enterpriseId: string];
}>();

const step = ref<1 | 2 | 3>(1);
const keyword = ref('');
const searching = ref(false);
const previewLoading = ref(false);
const confirming = ref(false);
const searchResults = ref<EnterpriseImportSearchItem[]>([]);
const previewData = ref<EnterpriseImportPreviewResponse>();
const selectedExternalId = ref<string>();
const selectedPersonIds = ref<string[]>([]);

const legalPersonIds = computed(() =>
  (previewData.value?.persons ?? [])
    .filter((item) => item.isLegalPerson)
    .map((item) => item.id),
);

const selectedPersonIdSet = computed(() => new Set(selectedPersonIds.value));

const selectedUserCount = computed(
  () =>
    (previewData.value?.persons ?? []).filter(
      (item) => !item.isLegalPerson && selectedPersonIdSet.value.has(item.id),
    ).length,
);

const ownerWillCreate = computed(() => {
  const legalPerson = (previewData.value?.persons ?? []).find(
    (item) => item.isLegalPerson,
  );
  return legalPerson ? !legalPerson.accountCreated : false;
});

const stepTitle = computed(() => {
  if (step.value === 1) {
    return '企业检索';
  }
  if (step.value === 2) {
    return '导入预览';
  }
  return '确认导入';
});

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (isOpen) {
      resetState();
    }
  },
});

async function handleSearch() {
  const normalizedKeyword = keyword.value.trim();
  if (!normalizedKeyword) {
    showActionFailure(new Error('请输入企业名称'));
    return;
  }

  searching.value = true;
  try {
    const response = await searchEnterpriseImportApi(normalizedKeyword);
    searchResults.value = response.items;
  } catch (error) {
    showActionFailure(error);
  } finally {
    searching.value = false;
  }
}

async function handleSelectEnterprise(item: EnterpriseImportSearchItem) {
  previewLoading.value = true;
  try {
    const response = await previewEnterpriseImportApi(item.externalId);
    selectedExternalId.value = item.externalId;
    previewData.value = response;
    selectedPersonIds.value = response.persons
      .filter((person) => person.selectedByDefault)
      .map((person) => person.id);
    ensureLegalPersonSelected();
    step.value = 2;
  } catch (error) {
    showActionFailure(error);
  } finally {
    previewLoading.value = false;
  }
}

function handleTogglePerson(person: EnterpriseImportPreviewPerson, checked: boolean) {
  if (person.isLegalPerson) {
    return;
  }

  const nextSelected = new Set(selectedPersonIds.value);
  if (checked) {
    nextSelected.add(person.id);
  } else {
    nextSelected.delete(person.id);
  }
  selectedPersonIds.value = Array.from(nextSelected);
  ensureLegalPersonSelected();
}

function ensureLegalPersonSelected() {
  const nextSelected = new Set(selectedPersonIds.value);
  for (const legalPersonId of legalPersonIds.value) {
    nextSelected.add(legalPersonId);
  }
  selectedPersonIds.value = Array.from(nextSelected);
}

function goPrevStep() {
  if (step.value === 1) {
    drawerApi.close();
    return;
  }
  step.value = step.value === 3 ? 2 : 1;
}

function goNextStep() {
  if (!previewData.value) {
    return;
  }
  if (step.value === 2) {
    step.value = 3;
  }
}

async function handleConfirmImport() {
  if (!selectedExternalId.value) {
    showActionFailure(new Error('请选择要导入的企业'));
    return;
  }

  confirming.value = true;
  try {
    const payload: EnterpriseImportConfirmPayload = {
      createAccounts: true,
      defaultPassword: '123456',
      externalId: selectedExternalId.value,
      selectedPersonIds: selectedPersonIds.value,
    };
    const response = await confirmEnterpriseImportApi(payload);
    showActionSuccess(response.message);
    emit('success', response.enterpriseId);
    drawerApi.close();
  } catch (error) {
    showActionFailure(error);
  } finally {
    confirming.value = false;
  }
}

function resetState() {
  step.value = 1;
  keyword.value = '';
  searching.value = false;
  previewLoading.value = false;
  confirming.value = false;
  searchResults.value = [];
  previewData.value = undefined;
  selectedExternalId.value = undefined;
  selectedPersonIds.value = [];
}
</script>

<template>
  <Drawer class="w-full max-w-260" :footer="false" :title="`新增企业 - ${stepTitle}`">
    <div class="space-y-4 px-4 pb-6 pt-2">
      <div class="flex flex-wrap gap-2">
        <Tag :color="step === 1 ? 'blue' : 'default'">1. 企业检索</Tag>
        <Tag :color="step === 2 ? 'blue' : 'default'">2. 导入预览</Tag>
        <Tag :color="step === 3 ? 'blue' : 'default'">3. 确认导入</Tag>
      </div>

      <template v-if="step === 1">
        <Alert
          message="管理员只需输入公司名称，后端会调用天眼查检索候选企业。"
          show-icon
          type="info"
        />
        <div class="flex gap-3">
          <Input
            v-model:value="keyword"
            placeholder="请输入公司名称"
            @press-enter="handleSearch"
          />
          <Button :loading="searching" type="primary" @click="handleSearch">
            搜索
          </Button>
        </div>

        <Spin :spinning="searching">
          <Empty v-if="!searchResults.length" description="暂无候选企业" />
          <div v-else class="space-y-3">
            <div
              v-for="item in searchResults"
              :key="item.externalId"
              class="rounded-lg border border-border bg-background px-4 py-4"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="space-y-2">
                  <div class="text-base font-medium text-foreground">
                    {{ item.name }}
                  </div>
                  <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Tag>{{ item.creditCode || '无统一社会信用代码' }}</Tag>
                    <Tag>{{ item.legalPerson || '无法人信息' }}</Tag>
                    <Tag>{{ item.regStatus || '状态未知' }}</Tag>
                    <Tag>{{ item.establishTime || '成立时间未知' }}</Tag>
                  </div>
                  <div class="text-sm text-muted-foreground">
                    {{ item.address || '暂无注册地址' }}
                  </div>
                </div>
                <Button type="primary" @click="handleSelectEnterprise(item)">
                  选择并预览
                </Button>
              </div>
            </div>
          </div>
        </Spin>
      </template>

      <template v-else-if="step === 2">
        <Spin :spinning="previewLoading">
          <Alert
            v-if="previewData?.existingEnterprise"
            :message="`该企业已存在：${previewData.existingEnterprise.name}`"
            description="继续导入会同步企业资料和人员信息，不会重复创建企业与账号。"
            show-icon
            type="warning"
          />

          <div class="rounded-lg border border-border bg-background px-4 py-4">
            <div class="mb-3 text-base font-medium text-foreground">企业基本信息</div>
            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <div class="text-xs text-muted-foreground">企业名称</div>
                <div class="text-sm text-foreground">
                  {{ previewData?.enterprise.name || '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">统一社会信用代码</div>
                <div class="text-sm text-foreground">
                  {{ previewData?.enterprise.creditCode || '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">法定代表人</div>
                <div class="text-sm text-foreground">
                  {{ previewData?.enterprise.legalPerson || '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">经营状态</div>
                <div class="text-sm text-foreground">
                  {{ previewData?.enterprise.regStatus || '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">成立日期</div>
                <div class="text-sm text-foreground">
                  {{ previewData?.enterprise.establishTime || '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">企业类型</div>
                <div class="text-sm text-foreground">
                  {{ previewData?.enterprise.companyOrgType || '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">联系电话</div>
                <div class="text-sm text-foreground">
                  {{ previewData?.enterprise.phoneNumber || '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">邮箱</div>
                <div class="text-sm text-foreground">
                  {{ previewData?.enterprise.email || '-' }}
                </div>
              </div>
              <div class="md:col-span-2">
                <div class="text-xs text-muted-foreground">注册地址</div>
                <div class="text-sm text-foreground">
                  {{ previewData?.enterprise.regLocation || previewData?.enterprise.address || '-' }}
                </div>
              </div>
              <div class="md:col-span-2">
                <div class="text-xs text-muted-foreground">经营范围</div>
                <div class="text-sm text-foreground">
                  {{ previewData?.enterprise.businessScope || '-' }}
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-border bg-background px-4 py-4">
            <div class="mb-3 text-base font-medium text-foreground">主要人员与账号创建</div>
            <div class="space-y-3">
              <div
                v-for="person in previewData?.persons ?? []"
                :key="person.id"
                class="flex items-start justify-between gap-4 rounded-lg border border-dashed border-border px-3 py-3"
              >
                <div class="space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-medium text-foreground">
                      {{ person.name }}
                    </span>
                    <Tag v-if="person.isLegalPerson" color="gold">法人</Tag>
                    <Tag>{{ person.position || person.personType }}</Tag>
                    <Tag v-if="person.accountCreated" color="green">已有账号</Tag>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ person.phone || '-' }} / {{ person.email || '-' }}
                  </div>
                </div>
                <Checkbox
                  :checked="selectedPersonIdSet.has(person.id)"
                  :disabled="person.isLegalPerson"
                  @update:checked="(checked) => handleTogglePerson(person, checked)"
                >
                  {{ person.isLegalPerson ? '负责人账号必创建' : '创建企业用户账号' }}
                </Checkbox>
              </div>
            </div>
          </div>
        </Spin>
      </template>

      <template v-else>
        <Alert
          message="确认后将写入企业资料、企业基本信息、企业主要人员，并自动创建账号。"
          show-icon
          type="info"
        />
        <div class="rounded-lg border border-border bg-background px-4 py-4 text-sm text-foreground">
          <div class="flex justify-between py-2">
            <span>企业名称</span>
            <span>{{ previewData?.enterprise.name || '-' }}</span>
          </div>
          <div class="flex justify-between py-2">
            <span>负责人账号</span>
            <span>{{ ownerWillCreate ? '创建 1 个' : '已存在，不重复创建' }}</span>
          </div>
          <div class="flex justify-between py-2">
            <span>企业用户账号</span>
            <span>创建 {{ selectedUserCount }} 个</span>
          </div>
          <div class="flex justify-between py-2">
            <span>默认密码</span>
            <span>123456</span>
          </div>
          <div class="flex justify-between py-2">
            <span>手机号规则</span>
            <span>允许重复，仅作联系方式</span>
          </div>
        </div>
      </template>

      <div class="flex justify-end gap-3 border-t border-border pt-4">
        <Button @click="goPrevStep">
          {{ step === 1 ? '关闭' : '上一步' }}
        </Button>
        <Button
          v-if="step === 2"
          :disabled="!previewData"
          type="primary"
          @click="goNextStep"
        >
          下一步
        </Button>
        <Button
          v-if="step === 3"
          :loading="confirming"
          type="primary"
          @click="handleConfirmImport"
        >
          确认导入
        </Button>
      </div>
    </div>
  </Drawer>
</template>
