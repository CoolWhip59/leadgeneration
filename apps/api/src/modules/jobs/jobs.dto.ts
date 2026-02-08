import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class CreateJobDto {
  @IsArray()
  @ArrayMinSize(1)
  cityIds!: string[];

  @IsString()
  @MinLength(2)
  categoryId!: string;
}
