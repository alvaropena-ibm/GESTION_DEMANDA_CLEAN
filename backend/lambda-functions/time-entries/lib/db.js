"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.getPool = void 0;

const { Pool } = require('pg');

// Create a singleton pool instance
let pool = null;

function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            },
            max: 1, // Lambda: use only 1 connection per container
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
        
        console.log('PostgreSQL pool created');
    }
    return pool;
}

exports.getPool = getPool;

/**
 * Execute a SQL query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
    const pool = getPool();
    const start = Date.now();
    
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.LOG_QUERIES === 'true') {
            console.log('Query executed:', { text, duration, rows: result.rowCount });
        }
        
        return result;
    } catch (error) {
        console.error('Database query error:', {
            query: text,
            params,
            error: error.message
        });
        throw error;
    }
}

exports.query = query;