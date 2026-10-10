/** Exercise the real Nest controller/DTO/multipart/binary pipeline using test-only auth and isolated repositories. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Module, UnauthorizedException, ValidationPipe } = require('@nestjs/common');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { NestFactory } = require('@nestjs/core');
const { Workbook } = require('exceljs');
const { ClientGovernanceController } = require('../dist/modules/client-governance/governance.controller');
const { ClientGovernanceService } = require('../dist/modules/client-governance/governance.service');
const { ClientGovernanceExcelService } = require('../dist/modules/client-governance/governance-excel.service');
const { PortalGuard } = require('../dist/common/guards/portal.guard');
const { ResponseInterceptor } = require('../dist/common/interceptors/response.interceptor');
const { ENTERPRISE_PROJECTS } = require('../dist/common/constants/enterprise-projects');
const { harness, overall, enterprise } = require('./helpers/client-governance-harness.cjs');
class TestAuthGuard {
  canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const actor = request.headers.authorization;
    if (!['Bearer test-overall', 'Bearer test-enterprise'].includes(actor)) throw new UnauthorizedException();
    request.currentUser = actor === 'Bearer test-overall' ? overall : enterprise;
    return true;
  }
}
async function main() {
  const h = harness(); const excel = new ClientGovernanceExcelService(h.service, h.repos.Enterprise);
  Reflect.defineMetadata(GUARDS_METADATA, [TestAuthGuard, PortalGuard], ClientGovernanceController);
  class TestModule {}
  Module({ controllers: [ClientGovernanceController], providers: [TestAuthGuard, PortalGuard, { provide: ClientGovernanceService, useValue: h.service }, { provide: ClientGovernanceExcelService, useValue: excel }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.listen(0, '127.0.0.1');
  const url = `${await app.getUrl()}/api/client/governance/enterprises/excel`;
  const headers = { authorization: 'Bearer test-overall' };
  try {
    assert.equal((await fetch(`${url}/template`)).status, 401);
    assert.equal((await fetch(`${url}/template`, { headers: { authorization: 'Bearer test-enterprise' } })).status, 403);
    assert.equal((await fetch(`${url}/export?distribution=oops`, { headers })).status, 400);
    assert.equal((await fetch(`${url}/export?keyword[x]=oops`, { headers })).status, 400);
    const template = await fetch(`${url}/template`, { headers });
    assert.equal(template.status, 200);
    assert.match(template.headers.get('content-type'), /spreadsheetml/);
    assert.match(template.headers.get('content-disposition'), /filename\*=UTF-8/);
    const workbook = new Workbook(); await workbook.xlsx.load(Buffer.from(await template.arrayBuffer()));
    workbook.worksheets[0].getRow(2).values = ['HTTP验证企业', '区域A', '销售甲', ENTERPRISE_PROJECTS[0], 2027];
    const file = Buffer.from(await workbook.xlsx.writeBuffer());
    const data = new FormData(); data.append('file', new Blob([file]), '模板.xlsx');
    const response = await fetch(`${url}/preview`, { method: 'POST', headers, body: data });
    assert.equal(response.status, 201);
    const preview = (await response.json()).data;
    assert.equal(preview.ready, 1); assert.equal(h.state().Enterprise.length, 0);
    const invalid = await fetch(`${url}/confirm`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ token: 'not-a-token' }) });
    assert.equal(invalid.status, 400);
    const result = await fetch(`${url}/confirm`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ token: preview.token }) });
    assert.equal(result.status, 201); assert.equal((await result.json()).data.success, 1);
    const exportResponse = await fetch(`${url}/export`, { headers });
    const exported = new Workbook(); await exported.xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));
    assert.equal(exported.worksheets[0].getCell('E2').value, 2027);
    const missing = await fetch(url.replace('/excel', ''), { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ name: '缺字段企业', regionId: '10', salesOwner: '销售甲' }) });
    assert.equal(missing.status, 400, 'Three-field legacy create requests must now be rejected');
    console.log('Governance Excel HTTP passed: authentication/portal scope, query DTOs, XLSX binary downloads, multipart preview, required-field/UUID validation, confirm and export year persistence.');
  } finally { await app.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
