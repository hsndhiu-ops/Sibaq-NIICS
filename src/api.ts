/**
 * Re-export data access layer from src/lib/api.ts
 *
 * All frontend components interface strictly through this layer.
 * Direct Supabase calls from components are forbidden.
 */

export * from './lib/api';
