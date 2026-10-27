import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnerVehiclesController } from './owner-vehicles.controller';
import { OwnerVehiclesService } from './owner-vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [VehiclesController, OwnerVehiclesController],
  providers: [VehiclesService, OwnerVehiclesService],
  exports: [VehiclesService, OwnerVehiclesService],
})
export class VehiclesModule {}
