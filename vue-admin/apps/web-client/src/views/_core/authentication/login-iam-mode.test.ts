import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const loginViews = [
  resolve(process.cwd(), 'apps/web-client/src/views/_core/authentication/login.vue'),
  resolve(process.cwd(), 'apps/web-admin/src/views/_core/authentication/login.vue'),
  resolve(process.cwd(), 'playground/src/views/_core/authentication/login.vue'),
];
const iamLoginView = resolve(
  process.cwd(),
  '../iam/iam_frontend/src/views/oauth/login/index.vue',
);

describe('login views', () => {
  it('skips local credential validation in IAM mode', () => {
    for (const loginView of loginViews.slice(0, 2)) {
      const source = readFileSync(loginView, 'utf8');

      expect(source).toContain("import { isIamAuthEnabled } from '#/auth/iam-sso';");
      expect(source).toContain('if (isIamAuthEnabled()) {');
      expect(source).toContain('return [];');
    }
  });

  it('does not render the slider or welcome message in the application logins', () => {
    for (const loginView of loginViews) {
      const source = readFileSync(loginView, 'utf8');

      expect(source).not.toContain('SliderCaptcha');
      expect(source).not.toContain("fieldName: 'captcha'");
      expect(source).toContain(':show-header="false"');
    }

    const iamSource = readFileSync(
      resolve(process.cwd(), '../iam/iam_frontend/src/views/_core/authentication/login.vue'),
      'utf8',
    );
    expect(iamSource).toContain(':show-header="false"');
  });

  it('renders the IAM password input', () => {
    const source = readFileSync(iamLoginView, 'utf8');

    expect(source).toContain("import { Button, Form, FormItem, Input, InputPassword, message } from 'antdv-next';");
    expect(source).toContain('html-type="button" @click="login"');
  });
});
