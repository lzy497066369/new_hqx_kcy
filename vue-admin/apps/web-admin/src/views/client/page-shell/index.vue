<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { Card } from 'antdv-next';

import { $t } from '#/locales';
import { useClientContextStore } from '#/store';

type PagePreset = {
  description: string;
  sections: string[];
};

const route = useRoute();
const clientContextStore = useClientContextStore();

const pageTitle = computed(() => {
  const title = route.meta?.title;
  return title ? $t(title) : '企业端';
});

const companyName = computed(
  () => clientContextStore.companyDisplayName || '当前企业',
);

const pagePresets: Record<string, PagePreset> = {
  '/company/contacts': {
    description: '维护申报、财务、技术等企业联系人，方便后续政策申报协作。',
    sections: ['联系人列表', '默认联系人', '联系方式校验'],
  },
  '/company/employees': {
    description: '沉淀员工、研发人员、社保人数、学历结构等企业人员数据。',
    sections: ['员工概览', '研发人员', '员工材料'],
  },
  '/company/materials': {
    description: '集中上传营业执照、财务报表、员工表、知识产权等企业材料。',
    sections: ['材料清单', '上传记录', '待补材料'],
  },
  '/company/profile': {
    description: '维护企业名称、简称、统一社会信用代码、法人、地址和行业等基础信息。',
    sections: ['基本信息', '工商信息', '经营信息'],
  },
  '/company/tax': {
    description: '维护营收、纳税、研发投入、资产等财税数据，为政策匹配提供依据。',
    sections: ['财税概览', '年度数据', '财务附件'],
  },
  '/dashboard': {
    description: '用图表查看企业资料完整度、材料上传、政策匹配和申报进度。',
    sections: ['资料完整度', '材料统计', '政策匹配趋势'],
  },
  '/home': {
    description: '聚合当前企业的资料进度、待办事项、政策推荐和快捷入口。',
    sections: ['企业概览', '待办摘要', '快捷入口'],
  },
  '/policy/library': {
    description: '浏览政策库，按地区、类型、行业和申报状态筛选政策。',
    sections: ['政策列表', '筛选条件', '政策详情'],
  },
  '/projects/list': {
    description: '查看平台发布的申报项目，按政策方向、申报阶段和地区筛选。',
    sections: ['项目列表', '申报条件', '材料要求'],
  },
  '/projects/my': {
    description: '查看当前企业已关注、已申报或正在准备的项目。',
    sections: ['我的项目', '申报进度', '待补材料'],
  },
  '/settings/account': {
    description: '维护当前登录人的个人资料和联系方式。',
    sections: ['个人资料', '联系方式', '登录信息'],
  },
  '/settings/company-switch': {
    description: '当账号绑定多家公司时，在这里切换当前操作企业。',
    sections: ['当前企业', '可切换企业', '默认企业'],
  },
  '/settings/security': {
    description: '维护密码、安全验证和账号登录安全。',
    sections: ['修改密码', '安全提醒', '登录记录'],
  },
  '/settings/users': {
    description: '企业负责人可维护本企业用户，普通企业用户只查看自己的账号信息。',
    sections: ['企业用户', '角色说明', '账号状态'],
  },
  '/tasks': {
    description: '集中处理资料待完善、材料待上传、政策申报和审核退回等事项。',
    sections: ['待处理', '处理中', '已完成'],
  },
};

const preset = computed<PagePreset>(() => {
  return (
    pagePresets[route.path] ?? {
      description: '企业端页面正在规划中。',
      sections: ['业务内容', '操作记录', '后续扩展'],
    }
  );
});
</script>

<template>
  <div class="client-page-shell">
    <section class="client-page-shell__hero">
      <div>
        <p class="client-page-shell__eyebrow">{{ companyName }}</p>
        <h1 class="client-page-shell__title">{{ pageTitle }}</h1>
        <p class="client-page-shell__description">
          {{ preset.description }}
        </p>
      </div>
    </section>

    <div class="client-page-shell__grid">
      <Card
        v-for="section in preset.sections"
        :key="section"
        class="client-page-shell__card"
        variant="borderless"
      >
        <template #title>{{ section }}</template>
        <p>该模块的业务内容将在后续迭代接入真实数据和操作表单。</p>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.client-page-shell {
  min-height: 100%;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgb(65 129 116 / 18%), transparent 34%),
    linear-gradient(135deg, #f7f5ec 0%, #eef5f1 48%, #f8fbff 100%);
}

.client-page-shell__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 188px;
  padding: 32px;
  color: #17342e;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 92%), rgb(239 249 244 / 88%)),
    repeating-linear-gradient(
      135deg,
      rgb(33 83 73 / 8%) 0,
      rgb(33 83 73 / 8%) 1px,
      transparent 1px,
      transparent 14px
    );
  border: 1px solid rgb(47 97 85 / 12%);
  border-radius: 28px;
  box-shadow: 0 22px 60px rgb(38 73 65 / 12%);
}

.client-page-shell__eyebrow {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #347463;
  letter-spacing: 0.08em;
}

.client-page-shell__title {
  margin: 0;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.client-page-shell__description {
  max-width: 720px;
  margin: 16px 0 0;
  font-size: 16px;
  line-height: 1.8;
  color: #536760;
}

.client-page-shell__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 20px;
}

.client-page-shell__card {
  min-height: 150px;
  border-radius: 22px;
  box-shadow: 0 14px 40px rgb(38 73 65 / 9%);
}

.client-page-shell__card p {
  margin: 0;
  line-height: 1.7;
  color: #66746f;
}

@media (max-width: 960px) {
  .client-page-shell__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .client-page-shell {
    padding: 14px;
  }

  .client-page-shell__hero {
    min-height: auto;
    padding: 24px;
    border-radius: 22px;
  }

  .client-page-shell__title {
    font-size: 28px;
  }
}
</style>
