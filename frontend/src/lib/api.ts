export type ServiceOption = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration_minutes: number;
};

export type RegistrationInput = { customerName: string; phoneNumber: string; serviceId: string };

export type RegistrationConfirmation = {
  id: string; customerName: string; phoneNumber: string; serviceId: string;
  serviceName: string; servicePrice: number; serviceDurationMinutes: number;
  tokenDate: string; tokenNumber: number; token: string; status: string; registeredAt: string;
};

export type QueueRegistration = {
  id: string; customer_name: string; phone_number: string; service_id: string;
  service_name: string; service_price: number; service_duration_minutes: number;
  token_date: string; token_number: number; status: string; registered_at: string;
  position: number | null; approximate_wait_minutes: number | null;
};

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "The request could not be completed.");
  return body;
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
export async function getApiHealth() {
  return readResponse<{ status: string }>(await fetch("/api/health"));
}