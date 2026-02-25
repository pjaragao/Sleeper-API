import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, executeMany, testConnection, closeDb } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    console.log('🚀 Starting database migrations...\n');

    try {
        // Initialize database connection
        const db = getDb();

        // Read and execute migration files
        const files = fs.readdirSync(__dirname)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            console.log(`📄 Running migration: ${file}`);
            const filePath = path.join(__dirname, file);
            const sql = fs.readFileSync(filePath, 'utf-8');

            executeMany(sql);
            console.log(`✅ Migration ${file} completed\n`);
        }

        console.log('🎉 All migrations completed successfully!');

        // Show created tables
        const tables = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).all() as { name: string }[];

        console.log('\n📋 Created tables:');
        tables.forEach(row => {
            console.log(`   - ${row.name}`);
        });

        // Test connection
        testConnection();

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        closeDb();
    }
}

runMigrations();
