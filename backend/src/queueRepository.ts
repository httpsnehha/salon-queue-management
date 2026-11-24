import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type QueueStatus = "Waiting" | "Called" | "In chair" | "Done" | "Cancelled" | "No-show";
export type ServiceRecord = {
  id: string; name: string; name_gu: string; category: string; description: string;
  price: number; duration_minutes: number; is_active: number;
};
export type BarberRecord = {
  id: string; name: string; is_active: number; on_duty: number; on_break: number;
};
export type QueueEntry = {
  id: string; token_date: string; token_number: number; customer_name: string;
  service_id: string; service_name: string; service_name_gu: string; service_price: number;
  service_duration_minutes: number; preferred_barber_id: string | null;
  assigned_barber_id: string | null; assigned_barber_name: string | null; preferred_barber_name: string | null;
  registered_at: string; called_at: string | null; service_started_at: string | null;
  status: QueueStatus;
};
export type RegistrationInput = {
  customerName?: unknown; phoneNumber?: unknown; serviceId?: unknown;
  preferredBarberId?: unknown;
};

export class RegistrationError extends Error { constructor(message: string) { super(message); } }
export class QueueEntryNotFoundError extends Error { constructor() { super("Queue entry not found."); } }
export class QueueTransitionError extends Error { constructor(message: string) { super(message); } }
export class ServiceValidationError extends Error { constructor(message: string) { super(message); } }
export class BarberValidationError extends Error { constructor(message: string) { super(message); } }
export class QueueClosedError extends Error { constructor() { super("Online queue registration is closed. Please contact the salon or visit in person."); } }

const initialServices = [
  { id:"signature-cut", name:"Signature Haircut", name_gu:"\u0ab8\u0abf\u0a97\u0acd\u0aa8\u0ac7\u0a9a\u0ab0 \u0ab9\u0ac7\u0ab0\u0a95\u0a9f", category:"Hair", description:"A consultation-led cut finished with a smooth, polished style.", price:600, duration_minutes:45 },
  { id:"nourishing-hair-spa", name:"Nourishing Hair Spa", name_gu:"\u0aaa\u0acc\u0ab7\u0acd\u0a9f\u0abf\u0a95 \u0ab9\u0ac7\u0ab0 \u0ab8\u0acd\u0aaa\u0abe", category:"Hair", description:"A relaxing cleanse and conditioning ritual for softer, shinier hair.", price:1200, duration_minutes:60 },
  { id:"radiance-facial", name:"Radiance Facial", name_gu:"\u0ab0\u0ac7\u0aa1\u0abf\u0aaf\u0aa8\u0acd\u0ab8 \u0aab\u0ac7\u0ab6\u0abf\u0aaf\u0ab2", category:"Skin", description:"A gentle facial treatment to leave your skin feeling refreshed.", price:1000, duration_minutes:50 },
  { id:"classic-manicure", name:"Classic Manicure", name_gu:"\u0a95\u0acd\u0ab2\u0abe\u0ab8\u0abf\u0a95 \u0aae\u0ac7\u0aa8\u0abf\u0a95\u0acd\u0aaf\u0ac1\u0ab0", category:"Nails", description:"Nail shaping, cuticle care, and a neat finishing polish.", price:700, duration_minutes:40 },
  { id:"relaxing-pedicure", name:"Relaxing Pedicure", name_gu:"\u0ab0\u0abf\u0ab2\u0ac7\u0a95\u0acd\u0ab8\u0abf\u0a82\u0a97 \u0aaa\u0ac7\u0aa1\u0abf\u0a95\u0acd\u0aaf\u0ac1\u0ab0", category:"Nails", description:"A soothing foot soak followed by nail and skin care.", price:900, duration_minutes:50 },
  { id:"brow-threading", name:"Brow Threading", name_gu:"\u0aad\u0acd\u0ab0\u0ac2 \u0aa5\u0acd\u0ab0\u0ac7\u0aa1\u0abf\u0a82\u0a97", category:"Grooming", description:"Careful shaping for a clean, natural-looking finish.", price:250, duration_minutes:20 },
];

