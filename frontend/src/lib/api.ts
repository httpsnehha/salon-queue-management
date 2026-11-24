export type ServiceOption = {
  id: string; name: string; name_gu: string; category: string; description: string;
  price: number; duration_minutes: number; is_active: number;
};
export type RegistrationInput = {
  customerName: string; phoneNumber: string; serviceId: string; preferredBarberId?: string | null;
};
export type RegistrationConfirmation = {
  id: string; customerName: string; phoneNumber: string; serviceId: string; serviceName: string;
  serviceNameGujarati: string; servicePrice: number; serviceDurationMinutes: number; tokenDate: string; tokenNumber: number;
  token: string; status: QueueStatus; registeredAt: string; preferredBarberId: string | null;
};
export type QueueStatus = "Waiting" | "Called" | "In chair" | "Done" | "Cancelled" | "No-show";
export type QueueRegistration = {
  id: string; customer_name: string; service_id: string; service_name: string;
  service_name_gu: string; service_price: number; service_duration_minutes: number; token_date: string;
  token_number: number; status: QueueStatus; registered_at: string;
  position: number | null; approximate_wait_minutes: number | null;
  preferred_barber_id: string | null; assigned_barber_id: string | null;
  assigned_barber_name: string | null; preferred_barber_name: string | null; called_at: string | null; service_started_at: string | null;
};
export type StaffQueueEntry = QueueRegistration;
export type QueueHistoryEntry = StaffQueueEntry;
export type QueueUpdate = { registrationId: string; status: QueueStatus };
export type BarberOption = { id: string; name: string; is_active: number; on_duty: number; on_break: number };
export type PublicSettings = { onlineQueueOpen: boolean; waitingCount: number; barbers: BarberOption[] };
export type QueueSettings = { onlineQueueOpen: boolean };
export type QueueStatistics = { customersServed: number; averageWaitingMinutes: number | null; noShows: number };
export type DisplayQueue = {
  nowServing: Array<{ id: string; token_number: number; service_name: string; status: "In chair"; barber_name: string | null }>;
  called: Array<{ id: string; token_number: number; service_name: string; status: "Called"; barber_name: string | null }>;
  upcoming: Array<{ id: string; token_number: number; service_name: string; status: "Waiting"; barber_name: string | null }>;
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}
async function readResponse<T>(response: Response): Promise<T> {
  let body: (T & { message?: string }) | undefined;
  if (response.status !== 204) {
    try { body = await response.json() as T & { message?: string }; } catch { body = undefined; }
  }
  if (!response.ok) throw new ApiError(body?.message || "The request could not be completed.", response.status);
  return body as T;
}
function json(method: string, value?: unknown) {
  return {
    method, credentials: "include" as const,
    headers: { "Content-Type": "application/json" },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  };
}
export async function getServices() {
  return readResponse<ServiceOption[]>(await fetch("/api/services"));
}
export async function getPublicSettings() {
  return readResponse<PublicSettings>(await fetch("/api/public/settings"));
}
export async function createRegistration(input: RegistrationInput) {
  return readResponse<RegistrationConfirmation>(await fetch("/api/registrations", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}
export async function getRegistration(id: string) {
  return readResponse<QueueRegistration>(await fetch("/api/registrations/" + encodeURIComponent(id)));
}
export async function getStaffQueue() {
  return readResponse<{ entries: StaffQueueEntry[] }>(await fetch("/api/staff/queue", { credentials: "include" }));
}
export async function getQueueHistory() {
  return readResponse<{ entries: QueueHistoryEntry[] }>(await fetch("/api/staff/history", { credentials: "include" }));
}
export async function createStaffSession(accessCode: string) {
  return readResponse<{ authenticated: boolean; expiresAt: number }>(await fetch("/api/staff/session", {
    ...json("POST", { accessCode }),
  }));
}
export async function endStaffSession() {
  return readResponse<void>(await fetch("/api/staff/session", json("DELETE")));
}
export async function changeQueueStatus(id: string, status: QueueStatus) {
  return readResponse<QueueUpdate>(await fetch("/api/staff/queue/" + encodeURIComponent(id) + "/status", json("PATCH", { status })));
}
export async function callNextForBarber(barberId: string) {
  return readResponse<{ id: string; token_number: number; status: "Called"; barberId: string; barberName: string; calledAt: string }>(
    await fetch("/api/staff/queue/call-next/" + encodeURIComponent(barberId), json("POST")),
  );
}
export async function createWalkIn(input: RegistrationInput) {
  return readResponse<RegistrationConfirmation>(await fetch("/api/staff/registrations", json("POST", input)));
}
export async function getDisplayQueue() {
  return readResponse<DisplayQueue>(await fetch("/api/display/queue"));
}
export async function getOwnerServices() {
  return readResponse<ServiceOption[]>(await fetch("/api/staff/services", { credentials: "include" }));
}
export async function saveService(input: Omit<ServiceOption, "id" | "is_active">, id?: string) {
  const url = id ? "/api/staff/services/" + encodeURIComponent(id) : "/api/staff/services";
  return readResponse<ServiceOption>(await fetch(url, json(id ? "PATCH" : "POST", input)));
}
export async function setServiceActive(id: string, active: boolean) {
  return readResponse<ServiceOption>(await fetch("/api/staff/services/" + encodeURIComponent(id) + "/active", json("PATCH", { active })));
}
export async function getQueueSettings() {
  return readResponse<QueueSettings>(await fetch("/api/staff/settings", { credentials: "include" }));
}
export async function setOnlineQueueOpen(onlineQueueOpen: boolean) {
  return readResponse<QueueSettings>(await fetch("/api/staff/settings/online-queue", json("PATCH", { onlineQueueOpen })));
}
export async function getBarbers() {
  return readResponse<BarberOption[]>(await fetch("/api/staff/barbers", { credentials: "include" }));
}
export async function createBarber(name: string) {
  return readResponse<BarberOption>(await fetch("/api/staff/barbers", json("POST", { name })));
}
export async function setBarberDuty(id: string, onDuty: boolean) {
  return readResponse<BarberOption>(await fetch("/api/staff/barbers/" + encodeURIComponent(id) + "/duty", json("PATCH", { onDuty })));
}
export async function setBarberBreak(id: string, onBreak: boolean) {
  return readResponse<BarberOption>(await fetch("/api/staff/barbers/" + encodeURIComponent(id) + "/break", json("PATCH", { onBreak })));
}
export async function getQueueStatistics() {
  return readResponse<QueueStatistics>(await fetch("/api/staff/statistics", { credentials: "include" }));
}
export async function getApiHealth() {
  return readResponse<{ status: string }>(await fetch("/api/health"));
}
