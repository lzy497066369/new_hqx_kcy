export const portalTypes = ['admin', 'client'] as const;

export type PortalType = (typeof portalTypes)[number];

export interface PortalTypeParams {
  portalType?: PortalType;
}
