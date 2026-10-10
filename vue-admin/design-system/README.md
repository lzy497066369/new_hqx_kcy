# HQX 管理系统 - 设计系统文档

## 📖 文档导航

- **[MASTER.md](MASTER.md)** - 完整的设计系统规范（颜色、排版、组件、无障碍）
- **[QUICK-START.md](QUICK-START.md)** - 快速开始指南（代码示例、常用模式）
- **[CHANGELOG.md](CHANGELOG.md)** - 更新日志（所有变更记录）

## 🎨 主题概览

HQX 管理系统现已采用**简洁白色主题**，专为企业级应用设计，提供清晰、专业、易用的用户界面。

### 核心特性

- ✨ **极简设计**: 纯白背景，去除视觉噪音
- 🎯 **专注内容**: 突出重要信息，提升可读性
- ♿ **无障碍**: WCAG AA 标准，对比度 ≥ 4.5:1
- 📱 **响应式**: 移动优先，适配所有设备
- 🚀 **高性能**: 优化的动画和流畅的交互

## 🎨 配色方案

### 主色调

| 颜色 | HSL | Hex | 用途 |
|------|-----|-----|------|
| Primary | `hsl(221, 83%, 53%)` | `#3B82F6` | 主要操作按钮 |
| Success | `hsl(142, 76%, 36%)` | `#10B981` | 成功状态 |
| Warning | `hsl(38, 92%, 50%)` | `#F59E0B` | 警告提示 |
| Destructive | `hsl(0, 84%, 60%)` | `#EF4444` | 危险操作 |

### 中性色

| 颜色 | HSL | Hex | 用途 |
|------|-----|-----|------|
| Background | `hsl(0, 0%, 100%)` | `#FFFFFF` | 页面背景 |
| Background Deep | `hsl(0, 0%, 98%)` | `#FAFAFA` | 内容区背景 |
| Foreground | `hsl(0, 0%, 15%)` | `#262626` | 文字颜色 |
| Border | `hsl(0, 0%, 90%)` | `#E5E5E5` | 边框颜色 |
| Muted | `hsl(0, 0%, 97%)` | `#F7F7F7` | 禁用状态 |

## 📂 文件结构

```
design-system/
├── README.md           # 本文件 - 设计系统导航
├── MASTER.md          # 完整设计规范（颜色、排版、间距、组件）
├── QUICK-START.md     # 快速开始（代码示例、工具类）
└── CHANGELOG.md       # 变更日志（版本历史）

packages/@core/base/design/src/design-tokens/
├── default.css        # 白色主题 CSS 变量定义
└── dark.css          # 深色主题 CSS 变量定义

packages/@core/preferences/src/
└── config.ts         # 默认主题配置（mode: 'light'）

internal/tailwind-config/src/
└── theme.css         # Tailwind CSS 主题扩展
```

## 🚀 快速开始

### 1. 使用颜色变量

```vue
<template>
  <div class="card">
    <h3>标题</h3>
    <button class="btn-primary">保存</button>
  </div>
</template>

<style scoped>
.card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  padding: 20px;
  border-radius: 8px;
}

.btn-primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  padding: 10px 16px;
  border-radius: 6px;
}
</style>
```

### 2. 使用 Tailwind 工具类

```vue
<template>
  <div class="bg-card border border-border rounded-lg p-5">
    <h3 class="text-foreground text-lg font-semibold mb-3">
      卡片标题
    </h3>
    <button class="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90">
      保存
    </button>
  </div>
</template>
```

### 3. 响应式设计

```vue
<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <!-- 移动端单列，平板双列，桌面三列 -->
    <div v-for="item in items" :key="item.id" class="card">
      {{ item.name }}
    </div>
  </div>
</template>
```

## 📐 设计原则

### 1. 极简主义
- 使用大量留白
- 去除不必要的装饰
- 专注核心内容

### 2. 层次清晰
- 使用字重和大小建立层级
- 保持一致的间距节奏
- 合理使用颜色强调

