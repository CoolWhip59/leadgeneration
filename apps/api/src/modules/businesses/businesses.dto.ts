import { IsOptional, IsString } from 'class-validator';

export class BusinessQueryDto {
  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  noWebsite?: string;
}
