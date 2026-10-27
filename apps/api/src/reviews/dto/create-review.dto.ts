import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsString, MaxLength } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'Điểm đánh giá từ 1 đến 5 sao',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt({ message: 'Điểm đánh giá phải là số nguyên' })
  @Min(1, { message: 'Điểm đánh giá tối thiểu là 1 sao' })
  @Max(5, { message: 'Điểm đánh giá tối đa là 5 sao' })
  score!: number;

  @ApiProperty({
    description: 'Nhận xét chi tiết (tối đa 2.000 ký tự)',
    example: 'Xe chạy rất êm, sạch sẽ, chủ xe nhiệt tình và giao xe đúng giờ!',
    maxLength: 2000,
  })
  @IsString({ message: 'Nội dung nhận xét phải là chuỗi ký tự' })
  @MaxLength(2000, { message: 'Nhận xét không được vượt quá 2.000 ký tự' })
  comment!: string;
}
