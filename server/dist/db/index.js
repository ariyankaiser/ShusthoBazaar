import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { config } from '../config/index.js';
const runtimeDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDirectory = path.basename(runtimeDirectory) === 'dist'
    ? path.dirname(runtimeDirectory)
    : runtimeDirectory;
const schemaPath = path.join(serverDirectory, 'db/schema.sql');
const resolvedDbPath = path.resolve(config.dbPath);
fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });
export const db = new Database(resolvedDbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
const migrationsDirectory = path.join(serverDirectory, 'db/migrations');
function addColumnIfMissing(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((entry) => entry.name);
    if (!columns.includes(column))
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
export function migrate() {
    const existing = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1").get();
    if (!existing)
        db.exec(fs.readFileSync(schemaPath, 'utf8'));
    // Incremental, idempotent upgrades for databases created by earlier versions.
    addColumnIfMissing('orders', 'rejection_reason', 'TEXT');
    for (const file of fs.readdirSync(migrationsDirectory).filter((name) => name.endsWith('.sql')).sort()) {
        db.exec(fs.readFileSync(path.join(migrationsDirectory, file), 'utf8'));
    }
}
export function closeDatabase() {
    if (db.open)
        db.close();
}
migrate();
