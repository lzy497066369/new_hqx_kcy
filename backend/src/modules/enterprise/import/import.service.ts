import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { EnterpriseBasicInfoEntity } from '../../../infrastructure/database/entities/enterprise-basic-info.entity';
import { EnterpriseEntity } from '../../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseOwnerEntity } from '../../../infrastructure/database/entities/enterprise-owner.entity';
import { EnterprisePersonEntity } from '../../../infrastructure/database/entities/enterprise-person.entity';
import { EnterpriseTeacherEntity } from '../../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseUserEntity } from '../../../infrastructure/database/entities/enterprise-user.entity';
import { RoleEntity } from '../../../infrastructure/database/entities/role.entity';
import { UserEntity } from '../../../infrastructure/database/entities/user.entity';
import { UserRoleEntity } from '../../../infrastructure/database/entities/user-role.entity';
import { EnterpriseAccountService } from '../shared/enterprise-account.service';
import { EnterpriseImportConfirmInput } from './dto';
import { TianyanchaClientService } from './tianyancha-client.service';
import { TianyanchaLogService } from './tianyancha-log.service';

type EnterpriseImportSearchItem = {
  address: null | string;
  creditCode: null | string;
  establishTime: null | string;
  externalId: string;
  legalPerson: null | string;
  name: string;
  raw: Record<string, unknown>;
  regStatus: null | string;
};

type MappedEnterpriseDetail = {
  address: null | string;
  alias: null | string;
  approvedTime: Date | null;
  base: null | string;
  bondName: null | string;
  bondNum: null | string;
  brnNumber: null | string;
  businessScope: null | string;
  categoryCodeFirst: null | string;
  categoryCodeFourth: null | string;
  categoryCodeSecond: null | string;
  categoryCodeThird: null | string;
  city: null | string;
  companyOrgType: null | string;
  creditCode: null | string;
  district: null | string;
  email: null | string;
  emailListJson: null | string;
  establishTime: Date | null;
  extraJson: string;
  fromTime: Date | null;
  historyNames: null | string;
  industry: null | string;
  isMicroEnt: null | number;
  legalPersonName: null | string;
  legalPersonType: null | string;
  logo: null | string;
  name: string;
  percentileScore: null | string;
  phoneListJson: null | string;
  phoneNumber: null | string;
  province: null | string;
  regCapital: null | string;
  regInstitute: null | string;
  regLocation: null | string;
  regNumber: null | string;
  regStatus: null | string;
  socialStaffNum: null | string;
  staffNumRange: null | string;
  stockType: null | string;
  tagsJson: null | string;
  taxNumber: null | string;
  toTime: Date | null;
  tycEnterpriseId: string;
  usedBondName: null | string;
  websiteListJson: null | string;
};

type MappedPersonDetail = {
  email: null | string;
  extraJson: string;
  id: string;
  isLegalPerson: boolean;
  name: string;
  personType: string;
  phone: null | string;
  position: string;
};

export interface EnterpriseImportActor {
  id?: number;
  roles?: string[];
  username: string;
}

