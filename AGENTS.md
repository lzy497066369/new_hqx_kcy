# 项目 Git 与目录约定

## 目录映射

- `hqx/`：总项目目录，对应总仓库 Git。
- `backend/`：后端服务目录，对应后端仓库 Git。
- `vue-admin/`：前端源码目录。
- `dist/`：前端构建后的生产代码目录。

## 推送规则

- 用户说“推送 `backend`”时，优先推到后端服务对应的仓库，不要默认推到总仓库。
- 用户说“推送 `vue-admin`”时，按前端源码目录处理。
- 用户说“推送 `dist`”时，按前端生产代码目录处理。
- 如果目标仓库不明确，先确认对应远端，再执行推送。

## 已知远端

- 总仓库：`git@github.com:lzy497066369/hqx.git`
- 后端仓库：`https://github.com/lzy497066369/new_hqx_backend.git`
- 前端源码仓库：`git@github.com:lzy497066369/new_hqx_admin.git`
- 前端生产代码仓库：`git@github.com:lzy497066369/new_hqx_admin_dist.git`
