export const CLIENT_PERSONAS = ['overall', 'enterprise'] as const;

export type ClientPersona = (typeof CLIENT_PERSONAS)[number];

export const CLIENT_PERSONA_LABELS: Record<ClientPersona, string> = {
  overall: '总负责人',
  enterprise: '企业负责人',
};

const ENTERPRISE_ROLE_CODES = ['enterprise_owner', 'project_teacher'];

const ACTIVE_PERSONA_KEY = 'hqx-client-persona';

export function isClientPersona(value: unknown): value is ClientPersona {
  return CLIENT_PERSONAS.includes(value as ClientPersona);
}

export function getActiveClientPersona(): ClientPersona {
  if (typeof window !== 'undefined') {
    const stored = window.sessionStorage.getItem(ACTIVE_PERSONA_KEY);
    if (isClientPersona(stored)) return stored;
  }
  return 'enterprise';
}

export function setActiveClientPersona(persona: ClientPersona) {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(ACTIVE_PERSONA_KEY, persona);
  }
}

export function hasClientPersona(roles: string[] = [], persona: ClientPersona) {
  const roleSet = new Set(roles.map((role) => role.toLowerCase()));
  const hasOverall = roleSet.has('global_leader');
  const hasEnterprise = ENTERPRISE_ROLE_CODES.some((role) => roleSet.has(role));
  if (
    roleSet.has('region_leader') ||
    (hasOverall && hasEnterprise) ||
    (roleSet.has('enterprise_owner') && roleSet.has('project_teacher'))
  ) return false;
  return persona === 'overall' ? hasOverall : hasEnterprise;
}

export function getPersonaHomePath(persona: ClientPersona) {
  return persona === 'overall' ? '/governance/overview' : '/client/enterprise-receipts';
}
