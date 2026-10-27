import type {
  CreateUploadIntentPayload,
  CreateVehiclePayload,
  DriverLicense,
  DriverLicenseResponse,
  GetVehicleDetailResponse,
  GetVehicleOptionsResponse,
  GetVehiclesResponse,
  LoginResponse,
  MediaObject,
  MediaObjectResponseWrapper,
  MediaReadUrlResponse,
  MediaReadUrlResponseWrapper,
  OwnerVehicle,
  OwnerVehicleResponse,
  OwnerVehiclesResponse,
  PaginationMeta,
  PricingBreakdown,
  Quote,
  QuoteResponse,
  CalculatePricingPayload,
  SubmitDriverLicensePayload,
  UploadIntentResponse,
  UploadIntentResponseWrapper,
  User,
  UserProfileResponse,
  VehicleDetail,
  VehicleOptions,
  VehicleSummary,
} from '@carsharing/contracts';

export type {
  CalculatePricingPayload,
  DriverLicense,
  MediaObject,
  MediaReadUrlResponse,
  OwnerVehicle,
  PaginationMeta,
  PricingBreakdown,
  Quote,
  UploadIntentResponse,
  User,
  VehicleDetail,
  VehicleOptions,
  VehicleSummary,
};

export interface VehicleSearchParams {
  q?: string;
  brand?: string;
  city?: string;
  carType?: string;
  transmission?: string;
  seats?: number;
  minPrice?: number;
  maxPrice?: number;
  keylessOnly?: boolean;
  amenities?: string[];
  sort?: string;
  startAt?: string;
  endAt?: string;
  page?: number;
  pageSize?: number;
}

// -----------------------------------------------------------------------------
// Core Helper
// -----------------------------------------------------------------------------

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Lỗi hệ thống (${res.status})`;
    try {
      const errorJson = await res.json();
      if (errorJson.error?.message) {
        errorMsg = errorJson.error.message;
      }
    } catch {
      // fallback to status
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

// -----------------------------------------------------------------------------
// Public Vehicle APIs
// -----------------------------------------------------------------------------

export async function fetchVehicles(
  params: VehicleSearchParams = {},
): Promise<GetVehiclesResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.brand && params.brand !== 'ALL') query.set('brand', params.brand);
  if (params.city && params.city !== 'ALL') query.set('city', params.city);
  if (params.carType && params.carType !== 'ALL') query.set('carType', params.carType);
  if (params.transmission && params.transmission !== 'ALL')
    query.set('transmission', params.transmission);
  if (params.seats) query.set('seats', String(params.seats));
  if (params.minPrice !== undefined) query.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined) query.set('maxPrice', String(params.maxPrice));
  if (params.keylessOnly) query.set('keylessOnly', 'true');
  if (params.amenities && params.amenities.length > 0)
    query.set('amenities', params.amenities.join(','));
  if (params.sort) query.set('sort', params.sort);
  if (params.startAt) query.set('startAt', params.startAt);
  if (params.endAt) query.set('endAt', params.endAt);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const qs = query.toString();
  const url = qs ? `/api/v1/vehicles?${qs}` : '/api/v1/vehicles';

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  return handleResponse<GetVehiclesResponse>(res);
}

export async function fetchVehicleById(id: string): Promise<VehicleDetail> {
  const res = await fetch(`/api/v1/vehicles/${id}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const json = await handleResponse<GetVehicleDetailResponse>(res);
  return json.data;
}

export async function fetchVehicleOptions(): Promise<GetVehicleOptionsResponse> {
  const res = await fetch('/api/v1/vehicle-options', {
    headers: { Accept: 'application/json' },
    cache: 'force-cache',
  });

  return handleResponse<GetVehicleOptionsResponse>(res);
}

// -----------------------------------------------------------------------------
// Pricing Engine APIs (G2-02)
// -----------------------------------------------------------------------------

