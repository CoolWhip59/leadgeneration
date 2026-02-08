import { IsString, MinLength } from 'class-validator';

export class CreateCityDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  country!: string;
}
