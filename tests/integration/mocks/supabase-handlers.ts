import { http, HttpResponse } from 'msw';

const SUPABASE_URL = 'https://gqfjrkkwcgagcatnrizk.supabase.co';

export const supabaseHandlers = [
  // Animals table — GET (tag uniqueness check returns 0 by default)
  http.get(`${SUPABASE_URL}/rest/v1/animals`, () => {
    return HttpResponse.json([], {
      headers: { 'Content-Range': '*/0' },
    });
  }),

  // Animals table — INSERT (animal intake)
  http.post(`${SUPABASE_URL}/rest/v1/animals`, () => {
    return HttpResponse.json([{ id: 'new-animal-uuid' }], { status: 201 });
  }),

  // Animals table — PATCH (status change)
  http.patch(`${SUPABASE_URL}/rest/v1/animals`, () => {
    return HttpResponse.json([{ id: 'animal-uuid', status: 'SICK' }]);
  }),

  // Weight records — INSERT
  http.post(`${SUPABASE_URL}/rest/v1/weight_records`, () => {
    return HttpResponse.json([{ id: 'weight-uuid' }], { status: 201 });
  }),

  // Feeding records — INSERT
  http.post(`${SUPABASE_URL}/rest/v1/feeding_records`, () => {
    return HttpResponse.json([{ id: 'feed-record-uuid' }], { status: 201 });
  }),

  // Feeding details — INSERT
  http.post(`${SUPABASE_URL}/rest/v1/feeding_details`, () => {
    return HttpResponse.json([], { status: 201 });
  }),
];

// Handlers for error scenarios (used in individual tests via server.use())
export const errorHandlers = {
  duplicateTag: http.get(`${SUPABASE_URL}/rest/v1/animals`, () => {
    return HttpResponse.json([{ id: 'existing' }], {
      headers: { 'Content-Range': '*/1' },
    });
  }),

  animalInsertLocked: http.post(`${SUPABASE_URL}/rest/v1/animals`, () => {
    return HttpResponse.json(
      { message: 'ERR_INVALID_TRANSITION: Cannot modify a DEAD animal', code: 'P0001' },
      { status: 400 }
    );
  }),

  duplicateTagInsert: http.post(`${SUPABASE_URL}/rest/v1/animals`, () => {
    return HttpResponse.json(
      { message: 'duplicate key value violates unique constraint "animals_tag_id_org_unique"', code: '23505' },
      { status: 409 }
    );
  }),

  dbUnavailable: http.post(`${SUPABASE_URL}/rest/v1/animals`, () => {
    return HttpResponse.json(
      { message: 'ERR_DB_UNAVAILABLE: connection refused' },
      { status: 503 }
    );
  }),

  statusUpdateLocked: http.patch(`${SUPABASE_URL}/rest/v1/animals`, () => {
    return HttpResponse.json(
      { message: 'ERR_INVALID_TRANSITION: Cannot modify a DEAD animal', code: 'P0001' },
      { status: 400 }
    );
  }),

  weightInsertNegative: http.post(`${SUPABASE_URL}/rest/v1/weight_records`, () => {
    return HttpResponse.json(
      { message: 'ERR_NEGATIVE_WEIGHT: weight must be > 0', code: 'P0001' },
      { status: 400 }
    );
  }),
};
