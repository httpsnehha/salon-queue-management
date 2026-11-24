import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
const configuredPath = process.env.SQLITE_DB_PATH ?? "./data/salon-queue.sqlite";
const databasePath = resolve(process.cwd(), configuredPath);
mkdirSync(dirname(databasePath), { recursive: true });
/** Node.js 26 includes node:sqlite; queue tables are intentionally not created yet. */
export const database = new DatabaseSync(databasePath);
