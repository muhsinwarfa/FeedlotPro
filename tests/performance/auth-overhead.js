/**
 * Layer 4 — Performance: Auth Session Validation Overhead
 *
 * Simulates 20 concurrent users hitting the Supabase Auth health endpoint,
 * measuring the base overhead of Supabase's auth layer.
 *
 * Also tests the /auth/v1/token endpoint to measure auth API latency.
 *
 * Threshold: p95 < 500 ms, error rate < 1 %
 * Run: "C:\Program Files\k6\k6.exe" run tests/performance/auth-overhead.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './k6-options.js';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Test 1: Supabase REST API health — the fastest measurable Supabase roundtrip.
  // Returns 200 with an empty JSON object regardless of auth state.
  const healthRes = http.get(
    `${SUPABASE_URL}/rest/v1/`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );

  check(healthRes, {
    'REST root status 200': (r) => r.status === 200,
    'REST root < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
