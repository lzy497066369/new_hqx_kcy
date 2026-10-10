<script setup lang="ts">
import type {
  ClientEnterpriseContractApi,
  ClientEnterprisePropertyApi,
} from '#/api/client';

import { computed } from 'vue';

type NodeKind = 'ip' | 'proof' | 'ps' | 'rd' | 'transformation';

type TopologyNode = {
  code: string;
  id: string;
  kind: NodeKind;
  name: string;
  status: 'complete' | 'empty' | 'warning';
  x: number;
  y: number;
};

type TopologyEdge = {
  from: string;
  id: string;
  kind: 'direct' | 'evidence' | 'support';
  to: string;
};

const props = defineProps<{
  contracts: ClientEnterpriseContractApi.Contract[];
  gaps: string[];
  intellectualProperties: ClientEnterprisePropertyApi.IntellectualProperty[];
  invoices: ClientEnterpriseContractApi.Invoice[];
  productServices: ClientEnterprisePropertyApi.ProductService[];
  readinessPercent: number;
  researchProjects: ClientEnterprisePropertyApi.ResearchProject[];
  transformations: ClientEnterprisePropertyApi.Transformation[];
}>();

const stageMeta: Record<NodeKind, { label: string; x: number }> = {
  transformation: { label: '成果转化', x: 90 },
  ip: { label: 'IP 知识产权', x: 280 },
  rd: { label: '研发立项报告', x: 470 },
  ps: { label: '高新产品 PS', x: 660 },
  proof: { label: '合同 / 发票', x: 850 },
};

const stageOrder: NodeKind[] = ['transformation', 'ip', 'rd', 'ps', 'proof'];

const topologyNodes = computed(() => {
  const nodes: TopologyNode[] = [];

  appendStageNodes(
    nodes,
    'ip',
    sortByDisplayCode(
      props.intellectualProperties.map((item) => ({
        code: item.ip_code || item.soft_work_num || 'IP',
        id: nodeId('ip', item.id),
        name: item.soft_work_name || '未命名知识产权',
        status: hasAnyRelation(
          item.related_rd_ids,
          item.related_ps_ids,
          item.related_transformation_ids,
        )
          ? 'complete'
          : 'warning',
      })),
    ),
  );
  appendStageNodes(
    nodes,
    'rd',
    sortByDisplayCode(
      props.researchProjects.map((item) => ({
        code: item.ky_project_num || 'RD',
        id: nodeId('rd', item.id),
        name: item.ky_project_name || '未命名研发立项报告',
        status: hasAnyRelation(item.related_ip_ids) ? 'complete' : 'warning',
      })),
    ),
  );
  appendStageNodes(
    nodes,
    'ps',
    sortByDisplayCode(
      props.productServices.map((item) => ({
        code: item.ps_code || 'PS',
        id: nodeId('ps', item.id),
        name: item.ps_name || '未命名产品/服务',
        status: hasAnyRelation(item.related_rd_ids, item.related_ip_ids)
          ? 'complete'
          : 'warning',
      })),
    ),
  );
  appendStageNodes(
    nodes,
    'transformation',
    sortByDisplayCode(
      props.transformations.map((item) => ({
        code: item.transformation_code || '成果',
        id: nodeId('transformation', item.id),
        name: item.transformation_name || '未命名成果',
        status: hasAnyRelation(item.related_ip_ids) ? 'complete' : 'warning',
      })),
    ),
  );

  const proofNodes = [
    ...props.contracts.map((item) => ({
      code: item.ht_num || '合同',
      id: nodeId('contract', item.id),
      name: item.ht_name || '未命名合同',
      status: 'complete' as const,
    })),
    ...props.invoices.map((item) => ({
      code: item.fp_num || '发票',
      id: nodeId('invoice', item.id),
      name: `发票 ${item.fp_num || item.id || ''}`.trim(),
      status: 'complete' as const,
    })),
  ];
  appendStageNodes(nodes, 'proof', proofNodes);

  return nodes;
});

const visibleNodeIds = computed(
  () => new Set(topologyNodes.value.map((item) => item.id)),
);

