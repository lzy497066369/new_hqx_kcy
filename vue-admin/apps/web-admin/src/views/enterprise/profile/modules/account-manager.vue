<script setup lang="ts">
import type {
  EnterpriseOwnerItem,
  EnterpriseProfileItem,
  EnterpriseTeacherItem,
  EnterpriseUserItem,
} from '#/api';

import { computed, ref } from 'vue';

import { Button, Divider, Segmented } from 'antdv-next';

import { useVbenDrawer, useVbenModal } from '@vben/common-ui';

import {
  deleteEnterpriseOwnerApi,
  deleteEnterpriseTeacherApi,
  deleteEnterpriseUserApi,
  getEnterpriseOwnerDetailApi,
  getEnterpriseOwnersApi,
  getEnterpriseProfileDetailApi,
  getEnterpriseTeacherDetailApi,
  getEnterpriseTeachersApi,
  getEnterpriseUserDetailApi,
  getEnterpriseUsersApi,
  resetEnterpriseOwnerPasswordApi,
  resetEnterpriseUserPasswordApi,
} from '#/api';
import { $t } from '#/locales';
import {
  confirmAction,
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';
import OwnerDetail from '../../owner/modules/detail.vue';
import OwnerForm from '../../owner/modules/form.vue';
import TeacherForm from '../../teacher/modules/form.vue';
import UserDetail from '../../user/modules/detail.vue';
import UserForm from '../../user/modules/form.vue';

type AccountTab = 'owner' | 'teacher' | 'user';

const enterprise = ref<EnterpriseProfileItem>();
const activeTab = ref<AccountTab>('user');
const ownerRows = ref<EnterpriseOwnerItem[]>([]);
const teacherRows = ref<EnterpriseTeacherItem[]>([]);
const userRows = ref<EnterpriseUserItem[]>([]);

const [OwnerFormModal, ownerFormModalApi] = useVbenModal({
  connectedComponent: OwnerForm,
  destroyOnClose: true,
});

const [OwnerDetailDrawer, ownerDetailDrawerApi] = useVbenDrawer({
  connectedComponent: OwnerDetail,
  destroyOnClose: true,
});

const [UserFormModal, userFormModalApi] = useVbenModal({
  connectedComponent: UserForm,
  destroyOnClose: true,
});

const [UserDetailDrawer, userDetailDrawerApi] = useVbenDrawer({
  connectedComponent: UserDetail,
  destroyOnClose: true,
});

const [TeacherFormModal, teacherFormModalApi] = useVbenModal({
  connectedComponent: TeacherForm,
  destroyOnClose: true,
});

const [Drawer, drawerApi] = useVbenDrawer({
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = drawerApi.getData<EnterpriseProfileItem>();
    if (!data?.id) {
      enterprise.value = undefined;
      ownerRows.value = [];
      teacherRows.value = [];
      userRows.value = [];
      return;
    }

    enterprise.value = await getEnterpriseProfileDetailApi(data.id);
    activeTab.value = 'user';
    await refreshAccounts();
  },
});

const fixedEnterpriseId = computed(() => enterprise.value?.id);
const ownerCount = computed(() => ownerRows.value.length);
const teacherCount = computed(() => teacherRows.value.length);
const userCount = computed(() => userRows.value.length);

async function refreshAccounts() {
  if (!enterprise.value?.id) {
    ownerRows.value = [];
    teacherRows.value = [];
    userRows.value = [];
    return;
  }

  const [ownerResult, teacherResult, userResult] = await Promise.all([
    getEnterpriseOwnersApi({
      enterpriseId: enterprise.value.id,
      page: 1,
      pageSize: 100,
    }),
    getEnterpriseTeachersApi({
      enterpriseId: enterprise.value.id,
      page: 1,
      pageSize: 100,
    }),
    getEnterpriseUsersApi({
      enterpriseId: enterprise.value.id,
      page: 1,
      pageSize: 100,
    }),
  ]);

  ownerRows.value = ownerResult.items;
  teacherRows.value = teacherResult.items;
  userRows.value = userResult.items;
}

function openOwnerCreate() {
  ownerFormModalApi.setData({ enterpriseId: enterprise.value?.id }).open();
}

async function openOwnerEdit(row: EnterpriseOwnerItem) {
  try {
    ownerFormModalApi.setData(await getEnterpriseOwnerDetailApi(row.id)).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function openOwnerDetail(row: EnterpriseOwnerItem) {
  try {
    ownerDetailDrawerApi.setData(await getEnterpriseOwnerDetailApi(row.id)).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function onOwnerDelete(row: EnterpriseOwnerItem) {
  try {
    await confirmAction(
      $t('ui.actionMessage.deleteConfirm', [row.name]),
      $t('ui.actionMessage.deleteTitle'),
    );
    await deleteEnterpriseOwnerApi(row.id);
    showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.name]));
    await refreshAccounts();
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return;
    }
    showActionFailure(error);
  }
}

async function onOwnerResetPassword(row: EnterpriseOwnerItem) {
  try {
    await confirmAction(`确认重置“${row.name}”的密码为 123456 吗？`, '重置密码');
    await resetEnterpriseOwnerPasswordApi(row.id);
    showActionSuccess('密码已重置为 123456');
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return;
    }
    showActionFailure(error);
  }
}

