<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, onMounted, ref, shallowRef, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

const props = withDefaults(
  defineProps<{
    height?: string;
    option: Record<string, any>;
  }>(),
  {
    height: '300px',
  },
);

const chartRef = ref<EchartsUIType>();
const mounted = shallowRef(false);
const { renderEcharts } = useEcharts(chartRef);

async function renderChart() {
  if (!mounted.value) {
    return;
  }
  await nextTick();
  await renderEcharts(props.option);
}

onMounted(() => {
  mounted.value = true;
  renderChart();
});

watch(
  () => props.option,
  () => {
    renderChart();
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" :height="height" />
</template>
