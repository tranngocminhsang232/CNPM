import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value || typeof value !== 'string' || !UUID_REGEX.test(value)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Validation failed (uuid is expected)',
      });
    }
    return value;
  }
}
