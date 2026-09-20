import { clearToken, getToken } from "./token";

export const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL && import.meta.env.PROD) {
  // Fail loudly in production builds instead of fetching "undefined/...".
  console.error(
    "[config] VITE_API_URL is not set. Point it at the live API, e.g. https://api.kabarbers.example.com",
  );
}

export type UserRole = "owner" | "customer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Service {
  id: string;
  owner_id: string;
  name: string;
  duration_minutes: number;
  description: string;
  is_active: boolean;
}

export interface Availability {
  id: string;
  service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface Booking {
  id: string;
  service_id: string;
  customer_id: string | null;
  slot_start: string;
  slot_end: string;
  status: string;
  created_at: string;
  /** Short customer-facing reference for guest status lookup. */
  reference_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  pax: number;
  notes: string | null;
  downpayment_status: string;
  payment_proof_url: string | null;
  arrival_time: string | null;
}

export interface ShopRule {
  id: number;
  title: string;
  text: string;
  order: number;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, error.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

// --- Auth ---
export async function login(email: string, password: string) {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({} as { detail?: string }));
    throw new Error(error.detail || "Login failed");
  }
  return res.json(); // { access_token, token_type }
}

export async function getMe(): Promise<User> {
  return request("/auth/me");
}

/** Return the currently authenticated user (null if no/invalid token). */
export async function getCurrentUser(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    return await getMe();
  } catch {
    return null;
  }
}

// --- Services (singleton haircut) ---
export async function getSingletonService(): Promise<Service> {
  return request("/services/singleton");
}

export async function updateSingletonService(data: { name: string; duration_minutes: number; description?: string }): Promise<Service> {
  return request("/services/singleton", { method: "PATCH", body: JSON.stringify(data) });
}

export async function getServiceAvailability(
  serviceId: string,
): Promise<Availability[]> {
  return request(`/services/${serviceId}/availability`);
}

export async function createAvailability(serviceId: string, data: { day_of_week: number; start_time: string; end_time: string }): Promise<Availability> {
  return request(`/services/${serviceId}/availability`, { method: "POST", body: JSON.stringify(data) });
}

export async function deleteAvailability(serviceId: string, availabilityId: string): Promise<void> {
  return request(`/services/${serviceId}/availability/${availabilityId}`, { method: "DELETE" });
}

export async function updateAvailability(serviceId: string, availabilityId: string, data: { day_of_week: number; start_time: string; end_time: string }): Promise<Availability> {
  return request(`/services/${serviceId}/availability/${availabilityId}`, { method: "PUT", body: JSON.stringify(data) });
}

// --- Bookings ---
export async function getAvailableSlots(
  serviceId: string | null,
  targetDate: string,
): Promise<string[]> {
  const sid = serviceId ? `service_id=${serviceId}&` : "";
  return request(`/bookings/available_slots?${sid}target_date=${targetDate}`);
}

export interface CreateBookingPublicData {
  service_id?: string;
  slot_start: string;
  customer_name: string;
  customer_phone: string;
  pax?: number;
  notes?: string;
}

