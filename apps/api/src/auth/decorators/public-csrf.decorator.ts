import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_CSRF_KEY = 'isPublicCsrf';
export const PublicCsrf = () => SetMetadata(IS_PUBLIC_CSRF_KEY, true);
