import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DeptEntity } from '../entities/dept.entity';

@Injectable()
export class DeptRepository {
  constructor(
    @InjectRepository(DeptEntity)
    private readonly deptRepo: Repository<DeptEntity>,
  ) {}

  async findAll(): Promise<DeptEntity[]> {
    return this.deptRepo.find({
      order: {
        id: 'ASC',
      },
    });
  }
}
