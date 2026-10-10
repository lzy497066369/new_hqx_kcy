<script setup lang="ts">
import type { CrmIntegrationClient } from '#/api';

import { onMounted, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';

import { getCrmIntegrationClientsApi } from '#/api';
import { showActionFailure } from '../../system/shared/action-feedback';
import CrmIntegrationClientPanel from './components/CrmIntegrationClientPanel.vue';
import CrmIntegrationRequestTable from './components/CrmIntegrationRequestTable.vue';

defineOptions({ name: 'CrmIntegrationSecurity' });

const clients = shallowRef<CrmIntegrationClient[]>([]);
const loading = shallowRef(false);

async function loadClients() {
  loading.value = true;
  try {
    clients.value = await getCrmIntegrationClientsApi();
  } catch (error) {
    showActionFailure(error);
  } finally {
    loading.value = false;
  }
}

onMounted(() => void loadClients());
</script>

<template>
  <Page auto-content-height>
    <div class="crm-integration-security">
      <CrmIntegrationClientPanel :clients="clients" :loading="loading" @refresh="loadClients" />
      <CrmIntegrationRequestTable />
    </div>
  </Page>
</template>

<style scoped>
.crm-integration-security {
  display: grid;
  gap: 16px;
}
</style>
