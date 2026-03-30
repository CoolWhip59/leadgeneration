import { ArrayMinSize, IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateJobDto {
  @IsArray()
  @ArrayMinSize(1)
  cityIds!: string[];

  @IsOptional()
  @IsString()
  @MinLength(2)
  categoryId?: string;
}
