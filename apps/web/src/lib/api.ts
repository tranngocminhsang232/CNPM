import type {
  GetVehiclesResponse,
  GetVehicleOptionsResponse,
  VehicleSummary,
  PaginationMeta,
  VehicleOptions,
} from '@carsharing/contracts';

export type { VehicleSummary, PaginationMeta, VehicleOptions };

export interface VehicleSearchParams {
  city?: string;
  carType?: string;
  keylessOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export async function fetchVehicles(
  params: VehicleSearchParams = {},
): Promise<GetVehiclesResponse> {
  const query = new URLSearchParams();
  if (params.city && params.city !== 'ALL') query.set('city', params.city);
  if (params.carType && params.carType !== 'ALL') query.set('carType', params.carType);
  if (params.keylessOnly) query.set('keylessOnly', 'true');
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const qs = query.toString();
  const url = qs ? `/api/v1/vehicles?${qs}` : '/api/v1/vehicles';

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let errorMsg = `Lỗi hệ thống (${res.status})`;
    try {
      const errorJson = await res.json();
      if (errorJson.error?.message) {
        errorMsg = errorJson.error.message;
      }
    } catch {
      // fallback to status code
    }
    throw new Error(errorMsg);
  }

  const json = await res.json();
  return json;
}

export async function fetchVehicleOptions(): Promise<GetVehicleOptionsResponse> {
  const res = await fetch('/api/v1/vehicle-options', {
    headers: {
      Accept: 'application/json',
    },
    cache: 'force-cache',
  });

  if (!res.ok) {
    throw new Error('Không thể tải danh mục bộ lọc');
  }

  return res.json();
}
