import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'vue/compiler-sfc';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

type TemplateRoot = NonNullable<
  NonNullable<ReturnType<typeof parse>['descriptor']['template']>['ast']
>;

function refreshButtons(nodes: TemplateRoot['children']): string[] {
  return nodes.flatMap((node) => {
    if (node.type !== 1) return [];
    if (
      /^(?:Button|a-button|VbenButton|VbenIconButton|button)$/.test(node.tag) &&
      /刷新|common\.refresh/.test(node.loc.source)
    ) {
      return [node.loc.source];
    }
    return refreshButtons(node.children);
  });
}

const pageRoots = [
  'apps/web-admin/src/views',
  'apps/web-client/src/views',
  '../iam/iam_frontend/src/views',
];

const sharedControls = [
  'packages/effects/layouts/src/basic/header/header.vue',
  'packages/effects/layouts/src/basic/tabbar/tabbar.vue',
  'packages/effects/layouts/src/widgets/sync-status/sync-status.vue',
  'packages/effects/common-ui/src/components/service-journey/service-journey-board.vue',
  'packages/effects/common-ui/src/ui/fallback/fallback.vue',
];

describe('manual page refresh removal', () => {
  it.each(pageRoots)(
    'removes refresh buttons and table tools from %s',
    (root) => {
      const violations: string[] = [];
      for (const path of sourceFiles(resolve(workspace, root))) {
        if (!/\.(?:vue|ts)$/.test(path) || path.endsWith('.test.ts')) continue;
        const source = readFileSync(path, 'utf8');
        if (/\brefresh\s*:\s*true\b/.test(source)) {
          violations.push(
            `${relative(workspace, path)}: table refresh enabled`,
          );
        }
        if (!path.endsWith('.vue')) continue;
        const { descriptor, errors } = parse(source, { filename: path });
        expect(errors, path).toEqual([]);
        if (descriptor.template?.ast) {
          for (const button of refreshButtons(
            descriptor.template.ast.children,
          )) {
            violations.push(`${relative(workspace, path)}: ${button}`);
          }
        }
      }
      expect(violations).toEqual([]);
    },
  );

  it.each(sharedControls)('removes shared refresh actions from %s', (path) => {
    const { descriptor, errors } = parse(read(path), { filename: path });
    expect(errors).toEqual([]);
    expect(descriptor.template?.ast).toBeDefined();
    expect(refreshButtons(descriptor.template!.ast!.children)).toEqual([]);
  });

  it('removes the tab refresh component and its context-menu action', () => {
    expect(
      read('packages/effects/layouts/src/basic/tabbar/tabbar.vue'),
    ).not.toContain('TabsToolRefresh');
    expect(
      read('packages/effects/layouts/src/basic/tabbar/use-tabbar.ts'),
    ).not.toContain('refreshTab');
    expect(
      existsSync(
        resolve(
          workspace,
          'packages/@core/ui-kit/tabs-ui/src/components/widgets/tool-refresh.vue',
        ),
      ),
    ).toBe(false);
  });

  it('removes refresh preferences instead of only hiding their controls', () => {
    const config = read('packages/@core/preferences/src/config.ts');
    expect(config).not.toMatch(/\b(?:showRefresh|refresh)\s*:/);
    expect(
      read(
        'packages/effects/layouts/src/widgets/preferences/preferences-drawer.vue',
      ),
    ).not.toContain('widgetRefresh');
    expect(
      read(
        'packages/effects/layouts/src/widgets/preferences/blocks/layout/widget.vue',
      ),
    ).not.toContain('widgetRefresh');
  });

  it.each(['web-admin', 'web-client'])(
    'disables default table refresh for %s',
    (app) => {
      expect(read(`apps/${app}/src/adapter/vxe-table.ts`)).toMatch(
        /toolbarConfig:\s*\{\s*refresh:\s*false/,
      );
    },
  );
});
