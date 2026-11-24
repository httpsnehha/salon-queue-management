import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type ServiceRecord = { id: string; name: string; category: string; description: string; price: number; duration_minutes: number };
export type RegistrationRecord = {
  id: string; customer_name: string; service_id: string;
  service_name: string; service_price: number; service_duration_minutes: number;
  token_date: string; token_number: number; status: string; registered_at: string;
  position: number | null; approximate_wait_minutes: number | null;
};

export class RegistrationError extends Error {
  constructor(message: string) { super(message); this.name = "RegistrationError"; }
}

const initialServices: ServiceRecord[] = [
  { id:"signature-cut", name:"Signature Haircut", category:"Hair", description:"A consultation-led cut finished with a smooth, polished style.", price:600, duration_minutes:45 },
  { id:"nourishing-hair-spa", name:"Nourishing Hair Spa", category:"Hair", description:"A relaxing cleanse and conditioning ritual for softer, shinier hair.", price:1200, duration_minutes:60 },
  { id:"radiance-facial", name:"Radiance Facial", category:"Skin", description:"A gentle facial treatment to leave your skin feeling refreshed.", price:1000, duration_minutes:50 },
  { id:"classic-manicure", name:"Classic Manicure", category:"Nails", description:"Nail shaping, cuticle care, and a neat finishing polish.", price:700, duration_minutes:40 },
  { id:"relaxing-pedicure", name:"Relaxing Pedicure", category:"Nails", description:"A soothing foot soak followed by nail and skin care.", price:900, duration_minutes:50 },
  { id:"brow-threading", name:"Brow Threading", category:"Grooming", description:"Careful shaping for a clean, natural-looking finish.", price:250, duration_minutes:20 },
];

export function initializeDatabase(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS services (" +
    "id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, " +
    "price INTEGER NOT NULL CHECK(price >= 0), duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0), " +
    "is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)))"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS queue_entries (" +
    "id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, phone_number TEXT NOT NULL, service_id TEXT NOT NULL, " +
    "service_name TEXT NOT NULL, service_price INTEGER NOT NULL CHECK(service_price >= 0), " +
    "service_duration_minutes INTEGER NOT NULL CHECK(service_duration_minutes > 0), " +
    "token_date TEXT NOT NULL, token_number INTEGER NOT NULL CHECK(token_number > 0), " +
    "status TEXT NOT NULL DEFAULT 'Waiting' CHECK(status IN ('Waiting','In Service','Completed','Cancelled')), " +
    "registered_at TEXT NOT NULL, UNIQUE(token_date, token_number))"
  );

  const insert = db.prepare(
    "INSERT OR IGNORE INTO services (id,name,category,description,price,duration_minutes) VALUES (?,?,?,?,?,?)"
  );
  for (const service of initialServices) {
    insert.run(service.id, service.name, service.category, service.description, service.price, service.duration_minutes);
  }
}

export function getServices(db: DatabaseSync): ServiceRecord[] {
  return db.prepare(
    "SELECT id,name,category,description,price,duration_minutes FROM services WHERE is_active=1 ORDER BY category,name"
  ).all() as ServiceRecord[];
}

export function getCalendarDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function validateName(value: unknown): string {
  if (typeof value !== "string") throw new RegistrationError("Enter your name.");
  const name = value.trim();
  if (name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name) || !/\p{L}/u.test(name)) {
    throw new RegistrationError("Enter a valid name between 2 and 100 characters.");
  }
  return name;
}

function validatePhone(value: unknown): string {
  if (typeof value !== "string") throw new RegistrationError("Enter your phone number.");
  const phone = value.trim();
  const digits = phone.replace(/\D/g, "");
  if (!/^\+?[0-9().\s-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    throw new RegistrationError("Enter a valid phone number with 7 to 15 digits.");
  }
  return phone;
}

export type RegistrationInput = { customerName?: unknown; phoneNumber?: unknown; serviceId?: unknown };

export function registerCustomer(db: DatabaseSync, input: RegistrationInput, now = new Date(), timeZone = process.env.QUEUE_TIME_ZONE || "Asia/Kolkata") {
  const customerName = validateName(input.customerName);
  const phoneNumber = validatePhone(input.phoneNumber);
  if (typeof input.serviceId !== "string" || input.serviceId.trim() === "") {
    throw new RegistrationError("Choose a service to join the queue.");
  }

  const serviceId = input.serviceId.trim();
  const tokenDate = getCalendarDate(now, timeZone);
  let transactionStarted = false;

  try {
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;

    const service = db.prepare(
      "SELECT id,name,price,duration_minutes FROM services WHERE id=? AND is_active=1"
    ).get(serviceId) as Pick<ServiceRecord, "id" | "name" | "price" | "duration_minutes"> | undefined;

    if (!service) throw new RegistrationError("That service is unavailable. Choose an available service.");

    const next = db.prepare(
      "SELECT COALESCE(MAX(token_number),0)+1 AS next_token FROM queue_entries WHERE token_date=?"
    ).get(tokenDate) as { next_token: number };

    const id = randomUUID();
    const registeredAt = now.toISOString();
    const tokenNumber = next.next_token;

    db.prepare(
      "INSERT INTO queue_entries (id,customer_name,phone_number,service_id,service_name,service_price," +
      "service_duration_minutes,token_date,token_number,status,registered_at) " +
      "VALUES (?,?,?,?,?,?,?,?,?,'Waiting',?)"
    ).run(
      id, customerName, phoneNumber, service.id, service.name, service.price,
      service.duration_minutes, tokenDate, tokenNumber, registeredAt,
    );

    db.exec("COMMIT");
    transactionStarted = false;

    return {
      id, customerName, phoneNumber, serviceId: service.id, serviceName: service.name,
      servicePrice: service.price, serviceDurationMinutes: service.duration_minutes,
      tokenDate, tokenNumber, token: "#" + String(tokenNumber).padStart(3, "0"),
      status: "Waiting", registeredAt,
    };
  } catch (error) {
    if (transactionStarted) db.exec("ROLLBACK");
    throw error;
  }
}

export function getRegistration(db: DatabaseSync, id: string): RegistrationRecord | undefined {
  const row = db.prepare(
    "SELECT id,customer_name,service_id,service_name,service_price," +
    "service_duration_minutes,token_date,token_number,status,registered_at FROM queue_entries WHERE id=?"
  ).get(id) as Omit<RegistrationRecord, "position" | "approximate_wait_minutes"> | undefined;
  if (!row) return undefined;

  let position: number | null = null;
  let wait: number | null = null;
  if (row.status === "Waiting") {
    const positionRow = db.prepare(
      "SELECT COUNT(*) AS position FROM queue_entries WHERE token_date=? AND status='Waiting' AND token_number<=?"
    ).get(row.token_date, row.token_number) as { position: number };
    const waitRow = db.prepare(
      "SELECT COALESCE(SUM(service_duration_minutes),0) AS wait_minutes FROM queue_entries " +
      "WHERE token_date=? AND ((status='Waiting' AND token_number<?) OR status='In Service')"
    ).get(row.token_date, row.token_number) as { wait_minutes: number };
    position = positionRow.position;
    wait = waitRow.wait_minutes;
  }
  return { ...row, position, approximate_wait_minutes: wait };
}