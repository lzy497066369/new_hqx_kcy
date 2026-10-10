# Docker 部署

这套编排只包含主业务系统：`backend` 和 `web-client`。`iam` 目录暂不纳入本次 Docker 化。

## 启动

```powershell
Copy-Item docker/.env.example docker/.env
docker compose --env-file docker/.env -f docker/compose.yml up -d --build
```

启动后访问：

- 客户端：http://localhost:5998
- 后端健康检查：http://localhost:3000/health

前端容器通过 Nginx 将 `/api` 和 `/uploads` 转发到 backend，因此浏览器请求使用同源地址，不需要额外配置跨域地址。

## 常用命令

```powershell
docker compose --env-file docker/.env -f docker/compose.yml ps
docker compose --env-file docker/.env -f docker/compose.yml logs -f backend
docker compose --env-file docker/.env -f docker/compose.yml down
```

MySQL 的初始化脚本来自 `backend/sql/schema.mysql56.sql`，只会在新的 `mysql-data` volume 首次启动时执行。需要重新初始化本地数据库时：

```powershell
docker compose --env-file docker/.env -f docker/compose.yml down -v
```

该命令会删除 Docker 管理的 MySQL、Redis 和上传文件 volume，请确认不需要保留数据后再执行。已有数据库不要删除 volume，应继续使用 backend 现有的迁移脚本。

## 使用现有 backend 环境变量

也可以直接使用现有后端环境文件中的 API 密钥和业务配置：

```powershell
docker compose --env-file backend/.env -f docker/compose.yml up -d --build
```

Compose 会在容器环境中覆盖 `DB_HOST`、`REDIS_HOST`、端口和生产模式等 Docker 专用设置。

## AI 与知识产权 PDF 识别

- 默认服务为 Psydo，接口根路径 `https://api.psydo.top/v1`，使用 Bearer 认证。
- 主模型 `gpt-6-astra`，依次备用 `gpt-6-sol`、`gpt-5.6-sol`。`AI_MODEL` 优先，`AI_MODELS` 配置有序模型列表，`AI_VISION_MODEL` 指定扫描件模型。
- 密钥仅通过后端环境变量 `AI_API_KEY` 注入。示例文件不含密钥；已有环境文件的密钥不会被更新配置的操作覆盖。切换服务时须自行在部署环境安全更换为对应服务的有效密钥，不能沿用其他供应商的密钥。
- 网络错误、超时、限流、服务端错误和明确的模型不可用错误可切换备用；鉴权及普通参数错误不切换。流式输出一旦已发送任何片段就不重放到备用模型。
- 在高新申报的知识产权汇总表旁选择“PDF上传识别”。每次最多10份、单份10MB、合计30MB；每份最多前6页。超页、缺字段、失败文件均会提示。扫描件依赖 `pdftoppm`（本镜像已安装，可用 `PDFTOPPM_PATH` 覆盖路径）。
- 页面按文件逐个识别并显示进度；识别结果需人工编辑核对，追加后再保存。不会自动写入或覆盖原表；重复专利号/登记号会阻止追加。
- PDF文字或扫描页会发送至配置的AI供应商。请仅上传有权处理的材料，并人工核对法律状态；历史授权证书不代表当前状态有效。
- 自建反向代理需允许单次10MB以上上传，并为识别接口配置至少300秒读取超时。直接调用多文件批量接口时建议2400秒、32MB请求上限；本Docker前端已仅针对该接口设置。
- 验证：后端构建后运行 `npm run verify:ai-provider`、`npm run verify:high-tech-ip-recognition`、`npm run verify:high-tech-application`。这些测试使用模拟AI响应，不会向外部发送真实资料或消耗模型额度；实际模型、视觉和联网搜索兼容性需在配置有效密钥后联调。
