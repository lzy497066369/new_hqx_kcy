<script setup lang="ts">
import ClientJourneyTrail from '#/views/client/components/ClientJourneyTrail.vue';

import type { ClientEnterpriseApi } from '#/api/client';

import { onMounted, reactive, ref, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  message,
  Skeleton,
  Tag,
} from 'antdv-next';

import {
  createClientEnterpriseContactApi,
  getClientEnterpriseContactsApi,
  updateClientEnterpriseContactApi,
} from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

defineOptions({ name: 'ClientEnterpriseProfileContacts' });

const store = useClientEnterpriseStore();
const contacts = ref<ClientEnterpriseApi.ClientEnterpriseContact[]>([]);
const loadingContacts = shallowRef(false);
const saving = shallowRef(false);
const editingContactId = shallowRef('');

const form = reactive<ClientEnterpriseApi.SaveClientEnterpriseContactParams>({
  email: '',
  isDefault: false,
  name: '',
  phone: '',
  position: '',
  remark: '',
  roleName: '',
});

onMounted(async () => {
  if (!store.initialized) {
    await store.refreshContext().catch(() => {});
  }
  await loadContacts();
});

async function loadContacts() {
  if (!store.currentCompany) {
    contacts.value = [];
    return;
  }

  loadingContacts.value = true;
  try {
    contacts.value = await getClientEnterpriseContactsApi();
  } finally {
    loadingContacts.value = false;
  }
}

function resetForm() {
  editingContactId.value = '';
  form.email = '';
  form.isDefault = false;
  form.name = '';
  form.phone = '';
  form.position = '';
  form.remark = '';
  form.roleName = '';
}

function editContact(contact: ClientEnterpriseApi.ClientEnterpriseContact) {
  editingContactId.value = contact.id;
  form.email = contact.email ?? '';
  form.isDefault = Boolean(contact.isDefault);
  form.name = contact.name;
  form.phone = contact.phone ?? '';
  form.position = contact.position ?? '';
  form.remark = contact.remark ?? '';
  form.roleName = contact.roleName ?? '';
}

async function saveContact() {
  saving.value = true;
  try {
    if (editingContactId.value) {
      await updateClientEnterpriseContactApi(editingContactId.value, form);
      message.success('联系人已更新');
    } else {
      await createClientEnterpriseContactApi(form);
      message.success('联系人已新增');
    }
    resetForm();
    await loadContacts();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <ClientJourneyTrail />
    <div class="space-y-5 p-5">
      <Alert
        v-if="store.errorMessage"
        show-icon
        type="warning"
        :message="store.errorMessage"
      />

      <div class="flex flex-col gap-2">
        <div class="text-2xl font-semibold">联系人信息</div>
        <div class="text-sm text-foreground/60">
          维护当前企业负责人、经办人和常用联系方式。
        </div>
      </div>

      <Skeleton v-if="store.loading && !store.initialized" active />

      <template v-else>
        <Empty v-if="!store.currentCompany" description="请先选择当前企业" />

        <div v-else class="grid gap-4 xl:grid-cols-[1fr_420px]">
          <Card title="联系人列表" variant="borderless">
            <Skeleton v-if="loadingContacts" active />

            <Empty
              v-else-if="!contacts.length"
              description="当前企业还没有联系人"
            />

            <div v-else class="space-y-3">
              <div
                v-for="contact in contacts"
                :key="contact.id"
                class="flex flex-col gap-3 rounded-md border border-border px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium">{{ contact.name }}</span>
                    <Tag v-if="contact.isDefault" color="success">默认</Tag>
                  </div>
                  <div class="mt-1 text-sm text-foreground/60">
                    {{ contact.roleName || contact.position || '联系人' }}
                  </div>
                  <div class="mt-1 text-sm text-foreground/60">
                    {{ contact.phone || '-' }} / {{ contact.email || '-' }}
                  </div>
                </div>
                <Button @click="editContact(contact)">
                  <IconifyIcon icon="lucide:edit-3" class="size-4" />
                  编辑
                </Button>
              </div>
            </div>
          </Card>

          <Card
            :title="editingContactId ? '编辑联系人' : '新增联系人'"
            variant="borderless"
          >
            <div class="space-y-4">
              <div>
                <div class="mb-1 text-sm text-foreground/60">姓名</div>
                <Input
                  v-model:value="form.name"
                  placeholder="请输入联系人姓名"
                />
              </div>
              <div>
                <div class="mb-1 text-sm text-foreground/60">联系电话</div>
                <Input
                  v-model:value="form.phone"
                  placeholder="请输入联系电话"
                />
              </div>
              <div>
                <div class="mb-1 text-sm text-foreground/60">联系邮箱</div>
                <Input
                  v-model:value="form.email"
                  placeholder="请输入联系邮箱"
                />
              </div>
              <div>
                <div class="mb-1 text-sm text-foreground/60">职务</div>
                <Input v-model:value="form.position" placeholder="请输入职务" />
              </div>
              <div>
                <div class="mb-1 text-sm text-foreground/60">经办身份</div>
                <Input
                  v-model:value="form.roleName"
                  placeholder="例如：企业负责人、经办人"
                />
              </div>
              <Checkbox v-model:checked="form.isDefault">
                设为默认联系人
              </Checkbox>

              <div class="flex flex-wrap gap-2">
                <Button type="primary" :loading="saving" @click="saveContact">
                  <IconifyIcon icon="lucide:save" class="size-4" />
                  保存联系人
                </Button>
                <Button @click="resetForm">
                  <IconifyIcon icon="lucide:plus" class="size-4" />
                  新增
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </template>
    </div>
  </Page>
</template>
