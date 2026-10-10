# 快速开始：简洁白色主题

## 概览

HQX 管理系统现已采用简洁、专业的白色主题设计。本指南帮助您快速了解主题特性并开始使用。

## 主题特点

✨ **极简主义**: 纯白背景，去除视觉噪音，专注内容  
🎨 **专业配色**: 精致的蓝色主色调，清晰的语义色彩  
♿ **无障碍**: 符合 WCAG AA 标准，文字对比度 ≥ 4.5:1  
📱 **响应式**: 移动优先设计，适配所有设备尺寸  
⚡ **性能优化**: 流畅的动画过渡，150-300ms 微交互  

## 核心颜色

### 主色调
```css
主色 Primary:    #3B82F6  /* 精致蓝 - 主要操作按钮 */
成功 Success:    #10B981  /* 专业绿 - 成功状态 */
警告 Warning:    #F59E0B  /* 鲜明橙 - 警告提示 */
错误 Destructive: #EF4444  /* 清晰红 - 危险操作 */
```

### 中性色
```css
背景 Background:   #FFFFFF  /* 纯白 */
内容区 Deep:       #FAFAFA  /* 极浅灰 */
文字 Foreground:   #262626  /* 深灰 */
边框 Border:       #E5E5E5  /* 浅灰边框 */
```

## 使用组件

### 按钮示例

```vue
<template>
  <!-- 主要按钮 -->
  <button class="btn-primary">
    保存
  </button>
  
  <!-- 次要按钮 -->
  <button class="btn-secondary">
    取消
  </button>
  
  <!-- 危险按钮 -->
  <button class="btn-destructive">
    删除
  </button>
</template>

<style scoped>
.btn-primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  filter: brightness(0.9);
}
</style>
```

### 卡片示例

```vue
<template>
  <div class="card">
    <h3>卡片标题</h3>
    <p>卡片内容...</p>
  </div>
</template>

<style scoped>
.card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
</style>
```

### 表单输入

```vue
<template>
  <div class="form-group">
    <label for="email">邮箱地址</label>
    <input 
      id="email" 
      type="email" 
      class="form-input"
      placeholder="请输入邮箱"
    />
  </div>
</template>

<style scoped>
.form-group {
  margin-bottom: 16px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.form-input {
  width: 100%;
  background: hsl(var(--input-background));
  border: 1px solid hsl(var(--input));
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.form-input::placeholder {
  color: hsl(var(--input-placeholder));
}
</style>
```

## 间距规范

使用 8px 增量的间距系统：

```css
/* Tailwind 类名 */
p-2   /* 8px  - 紧凑间距 */
p-3   /* 12px - 标准间距 */
p-4   /* 16px - 基础间距 */
p-6   /* 24px - 中等间距 */
p-8   /* 32px - 大间距 */
p-12  /* 48px - 超大间距 */
```

## 响应式断点

```css
/* 移动优先 */
< 768px:    单列布局，底部导航
768-1024px: 可折叠侧边栏，双列网格
> 1024px:   完整侧边栏，三四列网格
```

## 排版规范

### 字体大小
- **标题 H1**: 32px (2rem)
- **标题 H2**: 24px (1.5rem)
- **标题 H3**: 20px (1.25rem)
- **正文**: 16px (1rem) - 基础大小
- **小字**: 14px (0.875rem) - 标签、说明
- **极小**: 12px (0.75rem) - 元数据

### 字重
- **Light (300)**: 大标题
- **Regular (400)**: 正文
- **Medium (500)**: 标签、强调文本
- **Semibold (600)**: 章节标题
- **Bold (700)**: 主标题

### 行高
- **标题**: 1.2-1.3
- **正文**: 1.5-1.75
- **UI 元素**: 1.5

## 动画时长

```css
/* 微交互 */
150ms - 悬停状态、波纹效果

/* 短动画 */
200-300ms - 组件过渡

/* 中等动画 */
300-400ms - 页面过渡

/* 长动画 */
400-600ms - 复杂动画
```

## 无障碍检查清单

开发时请确保：

- [ ] 所有交互元素使用 `cursor: pointer`
- [ ] 焦点状态清晰可见（2-4px 蓝色环）
- [ ] 触摸目标最小 44×44px
- [ ] 文字对比度 ≥ 4.5:1
- [ ] 支持键盘导航（Tab 键顺序合理）
- [ ] 表单标签可见（不仅依赖 placeholder）
- [ ] 错误信息紧邻相关字段
- [ ] 尊重 `prefers-reduced-motion`

## 常用工具类

使用 Tailwind CSS 的语义化类名：

```html
<!-- 背景 -->
<div class="bg-background">纯白背景</div>
<div class="bg-background-deep">浅灰内容区</div>

<!-- 文字 -->
<p class="text-foreground">深灰正文</p>
<p class="text-muted-foreground">中灰次要文本</p>

<!-- 边框 -->
<div class="border border-border">浅灰边框</div>

<!-- 主题色 -->
<button class="bg-primary text-primary-foreground">主要按钮</button>
<span class="text-destructive">错误文本</span>
```

## 文件位置

主题配置文件：

```
vue-admin/
├── packages/@core/base/design/
│   └── src/design-tokens/
│       ├── default.css          # 白色主题配色
│       └── dark.css             # 深色主题配色
├── packages/@core/preferences/
│   └── src/config.ts            # 默认主题设置
├── internal/tailwind-config/
│   └── src/theme.css            # Tailwind 主题配置
└── design-system/
    ├── MASTER.md                # 完整设计系统文档
    └── QUICK-START.md           # 本文件
```

## 修改主题

如需自定义颜色，编辑 [default.css](../packages/@core/base/design/src/design-tokens/default.css):

```css
:root {
  /* 修改主色调 */
  --primary: 221 83% 53%;  /* 改为你的品牌色 */
  
  /* 修改背景色 */
  --background: 0 0% 100%; /* 保持纯白或改为浅色 */
}
```

修改后需清除浏览器缓存并重启开发服务器。

## 开发建议

### ✅ 推荐做法

- 使用语义化的 CSS 变量（`var(--primary)` 而非硬编码颜色值）
- 遵循 8px 间距增量系统
- 为所有交互添加平滑过渡（150-300ms）
- 使用 SVG 图标而非 emoji
- 移动优先设计，然后适配大屏

### ❌ 避免做法

- 不要移除焦点样式
- 不要使用小于 12px 的正文字体
- 不要仅依赖颜色传达信息
- 不要在移动端产生横向滚动
- 不要混用不同的设计风格

## 获取帮助

- 📖 完整文档: [MASTER.md](MASTER.md)
- 🎨 设计规范: [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- 💻 Tailwind 文档: [tailwindcss.com](https://tailwindcss.com/docs)

## 版本信息

- **主题版本**: 1.0.0
- **更新日期**: 2026-09-30
- **状态**: ✅ 已启用

---

**提示**: 清除浏览器缓存后，刷新页面即可看到新主题效果。
