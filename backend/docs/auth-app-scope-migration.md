# Auth Application Scope Migration

This migration introduces the data model for shared users and application-scoped authorization. It does not change the current KJQB login routes or queries yet.

## Scope

The current system is registered as `kjqb`. Existing roles, permissions, menus, and user portal access are backfilled to that application code.

The migration adds `sys_app`, `sys_app_client`, and `sys_user_app`, and adds `app_code` to `sys_role`, `sys_permission`, and `sys_menu`.

## Apply

Back up the target database first. For an existing database without historical migration records, execute only this idempotent migration:

```powershell
npm run db:execute-sql -- sql/auth-app-scope-p0.sql
```

The SQL runner supports MySQL `DELIMITER` statements required by this migration. Do not run the baseline SQL or `db:migrate -- --apply --allow-untracked-history` against an existing database unless its full historical migration chain has been reviewed.