const topologyEdges = computed(() => {
  const edges: TopologyEdge[] = [];

  props.transformations.forEach((item) => {
    parseRelationIds(item.related_ip_ids).forEach((ipId) => {
      pushEdge(edges, nodeId('transformation', item.id), nodeId('ip', ipId), 'support');
    });
  });

  props.researchProjects.forEach((item) => {
    parseRelationIds(item.related_ip_ids).forEach((ipId) => {
      pushEdge(edges, nodeId('ip', ipId), nodeId('rd', item.id), 'direct');
    });
  });

  props.productServices.forEach((item) => {
    parseRelationIds(item.related_rd_ids).forEach((rdId) => {
      pushEdge(edges, nodeId('rd', rdId), nodeId('ps', item.id), 'direct');
    });
    parseRelationIds(item.related_contract_ids).forEach((contractId) => {
      pushEdge(edges, nodeId('ps', item.id), nodeId('contract', contractId), 'evidence');
    });
    parseRelationIds(item.related_invoice_ids).forEach((invoiceId) => {
      pushEdge(edges, nodeId('ps', item.id), nodeId('invoice', invoiceId), 'evidence');
    });
  });

  return edges.filter(
    (item) =>
      visibleNodeIds.value.has(item.from) && visibleNodeIds.value.has(item.to),
  );
});

const topologyNodeMap = computed(
  () => new Map(topologyNodes.value.map((item) => [item.id, item])),
);

const stageCounts = computed<Record<NodeKind, number>>(() => ({
  ip: props.intellectualProperties.length,
  proof: props.contracts.length + props.invoices.length,
  ps: props.productServices.length,
  rd: props.researchProjects.length,
  transformation: props.transformations.length,
}));

const completeNodeCount = computed(
  () => topologyNodes.value.filter((item) => item.status === 'complete').length,
);

const canvasHeight = computed(() => {
  const largestColumn = Math.max(
    ...stageOrder.map(
      (stage) =>
        topologyNodes.value.filter((node) => node.kind === stage).length || 1,
    ),
  );
  return Math.max(390, 128 + largestColumn * 78);
});

function appendStageNodes(
  target: TopologyNode[],
  kind: NodeKind,
  rawNodes: Array<Pick<TopologyNode, 'code' | 'id' | 'name' | 'status'>>,
) {
  const startY = 104;
  const gap = 74;
  rawNodes.forEach((item, index) => {
    target.push({
      ...item,
      kind,
      x: stageMeta[kind].x,
      y: startY + index * gap,
    });
  });
}

function edgePath(edge: TopologyEdge) {
  const from = topologyNodeMap.value.get(edge.from);
  const to = topologyNodeMap.value.get(edge.to);
  if (!from || !to) {
    return '';
  }

  const fromX = from.x + 142;
  const fromY = from.y + 27;
  const toX = to.x;
  const toY = to.y + 27;
  const curve = Math.max(48, Math.abs(toX - fromX) * 0.42);
  return `M ${fromX} ${fromY} C ${fromX + curve} ${fromY}, ${toX - curve} ${toY}, ${toX} ${toY}`;
}

function nodeId(kind: string, id: number | string | undefined) {
  return `${kind}:${String(id ?? '')}`;
}

function sortByDisplayCode<T extends Pick<TopologyNode, 'code' | 'id'>>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftIndex = extractCodeIndex(left.code);
    const rightIndex = extractCodeIndex(right.code);
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.id.localeCompare(right.id);
  });
}

