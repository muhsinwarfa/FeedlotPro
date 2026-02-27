/**
 * Shared k6 configuration for FeedlotPro performance tests.
 *
 * Imported by each individual test script via:
 *   import { SUPABASE_URL, SUPABASE_ANON_KEY, baseHeaders } from './k6-options.js';
 *
 * Thresholds (applied per-script):
 *   - http_req_duration p95 < 2 000 ms (most reads)
 *   - http_req_duration p95 < 3 000 ms (write/join-heavy)
 *   - http_req_duration p95 < 500  ms (auth endpoint)
 *   - http_req_failed rate < 1 %
 */

export const SUPABASE_URL = 'https://gqfjrkkwcgagcatnrizk.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZmpya2t3Y2dhZ2NhdG5yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTQ5MjcsImV4cCI6MjA4NzY3MDkyN30.sWo38paeYlvwPWslXrZDj0-b1AeDjajWUGtZQ4B7pb4';

/** Standard headers for every Supabase REST request. */
export const baseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};
