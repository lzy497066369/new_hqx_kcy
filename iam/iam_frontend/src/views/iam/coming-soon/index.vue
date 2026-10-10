<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Empty } from 'antdv-next';

const route = useRoute();
const title = computed(() => String(route.meta.title ?? 'IAM 管理'));
</script>

<template>
  <Page auto-content-height>
    <section class="iam-coming-soon">
      <Empty :description="`${title}将随 IAM 数据模型落地后接入`" />
    </section>
  </Page>
</template>

<style scoped>
.iam-coming-soon {
  display: grid;
  min-height: 360px;
  place-items: center;
  background: #f6f8fb;
}
</style>