### 3. 易于访问
- 文字对比度 ≥ 4.5:1
- 触摸目标 ≥ 44×44px
- 支持键盘导航
- 尊重系统偏好设置

### 4. 一致性
- 统一的组件样式
- 8px 增量的间距系统
- 标准化的动画时长

## 🔧 开发规范

### CSS 变量命名

使用语义化命名，而非具体颜色值：

```css
/* ✅ 推荐 */
color: hsl(var(--primary));
background: hsl(var(--card));

/* ❌ 避免 */
color: #3B82F6;
background: white;
```

### 间距规范

使用 8px 增量系统：

```css
/* Tailwind 类名 */
gap-2   /* 8px */
gap-3   /* 12px */
gap-4   /* 16px */
gap-6   /* 24px */
gap-8   /* 32px */
```

### 动画时长

```css
/* 微交互 */
transition: all 0.15s;  /* 150ms - 悬停、点击 */

/* 组件过渡 */
transition: all 0.2s;   /* 200ms - 展开、折叠 */

/* 页面切换 */
transition: all 0.3s;   /* 300ms - 路由跳转 */
```

## ✅ 质量检查清单

开发新组件时，请确认：

### 视觉质量
- [ ] 使用 SVG 图标（非 emoji）
- [ ] 所有图标来自统一的图标库
- [ ] 颜色使用 CSS 变量而非硬编码
- [ ] 按压状态有视觉反馈

### 交互体验
- [ ] 可点击元素显示 `cursor: pointer`
- [ ] 触摸目标最小 44×44px
- [ ] 微交互时长 150-300ms
- [ ] 禁用状态清晰可辨

### 响应式
- [ ] 在 375px、768px、1024px 设备上验证
- [ ] 横竖屏都可正常使用
- [ ] 移动端无横向滚动

### 无障碍
- [ ] 主文本对比度 ≥ 4.5:1
- [ ] 次要文本对比度 ≥ 3:1
- [ ] 焦点状态清晰可见
- [ ] 支持键盘导航（Tab 键）
- [ ] 表单有可见标签（非仅 placeholder）

## 📚 相关资源

### 设计参考
- [WCAG 2.1 无障碍指南](https://www.w3.org/WAI/WCAG21/quickref/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design 3](https://m3.material.io/)

### 开发工具
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [Heroicons 图标库](https://heroicons.com/)
- [Contrast Checker 对比度检查](https://webaim.org/resources/contrastchecker/)

### 内部文档
- [完整设计规范 →](MASTER.md)
- [快速开始指南 →](QUICK-START.md)
- [更新日志 →](CHANGELOG.md)

## 🤝 贡献指南

### 修改主题

1. **更新 CSS 变量**  
   编辑 [`packages/@core/base/design/src/design-tokens/default.css`](../packages/@core/base/design/src/design-tokens/default.css)

2. **修改默认配置**  
   编辑 [`packages/@core/preferences/src/config.ts`](../packages/@core/preferences/src/config.ts)

3. **清除缓存并重启**
   ```bash
   # 清除浏览器缓存
   # 重启开发服务器
   cd apps/web-admin
   npm run dev
   ```

### 添加新组件

1. 遵循设计系统规范
2. 使用语义化 CSS 变量
3. 确保无障碍标准
4. 更新相关文档

## 📝 版本历史

### v1.0.0 (2026-09-30)
- ✨ 完整的简洁白色主题
- 📐 统一的设计系统规范
- ♿ WCAG AA 无障碍标准
- 📱 响应式移动优先设计

详细变更请参阅 [CHANGELOG.md](CHANGELOG.md)

## 💬 反馈与支持

如有问题或建议，请：

1. 查阅 [完整设计规范](MASTER.md)
2. 参考 [快速开始指南](QUICK-START.md)
3. 查看 [更新日志](CHANGELOG.md)

---

**维护团队**: HQX 设计团队  
**最后更新**: 2026-09-30  
**版本**: 1.0.0  
**状态**: ✅ 生产就绪
