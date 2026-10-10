import { Injectable } from '@nestjs/common';

type BaseRecord = {
  createTime: string;
  id: string;
  updateTime: string;
};

export type DeptRecord = BaseRecord & {
  name: string;
  parentId: string | null;
  remark: string;
  status: 0 | 1;
};

export type RoleRecord = BaseRecord & {
  code: string;
  name: string;
  permissions: string[];
  remark: string;
  status: 0 | 1;
};

export type UserRecord = BaseRecord & {
  deptId: string;
  deptName: string;
  homePath: string;
  name: string;
  remark: string;
  status: 0 | 1;
};

export type MenuRecord = BaseRecord & {
  authCode: string;
  children?: MenuRecord[];
  component: string | null;
  meta: {
    icon: string;
    title: string;
  };
  name: string;
  orderNum: number;
  parentId: string | null;
  path: string;
  redirect: string | null;
  status: 0 | 1;
  type: 'catalog' | 'menu' | 'button';
};

function createNow() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

@Injectable()
export class SystemMemoryStore {
  private nextId = 1000;

  private readonly depts: DeptRecord[] = [
    {
      createTime: createNow(),
      id: '1',
      name: '总部',
      parentId: null,
      remark: '默认部门',
      status: 1,
      updateTime: createNow(),
    },
  ];

  private readonly roles: RoleRecord[] = [
    {
      code: 'admin',
      createTime: createNow(),
      id: '1',
      name: '系统管理员',
      permissions: ['admin'],
      remark: '默认管理员角色',
      status: 1,
      updateTime: createNow(),
    },
  ];

  private readonly users: UserRecord[] = [
    {
      createTime: createNow(),
      deptId: '1',
      deptName: '总部',
      homePath: '/Dashboard/Workspace',
      id: '1',
      name: '系统管理员',
      remark: '默认管理员用户',
      status: 1,
      updateTime: createNow(),
    },
  ];

  private readonly menus: MenuRecord[] = [
    {
      authCode: '',
      children: [],
      component: null,
      createTime: createNow(),
      id: '1',
      meta: {
        icon: 'lucide:layout-dashboard',
        title: 'page.dashboard.title',
      },
      name: 'dashboard',
      orderNum: 1,
      parentId: null,
      path: '/Dashboard',
      redirect: '/Dashboard/Workspace',
      status: 1,
      type: 'catalog',
      updateTime: createNow(),
    },
    {
      authCode: '',
      children: [],
      component: 'dashboard/workspace/index',
      createTime: createNow(),
      id: '2',
      meta: {
        icon: 'carbon:workspace',
        title: 'page.dashboard.workspace',
      },
      name: 'dashboard-workspace',
      orderNum: 1,
      parentId: '1',
      path: '/Dashboard/Workspace',
      redirect: null,
      status: 1,
      type: 'menu',
      updateTime: createNow(),
    },
    {
      authCode: '',
      children: [],
      component: 'dashboard/analytics/index',
      createTime: createNow(),
      id: '3',
      meta: {
        icon: 'lucide:area-chart',
        title: 'page.dashboard.analytics',
      },
      name: 'dashboard-analytics',
      orderNum: 2,
      parentId: '1',
      path: '/Dashboard/Analytics',
      redirect: null,
      status: 1,
      type: 'menu',
      updateTime: createNow(),
    },
    {
      authCode: 'AC_100100',
      children: [],
      component: null,
      createTime: createNow(),
      id: '4',
      meta: {
        icon: 'lucide:users',
        title: 'system.name',
      },
      name: 'system',
      orderNum: 2,
      parentId: null,
      path: '/system',
      redirect: '/system/user',
      status: 1,
      type: 'catalog',
      updateTime: createNow(),
    },
    {
      authCode: 'AC_100100',
      children: [],
      component: 'system/user/list',
      createTime: createNow(),
      id: '5',
      meta: {
        icon: '',
        title: 'system.user.name',
      },
      name: 'system-user',
      orderNum: 1,
      parentId: '3',
      path: 'user',
      redirect: null,
      status: 1,
      type: 'menu',
      updateTime: createNow(),
    },
    {
      authCode: 'AC_100100',
      children: [],
      component: 'system/role/list',
      createTime: createNow(),
      id: '6',
      meta: {
        icon: '',
        title: 'system.role.name',
      },
      name: 'system-role',
      orderNum: 2,
      parentId: '3',
      path: 'role',
      redirect: null,
      status: 1,
      type: 'menu',
      updateTime: createNow(),
    },
    {
      authCode: 'AC_100100',
      children: [],
      component: 'system/menu/list',
      createTime: createNow(),
      id: '7',
      meta: {
        icon: '',
        title: 'system.menu.name',
      },
      name: 'system-menu',
      orderNum: 3,
      parentId: '3',
      path: 'menu',
      redirect: null,
      status: 1,
      type: 'menu',
      updateTime: createNow(),
    },
    {
      authCode: 'AC_100100',
      children: [],
      component: 'system/dept/list',
      createTime: createNow(),
      id: '8',
      meta: {
        icon: '',
        title: 'system.dept.name',
      },
      name: 'system-dept',
      orderNum: 4,
      parentId: '3',
      path: 'dept',
      redirect: null,
      status: 1,
      type: 'menu',
      updateTime: createNow(),
    },
  ];

