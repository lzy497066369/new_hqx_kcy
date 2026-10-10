import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, 'EnterpriseCardItem.vue'),
  'utf8',
);

describe('enterprise card actions', () => {
  it('provides declaration management and displays related declaration projects', () => {
    expect(source).toContain('declarations: [EnterpriseProfileItem]');
    expect(source).toContain("emit('declarations', props.item)");
    expect(source).toContain('关联申报项目');
    expect(source).toContain('props.item.declarationProjects');
    expect(source).not.toContain('materialLedger: [EnterpriseProfileItem]');
    expect(source).not.toContain("emit('materialLedger', props.item)");
    expect(source).not.toContain('workspace: [EnterpriseProfileItem]');
    expect(source).not.toContain("emit('workspace', props.item)");
    expect(source).not.toContain('>服务中心</Button');
  });
});