function tableExists(db: DatabaseSync, table: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
}
function columns(db: DatabaseSync, table: string): Set<string> {
  return new Set((db.prepare("PRAGMA table_info(" + table + ")").all() as Array<{ name: string }>).map((column) => column.name));
}
function createQueueTable(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE queue_entries (" +
    "id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, phone_number TEXT NOT NULL, service_id TEXT NOT NULL, " +
    "service_name TEXT NOT NULL, service_name_gu TEXT NOT NULL DEFAULT '', service_price INTEGER NOT NULL CHECK(service_price >= 0), " +
    "service_duration_minutes INTEGER NOT NULL CHECK(service_duration_minutes > 0), " +
    "token_date TEXT NOT NULL, token_number INTEGER NOT NULL CHECK(token_number > 0), " +
    "status TEXT NOT NULL DEFAULT 'Waiting' CHECK(status IN ('Waiting','Called','In chair','Done','Cancelled','No-show')), " +
    "registered_at TEXT NOT NULL, preferred_barber_id TEXT, assigned_barber_id TEXT, called_at TEXT, " +
    "service_started_at TEXT, service_done_at TEXT, UNIQUE(token_date, token_number))"
  );
}

export function initializeDatabase(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS services (" +
    "id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, " +
    "price INTEGER NOT NULL CHECK(price >= 0), duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0), " +
    "is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)))"
  );
  if (!columns(db, "services").has("name_gu")) {
    db.exec("ALTER TABLE services ADD COLUMN name_gu TEXT NOT NULL DEFAULT ''");
  }

  if (!tableExists(db, "queue_entries")) {
    createQueueTable(db);
  } else {
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='queue_entries'").get() as { sql: string };
    if (!schema.sql.includes("'Called'")) {
      db.exec("BEGIN IMMEDIATE");
      try {
        db.exec("ALTER TABLE queue_entries RENAME TO queue_entries_before_workflow_migration");
        createQueueTable(db);
        db.exec(
          "INSERT INTO queue_entries (id,customer_name,phone_number,service_id,service_name,service_name_gu,service_price," +
          "service_duration_minutes,token_date,token_number,status,registered_at) " +
          "SELECT q.id,q.customer_name,q.phone_number,q.service_id,q.service_name,COALESCE(s.name_gu,''),q.service_price,q.service_duration_minutes," +
          "q.token_date,q.token_number,CASE q.status WHEN 'In Service' THEN 'In chair' WHEN 'Completed' THEN 'Done' ELSE q.status END,q.registered_at " +
          "FROM queue_entries_before_workflow_migration q LEFT JOIN services s ON s.id=q.service_id"
        );
        db.exec("DROP TABLE queue_entries_before_workflow_migration");
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    } else {
      const existing = columns(db, "queue_entries");
      const additions: Array<[string, string]> = [
        ["service_name_gu", "TEXT NOT NULL DEFAULT ''"], ["preferred_barber_id", "TEXT"], ["assigned_barber_id", "TEXT"], ["called_at", "TEXT"],
        ["service_started_at", "TEXT"], ["service_done_at", "TEXT"],
      ];
      for (const [name, type] of additions) if (!existing.has(name)) db.exec("ALTER TABLE queue_entries ADD COLUMN " + name + " " + type);
    }
  }

  db.exec(
    "CREATE TABLE IF NOT EXISTS barbers (" +
    "id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100), " +
    "is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)))"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS barber_availability (" +
    "barber_id TEXT NOT NULL, availability_date TEXT NOT NULL, " +
    "on_duty INTEGER NOT NULL DEFAULT 0 CHECK(on_duty IN (0,1)), " +
    "on_break INTEGER NOT NULL DEFAULT 0 CHECK(on_break IN (0,1)), " +
    "PRIMARY KEY(barber_id,availability_date), FOREIGN KEY(barber_id) REFERENCES barbers(id))"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS queue_settings (" +
    "id INTEGER PRIMARY KEY CHECK(id=1), online_queue_open INTEGER NOT NULL DEFAULT 1 CHECK(online_queue_open IN (0,1)))"
  );
  db.prepare("INSERT OR IGNORE INTO queue_settings (id,online_queue_open) VALUES (1,1)").run();

  db.exec("UPDATE queue_entries SET service_name_gu=COALESCE((SELECT name_gu FROM services WHERE services.id=queue_entries.service_id),'') WHERE service_name_gu=''");

  const insert = db.prepare(
    "INSERT OR IGNORE INTO services (id,name,name_gu,category,description,price,duration_minutes) VALUES (?,?,?,?,?,?,?)"
  );
  const updateGujarati = db.prepare("UPDATE services SET name_gu=? WHERE id=? AND name_gu=''");
  for (const service of initialServices) {
    insert.run(service.id, service.name, service.name_gu, service.category, service.description, service.price, service.duration_minutes);
    updateGujarati.run(service.name_gu, service.id);
  }
}

export function getCalendarDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}
function validateName(value: unknown, label = "Enter your name.") {
  if (typeof value !== "string") throw new RegistrationError(label);
  const name = value.trim();
  if (name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name) || !/\p{L}/u.test(name)) {
    throw new RegistrationError("Enter a valid name between 2 and 100 characters.");
  }
  return name;
}
function validatePhone(value: unknown) {
  if (typeof value !== "string") throw new RegistrationError("Enter your phone number.");
  const phone = value.trim();
  const digits = phone.replace(/\D/g, "");
  if (!/^\+?[0-9().\s-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    throw new RegistrationError("Enter a valid phone number with 7 to 15 digits.");
  }
  return phone;
}
function validateService(input: Record<string, unknown>) {
  let name: string;
  let gujaratiName: string;
  let category: string;
  let description: string;
  if (typeof input.name !== "string" || !(name = input.name.trim()) || name.length > 100) throw new ServiceValidationError("Enter an English service name up to 100 characters.");
  if (typeof input.name_gu !== "string" || !(gujaratiName = input.name_gu.trim()) || gujaratiName.length > 100) throw new ServiceValidationError("Enter a Gujarati service name up to 100 characters.");
  if (typeof input.category !== "string" || !(category = input.category.trim()) || category.length > 60) throw new ServiceValidationError("Enter a service category up to 60 characters.");
  if (typeof input.description !== "string" || !(description = input.description.trim()) || description.length > 500) throw new ServiceValidationError("Enter a service description up to 500 characters.");
  const price = Number(input.price);
  const duration = Number(input.duration_minutes);
  if (!Number.isInteger(price) || price < 0) throw new ServiceValidationError("Price must be a non-negative whole number.");
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) throw new ServiceValidationError("Duration must be a positive number of minutes.");
  return { name, name_gu: gujaratiName, category, description, price, duration_minutes: duration };
}
export function getServices(db: DatabaseSync, includeInactive = false): ServiceRecord[] {
  const where = includeInactive ? "" : " WHERE is_active=1";
  return db.prepare("SELECT id,name,name_gu,category,description,price,duration_minutes,is_active FROM services" + where + " ORDER BY category,name").all() as ServiceRecord[];
}
export function saveService(db: DatabaseSync, input: Record<string, unknown>, id?: string): ServiceRecord {
  const values = validateService(input);
  if (id) {
    const result = db.prepare(
      "UPDATE services SET name=?,name_gu=?,category=?,description=?,price=?,duration_minutes=? WHERE id=?"
    ).run(values.name, values.name_gu, values.category, values.description, values.price, values.duration_minutes, id);
    if (result.changes !== 1) throw new ServiceValidationError("Service not found.");
    return db.prepare("SELECT id,name,name_gu,category,description,price,duration_minutes,is_active FROM services WHERE id=?").get(id) as ServiceRecord;
  }
  const newId = randomUUID();
  db.prepare("INSERT INTO services (id,name,name_gu,category,description,price,duration_minutes,is_active) VALUES (?,?,?,?,?,?,?,1)")
    .run(newId, values.name, values.name_gu, values.category, values.description, values.price, values.duration_minutes);
  return db.prepare("SELECT id,name,name_gu,category,description,price,duration_minutes,is_active FROM services WHERE id=?").get(newId) as ServiceRecord;
}
export function setServiceActive(db: DatabaseSync, id: string, active: unknown) {
  if (typeof active !== "boolean") throw new ServiceValidationError("Choose whether the service is on or off.");
  const result = db.prepare("UPDATE services SET is_active=? WHERE id=?").run(active ? 1 : 0, id);
  if (result.changes !== 1) throw new ServiceValidationError("Service not found.");
  return db.prepare("SELECT id,name,name_gu,category,description,price,duration_minutes,is_active FROM services WHERE id=?").get(id) as ServiceRecord;
}
export function getQueueSettings(db: DatabaseSync) {
  const row = db.prepare("SELECT online_queue_open FROM queue_settings WHERE id=1").get() as { online_queue_open: number };
  return { onlineQueueOpen: row.online_queue_open === 1 };
}
export function setOnlineQueueOpen(db: DatabaseSync, value: unknown) {
  if (typeof value !== "boolean") throw new ServiceValidationError("Queue open must be true or false.");
  db.prepare("UPDATE queue_settings SET online_queue_open=? WHERE id=1").run(value ? 1 : 0);
  return getQueueSettings(db);
}
export function getBarbers(db: DatabaseSync, date: string, includeInactive = false): BarberRecord[] {
  const activeClause = includeInactive ? "" : "WHERE b.is_active=1 ";
  return db.prepare(
    "SELECT b.id,b.name,b.is_active,COALESCE(a.on_duty,0) AS on_duty,COALESCE(a.on_break,0) AS on_break " +
    "FROM barbers b LEFT JOIN barber_availability a ON a.barber_id=b.id AND a.availability_date=? " +
    activeClause + "ORDER BY b.name"
  ).all(date) as BarberRecord[];
}
export function createBarber(db: DatabaseSync, value: unknown) {
  const name = validateName(value, "Enter a barber name.");
  const id = randomUUID();
  db.prepare("INSERT INTO barbers (id,name) VALUES (?,?)").run(id, name);
  return db.prepare("SELECT id,name,is_active,0 AS on_duty,0 AS on_break FROM barbers WHERE id=?").get(id) as BarberRecord;
}
export function setBarberDuty(db: DatabaseSync, id: string, date: string, value: unknown) {
  if (typeof value !== "boolean") throw new BarberValidationError("On-duty value must be true or false.");
  if (!db.prepare("SELECT id FROM barbers WHERE id=? AND is_active=1").get(id)) throw new BarberValidationError("Barber not found.");
  db.prepare(
    "INSERT INTO barber_availability (barber_id,availability_date,on_duty,on_break) VALUES (?,?,?,0) " +
    "ON CONFLICT(barber_id,availability_date) DO UPDATE SET on_duty=excluded.on_duty,on_break=CASE WHEN excluded.on_duty=0 THEN 0 ELSE barber_availability.on_break END"
  ).run(id, date, value ? 1 : 0);
  return getBarbers(db, date, true).find((barber) => barber.id === id)!;
}
export function setBarberBreak(db: DatabaseSync, id: string, date: string, value: unknown) {
  if (typeof value !== "boolean") throw new BarberValidationError("Break value must be true or false.");
  const barber = db.prepare(
    "SELECT b.id,COALESCE(a.on_duty,0) AS on_duty FROM barbers b LEFT JOIN barber_availability a " +
    "ON a.barber_id=b.id AND a.availability_date=? WHERE b.id=? AND b.is_active=1"
  ).get(date, id) as { id: string; on_duty: number } | undefined;
  if (!barber) throw new BarberValidationError("Barber not found.");
  if (value && !barber.on_duty) throw new BarberValidationError("A barber must be on duty before going on break.");
  if (value && db.prepare("SELECT id FROM queue_entries WHERE assigned_barber_id=? AND status='Called'").get(id)) throw new BarberValidationError("A barber cannot go on break while a customer is waiting for service.");
  db.prepare(
    "INSERT INTO barber_availability (barber_id,availability_date,on_duty,on_break) VALUES (?,?,1,?) " +
    "ON CONFLICT(barber_id,availability_date) DO UPDATE SET on_break=excluded.on_break"
  ).run(id, date, value ? 1 : 0);
  return getBarbers(db, date, true).find((item) => item.id === id)!;
}

export function registerCustomer(db: DatabaseSync, input: RegistrationInput, now = new Date(), timeZone = process.env.QUEUE_TIME_ZONE || "Asia/Kolkata", staffWalkIn = false) {
  const customerName = validateName(input.customerName);
  const phoneNumber = validatePhone(input.phoneNumber);
  if (typeof input.serviceId !== "string" || input.serviceId.trim() === "") throw new RegistrationError("Choose a service to join the queue.");
  if (input.preferredBarberId !== undefined && input.preferredBarberId !== null && typeof input.preferredBarberId !== "string") {
    throw new RegistrationError("Choose a valid barber or Any available barber.");
  }
  const serviceId = input.serviceId.trim();
  const barberId = typeof input.preferredBarberId === "string" && input.preferredBarberId.trim() ? input.preferredBarberId.trim() : null;
  const tokenDate = getCalendarDate(now, timeZone);
  let transactionStarted = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    if (!staffWalkIn && !getQueueSettings(db).onlineQueueOpen) throw new QueueClosedError();
    const service = db.prepare("SELECT id,name,name_gu,price,duration_minutes FROM services WHERE id=? AND is_active=1").get(serviceId) as
      { id: string; name: string; name_gu: string; price: number; duration_minutes: number } | undefined;
    if (!service) throw new RegistrationError("That service is unavailable. Choose an available service.");
    if (barberId) {
      const barber = db.prepare(
        "SELECT b.id,COALESCE(a.on_duty,0) AS on_duty,COALESCE(a.on_break,0) AS on_break FROM barbers b " +
        "LEFT JOIN barber_availability a ON a.barber_id=b.id AND a.availability_date=? WHERE b.id=? AND b.is_active=1"
      ).get(tokenDate, barberId) as { id: string; on_duty: number; on_break: number } | undefined;
      if (!barber || !barber.on_duty) throw new RegistrationError("That barber is not available today. Choose another barber or Any.");
      if (barber.on_break) throw new RegistrationError("That barber is currently on break. Choose another barber or Any.");
    }
    const tokenNumber = (db.prepare("SELECT COALESCE(MAX(token_number),0)+1 AS next FROM queue_entries WHERE token_date=?").get(tokenDate) as { next: number }).next;
    const id = randomUUID();
    const registeredAt = now.toISOString();
    db.prepare(
      "INSERT INTO queue_entries (id,customer_name,phone_number,service_id,service_name,service_name_gu,service_price,service_duration_minutes," +
      "token_date,token_number,status,registered_at,preferred_barber_id) VALUES (?,?,?,?,?,?,?,?,?,?,'Waiting',?,?)"
    ).run(id, customerName, phoneNumber, service.id, service.name, service.name_gu, service.price, service.duration_minutes, tokenDate, tokenNumber, registeredAt, barberId);
    db.exec("COMMIT");
    transactionStarted = false;
    return {
      id, customerName, phoneNumber, serviceId: service.id, serviceName: service.name, serviceNameGujarati: service.name_gu, servicePrice: service.price,
      serviceDurationMinutes: service.duration_minutes, tokenDate, tokenNumber,
      token: "#" + String(tokenNumber).padStart(3, "0"), status: "Waiting", registeredAt,
      preferredBarberId: barberId,
    };
  } catch (error) {
    if (transactionStarted) db.exec("ROLLBACK");
    throw error;
  }
}
export function getRegistration(db: DatabaseSync, id: string, now = new Date(), timeZone = process.env.QUEUE_TIME_ZONE || "Asia/Kolkata") {
  expireCalledCustomers(db, now, timeZone);
  const row = db.prepare(
    "SELECT q.id,q.customer_name,q.service_id,q.service_name,q.service_name_gu,q.service_price,q.service_duration_minutes,q.token_date," +
    "q.token_number,q.status,q.registered_at,q.preferred_barber_id,q.assigned_barber_id,q.called_at,q.service_started_at," +
    "b.name AS assigned_barber_name,p.name AS preferred_barber_name FROM queue_entries q LEFT JOIN barbers b ON b.id=q.assigned_barber_id LEFT JOIN barbers p ON p.id=q.preferred_barber_id WHERE q.id=?"
  ).get(id) as (QueueEntry & { assigned_barber_name: string | null }) | undefined;
  if (!row) return undefined;
  let position: number | null = null;
  let wait: number | null = null;
  if (row.status === "Waiting") {
    position = (db.prepare("SELECT COUNT(*) AS n FROM queue_entries WHERE token_date=? AND status='Waiting' AND token_number<=?").get(row.token_date, row.token_number) as { n: number }).n;
    wait = (db.prepare(
      "SELECT COALESCE(SUM(service_duration_minutes),0) AS n FROM queue_entries WHERE token_date=? AND " +
      "((status='Waiting' AND token_number<?) OR status IN ('Called','In chair'))"
    ).get(row.token_date, row.token_number) as { n: number }).n;
  }
  return { ...row, position, approximate_wait_minutes: wait };
}
export function getStaffQueue(db: DatabaseSync, now = new Date(), timeZone = process.env.QUEUE_TIME_ZONE || "Asia/Kolkata"): QueueEntry[] {
  expireCalledCustomers(db, now, timeZone);
  const date = getCalendarDate(now, timeZone);
  return db.prepare(
    "SELECT q.id,q.token_date,q.token_number,q.customer_name,q.service_id,q.service_name,q.service_name_gu,q.service_price,q.service_duration_minutes," +
    "q.preferred_barber_id,q.assigned_barber_id,b.name AS assigned_barber_name,p.name AS preferred_barber_name,q.registered_at,q.called_at,q.service_started_at,q.status " +
    "FROM queue_entries q LEFT JOIN barbers b ON b.id=q.assigned_barber_id LEFT JOIN barbers p ON p.id=q.preferred_barber_id WHERE q.token_date=? ORDER BY q.token_number"
  ).all(date) as QueueEntry[];
}
export function getQueueHistory(db: DatabaseSync, now = new Date(), timeZone = process.env.QUEUE_TIME_ZONE || "Asia/Kolkata"): QueueEntry[] {
  const date = getCalendarDate(now, timeZone);
  return db.prepare(
    "SELECT q.id,q.token_date,q.token_number,q.customer_name,q.service_id,q.service_name,q.service_name_gu,q.service_price,q.service_duration_minutes," +
    "q.preferred_barber_id,q.assigned_barber_id,b.name AS assigned_barber_name,p.name AS preferred_barber_name,q.registered_at,q.called_at,q.service_started_at,q.status " +
    "FROM queue_entries q LEFT JOIN barbers b ON b.id=q.assigned_barber_id LEFT JOIN barbers p ON p.id=q.preferred_barber_id " +
    "WHERE q.token_date<? AND q.status IN ('Cancelled','No-show') ORDER BY q.token_date DESC,q.token_number DESC"
  ).all(date) as QueueEntry[];
}

