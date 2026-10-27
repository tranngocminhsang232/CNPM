export * from './schema';
import type { components, operations } from './schema';

export type VehicleSummary = components['schemas']['VehicleSummaryDto'];
export type PaginationMeta = components['schemas']['PaginationMetaDto'];
export type VehicleOptions = components['schemas']['VehicleOptionsDto'];
export type AmenityOption = components['schemas']['AmenityOptionDto'];

export type GetVehiclesQuery = operations['VehiclesController_getVehicles']['parameters']['query'];
export type GetVehiclesResponse = {
  data: VehicleSummary[];
  meta: PaginationMeta;
};
export type GetVehicleOptionsResponse = {
  data: VehicleOptions;
};