export async function calculateQuoteApi(payload: CalculatePricingPayload): Promise<Quote> {
  const res = await fetch('/api/v1/pricing/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<QuoteResponse>(res);
  return json.data;
}

export async function fetchPricingPreviewApi(
  vehicleId: string,
  startAt: string,
  endAt: string,
  insurancePackage: 'BASIC' | 'STANDARD' | 'PREMIUM' = 'BASIC',
  voucherCode?: string,
): Promise<Quote> {
  const query = new URLSearchParams({ startAt, endAt, insurancePackage });
  if (voucherCode) query.set('voucherCode', voucherCode);

  const res = await fetch(`/api/v1/vehicles/${vehicleId}/pricing-preview?${query.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const json = await handleResponse<QuoteResponse>(res);
  return json.data;
}

// -----------------------------------------------------------------------------
// Auth & User Profile APIs
// -----------------------------------------------------------------------------

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/v1/auth/csrf', {
    headers: { Accept: 'application/json' },
  });
  const data = await handleResponse<{ data: { csrfToken: string } }>(res);
  return data.data.csrfToken;
}

export async function loginApi(email: string, password: string): Promise<User> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await handleResponse<LoginResponse>(res);
  return json.data.user;
}

export async function logoutApi(csrfToken: string): Promise<void> {
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
  });
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch('/api/v1/auth/me', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 401) return null;
    const json = await handleResponse<UserProfileResponse>(res);
    return json.data;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// KYC & Driver License APIs
// -----------------------------------------------------------------------------

export async function fetchDriverLicense(): Promise<DriverLicense | null> {
  try {
    const res = await fetch('/api/v1/users/me/driver-license', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 401) return null;
    const json = await handleResponse<DriverLicenseResponse>(res);
    return json.data;
  } catch {
    return null;
  }
}

export async function submitDriverLicense(
  payload: SubmitDriverLicensePayload,
  csrfToken: string,
): Promise<DriverLicense> {
  const res = await fetch('/api/v1/users/me/driver-license', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<{ data: DriverLicense }>(res);
  return json.data;
}

// -----------------------------------------------------------------------------
// Media & S3 Upload APIs
// -----------------------------------------------------------------------------

export async function createUploadIntent(
  payload: CreateUploadIntentPayload,
  csrfToken: string,
): Promise<UploadIntentResponse> {
  const res = await fetch('/api/v1/media/upload-intents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<UploadIntentResponseWrapper>(res);
  return json.data;
}

export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: Blob | ArrayBuffer,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: file,
  });

  if (!res.ok) {
    throw new Error(`Tải ảnh lên storage thất bại (${res.status})`);
  }
}

export async function verifyMedia(mediaId: string, csrfToken: string): Promise<MediaObject> {
  const res = await fetch(`/api/v1/media/${mediaId}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
  });
  const json = await handleResponse<MediaObjectResponseWrapper>(res);
  return json.data;
}

export async function fetchMediaReadUrl(mediaId: string): Promise<string> {
  const res = await fetch(`/api/v1/media/${mediaId}/read-url`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const json = await handleResponse<MediaReadUrlResponseWrapper>(res);
  return json.data.url;
}

// -----------------------------------------------------------------------------
// Owner Vehicles APIs
// -----------------------------------------------------------------------------

export async function fetchOwnerVehicles(): Promise<OwnerVehicle[]> {
  const res = await fetch('/api/v1/owner/vehicles', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const json = await handleResponse<OwnerVehiclesResponse>(res);
  return json.data;
}

export async function fetchOwnerVehicleById(id: string): Promise<OwnerVehicle> {
  const res = await fetch(`/api/v1/owner/vehicles/${id}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const json = await handleResponse<OwnerVehicleResponse>(res);
  return json.data;
}

export async function createVehicle(
  payload: CreateVehiclePayload,
  csrfToken: string,
): Promise<OwnerVehicle> {
  const res = await fetch('/api/v1/owner/vehicles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<OwnerVehicleResponse>(res);
  return json.data;
}

export async function publishVehicle(id: string, csrfToken: string): Promise<OwnerVehicle> {
  const res = await fetch(`/api/v1/owner/vehicles/${id}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
  });
  const json = await handleResponse<OwnerVehicleResponse>(res);
  return json.data;
}
