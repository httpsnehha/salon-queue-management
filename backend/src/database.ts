import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "./queueRepository.js";

const configuredPath = process.env.SQLITE_DB_PATH ?? "./data/salon-queue.sqlite";
const databasePath = resolve(process.cwd(), configuredPath);
mkdirSync(dirname(databasePath), { recursive: true });

export const database = new DatabaseSync(databasePath, { timeout: 5000 });
initializeDatabase(database);