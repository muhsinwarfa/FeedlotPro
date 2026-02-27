/**
 * Layer 3 — Security: RLS Gap Documentation
 *
 * This file is a PERMANENT SENTINEL for missing Row-Level Security policies on
 * the Supabase PostgreSQL database.
 *
 * Currently, the application enforces tenant isolation entirely at the
 * application layer (every query includes `organization_id = auth.uid()`).
 * There are NO RLS policies in the database (docs/schema.sql confirms this).
 *
 * Each `it.todo` entry below represents a missing policy. When a policy is
 * implemented, convert the corresponding `it.todo` to a real test that verifies
 * the policy blocks cross-tenant access at the DB level.
 *
 * DO NOT DELETE these todos — they serve as the canonical list of security debt.
 */

import { describe, it } from 'vitest';

describe('RLS Gap Documentation — missing Row-Level Security policies', () => {
  describe('animals table', () => {
    it.todo(
      'RLS: animals.SELECT — users can only read rows where organization_id matches their session org'
    );
    it.todo(
      'RLS: animals.INSERT — users can only insert rows where organization_id matches their session org'
    );
    it.todo(
      'RLS: animals.UPDATE — users can only update rows where organization_id matches their session org'
    );
  });

  describe('weight_records table', () => {
    it.todo(
      'RLS: weight_records.SELECT — access only via animal.organization_id join matches session org'
    );
    it.todo(
      'RLS: weight_records.INSERT — access only via animal.organization_id join matches session org'
    );
  });

  describe('feeding_records table', () => {
    it.todo(
      'RLS: feeding_records.SELECT — users can only read rows where organization_id matches their session org'
    );
    it.todo(
      'RLS: feeding_records.INSERT — users can only insert rows where organization_id matches their session org'
    );
  });

  describe('feeding_details table', () => {
    it.todo(
      'RLS: feeding_details.SELECT — access only via feeding_record.organization_id join matches session org'
    );
    it.todo(
      'RLS: feeding_details.INSERT — access only via feeding_record.organization_id join matches session org'
    );
  });

  describe('pens table', () => {
    it.todo(
      'RLS: pens.SELECT — users can only read rows where organization_id matches their session org'
    );
    it.todo(
      'RLS: pens.UPDATE — users can only update rows where organization_id matches their session org'
    );
  });

  describe('pantry_ingredients table', () => {
    it.todo(
      'RLS: pantry_ingredients.SELECT — users can only read rows where organization_id matches their session org'
    );
  });
});
