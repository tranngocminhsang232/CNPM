import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ValidatePromotionDto {
  @ApiProperty({
    example: 'WELCOME2026',
    description: 'Mã khuyến mãi cần kiểm tra (không phân biệt hoa thường)',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    example: 2000000,
    description: 'Tổng tiền thuê xe trước giảm giá (VND) để kiểm tra điều kiện áp dụng',
  })
  @IsInt()
  @Min(0)
  subtotalVnd!: number;

  @ApiPropertyOptional({
    example: '10000000-0000-0000-0000-000000000001',
    description: 'Mã định danh xe (nếu có context xe cụ thể)',
  })
  @IsOptional()
  @IsString()
  vehicleId?: string;
}

export class ValidatedPromotionDto {
  @ApiProperty({ example: 'WELCOME2026', description: 'Mã khuyến mãi chuẩn hóa viết hoa' })
  code!: string;

  @ApiProperty({ example: 'Chào mừng thành viên mới: Giảm 10% tối đa 200.000 VND' })
  description!: string;

  @ApiProperty({ example: 'PERCENTAGE', enum: ['PERCENTAGE', 'FIXED_AMOUNT'] })
  discountType!: string;

  @ApiProperty({ example: 10, description: 'Giá trị giảm (% hoặc số tiền VND)' })
  discountValue!: number;

  @ApiPropertyOptional({ example: 200000, description: 'Mức giảm tối đa (VND) cho loại %' })
  maxDiscountVnd?: number | null;

  @ApiProperty({ example: 500000, description: 'Giá trị đơn hàng tối thiểu (VND)' })
  minOrderValueVnd!: number;

  @ApiProperty({ example: 200000, description: 'Số tiền giảm giá thực tế tính ra (VND)' })
  discountVnd!: number;

  @ApiProperty({ example: 2000000, description: 'Tổng tiền trước khi giảm giá (VND)' })
  subtotalBeforeDiscountVnd!: number;

  @ApiProperty({ example: 1800000, description: 'Tổng phụ sau khi trừ số tiền giảm giá (VND)' })
  subtotalAfterDiscountVnd!: number;

  @ApiProperty({ example: true, description: 'Mã khuyến mãi hợp lệ' })
  valid!: boolean;
}
