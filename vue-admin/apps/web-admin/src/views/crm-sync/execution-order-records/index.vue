<script setup lang="ts">
import CrmSyncRecordList from '../components/CrmSyncRecordList.vue';

defineOptions({ name: 'CrmExecutionOrderSyncRecord' });
</script>

<template>
  <CrmSyncRecordList mode="execution-order" />
</template>
