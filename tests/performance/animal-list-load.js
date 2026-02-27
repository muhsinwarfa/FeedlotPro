/**
 * Layer 4 — Performance: Animal List Load
 *
 * Simulates 10 concurrent users reading the animals list with a pen join,
 * the most complex query on the /inventory page.
 *
 * Threshold: p95 < 2 000 ms, error rate < 1 %
 * Run: "C:\Program Files\k6\k6.exe" run tests/performance/animal-list-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SUPABASE_URL, baseHeaders } from './k6-options.js';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Mirrors the query in app/(dashboard)/inventory/page.tsx:
  // supabase.from('animals').select('id,tag_id,breed,status,intake_weight,current_weight,intake_date,pen_id,pens(pen_name)')
  const url =
    `${SUPABASE_URL}/rest/v1/animals` +
    `?select=id,tag_id,breed,status,intake_weight,current_weight,intake_date,pen_id,pens(pen_name)` +
    `&limit=100` +
    `&order=intake_date.desc`;

  const res = http.get(url, { headers: baseHeaders });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response is JSON array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch {
        return false;
      }
    },
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
