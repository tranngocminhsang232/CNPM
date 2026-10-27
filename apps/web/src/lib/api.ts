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
  ValidatedPromotion,
  ValidatePromotionPayload,
  ValidatePromotionResponse,
  SubmitDriverLicensePayload,
  UploadIntentResponse,
  UploadIntentResponseWrapper,
  User,
  UserProfileResponse,
  VehicleDetail,
  VehicleOptions,
  VehicleSummary,
  Booking,
  BookingResponse,
  BookingsListResponse,
  CreateBookingPayload,
  RejectBookingPayload,
  CancelBookingPayload,
  Payment,
  PaymentResponse,
  CreatePaymentIntentPayload,
  SimulatePaymentPayload,
  Inspection,
  InspectionPhoto,
  SaveInspectionPayload,
  InspectionResponse,
  InspectionsListResponse,
  TriggerKeylessPayload,
  KeylessOperation,
  KeylessOperationResponse,
} from '@carsharing/contracts';

export type {
  Booking,
  CreateBookingPayload,
  RejectBookingPayload,
  CancelBookingPayload,
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
  ValidatedPromotion,
  ValidatePromotionPayload,
  VehicleDetail,
  VehicleOptions,
  VehicleSummary,
  Payment,
  CreatePaymentIntentPayload,
  SimulatePaymentPayload,
  Inspection,
  InspectionPhoto,
  SaveInspectionPayload,
  TriggerKeylessPayload,
  KeylessOperation,
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

export const fetchVehicleDetailApi = fetchVehicleById;

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

// -----------------------------------------------------------------------------
// Promotion & Voucher APIs
// -----------------------------------------------------------------------------

export async function validatePromotionApi(
  payload: ValidatePromotionPayload,
): Promise<ValidatedPromotion> {
  const res = await fetch('/api/v1/promotions/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<ValidatePromotionResponse>(res);
  return json.data;
}

// -----------------------------------------------------------------------------
// Booking APIs
// -----------------------------------------------------------------------------

export async function createBookingApi(
  payload: CreateBookingPayload,
  idempotencyKey: string,
  csrfToken: string,
): Promise<Booking> {
  const res = await fetch('/api/v1/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<BookingResponse>(res);
  return json.data;
}

export async function fetchBookingsApi(params?: {
  perspective?: 'renter' | 'owner';
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<BookingsListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.perspective) searchParams.set('perspective', params.perspective);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

  const query = searchParams.toString();
  const url = query ? `/api/v1/bookings?${query}` : '/api/v1/bookings';

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  return handleResponse<BookingsListResponse>(res);
}

export async function fetchBookingDetailApi(id: string): Promise<Booking> {
  const res = await fetch(`/api/v1/bookings/${id}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  const json = await handleResponse<BookingResponse>(res);
  return json.data;
}

export async function approveBookingApi(id: string, csrfToken: string): Promise<Booking> {
  const res = await fetch(`/api/v1/bookings/${id}/approve`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
  });
  const json = await handleResponse<BookingResponse>(res);
  return json.data;
}

export async function rejectBookingApi(
  id: string,
  reason: string,
  csrfToken: string,
): Promise<Booking> {
  const res = await fetch(`/api/v1/bookings/${id}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ reason }),
  });
  const json = await handleResponse<BookingResponse>(res);
  return json.data;
}

export async function cancelBookingApi(
  id: string,
  reason: string,
  csrfToken: string,
): Promise<Booking> {
  const res = await fetch(`/api/v1/bookings/${id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ reason }),
  });
  const json = await handleResponse<BookingResponse>(res);
  return json.data;
}

export async function completeBookingApi(id: string, csrfToken: string): Promise<Booking> {
  const res = await fetch(`/api/v1/bookings/${id}/complete`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
  });
  const json = await handleResponse<BookingResponse>(res);
  return json.data;
}

export async function createPaymentIntentApi(
  payload: CreatePaymentIntentPayload,
  csrfToken: string,
): Promise<Payment> {
  const res = await fetch('/api/v1/payments/create-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<PaymentResponse>(res);
  return json.data;
}

export async function simulatePaymentApi(payload: SimulatePaymentPayload): Promise<Payment> {
  const res = await fetch('/api/v1/payments/simulate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<PaymentResponse>(res);
  return json.data;
}

export async function fetchPaymentByRefApi(ref: string): Promise<Payment> {
  const res = await fetch(`/api/v1/payments/${encodeURIComponent(ref)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  const json = await handleResponse<PaymentResponse>(res);
  return json.data;
}

// -----------------------------------------------------------------------------
// Inspection & Handover APIs (G4-01)
// -----------------------------------------------------------------------------

export async function saveInspectionApi(
  bookingId: string,
  payload: SaveInspectionPayload,
  csrfToken: string,
): Promise<Inspection> {
  const res = await fetch(`/api/v1/bookings/${bookingId}/inspections`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<InspectionResponse>(res);
  return json.data;
}

export async function finalizeInspectionApi(
  bookingId: string,
  type: 'CHECK_IN' | 'CHECK_OUT',
  csrfToken: string,
): Promise<Inspection> {
  const res = await fetch(`/api/v1/bookings/${bookingId}/inspections/${type}/finalize`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
  });
  const json = await handleResponse<InspectionResponse>(res);
  return json.data;
}

export async function fetchInspectionsApi(bookingId: string): Promise<Inspection[]> {
  const res = await fetch(`/api/v1/bookings/${bookingId}/inspections`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  const json = await handleResponse<InspectionsListResponse>(res);
  return json.data;
}

export async function fetchInspectionByTypeApi(
  bookingId: string,
  type: 'CHECK_IN' | 'CHECK_OUT',
): Promise<Inspection | null> {
  const res = await fetch(`/api/v1/bookings/${bookingId}/inspections/${type}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  if (res.status === 404) return null;
  const json = await handleResponse<InspectionResponse>(res);
  return json.data;
}

// -----------------------------------------------------------------------------
// Keyless Operations APIs (G4-02)
// -----------------------------------------------------------------------------

export async function triggerKeylessOperationApi(
  bookingId: string,
  payload: TriggerKeylessPayload,
  idempotencyKey: string,
  csrfToken: string,
): Promise<KeylessOperation> {
  const res = await fetch(`/api/v1/bookings/${bookingId}/keyless-operations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-csrf-token': csrfToken,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<KeylessOperationResponse>(res);
  return json.data;
}

export async function fetchKeylessOperationApi(
  bookingId: string,
  operationId: string,
): Promise<KeylessOperation> {
  const res = await fetch(`/api/v1/bookings/${bookingId}/keyless-operations/${operationId}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  const json = await handleResponse<KeylessOperationResponse>(res);
  return json.data;
}

export async function reconcileKeylessOperationApi(
  bookingId: string,
  operationId: string,
  csrfToken: string,
): Promise<KeylessOperation> {
  const res = await fetch(
    `/api/v1/bookings/${bookingId}/keyless-operations/${operationId}/reconcile`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'x-csrf-token': csrfToken,
      },
    },
  );
  const json = await handleResponse<KeylessOperationResponse>(res);
  return json.data;
}
