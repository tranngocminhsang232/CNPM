import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  API_PORT: number = 4000;

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET: string = 'carsharing_access_jwt_secret_dev_local_2026';

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string = 'carsharing_refresh_jwt_secret_dev_local_2026';

  @IsString()
  @IsOptional()
  S3_ENDPOINT: string = 'http://localhost:9000';

  @IsString()
  @IsOptional()
  S3_REGION: string = 'us-east-1';

  @IsString()
  @IsOptional()
  S3_BUCKET_PRIVATE: string = 'car-sharing-private';

  @IsString()
  @IsOptional()
  S3_ACCESS_KEY: string = 'minioadmin';

  @IsString()
  @IsOptional()
  S3_SECRET_KEY: string = 'minioadmin';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Config validation error: ${errors.toString()}`);
  }
  return validatedConfig;
}
