import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const sourcePaths = [
  resolve(process.cwd(), 'apps/web-client/src/api/core/menu.ts'),
  resolve(process.cwd(), 'apps/web-admin/src/api/core/menu.ts'),
];

describe('IAM menu API', () => {
  it('uses a bearer-authenticated raw request for the unwrapped IAM response', () => {
    for (const sourcePath of sourcePaths) {
      const source = readFileSync(sourcePath, 'utf8');

      expect(source).toContain('await fetch(');
      expect(source).toContain('authorization: `Bearer ${accessStore.accessToken}`');
      expect(source).not.toContain('return requestClient.get<RouteRecordStringComponent[]>(\n      `${issuer}/iam/me');
    }
  });
});
