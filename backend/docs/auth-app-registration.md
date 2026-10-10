# Auth Application Registration

Register each relying system before it uses the shared login endpoint. The application code becomes the login `appCode`, JWT audience, menu scope, role scope, and refresh cookie namespace.

```powershell
npm run auth:register-app -- --code soft-copyright --name "软件著作权管理系统" --portal admin
```

The command only registers the application. It does not create users, user application grants, roles, menus, or SSO clients. Add those records for the new system before enabling login.

To bootstrap the first administrator and a public browser client in one transaction:

```powershell
npm run auth:bootstrap-app-admin -- --app-code soft-copyright --username admin --client-id soft-copyright-web --redirect-uri https://soft.example.com/auth/callback --portal admin
```

The bootstrap role has no menus or permissions. It gives the selected user an active application assignment and establishes the client registration; create the soft copyright system's own menus and permissions in its application scope.