function extractCodeIndex(value: string) {
  const match = value.match(/(?:IP|RD|PS|成果)\s*0*(\d+)/iu);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function pushEdge(
  target: TopologyEdge[],
  from: string,
  to: string,
  kind: TopologyEdge['kind'],
) {
  if (!from.endsWith(':') && !to.endsWith(':')) {
    target.push({ from, id: `${from}->${to}:${kind}`, kind, to });
  }
}

function parseRelationIds(value: null | string | undefined) {
  return String(value ?? '')
    .split(/[,，\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasAnyRelation(...values: Array<null | string | undefined>) {
  return values.some((value) => parseRelationIds(value).length > 0);
}
</script>

<template>
  <section class="topology-panel">
    <div class="topology-panel__hero">
      <div>
        <span class="topology-panel__eyebrow">Evidence Topology</span>
        <h3>高企证据链关系拓扑图</h3>
        <p>
          按“成果转化 -> IP -> RD -> PS -> 合同/发票”的主链绘制证据关系，快速定位断点。
        </p>
      </div>
      <div class="topology-panel__score">
        <strong>{{ readinessPercent }}%</strong>
        <span>完整度</span>
      </div>
    </div>

    <div class="topology-panel__stats">
      <div class="topology-panel__stat">
        <strong>{{ topologyNodes.length }}</strong>
        <span>展示节点</span>
      </div>
      <div class="topology-panel__stat">
        <strong>{{ topologyEdges.length }}</strong>
        <span>有效连线</span>
      </div>
      <div class="topology-panel__stat">
        <strong>{{ completeNodeCount }}</strong>
        <span>已入链</span>
      </div>
      <div class="topology-panel__stat topology-panel__stat--warn">
        <strong>{{ gaps.length }}</strong>
        <span>待补缺口</span>
      </div>
    </div>

    <div class="topology-panel__canvas-wrap">
      <div
        class="topology-panel__canvas"
        :style="{ minHeight: `${canvasHeight}px` }"
      >
        <svg
          class="topology-panel__links"
          :height="canvasHeight"
          :viewBox="`0 0 1000 ${canvasHeight}`"
          width="1000"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="topology-link-gradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stop-color="#8fd8c8" />
              <stop offset="55%" stop-color="#f6c363" />
              <stop offset="100%" stop-color="#f08d6d" />
            </linearGradient>
            <filter id="topology-link-glow">
              <feGaussianBlur stdDeviation="2.6" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            v-for="edge in topologyEdges"
            :key="edge.id"
            class="topology-panel__link"
            :class="`topology-panel__link--${edge.kind}`"
            :d="edgePath(edge)"
          />
        </svg>

        <div
          v-for="stage in stageOrder"
          :key="stage"
          class="topology-panel__stage"
          :style="{ left: `${stageMeta[stage].x}px` }"
        >
          <span>{{ stageMeta[stage].label }}</span>
          <strong>{{ stageCounts[stage] }}</strong>
        </div>

        <article
          v-for="node in topologyNodes"
          :key="node.id"
          class="topology-panel__node"
          :class="[
            `topology-panel__node--${node.kind}`,
            `topology-panel__node--${node.status}`,
          ]"
          :style="{ left: `${node.x}px`, top: `${node.y}px` }"
        >
          <small>{{ node.code }}</small>
          <strong>{{ node.name }}</strong>
        </article>

        <div v-if="topologyNodes.length === 0" class="topology-panel__empty">
          暂无可绘制节点，先添加知识产权、研发立项报告或成果转化后会自动生成拓扑。
        </div>
      </div>
    </div>

    <div v-if="gaps.length" class="topology-panel__gaps">
      <strong>优先补齐</strong>
      <span v-for="gap in gaps.slice(0, 6)" :key="gap">{{ gap }}</span>
      <em v-if="gaps.length > 6">还有 {{ gaps.length - 6 }} 个缺口</em>
    </div>
  </section>
</template>

<style scoped>
.topology-panel {
  --topology-ink: #24352f;
  --topology-paper: #fffaf0;
  --topology-river: #8fd8c8;
  --topology-amber: #f6c363;
  --topology-coral: #ef8065;
  --topology-moss: #4a6d5e;
  position: relative;
  padding: 18px;
  margin-top: 14px;
  overflow: hidden;
  color: var(--topology-ink);
  background:
    radial-gradient(circle at 12% 12%, rgb(246 195 99 / 32%), transparent 28%),
    radial-gradient(circle at 88% 8%, rgb(143 216 200 / 28%), transparent 30%),
    linear-gradient(135deg, #fffaf0 0%, #f3ead8 48%, #e6f2eb 100%);
  border: 1px solid rgb(74 109 94 / 18%);
  border-radius: 24px;
  box-shadow: 0 22px 60px rgb(42 64 56 / 13%);
}

.topology-panel::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background-image:
    linear-gradient(rgb(74 109 94 / 6%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(74 109 94 / 6%) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(to bottom, #000, transparent 72%);
}

.topology-panel__hero,
.topology-panel__stats,
.topology-panel__canvas-wrap,
.topology-panel__gaps {
  position: relative;
  z-index: 1;
}

.topology-panel__hero {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  justify-content: space-between;
}

.topology-panel__eyebrow {
  display: inline-flex;
  padding: 4px 10px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 11px;
  font-style: italic;
  letter-spacing: 0.12em;
  color: #78521b;
  text-transform: uppercase;
  background: rgb(246 195 99 / 30%);
  border: 1px solid rgb(120 82 27 / 16%);
  border-radius: 999px;
}

.topology-panel__hero h3 {
  margin: 10px 0 6px;
  font-family: 'STSong', 'Songti SC', Georgia, serif;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.topology-panel__hero p {
  max-width: 620px;
  margin: 0;
  color: rgb(36 53 47 / 68%);
}

.topology-panel__score {
  display: grid;
  flex: 0 0 116px;
  place-items: center;
  min-height: 96px;
  background:
    linear-gradient(145deg, rgb(36 53 47 / 92%), rgb(74 109 94 / 84%)),
    var(--topology-moss);
  border: 1px solid rgb(255 255 255 / 32%);
  border-radius: 26px;
  box-shadow: 0 18px 34px rgb(36 53 47 / 22%);
}

.topology-panel__score strong {
  font-size: 30px;
  line-height: 1;
  color: #fff8dd;
}

.topology-panel__score span {
  margin-top: -18px;
  font-size: 12px;
  color: rgb(255 248 221 / 72%);
}

.topology-panel__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.topology-panel__stat {
  padding: 12px 14px;
  background: rgb(255 255 255 / 56%);
  border: 1px solid rgb(74 109 94 / 14%);
  border-radius: 18px;
  backdrop-filter: blur(12px);
}

.topology-panel__stat strong {
  display: block;
  font-size: 22px;
}

.topology-panel__stat span {
  font-size: 12px;
  color: rgb(36 53 47 / 62%);
}

.topology-panel__stat--warn strong {
  color: #bb563b;
}

.topology-panel__canvas-wrap {
  margin-top: 16px;
  overflow-x: auto;
  border-radius: 22px;
}

.topology-panel__canvas {
  position: relative;
  min-width: 1020px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 20%, rgb(255 255 255 / 12%), transparent 28%),
    linear-gradient(135deg, #18261f 0%, #24372e 46%, #3b3420 100%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 22px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 6%);
}

.topology-panel__canvas::before {
  position: absolute;
  inset: 0;
  content: '';
  background-image:
    radial-gradient(circle, rgb(255 248 221 / 16%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 248 221 / 5%) 1px, transparent 1px);
  background-size: 22px 22px, 190px 100%;
}

.topology-panel__links {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.topology-panel__link {
  fill: none;
  stroke: url('#topology-link-gradient');
  stroke-linecap: round;
  stroke-width: 2.4;
  filter: url('#topology-link-glow');
  opacity: 0.78;
  animation: topology-draw 900ms ease-out both;
}

.topology-panel__link--support {
  stroke-dasharray: 6 8;
}

.topology-panel__link--evidence {
  stroke: #f1d28a;
  stroke-width: 1.8;
}

.topology-panel__stage {
  position: absolute;
  top: 24px;
  z-index: 2;
  width: 150px;
  color: rgb(255 248 221 / 82%);
}

.topology-panel__stage span {
  display: block;
  font-size: 12px;
}

.topology-panel__stage strong {
  font-size: 24px;
  color: #fff8dd;
}

.topology-panel__node {
  position: absolute;
  z-index: 3;
  width: 150px;
}

.topology-panel__node {
  min-height: 56px;
  padding: 10px 12px;
  overflow: hidden;
  background: rgb(255 250 240 / 92%);
  border: 1px solid rgb(255 255 255 / 64%);
  border-radius: 16px;
  box-shadow: 0 14px 24px rgb(0 0 0 / 18%);
  animation: topology-rise 520ms ease-out both;
}

.topology-panel__node::after {
  position: absolute;
  top: 12px;
  right: 10px;
  width: 8px;
  height: 8px;
  content: '';
  background: var(--topology-river);
  border-radius: 50%;
  box-shadow: 0 0 0 5px rgb(143 216 200 / 18%);
}

.topology-panel__node--warning::after {
  background: var(--topology-coral);
  box-shadow: 0 0 0 5px rgb(239 128 101 / 18%);
}

.topology-panel__node small {
  display: block;
  max-width: 112px;
  overflow: hidden;
  font-size: 11px;
  color: rgb(36 53 47 / 58%);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topology-panel__node strong {
  display: -webkit-box;
  margin-top: 3px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.28;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.topology-panel__node--ip {
  border-left: 5px solid #8fd8c8;
}

.topology-panel__node--transformation {
  border-left: 5px solid #f6c363;
}

.topology-panel__node--rd {
  border-left: 5px solid #fff0ad;
}

.topology-panel__node--ps {
  border-left: 5px solid #ef8065;
}

.topology-panel__node--proof {
  border-left: 5px solid #c9b6ff;
}

.topology-panel__empty {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  color: rgb(255 248 221 / 72%);
}

.topology-panel__gaps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding-top: 12px;
  margin-top: 14px;
  border-top: 1px dashed rgb(74 109 94 / 20%);
}

.topology-panel__gaps strong,
.topology-panel__gaps span,
.topology-panel__gaps em {
  padding: 5px 10px;
  font-size: 12px;
  font-style: normal;
  border-radius: 999px;
}

.topology-panel__gaps strong {
  color: #fff8dd;
  background: var(--topology-moss);
}

.topology-panel__gaps span,
.topology-panel__gaps em {
  color: #7d432f;
  background: rgb(239 128 101 / 14%);
  border: 1px solid rgb(239 128 101 / 18%);
}

@keyframes topology-draw {
  from {
    stroke-dasharray: 18 18;
    stroke-dashoffset: 80;
    opacity: 0;
  }
}

@keyframes topology-rise {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}

@media (max-width: 900px) {
  .topology-panel {
    padding: 14px;
  }

  .topology-panel__hero {
    flex-direction: column;
  }

  .topology-panel__score {
    width: 100%;
    min-height: 76px;
  }

  .topology-panel__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
