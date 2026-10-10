export const PORTAL_TYPES = ['admin', 'client'] as const;

export type PortalType = (typeof PORTAL_TYPES)[number];

export const DEFAULT_PORTAL_TYPE: PortalType = 'admin';
