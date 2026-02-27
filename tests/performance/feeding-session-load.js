/**
 * Layer 4 — Performance: Feeding Session Load
 *
 * Simulates 5 concurrent users reading feeding_records with feeding_details,
 * the query backing the /feeding/history page (the most join-heavy read).
 *
 * Threshold: p95 < 3 000 ms, error rate < 1 %
 * Run: "C:\Program Files\k6\k6.exe" run tests/performance/feeding-session-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SUPABASE_URL, baseHeaders } from './k6-options.js';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Step 1: Read feeding records with pen join (mirrors /feeding/history page)
  const feedingUrl =
    `${SUPABASE_URL}/rest/v1/feeding_records` +
    `?select=id,feeding_timestamp,total_kg_fed,pen_id,pens(pen_name)` +
    `&limit=50` +
    `&order=feeding_timestamp.desc`;

  const feedingRes = http.get(feedingUrl, { headers: baseHeaders });

  check(feedingRes, {
    'feeding_records status 200': (r) => r.status === 200,
    'feeding_records is array': (r) => {
      try { return Array.isArray(JSON.parse(r.body)); }
      catch { return false; }
    },
    'feeding_records < 3s': (r) => r.timings.duration < 3000,
  });

  sleep(0.5);

  // Step 2: Read feeding details (ingredient breakdown for a record)
  const detailsUrl =
    `${SUPABASE_URL}/rest/v1/feeding_details` +
    `?select=id,kg_amount,ingredient_id,pantry_ingredients(ingredient_name)` +
    `&limit=20` +
    `&order=kg_amount.desc`;

  const detailsRes = http.get(detailsUrl, { headers: baseHeaders });

  check(detailsRes, {
    'feeding_details status 200': (r) => r.status === 200,
    'feeding_details is array': (r) => {
      try { return Array.isArray(JSON.parse(r.body)); }
      catch { return false; }
    },
    'feeding_details < 3s': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
