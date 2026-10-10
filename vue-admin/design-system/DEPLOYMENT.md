# 部署验证清单

## ✅ 已完成的主题更新

### 1. 核心配置文件

- [x] **[packages/@core/base/design/src/design-tokens/default.css](../packages/@core/base/design/src/design-tokens/default.css)**
  - 更新 `:root` CSS 变量为白色主题
  - 更新 `.light` 类的所有颜色定义
  
- [x] **[packages/@core/preferences/src/config.ts](../packages/@core/preferences/src/config.ts)**
  - 默认主题模式：`light`
  - 主色调：`hsl(221 83% 53%)`
  - 成功色：`hsl(142 76% 36%)`
  - 警告色：`hsl(38 92% 50%)`
  - 错误色：`hsl(0 84% 60%)`

### 2. 设计系统文档

- [x] **[design-system/README.md](README.md)** - 导航中心和快速参考
- [x] **[design-system/MASTER.md](MASTER.md)** - 完整的设计规范
- [x] **[design-system/QUICK-START.md](QUICK-START.md)** - 快速开始指南
- [x] **[design-system/CHANGELOG.md](CHANGELOG.md)** - 详细更新日志

## 🚀 启动应用

### 方法一：使用 pnpm (推荐)

```bash
# 在 vue-admin 目录下
pnpm dev
```

### 方法二：使用 turbo

```bash
# 在 vue-admin 目录下
npm run dev
```

### 方法三：只启动 web-admin

```bash
# 在 vue-admin 目录下
pnpm run dev --filter=@vben/web-admin
```

## 🔍 验证步骤

启动应用后，请验证以下内容：

### 视觉验证

- [ ] **背景色**
  - 页面主背景应为纯白色 (`#FFFFFF`)
  - 内容区域应为极浅灰 (`#FAFAFA`)

- [ ] **文字颜色**
  - 主要文字应为深灰色 (`#262626`)
  - 次要文字应为中灰色（约 `#737373`）

- [ ] **主色调**
  - 主要按钮应为蓝色 (`#3B82F6`)
  - 悬停时应有轻微变暗效果

- [ ] **边框**
  - 卡片、输入框边框应为浅灰色 (`#E5E5E5`)
  - 边框应清晰但不突兀

- [ ] **语义色彩**
  - 成功提示：绿色 (`#10B981`)
  - 警告提示：橙色 (`#F59E0B`)
  - 错误提示：红色 (`#EF4444`)

### 组件验证

- [ ] **按钮**
  - 主要按钮：蓝色背景，白色文字
  - 次要按钮：浅灰背景，深色文字
  - 危险按钮：红色背景，白色文字
  - 悬停状态有视觉反馈

- [ ] **卡片**
  - 白色背景
  - 浅灰色边框
  - 轻微的阴影效果

- [ ] **表单输入**
  - 白色背景
  - 浅灰色边框
  - 焦点时蓝色边框和外围光晕

- [ ] **导航栏/侧边栏**
  - 白色背景
  - 当前选中项有蓝色高亮

### 响应式验证

- [ ] **桌面视图** (> 1024px)
  - 侧边栏完全展开
  - 多列网格布局

- [ ] **平板视图** (768px - 1024px)
  - 侧边栏可折叠
  - 双列网格布局

- [ ] **移动视图** (< 768px)
  - 单列布局
  - 底部或汉堡菜单导航

### 无障碍验证

- [ ] **键盘导航**
  - Tab 键可以导航所有交互元素
  - 焦点状态清晰可见（蓝色环）
  - Enter/Space 可以激活按钮

- [ ] **对比度**
  - 使用浏览器开发工具检查文字对比度
  - 主文本应 ≥ 4.5:1
  - 大文本应 ≥ 3:1

## 🐛 常见问题排查

### 问题 1：样式没有更新

**症状**：页面仍显示旧的深色或蓝灰色主题

**解决方案**：
```bash
# 1. 清除 node_modules 缓存
rm -rf node_modules/.vite
rm -rf node_modules/.cache

# 2. 重启开发服务器
pnpm dev
```

### 问题 2：浏览器缓存

**症状**：本地看到旧样式，但代码已更新

**解决方案**：
- **Chrome/Edge**: `Cmd+Shift+Delete` (Mac) 或 `Ctrl+Shift+Delete` (Windows)
- **Firefox**: `Cmd+Shift+Delete` (Mac) 或 `Ctrl+Shift+Delete` (Windows)
- 或使用无痕/隐私模式

### 问题 3：CSS 变量未生效

**症状**：某些组件颜色不正确

**检查**：
```bash
# 确认 CSS 文件存在
ls -la packages/@core/base/design/src/design-tokens/default.css

# 检查文件内容
grep "background: 0 0% 100%" packages/@core/base/design/src/design-tokens/default.css
```

### 问题 4：TypeScript 类型错误

**症状**：编译时出现类型错误

**解决方案**：
```bash
# 重新生成类型定义
pnpm run typecheck
```

## 📊 性能检查

启动后检查控制台：

- [ ] 无 CSS 加载错误
- [ ] 无 404 资源错误
- [ ] 首屏渲染时间 < 3 秒
- [ ] CSS 文件大小合理（不超过 500KB）

## 📝 最终确认

当以上所有检查都通过后：

- [ ] 截图保存主要页面（首页、列表页、表单页）
- [ ] 记录任何需要调整的细节
- [ ] 更新项目文档（如有必要）

## 🎉 部署就绪

如果所有验证通过，主题已成功应用，可以部署到生产环境！

## 📚 相关文档

- [完整设计规范](MASTER.md) - 所有设计决策和标准
- [快速开始指南](QUICK-START.md) - 代码示例和最佳实践
- [更新日志](CHANGELOG.md) - 详细的变更历史

---

**验证人员**: _______________  
**验证日期**: _______________  
**版本**: 1.0.0  
**状态**: 🟡 待验证
