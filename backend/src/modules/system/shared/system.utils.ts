import {
  DEFAULT_PORTAL_TYPE,
  PORTAL_TYPES,
  type PortalType,
} from '../../../common/types/portal-type';

export type TreeNodeLike = {
  id: string;
  parentId: string | null;
  [key: string]: any;
};

export function toStringId(value: unknown): string {
  return String(value);
}

export function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value);
}

export function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (value === null || value === undefined || value === '') {
    return [];
  }

  return [String(value)];
}

export function normalizePortalType(
  value: unknown,
  fallback: PortalType = DEFAULT_PORTAL_TYPE,
): PortalType {
  return PORTAL_TYPES.includes(value as PortalType)
    ? (value as PortalType)
    : fallback;
}

export function resolveManagedPortalType(
  value: unknown,
  currentPortal: PortalType,
): PortalType {
  const portalType = normalizePortalType(value, currentPortal);
  return currentPortal === 'admin' ? portalType : currentPortal;
}

export function buildTree<T extends TreeNodeLike>(
  rows: T[],
  sortBy: (left: T, right: T) => number,
): Array<T & { children?: Array<T & { children?: any[] }> }> {
  type Node = T & { children?: Node[] };
  const nodeMap = new Map<string, Node>();

  rows.forEach((row) => {
    nodeMap.set(String(row.id), {
      ...row,
      children: [],
    });
  });

  const roots: Node[] = [];

  nodeMap.forEach((node) => {
    if (!node.parentId) {
      roots.push(node);
      return;
    }

    const parent = nodeMap.get(String(node.parentId));
    if (!parent) {
      roots.push(node);
      return;
    }

    parent.children = parent.children ?? [];
    parent.children.push(node);
  });

  const walk = (list: Node[]): Node[] =>
    list
      .slice()
      .sort(sortBy)
      .map((node): Node => {
        const children = Array.isArray(node.children) ? walk(node.children) : [];
        return {
          ...node,
          ...(children.length > 0 ? { children } : {}),
        } as Node;
      });

  return walk(roots);
}