export async function createPublicBooking(
  data: CreateBookingPublicData,
): Promise<Booking> {
  return request("/bookings/public", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Upload a GCash proof image file (JPG/PNG/WEBP). Uses multipart/form-data. */
export async function uploadPaymentProofFile(
  bookingId: string,
  file: File,
): Promise<Booking> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/bookings/${bookingId}/payment-proof-file`, {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: form,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Guest status lookup — reference code + booking phone, no login needed. */
export async function lookupBooking(code: string, phone: string): Promise<Booking> {
  const params = new URLSearchParams({ code: code.trim(), phone: phone.trim() });
  return request(`/bookings/lookup?${params.toString()}`);
}

/** Proof-file endpoint URL (private — fetch with auth, see fetchProofBlob). */
export function proofFileUrl(bookingId: string): string {
  return `${API_URL}/bookings/${bookingId}/proof-file`;
}

/** Download proof bytes with the stored token and return a blob object URL.
 *  Callers must revoke it with URL.revokeObjectURL (see useProofImage). */
export async function fetchProofBlob(bookingId: string): Promise<string> {
  const token = getToken();
  const res = await fetch(proofFileUrl(bookingId), {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Download failed" }));
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, error.detail || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// --- Gallery (owner-managed work showcase) ---
export interface GalleryPhoto {
  id: string;
  image_url: string;
  alt: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export async function getGallery(): Promise<GalleryPhoto[]> {
  return request("/gallery");
}

export async function uploadGalleryPhoto(
  file: File,
  alt: string,
  caption?: string,
): Promise<GalleryPhoto> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  form.append("alt", alt);
  if (caption && caption.trim()) form.append("caption", caption.trim());

  const res = await fetch(`${API_URL}/gallery`, {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: form,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateGalleryPhoto(
  photoId: string,
  data: { alt?: string; caption?: string | null; sort_order?: number },
): Promise<GalleryPhoto> {
  return request(`/gallery/${photoId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteGalleryPhoto(photoId: string): Promise<void> {
  return request(`/gallery/${photoId}`, {
    method: "DELETE",
  });
}

// --- Owner ---
export interface OwnerBookingFilters {
  status?: string;
  date?: string;
  service_id?: string;
}

export async function ownerListBookings(
  filters: OwnerBookingFilters = {},
): Promise<Booking[]> {
  const params = new URLSearchParams();
  if (filters.status) params.append("status", filters.status);
  if (filters.date) params.append("date", filters.date);
  if (filters.service_id) params.append("service_id", filters.service_id);

  return request(`/bookings/all?${params.toString()}`);
}

export async function ownerConfirmPayment(bookingId: string): Promise<Booking> {
  return request(`/bookings/${bookingId}/confirm-payment`, {
    method: "PATCH",
  });
}

export async function ownerMarkArrived(
  bookingId: string,
  arrivalTime?: string,
): Promise<Booking> {
  return request(`/bookings/${bookingId}/mark-arrived`, {
    method: "PATCH",
    body: JSON.stringify({ arrival_time: arrivalTime }),
  });
}

export async function ownerMarkComplete(bookingId: string): Promise<Booking> {
  return request(`/bookings/${bookingId}/mark-complete`, {
    method: "PATCH",
  });
}

export async function ownerMarkNoShow(bookingId: string): Promise<Booking> {
  return request(`/bookings/${bookingId}/mark-no-show`, {
    method: "PATCH",
  });
}

export async function ownerCancelBooking(bookingId: string): Promise<Booking> {
  return request(`/bookings/${bookingId}/cancel`, {
    method: "PATCH",
  });
}

export async function ownerDeleteBooking(bookingId: string): Promise<void> {
  return request(`/bookings/${bookingId}`, {
    method: "DELETE",
  });
}

// --- Shop Rules ---
export async function getShopRules(): Promise<ShopRule[]> {
  const res = await request<{ rules: ShopRule[] }>("/shop-rules");
  const rules = Array.isArray(res.rules) ? res.rules : [];
  return [...rules].sort((a, b) => a.order - b.order);
}

// --- Shop Status ---
export interface ShopStatus {
  id: string;
  is_open: boolean;
  shop_name: string;
  hero_image_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  gcash_number: string | null;
  gcash_account_name: string | null;
  gcash_qr_url: string | null;
  updated_at: string;
}

export async function getShopStatus(): Promise<ShopStatus> {
  return request("/shop/status");
}

export async function toggleShopStatus(isOpen: boolean): Promise<ShopStatus> {
  return request("/shop/status", {
    method: "PATCH",
    body: JSON.stringify({ is_open: isOpen }),
  });
}

export async function uploadHeroImage(file: File): Promise<ShopStatus> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/shop/hero-image`, {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: form,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function resetHeroImage(): Promise<ShopStatus> {
  return request("/shop/hero-image", {
    method: "DELETE",
  });
}

export async function updateShopSocials(data: {
  facebook_url?: string;
  tiktok_url?: string;
}): Promise<ShopStatus> {
  return request("/shop/socials", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateShopPayment(data: {
  gcash_number?: string;
  gcash_account_name?: string;
}): Promise<ShopStatus> {
  return request("/shop/payment", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function uploadGcashQr(file: File): Promise<ShopStatus> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/shop/gcash-qr`, {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: form,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function resetGcashQr(): Promise<ShopStatus> {
  return request("/shop/gcash-qr", {
    method: "DELETE",
  });
}

// --- Weekly Schedule ---
export interface SlotInfo {
  time: string;
  /** available: free · held: reserved, awaiting proof/review · booked: owner-confirmed */
  status: "available" | "held" | "booked";
}

export interface DaySchedule {
  date: string;
  day_name: string;
  slots: SlotInfo[];
}

export interface WeeklyScheduleResponse {
  is_open: boolean;
  days: DaySchedule[];
}

export async function getWeeklySchedule(startDate: string): Promise<WeeklyScheduleResponse> {
  return request(`/bookings/weekly-schedule?start_date=${startDate}`);
}

// --- Scheduling UI contract (server-derived slot truth) ---
// GET /bookings/availability?date=YYYY-MM-DD → full slot list with status
// GET /bookings/availability?month=YYYY-MM → per-day summary for dots.
// The frontend renders these verbatim — never derives status/expiry itself.

/** Canonical slot status for the scheduling UI. Backend may still send
 *  legacy "held" for day slots — normalized to "pending" on the way in. */
export type DaySlotStatus = "available" | "pending" | "booked";

export interface DaySlotAvailability {
  time: string;
  status: DaySlotStatus;
  /** ISO timestamp when a pending hold expires (null unless pending). */
  expires_at: string | null;
}

export interface DayAvailabilityResponse {
  date: string;
  is_open: boolean;
  slots: DaySlotAvailability[];
}

export interface MonthDaySummary {
  date: string;
  has_busy: boolean;
  has_pending: boolean;
  is_closed: boolean;
}

export interface MonthAvailabilityResponse {
  month: string;
  days: MonthDaySummary[];
}

function normalizeSlotStatus(raw: string): DaySlotStatus {
  if (raw === "held") return "pending";
  if (raw === "pending" || raw === "booked" || raw === "available") return raw;
  return "available";
}

export async function getDayAvailability(dateStr: string): Promise<DayAvailabilityResponse> {
  const res = await request<{ date: string; is_open: boolean; slots: Array<{ time: string; status: string; expires_at: string | null }> }>(
    `/bookings/availability?date=${dateStr}`,
  );
  return {
    date: res.date,
    is_open: res.is_open,
    slots: res.slots.map((s) => ({
      time: s.time,
      status: normalizeSlotStatus(s.status),
      expires_at: s.expires_at,
    })),
  };
}

export async function getMonthAvailability(month: string): Promise<MonthAvailabilityResponse> {
  return request(`/bookings/availability?month=${month}`);
}

/** True when an ApiError is the slot-race conflict (slot flipped
 *  Pending/Booked between day-load and submit). Carries the stable
 *  SLOT_TAKEN code from the backend (409), with a fallback to message
 *  matching for older backends that still return 400. */
export function isSlotTakenError(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 409) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /SLOT_TAKEN|just taken|no longer available/i.test(msg);
}

/** Customer-facing message for the slot-race conflict — never the raw error. */
export function slotTakenMessage(): string {
  return "Someone just took this slot. Pick another time — the day's slots were refreshed.";
}