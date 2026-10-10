# 平台组织与公司访问授权

## 边界

IAM 只维护平台内部组织，不维护企业客户的公司部门。

- `iam_platform_department`：平台内部部门树。
- `iam_user_platform_department`：用户部门归属，支持兼岗，但每个用户只有一个主部门。
- `iam_company`：业务系统同步的轻量公司索引，只用于公司访问授权和展示。
- `iam_company_member`、`iam_user_company_scope`：应用内的负责人/成员身份、公司访问范围和默认公司。

公司基本资料、公司详情、财税、人员和项目资料始终由业务系统维护。

## 管理接口

| 接口 | 用途 |
| --- | --- |
| `GET /iam/admin/platform-departments` | 查询平台部门树数据 |
| `POST /iam/admin/platform-departments` | 创建平台部门 |
| `PUT /iam/admin/platform-departments/:id` | 更新平台部门 |
| `GET /iam/admin/platform-departments/:id/members` | 查询部门成员 |
| `PUT /iam/admin/platform-departments/:id/members` | 设置部门成员和主部门 |
| `GET /iam/admin/companies/:id/members?appCode=:appCode` | 查询应用内公司授权 |
| `PUT /iam/admin/companies/:id/members` | 设置应用内公司授权 |

## 旧系统迁移

`npm run import:legacy -- --apply` 会幂等迁移：

```text
sys_dept -> iam_platform_department
sys_user.dept_id -> iam_user_platform_department
```

映射通过 `source_system + source_department_id` 保持稳定；原业务库不会被写入。
