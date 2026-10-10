import { SetMetadata } from '@nestjs/common';

import type { PortalType } from '../types/portal-type';

export const REQUIRED_PORTALS_KEY = 'required_portals';

export const RequirePortals = (...portals: PortalType[]) =>
  SetMetadata(REQUIRED_PORTALS_KEY, portals);
