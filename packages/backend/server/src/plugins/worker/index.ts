import './config';

import { Module } from '@nestjs/common';

import { WorkerController } from './controller';
import { MetadataProxyController } from './metadata';
import { WorkerService } from './service';
@Module({
  providers: [WorkerService],
  controllers: [WorkerController, MetadataProxyController],
})
export class WorkerModule {}
