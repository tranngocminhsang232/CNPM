import { ApiProperty } from '@nestjs/swagger';

export class AmenityOptionDto {
  @ApiProperty({ example: 'GPS' })
  code!: string;

  @ApiProperty({ example: 'Định vị GPS' })
  name!: string;
}

export class VehicleOptionsDto {
  @ApiProperty({ example: ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'] })
  cities!: string[];

  @ApiProperty({ example: ['SEDAN', 'SUV', 'HATCHBACK', 'MPV', 'CROSSOVER'] })
  carTypes!: string[];

  @ApiProperty({ example: ['AUTO', 'MANUAL'] })
  transmissions!: string[];

  @ApiProperty({ type: [AmenityOptionDto] })
  amenities!: AmenityOptionDto[];
}
