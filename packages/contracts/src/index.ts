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

export type CreateUploadIntentPayload = components['schemas']['CreateUploadIntentDto'];
export type UploadIntentResponse = components['schemas']['UploadIntentResponseDto'];
export type MediaReadUrlResponse = components['schemas']['MediaReadUrlResponseDto'];
export type MediaObject = components['schemas']['MediaObjectDto'];

export type CreateVehiclePayload = components['schemas']['CreateVehicleDto'];
export type UpdateVehiclePayload = components['schemas']['UpdateVehicleDto'];
export type OwnerVehicle = components['schemas']['OwnerVehicleDto'];

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
export type OwnerVehiclesResponse = {
  data: OwnerVehicle[];
};
export type OwnerVehicleResponse = {
  data: OwnerVehicle;
};
export type UploadIntentResponseWrapper = {
  data: UploadIntentResponse;
};
export type MediaReadUrlResponseWrapper = {
  data: MediaReadUrlResponse;
};
export type MediaObjectResponseWrapper = {
  data: MediaObject;
};
