#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const controller = source('src/modules/enterprise/workspace/workspace.controller.ts');
const service = source('src/modules/enterprise/workspace/workspace.service.ts');
const dto = source('src/modules/enterprise/workspace/dto.ts');

assert(controller.includes("employees/attachments"), 'employee attachment upload route is missing');
assert(controller.includes('createEmployeeAttachmentUploadInterceptorOptions'), 'employee attachment upload must use an enterprise-specific interceptor');
assert(service.includes('assertEmployeeAttachmentPaths'), 'employee attachment ownership validation is missing');
assert(service.includes('isEmployeeAttachmentPathForEnterprise'), 'employee attachment path scope validation is missing');
assert(
  /@Min\(0\)\s+@Max\(366\)\s+annualWorkDays/u.test(dto),
  'annual work days must stay within 0-366',
);
assert(dto.includes('@IsIn([1, 2]) ygSex'), 'employee gender must use the client enum');
assert(dto.includes('@IsIn([1, 2, 3, 4]) ygLx'), 'employee type must use the client enum');

console.log('Enterprise employee attachment verification passed.');
