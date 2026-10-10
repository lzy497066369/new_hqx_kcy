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

assert(controller.includes('archive-attachments'), 'archive attachment upload route is missing');
assert(controller.includes('uploadArchiveAttachment'), 'archive attachment must use enterprise-scoped upload handling');
assert(service.includes('assertArchiveAttachmentPaths'), 'archive attachment ownership validation is missing');
assert(service.includes('isEmployeeAttachmentPathForEnterprise'), 'archive attachments must reuse enterprise-scoped storage paths');
assert(service.includes('assertTaxAuditAttachmentPath'), 'tax audit attachment ownership validation is missing');
assert(service.includes('assertDocumentAttachmentPath'), 'document attachment ownership validation is missing');
assert(service.includes('assertCertificateAttachmentPath'), 'certificate attachment ownership validation is missing');
assert(service.includes('assertPhotoAttachmentPaths'), 'photo attachment ownership validation is missing');
assert(dto.includes('@IsIn([1, 2, 3]) htStatus'), 'contract status must use the client enum');
assert(dto.includes('@IsIn([1, 2, 3]) fpStatus'), 'invoice status must use the client enum');

console.log('Enterprise archive attachment verification passed.');
