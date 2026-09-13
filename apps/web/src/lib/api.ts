import { clearToken, getToken } from "./token";

export const API_URL = import.meta.env.VITE_API_URL;

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

// --- Weekly Schedule ---
export interface SlotInfo {
  time: string;
  status: "available" | "booked";
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