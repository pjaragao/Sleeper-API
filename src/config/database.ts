import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Database provider type
export type DbProvider = 'sqlite' | 'supabase';

// Get current provider
export function getDbProvider(): DbProvider {
    return (process.env.DB_PROVIDER as DbProvider) || 'sqlite';
}

// SQLite database instance
let db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!db) {
        const dbPath = process.env.SQLITE_PATH || './data/sleeper.db';
        const dir = path.dirname(dbPath);

        // Create data directory if needed
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        console.log(`✅ SQLite database connected: ${dbPath}`);
    }
    return db;
}

// Generic query interface (works for both SQLite now, Supabase later)
export interface QueryResult<T> {
    data: T[];
    error?: string;
}

// Execute SELECT query
export function query<T = unknown>(sql: string, params: unknown[] = []): T[] {
    const database = getDb();
    const stmt = database.prepare(sql);
    return stmt.all(...params) as T[];
}

// Execute INSERT/UPDATE/DELETE
export function execute(sql: string, params: unknown[] = []): Database.RunResult {
    const database = getDb();
    const stmt = database.prepare(sql);
    return stmt.run(...params);
}

// Execute multiple statements (for migrations)
export function executeMany(sql: string): void {
    const database = getDb();
    database.exec(sql);
}

// Get single row
export function queryOne<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
    const database = getDb();
    const stmt = database.prepare(sql);
    return stmt.get(...params) as T | undefined;
}

// Test connection
export function testConnection(): boolean {
    try {
        const database = getDb();
        database.prepare('SELECT 1').get();
        console.log('✅ Database connection test passed');
        return true;
    } catch (error) {
        console.error('❌ Database connection test failed:', error);
        return false;
    }
}

// Close database
export function closeDb(): void {
    if (db) {
        db.close();
        db = null;
        console.log('Database connection closed');
    }
}

// ========================
// FUTURE: Supabase adapter
// ========================
// When migrating to Supabase, implement these functions:
// - supabaseQuery<T>(table: string, filters: object): Promise<T[]>
// - supabaseInsert<T>(table: string, data: T): Promise<T>
// - supabaseUpdate<T>(table: string, data: Partial<T>, filters: object): Promise<T>
// - supabaseDelete(table: string, filters: object): Promise<void>
//
// The sync service uses raw SQL which works with both SQLite and PostgreSQL
// Just change the DB_PROVIDER and add Supabase client initialization
