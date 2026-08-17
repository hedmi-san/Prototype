"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.runTransaction = runTransaction;
const node_sqlite_1 = require("node:sqlite");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const dataDir = node_path_1.default.join(process.cwd(), 'data');
if (!node_fs_1.default.existsSync(dataDir)) {
    node_fs_1.default.mkdirSync(dataDir, { recursive: true });
}
const dbPath = node_path_1.default.join(dataDir, 'distributor.db');
exports.db = new node_sqlite_1.DatabaseSync(dbPath);
// Enable WAL mode & foreign key constraints
exports.db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);
function runTransaction(fn) {
    exports.db.exec('BEGIN IMMEDIATE;');
    try {
        const result = fn();
        exports.db.exec('COMMIT;');
        return result;
    }
    catch (error) {
        exports.db.exec('ROLLBACK;');
        throw error;
    }
}
