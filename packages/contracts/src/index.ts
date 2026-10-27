export * from './schema';
import type { components, operations } from './schema';

export type VehicleSummary = components['schemas']['VehicleSummaryDto'];
export type PaginationMeta = components['schemas']['PaginationMetaDto'];
export type VehicleOptions = components['schemas']['VehicleOptionsDto'];
export type AmenityOption = components['schemas']['AmenityOptionDto'];

export type User = components['schemas']['UserDto'];
export type AuthResponse = components['schemas']['AuthResponseDto'];
export type CsrfResponse = components['schemas']['CsrfResponseDto'];

export type DriverLicense = components['schemas']['DriverLicenseDto'];
export type SubmitDriverLicensePayload = components['schemas']['SubmitDriverLicenseDto'];
export type VerifyDriverLicensePayload = components['schemas']['VerifyDriverLicenseDto'];

export type GetVehiclesQuery = operations['VehiclesController_getVehicles']['parameters']['query'];
export type GetVehiclesResponse = {
  data: VehicleSummary[];
  meta: PaginationMeta;
};
export type GetVehicleOptionsResponse = {
  data: VehicleOptions;
};
export type LoginResponse = {
  data: AuthResponse;
};
export type RegisterResponse = {
  data: AuthResponse;
};
export type CsrfResponseWrapper = {
  data: CsrfResponse;
};
export type UserProfileResponse = {
  data: User;
};
export type DriverLicenseResponse = {
  data: DriverLicense | null;
};
