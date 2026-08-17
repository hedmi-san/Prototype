import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'distributor.db');
export const db = new DatabaseSync(dbPath);
// Enable WAL mode & foreign key constraints
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);
export function runTransaction(fn) {
    db.exec('BEGIN IMMEDIATE;');
    try {
        const result = fn();
        db.exec('COMMIT;');
        return result;
    }
    catch (error) {
        db.exec('ROLLBACK;');
        throw error;
    }
}
