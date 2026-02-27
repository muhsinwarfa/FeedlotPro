/**
 * Layer 4 — Performance: Weight Recording Load
 *
 * Simulates 5 concurrent users reading the weight_records table,
 * the query backing the weight history displayed on /inventory/[id].
 *
 * Note: INSERT load testing requires a provisioned test user (valid JWT +
 * valid animal_id). The read-path load test here covers the critical latency
 * bottleneck — the weight history query with an animal join.
 *
 * Threshold: p95 < 3 000 ms, error rate < 1 %
 * Run: "C:\Program Files\k6\k6.exe" run tests/performance/weight-recording-load.js
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
  // Mirrors the weight history query in /inventory/[id] page:
  // supabase.from('weight_records').select('id,new_weight,weigh_date,animal_id').order('weigh_date', { ascending: false }).limit(50)
  const url =
    `${SUPABASE_URL}/rest/v1/weight_records` +
    `?select=id,new_weight,weigh_date,animal_id` +
    `&limit=50` +
    `&order=weigh_date.desc`;

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
    'response time < 3s': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