  private createId() {
    this.nextId += 1;
    return String(this.nextId);
  }

  listDepts() {
    return clone(this.depts);
  }

  listRoles() {
    return clone(this.roles);
  }

  listUsers() {
    return clone(this.users);
  }

  listMenus() {
    return clone(this.menus);
  }

  getDeptById(id: string) {
    return this.depts.find((item) => item.id === id) ?? null;
  }

  getRoleById(id: string) {
    return this.roles.find((item) => item.id === id) ?? null;
  }

  getUserById(id: string) {
    return this.users.find((item) => item.id === id) ?? null;
  }

  getMenuById(id: string) {
    return this.menus.find((item) => item.id === id) ?? null;
  }

  createDept(input: Omit<DeptRecord, keyof BaseRecord>) {
    const now = createNow();
    const dept: DeptRecord = {
      ...input,
      createTime: now,
      id: this.createId(),
      updateTime: now,
    };
    this.depts.push(dept);
    return clone(dept);
  }

  updateDept(id: string, input: Partial<Omit<DeptRecord, keyof BaseRecord>>) {
    const target = this.getDeptById(id);
    if (!target) return null;
    Object.assign(target, input, { updateTime: createNow() });
    return clone(target);
  }

  deleteDept(id: string) {
    const index = this.depts.findIndex((item) => item.id === id);
    if (index < 0) return false;
    this.depts.splice(index, 1);
    return true;
  }

  createRole(input: Omit<RoleRecord, keyof BaseRecord>) {
    const now = createNow();
    const role: RoleRecord = {
      ...input,
      createTime: now,
      id: this.createId(),
      updateTime: now,
    };
    this.roles.push(role);
    return clone(role);
  }

  updateRole(id: string, input: Partial<Omit<RoleRecord, keyof BaseRecord>>) {
    const target = this.getRoleById(id);
    if (!target) return null;
    Object.assign(target, input, { updateTime: createNow() });
    return clone(target);
  }

  deleteRole(id: string) {
    const index = this.roles.findIndex((item) => item.id === id);
    if (index < 0) return false;
    this.roles.splice(index, 1);
    return true;
  }

  createUser(input: Omit<UserRecord, keyof BaseRecord>) {
    const now = createNow();
    const user: UserRecord = {
      ...input,
      createTime: now,
      id: this.createId(),
      updateTime: now,
    };
    this.users.push(user);
    return clone(user);
  }

  updateUser(id: string, input: Partial<Omit<UserRecord, keyof BaseRecord>>) {
    const target = this.getUserById(id);
    if (!target) return null;
    Object.assign(target, input, { updateTime: createNow() });
    return clone(target);
  }

  deleteUser(id: string) {
    const index = this.users.findIndex((item) => item.id === id);
    if (index < 0) return false;
    this.users.splice(index, 1);
    return true;
  }

  createMenu(input: Omit<MenuRecord, keyof BaseRecord | 'children'>) {
    const now = createNow();
    const menu: MenuRecord = {
      ...input,
      children: [],
      createTime: now,
      id: this.createId(),
      updateTime: now,
    };
    this.menus.push(menu);
    return clone(menu);
  }

  updateMenu(id: string, input: Partial<Omit<MenuRecord, keyof BaseRecord>>) {
    const target = this.getMenuById(id);
    if (!target) return null;
    Object.assign(target, input, { updateTime: createNow() });
    return clone(target);
  }

  deleteMenu(id: string) {
    const index = this.menus.findIndex((item) => item.id === id);
    if (index < 0) return false;
    this.menus.splice(index, 1);
    return true;
  }
}
