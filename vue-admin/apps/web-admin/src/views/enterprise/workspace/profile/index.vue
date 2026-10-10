<script setup lang="ts">
import type {
  EnterpriseWorkspaceContact,
  EnterpriseWorkspaceContactInput,
} from '#/api';

import { computed, shallowRef } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Card, Empty, Spin } from 'antdv-next';

import {
  confirmAction,
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';
import EnterpriseBasicProfileForm from './components/EnterpriseBasicProfileForm.vue';
import EnterpriseContactList from './components/EnterpriseContactList.vue';
import EnterpriseContactModal from './components/EnterpriseContactModal.vue';
import EnterpriseWorkspaceBasicProfileForm from './components/EnterpriseWorkspaceBasicProfileForm.vue';
import { useEnterpriseBasicProfile } from './composables/use-enterprise-basic-profile';
import { useEnterpriseProfile } from './composables/use-enterprise-profile';

defineOptions({ name: 'EnterpriseWorkspaceProfile' });

const contactModalOpen = shallowRef(false);
const selectedContact = shallowRef<EnterpriseWorkspaceContact>();
const route = useRoute();
const isLedgerView = computed(() => route.name === 'EnterpriseMaterialSection');
const isBasicLedgerSection = computed(
  () => isLedgerView.value && route.params.section === 'basic',
);
const showProfileSections = computed(
  () => !isLedgerView.value || route.params.section === 'basic',
);
const {
  contacts,
  loading,
  profile,
  removeContact,
  saveContact,
  saveProfile,
  saving,
} = useEnterpriseProfile();
const {
  loading: basicProfileLoading,
  profile: basicProfile,
  save: saveBasicProfile,
  saving: basicProfileSaving,
} = useEnterpriseBasicProfile();

function openContactModal(contact?: EnterpriseWorkspaceContact) {
  selectedContact.value = contact;
  contactModalOpen.value = true;
}

async function handleSaveProfile(data: Parameters<typeof saveProfile>[0]) {
  try {
    await saveProfile(data);
    showActionSuccess('企业基础信息已保存');
  } catch (error) {
    showActionFailure(error);
  }
}

async function handleSaveBasicProfile(
  data: NonNullable<typeof basicProfile.value>,
) {
  try {
    await saveBasicProfile(data);
    showActionSuccess('企业基础资料已保存');
  } catch (error) {
    showActionFailure(error);
  }
}

async function handleSaveContact(data: EnterpriseWorkspaceContactInput) {
  try {
    await saveContact(data, selectedContact.value?.id);
    contactModalOpen.value = false;
    showActionSuccess(selectedContact.value ? '联系人已更新' : '联系人已新增');
  } catch (error) {
    showActionFailure(error);
  }
}

async function handleRemoveContact(contact: EnterpriseWorkspaceContact) {
  try {
    await confirmAction(`确认删除联系人“${contact.name}”吗？`, '删除联系人');
    await removeContact(contact.id);
    showActionSuccess('联系人已删除');
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  }
}
</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading || (isBasicLedgerSection && basicProfileLoading)">
      <div v-if="profile" class="enterprise-profile-page">
        <EnterpriseWorkspaceBasicProfileForm
          v-if="isBasicLedgerSection && basicProfile"
          :profile="basicProfile"
          :saving="basicProfileSaving"
          @save="handleSaveBasicProfile"
        />
        <Card v-else-if="showProfileSections" title="基础信息">
          <EnterpriseBasicProfileForm
            :profile="profile"
            :saving="saving"
            @save="handleSaveProfile"
          />
        </Card>

        <Card v-if="showProfileSections" title="联系人维护">
          <EnterpriseContactList
            :contacts="contacts"
            :saving="saving"
            @create="openContactModal()"
            @edit="openContactModal"
            @remove="handleRemoveContact"
          />
        </Card>
        <EnterpriseContactModal
          v-model:open="contactModalOpen"
          :contact="selectedContact"
          :saving="saving"
          @save="handleSaveContact"
        />
      </div>
      <Empty v-else-if="!loading" description="未找到可访问的企业档案" />
    </Spin>
  </Page>
</template>

<style scoped>
.enterprise-profile-page { display: grid; gap: 16px; }
</style>
