import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, closeDb } from './config/database.js';
import { startScheduler, stopScheduler } from './services/scheduler.service.js';
import apiRoutes from './routes/api.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Sleeper Fantasy Assistant API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            status: '/api/status',
            players: '/api/players',
            leagues: '/api/leagues',
            sync: '/api/sync/*',
            docs: 'Coming soon...'
        }
    });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Graceful shutdown
const shutdown = () => {
    console.log('\n🛑 Shutting down...');
    stopScheduler();
    closeDb();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
async function start() {
    console.log('\n🚀 Starting Sleeper Fantasy Assistant...\n');

    // Test database connection
    if (!testConnection()) {
        console.error('❌ Database connection failed. Please run migrations first: npm run db:migrate');
        process.exit(1);
    }

    // Start scheduler
    startScheduler();

    // Start Express server
    app.listen(PORT, () => {
        console.log(`\n🌐 Server running at http://localhost:${PORT}`);
        console.log(`📚 API available at http://localhost:${PORT}/api\n`);
    });
}

start();
