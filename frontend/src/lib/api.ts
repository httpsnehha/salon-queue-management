export type ServiceOption = {
  id: string; name: string; category: string; description: string; price: number; duration_minutes: number;
};
export type RegistrationInput = { customerName: string; phoneNumber: string; serviceId: string };
export type RegistrationConfirmation = {
  id: string; customerName: string; phoneNumber: string; serviceId: string; serviceName: string;
  servicePrice: number; serviceDurationMinutes: number; tokenDate: string; tokenNumber: number;
  token: string; status: string; registeredAt: string;
};
export type QueueRegistration = {
  id: string; customer_name: string; service_id: string; service_name: string;
  service_price: number; service_duration_minutes: number; token_date: string;
  token_number: number; status: string; registered_at: string;
  position: number | null; approximate_wait_minutes: number | null;
};
export type QueueStatus = "Waiting" | "In Service" | "Completed" | "Cancelled";
export type StaffQueueEntry = {
  id: string; token_date: string; token_number: number; customer_name: string;
  service_name: string; service_duration_minutes: number; registered_at: string; status: QueueStatus;
};
export type QueueUpdate = { registrationId: string; status: QueueStatus };
export type DisplayQueue = {
  nowServing: Array<{ id: string; token_number: number; service_name: string; status: "In Service" }>;
  upcoming: Array<{ id: string; token_number: number; service_name: string; status: "Waiting" }>;
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
    try {
      body = await response.json() as T & { message?: string };
    } catch {
      body = undefined;
    }
  }
  if (!response.ok) throw new ApiError(body?.message || "The request could not be completed.", response.status);
  return body as T;
}

export async function getServices() {
  return readResponse<ServiceOption[]>(await fetch("/api/services"));
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
export async function createStaffSession(accessCode: string) {
  return readResponse<{ authenticated: boolean; expiresAt: number }>(await fetch("/api/staff/session", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessCode }),
  }));
}
export async function endStaffSession() {
  return readResponse<void>(await fetch("/api/staff/session", {
    method: "DELETE", credentials: "include",
  }));
}
export async function changeQueueStatus(id: string, status: QueueStatus) {
  return readResponse<QueueUpdate>(await fetch("/api/staff/queue/" + encodeURIComponent(id) + "/status", {
    method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }));
}
export async function getDisplayQueue() {
  return readResponse<DisplayQueue>(await fetch("/api/display/queue"));
}
export async function getApiHealth() {
  return readResponse<{ status: string }>(await fetch("/api/health"));
}