@Injectable()
export class EnterpriseImportService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(EnterpriseBasicInfoEntity)
    private readonly basicInfoRepo: Repository<EnterpriseBasicInfoEntity>,
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepo: Repository<EnterpriseEntity>,
    @InjectRepository(EnterprisePersonEntity)
    private readonly personRepo: Repository<EnterprisePersonEntity>,
    private readonly accountService: EnterpriseAccountService,
    private readonly tianyanchaClient: TianyanchaClientService,
    private readonly tianyanchaLogService: TianyanchaLogService,
  ) {}

  async search(keyword: string, user: EnterpriseImportActor): Promise<{ items: EnterpriseImportSearchItem[] }> {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      throw new BadRequestException('公司名称不能为空');
    }

    const { data } = await this.tianyanchaClient.request<Record<string, unknown>>({
      actor: user.username,
      apiCode: 'search_816',
      apiName: '天眼查企业搜索',
      keyword: normalizedKeyword,
      params: {
        pageNum: '1',
        pageSize: '20',
        word: normalizedKeyword,
      },
      pathEnv: 'TIANYANCHA_SEARCH_PATH',
    });

    return {
      items: this.extractSearchItems(data),
    };
  }

  async preview(externalId: string, user: EnterpriseImportActor): Promise<unknown> {
    const normalizedExternalId = externalId?.trim();
    if (!normalizedExternalId) {
      throw new BadRequestException('企业ID不能为空');
    }

    const preview = await this.loadPreview(normalizedExternalId, user.username);
    const existingEnterprise = await this.findExistingEnterprise(preview.enterprise);
    const existingPersons = existingEnterprise
      ? await this.personRepo.find({
          where: {
            enterpriseId: existingEnterprise.id,
          },
        })
      : [];
    const existingPersonKeys = new Set(
      existingPersons
        .filter((item) => item.accountUserId)
        .map((item) => this.buildPersonUniqueKey(item.name, item.position)),
    );

    return {
      existingEnterprise: existingEnterprise
        ? {
            creditCode: existingEnterprise.creditCode,
            id: String(existingEnterprise.id),
            name: existingEnterprise.name,
          }
        : null,
      enterprise: {
        address: preview.enterprise.address,
        alias: preview.enterprise.alias,
        businessScope: preview.enterprise.businessScope,
        city: preview.enterprise.city,
        companyOrgType: preview.enterprise.companyOrgType,
        creditCode: preview.enterprise.creditCode,
        district: preview.enterprise.district,
        email: preview.enterprise.email,
        establishTime: this.formatDateValue(preview.enterprise.establishTime),
        externalId: preview.enterprise.tycEnterpriseId,
        industry: preview.enterprise.industry,
        legalPerson: preview.enterprise.legalPersonName,
        name: preview.enterprise.name,
        phoneNumber: preview.enterprise.phoneNumber,
        province: preview.enterprise.province,
        regCapital: preview.enterprise.regCapital,
        regInstitute: preview.enterprise.regInstitute,
        regLocation: preview.enterprise.regLocation,
        regStatus: preview.enterprise.regStatus,
        websites: this.parseJsonArray(preview.enterprise.websiteListJson),
      },
      persons: preview.persons.map((person) => ({
        accountCreated: existingPersonKeys.has(
          this.buildPersonUniqueKey(person.name, person.position),
        ),
        email: person.email,
        id: person.id,
        isLegalPerson: person.isLegalPerson,
        name: person.name,
        personType: person.personType,
        phone: person.phone,
        position: person.position,
        selectedByDefault: true,
      })),
    };
  }

  async confirm(input: EnterpriseImportConfirmInput, user: EnterpriseImportActor): Promise<unknown> {
    const externalId = input.externalId?.trim();
    if (!externalId) {
      throw new BadRequestException('企业ID不能为空');
    }

    const createAccounts = input.createAccounts !== false;
    const defaultPassword = input.defaultPassword?.trim() || '123456';
    const selectedPersonIdSet = new Set(
      (input.selectedPersonIds ?? []).map((item) => item.trim()).filter(Boolean),
    );

    const preview = await this.loadPreview(externalId, user.username);
    const result = await this.dataSource.transaction(async (manager) => {
      const txBasicInfoRepo = manager.getRepository(EnterpriseBasicInfoEntity);
      const txEnterpriseRepo = manager.getRepository(EnterpriseEntity);
      const txOwnerRepo = manager.getRepository(EnterpriseOwnerEntity);
      const txPersonRepo = manager.getRepository(EnterprisePersonEntity);
      const txTeacherRepo = manager.getRepository(EnterpriseTeacherEntity);
      const txRoleRepo = manager.getRepository(RoleEntity);
      const txEnterpriseUserRepo = manager.getRepository(EnterpriseUserEntity);
      const txUserRepo = manager.getRepository(UserEntity);
      const txUserRoleRepo = manager.getRepository(UserRoleEntity);

      let enterprise =
        (await this.findExistingEnterpriseTx(txEnterpriseRepo, txBasicInfoRepo, preview.enterprise)) ??
        null;
      const existed = !!enterprise;

      if (!enterprise) {
        enterprise = await txEnterpriseRepo.save(
          txEnterpriseRepo.create({
            address: preview.enterprise.address,
            city: preview.enterprise.city,
            code: this.generateInternalCode(),
            contactEmail: preview.enterprise.email,
            contactName: preview.enterprise.legalPersonName,
            contactPhone: preview.enterprise.phoneNumber,
            creditCode:
              preview.enterprise.creditCode ?? this.fallbackCreditCode(preview.enterprise),
            district: preview.enterprise.district,
            enterpriseType: preview.enterprise.companyOrgType,
            industry: preview.enterprise.industry,
            legalPerson: preview.enterprise.legalPersonName,
            name: preview.enterprise.name,
            profileStatus: 'draft',
            province: preview.enterprise.province,
            remark: '天眼查导入',
            shortName: preview.enterprise.alias,
            source: 'tianyancha',
            status: 1,
          }),
        );
      } else {
        enterprise.address = preview.enterprise.address;
        enterprise.city = preview.enterprise.city;
        enterprise.contactEmail = preview.enterprise.email;
        enterprise.contactName = preview.enterprise.legalPersonName;
        enterprise.contactPhone = preview.enterprise.phoneNumber;
        enterprise.creditCode =
          preview.enterprise.creditCode ?? enterprise.creditCode ?? this.fallbackCreditCode(preview.enterprise);
        enterprise.district = preview.enterprise.district;
        enterprise.enterpriseType = preview.enterprise.companyOrgType;
        enterprise.industry = preview.enterprise.industry;
        enterprise.legalPerson = preview.enterprise.legalPersonName;
        enterprise.name = preview.enterprise.name;
        enterprise.province = preview.enterprise.province;
        enterprise.shortName = preview.enterprise.alias;
        enterprise.source = 'tianyancha';
        enterprise.status = 1;
        enterprise = await txEnterpriseRepo.save(enterprise);
      }

      let basicInfo = await txBasicInfoRepo.findOne({
        where: {
          enterpriseId: enterprise.id,
        },
      });
      if (!basicInfo) {
        basicInfo = txBasicInfoRepo.create({
          enterpriseId: enterprise.id,
        });
      }

      Object.assign(basicInfo, {
        alias: preview.enterprise.alias,
        approvedTime: preview.enterprise.approvedTime,
        base: preview.enterprise.base,
        bondName: preview.enterprise.bondName,
        bondNum: preview.enterprise.bondNum,
        brnNumber: preview.enterprise.brnNumber,
        businessScope: preview.enterprise.businessScope,
        categoryCodeFirst: preview.enterprise.categoryCodeFirst,
        categoryCodeFourth: preview.enterprise.categoryCodeFourth,
        categoryCodeSecond: preview.enterprise.categoryCodeSecond,
        categoryCodeThird: preview.enterprise.categoryCodeThird,
        city: preview.enterprise.city,
        companyOrgType: preview.enterprise.companyOrgType,
        creditCode: preview.enterprise.creditCode,
        district: preview.enterprise.district,
        email: preview.enterprise.email,
        emailListJson: preview.enterprise.emailListJson,
        enterpriseId: enterprise.id,
        establishTime: preview.enterprise.establishTime,
        extraJson: preview.enterprise.extraJson,
        fromTime: preview.enterprise.fromTime,
        historyNames: preview.enterprise.historyNames,
        industry: preview.enterprise.industry,
        isMicroEnt: preview.enterprise.isMicroEnt,
        legalPersonName: preview.enterprise.legalPersonName,
        legalPersonType: preview.enterprise.legalPersonType,
        logo: preview.enterprise.logo,
        name: preview.enterprise.name,
        percentileScore: preview.enterprise.percentileScore,
        phoneListJson: preview.enterprise.phoneListJson,
        phoneNumber: preview.enterprise.phoneNumber,
        province: preview.enterprise.province,
        regCapital: preview.enterprise.regCapital,
        regInstitute: preview.enterprise.regInstitute,
        regLocation: preview.enterprise.regLocation,
        regNumber: preview.enterprise.regNumber,
        regStatus: preview.enterprise.regStatus,
        socialStaffNum: preview.enterprise.socialStaffNum,
        staffNumRange: preview.enterprise.staffNumRange,
        stockType: preview.enterprise.stockType,
        tagsJson: preview.enterprise.tagsJson,
        taxNumber: preview.enterprise.taxNumber,
        toTime: preview.enterprise.toTime,
        tycEnterpriseId: preview.enterprise.tycEnterpriseId,
        usedBondName: preview.enterprise.usedBondName,
        websiteListJson: preview.enterprise.websiteListJson,
      });
      await txBasicInfoRepo.save(basicInfo);

      const savedPersons: EnterprisePersonEntity[] = [];
      for (const person of preview.persons) {
        let personEntity = await txPersonRepo.findOne({
          where: {
            enterpriseId: enterprise.id,
            name: person.name,
            position: person.position,
          },
        });
        if (!personEntity) {
          personEntity = txPersonRepo.create({
            enterpriseId: enterprise.id,
            name: person.name,
            position: person.position,
          });
        }

        Object.assign(personEntity, {
          accountUserId: personEntity.accountUserId ?? null,
          email: person.email,
          extraJson: person.extraJson,
          isLegalPerson: person.isLegalPerson ? 1 : 0,
          personType: person.personType,
          phone: person.phone,
          source: 'tianyancha',
          tycPersonId: person.id,
        });
        savedPersons.push(await txPersonRepo.save(personEntity));
      }

      let createdOwnerCount = 0;
      let createdUserCount = 0;

      if (createAccounts) {
        const legalPerson = savedPersons.find((item) => item.isLegalPerson === 1);
        if (legalPerson) {
          const existingOwner = await txOwnerRepo.findOne({
            where: {
              enterpriseId: enterprise.id,
            },
          });

          if (existingOwner) {
            legalPerson.accountUserId = existingOwner.userId;
            await txPersonRepo.save(legalPerson);
          } else if (!legalPerson.accountUserId) {
            const ownerUser = await this.accountService.createAccount(
              {
                allowDuplicateEmail: true,
                allowDuplicatePhone: true,
                email: legalPerson.email,
                name: legalPerson.name,
                password: defaultPassword,
                phone: legalPerson.phone,
                remark: '由天眼查导入企业时自动创建，初始密码 123456',
                status: 1,
                username: await this.generateUsername(txUserRepo, `owner_${enterprise.id}`),
              },
              'enterprise_owner',
              {
                roleRepo: txRoleRepo,
                userRepo: txUserRepo,
                userRoleRepo: txUserRoleRepo,
              },
            );

            await txOwnerRepo.save(
              txOwnerRepo.create({
                enterpriseId: enterprise.id,
                remark: '天眼查导入自动创建',
                status: 1,
                userId: ownerUser.id,
              }),
            );
            legalPerson.accountUserId = ownerUser.id;
            await txPersonRepo.save(legalPerson);
            createdOwnerCount += 1;
          }
        }

        let userSequence = 1;
        for (const person of savedPersons.filter((item) => item.isLegalPerson !== 1)) {
          if (!selectedPersonIdSet.has(person.tycPersonId ?? '')) {
            continue;
          }
          if (person.accountUserId) {
            continue;
          }

          const createdUser = await this.accountService.createAccount(
            {
              allowDuplicateEmail: true,
              allowDuplicatePhone: true,
              email: person.email,
              name: person.name,
              password: defaultPassword,
              phone: person.phone,
              remark: '由天眼查导入企业时自动创建，初始密码 123456',
              status: 1,
              username: await this.generateUsername(
                txUserRepo,
                `user_${enterprise.id}_${userSequence}`,
              ),
            },
            'enterprise_user',
            {
              roleRepo: txRoleRepo,
              userRepo: txUserRepo,
              userRoleRepo: txUserRoleRepo,
            },
          );
          userSequence += 1;

          await txEnterpriseUserRepo.save(
            txEnterpriseUserRepo.create({
              enterpriseId: enterprise.id,
              isDefault: 0,
              remark: '天眼查导入自动创建',
              status: 1,
              userId: createdUser.id,
            }),
          );
          person.accountUserId = createdUser.id;
          await txPersonRepo.save(person);
          createdUserCount += 1;
        }
      }

      if (user.roles?.includes('project_teacher') && user.id) {
        const teacherBinding = await txTeacherRepo.findOne({
          where: { enterpriseId: enterprise.id },
        });
        if (!teacherBinding) {
          await txTeacherRepo.save(
            txTeacherRepo.create({
              enterpriseId: enterprise.id,
              remark: '项目老师导入企业时自动绑定',
              status: 1,
              teacherUserId: String(user.id),
            }),
          );
        }
      }

      return {
        createdOwnerCount,
        createdUserCount,
        enterpriseId: String(enterprise.id),
        enterpriseName: enterprise.name,
        existed,
      };
    });

    await Promise.all(
      preview.logIds.map((logId) =>
        this.tianyanchaLogService.bindEnterprise(logId, result.enterpriseId),
      ),
    );

    return {
      createAccounts,
      createdOwnerCount: result.createdOwnerCount,
      createdUserCount: result.createdUserCount,
      defaultPassword,
      enterpriseId: result.enterpriseId,
      enterpriseName: result.enterpriseName,
      existed: result.existed,
      message: result.existed ? '企业已存在，已完成资料同步' : '企业导入成功',
    };
  }

  private async loadPreview(externalId: string, actor: string): Promise<{
    enterprise: MappedEnterpriseDetail;
    logIds: string[];
    persons: MappedPersonDetail[];
  }> {
    const { data, logId } = await this.tianyanchaClient.request<Record<string, unknown>>({
      actor,
      apiCode: 'baseinfo_with_staff',
      apiName: '天眼查企业基本信息及主要人员',
      params: {
        keyword: externalId,
      },
      pathEnv: 'TIANYANCHA_BASEINFO_WITH_STAFF_PATH',
      tycEnterpriseId: externalId,
    });

    const detailRoot = this.extractDetailRoot(data);
    const enterprise = this.mapEnterpriseDetail(detailRoot, externalId);
    return {
      enterprise,
      logIds: [logId],
      persons: this.mapPersonDetails(detailRoot, enterprise),
    };
  }

  private extractSearchItems(response: Record<string, unknown>): EnterpriseImportSearchItem[] {
    const rawItems = this.extractArray(
      response,
      ['result', 'items'],
      ['result'],
      ['data', 'items'],
      ['data'],
      ['items'],
    );

    return rawItems
      .map((item) => this.ensureObject(item))
      .map((item) => {
        const externalId =
          this.pickString(item, 'id', 'gid', 'companyId', 'externalId') ?? '';
        const name = this.pickString(item, 'name', 'companyName') ?? '';
        if (!externalId || !name) {
          return null;
        }
        return {
          address: this.pickString(item, 'regLocation', 'address', 'base'),
          creditCode: this.pickString(item, 'creditCode', 'creditCodeNum', 'creditNo'),
          establishTime: this.formatDateValue(
            this.parseDateValue(item.estiblishTime ?? item.establishTime),
          ),
          externalId,
          legalPerson: this.pickString(item, 'legalPersonName', 'legalPerson', 'operName'),
          name,
          raw: item,
          regStatus: this.pickString(item, 'regStatus', 'regStatusWord', 'regStatusName'),
        } satisfies EnterpriseImportSearchItem;
      })
      .filter((item): item is EnterpriseImportSearchItem => !!item);
  }

  private extractDetailRoot(response: Record<string, unknown>): Record<string, any> {
    const result = this.pickValue(response, ['result'], ['data']);
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return result as Record<string, any>;
    }
    if (Array.isArray(result) && result[0] && typeof result[0] === 'object') {
      return result[0] as Record<string, any>;
    }
    return response;
  }

  private mapEnterpriseDetail(
    detailRoot: Record<string, any>,
    externalId: string,
  ): MappedEnterpriseDetail {
    return {
      address: this.pickString(detailRoot, 'regLocation', 'address'),
      alias: this.pickString(detailRoot, 'alias', 'shortName'),
      approvedTime: this.parseDateValue(detailRoot.approvedTime),
      base: this.pickString(detailRoot, 'base'),
      bondName: this.pickString(detailRoot, 'bondName'),
      bondNum: this.pickString(detailRoot, 'bondNum'),
      brnNumber: this.pickString(detailRoot, 'brnNumber'),
      businessScope: this.pickString(detailRoot, 'businessScope'),
      categoryCodeFirst: this.pickString(detailRoot, 'categoryCodeFirst'),
      categoryCodeFourth: this.pickString(detailRoot, 'categoryCodeFourth'),
      categoryCodeSecond: this.pickString(detailRoot, 'categoryCodeSecond'),
      categoryCodeThird: this.pickString(detailRoot, 'categoryCodeThird'),
      city: this.pickString(detailRoot, 'city'),
      companyOrgType: this.pickString(detailRoot, 'companyOrgType'),
      creditCode: this.pickString(detailRoot, 'creditCode', 'creditNo'),
      district: this.pickString(detailRoot, 'district'),
      email: this.pickPrimaryValue(detailRoot.email, detailRoot.emailList),
      emailListJson: this.serializeJson(this.toStringArray(detailRoot.emailList)),
      establishTime: this.parseDateValue(detailRoot.estiblishTime ?? detailRoot.establishTime),
      extraJson: JSON.stringify(detailRoot),
      fromTime: this.parseDateValue(detailRoot.fromTime),
      historyNames: this.serializeJson(this.toStringArray(detailRoot.historyNames)),
      industry: this.pickString(detailRoot, 'industry'),
      isMicroEnt: this.parseTinyInt(detailRoot.isMicroEnt),
      legalPersonName: this.pickString(detailRoot, 'legalPersonName', 'legalPerson', 'operName'),
      legalPersonType: this.pickString(detailRoot, 'legalPersonType'),
      logo: this.pickString(detailRoot, 'logo'),
      name: this.pickString(detailRoot, 'name', 'companyName') ?? `未命名企业_${externalId}`,
      percentileScore: this.pickString(detailRoot, 'percentileScore'),
      phoneListJson: this.serializeJson(this.toStringArray(detailRoot.phoneList)),
      phoneNumber: this.pickPrimaryValue(
        detailRoot.phoneNumber,
        detailRoot.phoneList,
        detailRoot.mobile,
      ),
      province: this.pickString(detailRoot, 'province'),
      regCapital: this.pickString(detailRoot, 'regCapital'),
      regInstitute: this.pickString(detailRoot, 'regInstitute'),
      regLocation: this.pickString(detailRoot, 'regLocation', 'address'),
      regNumber: this.pickString(detailRoot, 'regNumber'),
      regStatus: this.pickString(detailRoot, 'regStatus'),
      socialStaffNum: this.pickString(detailRoot, 'socialStaffNum'),
      staffNumRange: this.pickString(detailRoot, 'staffNumRange'),
      stockType: this.pickString(detailRoot, 'stockType'),
      tagsJson: this.serializeJson(this.toStringArray(detailRoot.tags)),
      taxNumber: this.pickString(detailRoot, 'taxNumber'),
      toTime: this.parseDateValue(detailRoot.toTime),
      tycEnterpriseId:
        this.pickString(detailRoot, 'id', 'gid', 'companyId', 'externalId') ?? externalId,
      usedBondName: this.pickString(detailRoot, 'usedBondName'),
      websiteListJson: this.serializeJson(this.toStringArray(detailRoot.websiteList)),
    };
  }

  private mapPersonDetails(
    detailRoot: Record<string, any>,
    enterprise: MappedEnterpriseDetail,
  ): MappedPersonDetail[] {
    const rawStaffItems = this.extractArray(
      detailRoot,
      ['staffList'],
      ['staffInfoList'],
      ['companyStaffList'],
      ['result', 'staffList'],
      ['data', 'staffList'],
    );

    const persons = rawStaffItems
      .map((item) => this.ensureObject(item))
      .map((item, index) => {
        const name = this.pickString(item, 'name', 'personName') ?? '';
        if (!name) {
          return null;
        }
        const position = this.pickString(item, 'position', 'title', 'jobTitle') ?? '';
        return {
          email: this.pickPrimaryValue(item.email, item.emailList),
          extraJson: JSON.stringify(item),
          id:
            this.pickString(item, 'id', 'personId', 'staffId', 'humanId') ??
            `${enterprise.tycEnterpriseId}_${index + 1}`,
          isLegalPerson:
            name === enterprise.legalPersonName ||
            ['legal_person', 'legalperson', '法人'].includes(
              (this.pickString(item, 'type', 'personType') ?? '').toLowerCase(),
            ),
          name,
          personType: ['shareholder'].includes(
            (this.pickString(item, 'type', 'personType') ?? '').toLowerCase(),
          )
            ? 'shareholder'
            : 'executive',
          phone: this.pickPrimaryValue(item.phone, item.phoneList, item.mobile),
          position,
        } satisfies MappedPersonDetail;
      })
      .filter((item): item is MappedPersonDetail => !!item);

    if (
      enterprise.legalPersonName &&
      !persons.some((item) => item.name === enterprise.legalPersonName)
    ) {
      persons.unshift({
        email: enterprise.email,
        extraJson: JSON.stringify({
          source: 'synthesized_legal_person',
        }),
        id: `${enterprise.tycEnterpriseId}_legal_person`,
        isLegalPerson: true,
        name: enterprise.legalPersonName,
        personType: 'legal_person',
        phone: enterprise.phoneNumber,
        position: '法人',
      });
    }

    for (const person of persons) {
      if (person.isLegalPerson) {
        person.personType = 'legal_person';
        if (!person.position) {
          person.position = '法人';
        }
      }
    }

    return persons;
  }

  private async findExistingEnterprise(
    enterprise: MappedEnterpriseDetail,
  ): Promise<EnterpriseEntity | null> {
    return this.findExistingEnterpriseTx(this.enterpriseRepo, this.basicInfoRepo, enterprise);
  }

  private async findExistingEnterpriseTx(
    enterpriseRepository: Repository<EnterpriseEntity>,
    basicInfoRepository: Repository<EnterpriseBasicInfoEntity>,
    enterprise: MappedEnterpriseDetail,
  ): Promise<EnterpriseEntity | null> {
    if (enterprise.creditCode) {
      const byCreditCode = await enterpriseRepository.findOne({
        where: {
          creditCode: enterprise.creditCode,
        },
      });
      if (byCreditCode) {
        return byCreditCode;
      }
    }

    const byTycEnterpriseId = await basicInfoRepository.findOne({
      where: {
        tycEnterpriseId: enterprise.tycEnterpriseId,
      },
    });
    if (!byTycEnterpriseId) {
      return null;
    }

    return enterpriseRepository.findOne({
      where: {
        id: byTycEnterpriseId.enterpriseId,
      },
    });
  }

  private fallbackCreditCode(enterprise: MappedEnterpriseDetail): string {
    return `TYC_${enterprise.tycEnterpriseId}`;
  }

  private generateInternalCode(): string {
    return `ENTERPRISE_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  private async generateUsername(
    userRepository: Repository<UserEntity>,
    baseUsername: string,
  ): Promise<string> {
    let candidate = baseUsername;
    let index = 0;
    while (await userRepository.findOne({ where: { username: candidate } })) {
      index += 1;
      candidate = `${baseUsername}_${Math.random().toString(36).slice(2, 6)}${index}`;
    }
    return candidate;
  }

  private parseJsonArray(value: null | string): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }

  private buildPersonUniqueKey(name: string, position: string): string {
    return `${name.trim()}__${position.trim()}`;
  }

  private serializeJson(value: unknown): null | string {
    if (value === null || value === undefined) {
      return null;
    }
    if (Array.isArray(value) && value.length === 0) {
      return null;
    }
    return JSON.stringify(value);
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  private extractArray(source: Record<string, any>, ...paths: string[][]): unknown[] {
    for (const path of paths) {
      const value = this.pickValue(source, path);
      if (Array.isArray(value)) {
        return value;
      }
    }
    return [];
  }

  private pickValue(source: Record<string, any>, ...paths: string[][]): unknown {
    for (const path of paths) {
      let current: unknown = source;
      let missing = false;
      for (const key of path) {
        if (!current || typeof current !== 'object' || !(key in current)) {
          missing = true;
          break;
        }
        current = (current as Record<string, unknown>)[key];
      }
      if (!missing) {
        return current;
      }
    }
    return undefined;
  }

  private ensureObject(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? (value as Record<string, any>) : {};
  }

  private pickString(source: Record<string, any>, ...keys: string[]): null | string {
    for (const key of keys) {
      const value = source[key];
      if (value === undefined || value === null) {
        continue;
      }
      const normalized = String(value).trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  private pickPrimaryValue(primary: unknown, list?: unknown, extra?: unknown): null | string {
    const primaryValue = this.normalizeString(primary);
    if (primaryValue) {
      return primaryValue;
    }
    const extraValue = this.normalizeString(extra);
    if (extraValue) {
      return extraValue;
    }
    const listValues = this.toStringArray(list);
    return listValues[0] ?? null;
  }

  private normalizeString(value: unknown): null | string {
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = String(value).trim();
    return normalized || null;
  }

  private parseDateValue(value: unknown): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number') {
      const date = new Date(value > 9999999999 ? value : value * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const stringValue = String(value).trim();
    if (!stringValue) {
      return null;
    }
    if (/^\d+$/.test(stringValue)) {
      const numericValue = Number(stringValue);
      const date = new Date(
        stringValue.length >= 13 ? numericValue : numericValue * 1000,
      );
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(stringValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseTinyInt(value: unknown): null | number {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const normalized = Number(value);
    return Number.isNaN(normalized) ? null : normalized;
  }

  private formatDateValue(value: Date | null): null | string {
    if (!value) {
      return null;
    }
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