function openUserCreate() {
  userFormModalApi
    .setData({ enterpriseId: enterprise.value?.id, isDefault: 0 })
    .open();
}

async function openUserEdit(row: EnterpriseUserItem) {
  try {
    userFormModalApi.setData(await getEnterpriseUserDetailApi(row.id)).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function openUserDetail(row: EnterpriseUserItem) {
  try {
    userDetailDrawerApi.setData(await getEnterpriseUserDetailApi(row.id)).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function onUserDelete(row: EnterpriseUserItem) {
  try {
    await confirmAction(
      $t('ui.actionMessage.deleteConfirm', [row.name]),
      $t('ui.actionMessage.deleteTitle'),
    );
    await deleteEnterpriseUserApi(row.id);
    showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.name]));
    await refreshAccounts();
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return;
    }
    showActionFailure(error);
  }
}

async function onUserResetPassword(row: EnterpriseUserItem) {
  try {
    await confirmAction(`确认重置“${row.name}”的密码为 123456 吗？`, '重置密码');
    await resetEnterpriseUserPasswordApi(row.id);
    showActionSuccess('密码已重置为 123456');
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return;
    }
    showActionFailure(error);
  }
}

function openTeacherCreate() {
  teacherFormModalApi.setData({ enterpriseId: enterprise.value?.id }).open();
}

async function openTeacherEdit(row: EnterpriseTeacherItem) {
  try {
    teacherFormModalApi.setData(await getEnterpriseTeacherDetailApi(row.id)).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function onTeacherDelete(row: EnterpriseTeacherItem) {
  try {
    await confirmAction(
      $t('ui.actionMessage.deleteConfirm', [row.name]),
      $t('ui.actionMessage.deleteTitle'),
    );
    await deleteEnterpriseTeacherApi(row.id);
    showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.name]));
    await refreshAccounts();
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return;
    }
    showActionFailure(error);
  }
}
</script>

<template>
  <Drawer class="w-full max-w-260" :title="enterprise?.name ?? '企业账号管理'">
    <OwnerFormModal
      :fixed-enterprise-id="fixedEnterpriseId"
      @success="refreshAccounts"
    />
    <OwnerDetailDrawer />
    <UserFormModal
      :fixed-enterprise-id="fixedEnterpriseId"
      @success="refreshAccounts"
    />
    <UserDetailDrawer />
    <TeacherFormModal
      :fixed-enterprise-id="fixedEnterpriseId"
      @success="refreshAccounts"
    />

    <div class="mb-4 flex items-center justify-between gap-3">
      <Segmented
        v-model:value="activeTab"
        :options="[
          { label: `企业用户 (${userCount})`, value: 'user' },
          { label: `项目老师 (${teacherCount})`, value: 'teacher' },
          { label: `负责人 (${ownerCount})`, value: 'owner' },
        ]"
      />
      <div class="flex gap-2">
        <Button v-if="activeTab === 'user'" type="primary" @click="openUserCreate">
          新增用户
        </Button>
        <Button
          v-else-if="activeTab === 'teacher'"
          type="primary"
          @click="openTeacherCreate"
        >
          绑定项目老师
        </Button>
        <Button v-else type="primary" @click="openOwnerCreate">
          新增负责人
        </Button>
      </div>
    </div>

    <template v-if="activeTab === 'user'">
      <div
        v-for="row in userRows"
        :key="row.id"
        class="mb-3 rounded-lg border border-gray-200 p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-medium">
              {{ row.name }}
              <span v-if="row.isDefault === 1" class="ml-2 text-xs text-blue-600">
                默认
              </span>
            </div>
            <div class="mt-1 text-sm text-gray-500">
              {{ row.username }} / {{ row.phone || '-' }} / {{ row.email || '-' }}
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="small" @click="openUserDetail(row)">详情</Button>
            <Button size="small" @click="openUserEdit(row)">编辑</Button>
            <Button size="small" @click="onUserResetPassword(row)">
              重置密码
            </Button>
            <Button size="small" danger @click="onUserDelete(row)">删除</Button>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="activeTab === 'teacher'">
      <div
        v-for="row in teacherRows"
        :key="row.id"
        class="mb-3 rounded-lg border border-gray-200 p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-medium">{{ row.name }}</div>
            <div class="mt-1 text-sm text-gray-500">
              {{ row.username }} / {{ row.phone || '-' }} / {{ row.email || '-' }}
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="small" @click="openTeacherEdit(row)">编辑</Button>
            <Button size="small" danger @click="onTeacherDelete(row)">删除</Button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        v-for="row in ownerRows"
        :key="row.id"
        class="mb-3 rounded-lg border border-gray-200 p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-medium">{{ row.name }}</div>
            <div class="mt-1 text-sm text-gray-500">
              {{ row.username }} / {{ row.phone || '-' }} / {{ row.email || '-' }}
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="small" @click="openOwnerDetail(row)">详情</Button>
            <Button size="small" @click="openOwnerEdit(row)">编辑</Button>
            <Button size="small" @click="onOwnerResetPassword(row)">
              重置密码
            </Button>
            <Button size="small" danger @click="onOwnerDelete(row)">删除</Button>
          </div>
        </div>
      </div>
    </template>

    <Divider />
    <div class="text-xs text-gray-500">
      当前企业会自动带入新增/编辑表单；每个企业只允许绑定一个项目老师。
    </div>
  </Drawer>
</template>