export function getDisplayQueue(db: DatabaseSync, now = new Date(), timeZone = process.env.QUEUE_TIME_ZONE || "Asia/Kolkata") {
  expireCalledCustomers(db, now, timeZone);
  const date = getCalendarDate(now, timeZone);
  const entries = db.prepare(
    "SELECT q.id,q.token_number,q.service_name,q.status,b.name AS barber_name FROM queue_entries q " +
    "LEFT JOIN barbers b ON b.id=q.assigned_barber_id WHERE q.token_date=? AND q.status IN ('Called','Waiting','In chair') ORDER BY q.token_number"
  ).all(date) as Array<{ id: string; token_number: number; service_name: string; status: QueueStatus; barber_name: string | null }>;
  return {
    nowServing: entries.filter((entry) => entry.status === "In chair"),
    called: entries.filter((entry) => entry.status === "Called"),
    upcoming: entries.filter((entry) => entry.status === "Waiting"),
  };
}

export function callNextForBarber(db: DatabaseSync, barberId: string, now = new Date(), timeZone = process.env.QUEUE_TIME_ZONE || "Asia/Kolkata") {
  const date = getCalendarDate(now, timeZone);
  db.exec("BEGIN IMMEDIATE");
  try {
    const barber = db.prepare(
      "SELECT b.id,b.name,COALESCE(a.on_duty,0) AS on_duty,COALESCE(a.on_break,0) AS on_break FROM barbers b " +
      "LEFT JOIN barber_availability a ON a.barber_id=b.id AND a.availability_date=? WHERE b.id=? AND b.is_active=1"
    ).get(date, barberId) as { id: string; name: string; on_duty: number; on_break: number } | undefined;
    if (!barber || !barber.on_duty) throw new BarberValidationError("This barber is not on duty today.");
    if (barber.on_break) throw new BarberValidationError("This barber is on break and cannot be assigned a customer.");
    if (db.prepare("SELECT id FROM queue_entries WHERE token_date=? AND assigned_barber_id=? AND status='In chair'").get(date, barberId)) {
      throw new QueueTransitionError("This barber already has a customer in the chair.");
    }
    const entry = db.prepare(
      "SELECT id,token_number FROM queue_entries WHERE token_date=? AND status='Waiting' AND assigned_barber_id IS NULL " +
      "AND (preferred_barber_id IS NULL OR preferred_barber_id=?) ORDER BY token_number LIMIT 1"
    ).get(date, barberId) as { id: string; token_number: number } | undefined;
    if (!entry) throw new QueueTransitionError("There are no waiting customers eligible for this barber.");
    const calledAt = now.toISOString();
    db.prepare("UPDATE queue_entries SET status='Called',assigned_barber_id=?,called_at=? WHERE id=? AND status='Waiting'")
      .run(barberId, calledAt, entry.id);
    db.exec("COMMIT");
    return { id: entry.id, token_number: entry.token_number, status: "Called" as const, barberId, barberName: barber.name, calledAt };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function updateQueueStatus(db: DatabaseSync, id: string, nextStatus: unknown, now = new Date()): QueueStatus {
  const statuses: QueueStatus[] = ["Waiting", "Called", "In chair", "Done", "Cancelled", "No-show"];
  if (typeof nextStatus !== "string" || !statuses.includes(nextStatus as QueueStatus)) throw new QueueTransitionError("Choose a valid queue status.");
  const target = nextStatus as QueueStatus;
  db.exec("BEGIN IMMEDIATE");
  try {
    const entry = db.prepare("SELECT status,assigned_barber_id,token_date FROM queue_entries WHERE id=?").get(id) as
      { status: QueueStatus; assigned_barber_id: string | null; token_date: string } | undefined;
    if (!entry) throw new QueueEntryNotFoundError();
    const allowed: Record<QueueStatus, QueueStatus[]> = {
      "Waiting": ["Cancelled"], "Called": ["In chair"], "In chair": ["Done"],
      "Done": [], "Cancelled": [], "No-show": [],
    };
    if (!allowed[entry.status].includes(target)) throw new QueueTransitionError("That status change is not allowed.");
    if (target === "In chair") {
      if (!entry.assigned_barber_id) throw new QueueTransitionError("This customer has not been assigned to a barber.");
      if (db.prepare("SELECT id FROM queue_entries WHERE token_date=? AND assigned_barber_id=? AND status='In chair'").get(entry.token_date, entry.assigned_barber_id)) {
        throw new QueueTransitionError("This barber already has a customer in the chair.");
      }
      const barber = db.prepare(
        "SELECT COALESCE(a.on_duty,0) AS on_duty,COALESCE(a.on_break,0) AS on_break FROM barbers b " +
        "LEFT JOIN barber_availability a ON a.barber_id=b.id AND a.availability_date=? WHERE b.id=?"
      ).get(entry.token_date, entry.assigned_barber_id) as { on_duty: number; on_break: number } | undefined;
      if (!barber?.on_duty || barber.on_break) throw new QueueTransitionError("The assigned barber is not available to start service.");
    }
    const stampColumn = target === "In chair" ? ",service_started_at=?" : target === "Done" ? ",service_done_at=?" : "";
    const values = stampColumn ? [target, now.toISOString(), id, entry.status] : [target, id, entry.status];
    const result = stampColumn
      ? db.prepare("UPDATE queue_entries SET status=?" + stampColumn + " WHERE id=? AND status=?").run(...values)
      : db.prepare("UPDATE queue_entries SET status=? WHERE id=? AND status=?").run(...values);
    if (result.changes !== 1) throw new QueueTransitionError("The queue entry changed. Refresh and try again.");
    db.exec("COMMIT");
    return target;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function expireCalledCustomers(db: DatabaseSync, now = new Date(), timeZone = process.env.QUEUE_TIME_ZONE || "Asia/Kolkata") {
  const cutoff = now.getTime() - 10 * 60 * 1000;
  const date = getCalendarDate(now, timeZone);
  db.exec("BEGIN IMMEDIATE");
  try {
    const entries = db.prepare(
      "SELECT id FROM queue_entries WHERE status='Called' AND called_at IS NOT NULL"
    ).all() as Array<{ id: string }>;
    const expired: string[] = [];
    const update = db.prepare("UPDATE queue_entries SET status='No-show' WHERE id=? AND status='Called' AND called_at<=?");
    for (const entry of entries) {
      const calledAt = db.prepare("SELECT called_at FROM queue_entries WHERE id=?").get(entry.id) as { called_at: string };
      if (Date.parse(calledAt.called_at) <= cutoff && update.run(entry.id, new Date(cutoff).toISOString()).changes === 1) expired.push(entry.id);
    }
    db.exec("COMMIT");
    return expired;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function getStatistics(db: DatabaseSync, now = new Date(), timeZone = process.env.QUEUE_TIME_ZONE || "Asia/Kolkata") {
  const date = getCalendarDate(now, timeZone);
  const rows = db.prepare(
    "SELECT status,registered_at,service_started_at FROM queue_entries WHERE token_date=?"
  ).all(date) as Array<{ status: QueueStatus; registered_at: string; service_started_at: string | null }>;
  const completedWaits = rows.filter((row) => row.status === "Done" && row.service_started_at)
    .map((row) => ({ start: Date.parse(row.service_started_at!), registered: Date.parse(row.registered_at) }))
    .filter((times) => Number.isFinite(times.start) && Number.isFinite(times.registered) && times.start >= times.registered)
    .map((times) => (times.start - times.registered) / 60000);
  return {
    customersServed: rows.filter((row) => row.status === "Done").length,
    averageWaitingMinutes: completedWaits.length ? Math.round(completedWaits.reduce((total, value) => total + value, 0) / completedWaits.length) : null,
    noShows: rows.filter((row) => row.status === "No-show").length,
  };
}
export function createWalkIn(db: DatabaseSync, input: RegistrationInput, now = new Date(), timeZone = process.env.QUEUE_TIME_ZONE || "Asia/Kolkata") {
  return registerCustomer(db, input, now, timeZone, true);
}
