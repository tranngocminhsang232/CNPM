import { Module } from '@nestjs/common';
import { KeylessController } from './keyless.controller';
import { KeylessService } from './keyless.service';
import { KeylessSimulatorAdapter } from './adapters/keyless-simulator.adapter';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [KeylessController],
  providers: [KeylessService, KeylessSimulatorAdapter],
  exports: [KeylessService, KeylessSimulatorAdapter],
})
export class KeylessModule {}
