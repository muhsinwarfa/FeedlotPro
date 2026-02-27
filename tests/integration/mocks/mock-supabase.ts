import { vi } from 'vitest';

// Creates a chainable Supabase mock that resolves to the provided value
export function makeSupabaseMock({
  insertResult = { data: [{ id: 'new-uuid' }], error: null },
  updateResult = { data: null, error: null },
  selectCountResult = { count: 0, error: null },
  signOutResult = { error: null },
}: {
  insertResult?: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
  selectCountResult?: { count: number | null; error: unknown };
  signOutResult?: { error: unknown };
} = {}) {
  const chain: Record<string, unknown> = {};

  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => Promise.resolve(insertResult));
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));

  // Count mode: the last .eq() in count query must return selectCountResult
  // Override eq to return selectCountResult when this is the tag uniqueness check
  let eqCallCount = 0;
  (chain.eq as ReturnType<typeof vi.fn>).mockImplementation(() => {
    eqCallCount++;
    // After 2 .eq() calls (org_id + tag_id), return count result
    if (eqCallCount >= 2) {
      eqCallCount = 0;
      return Promise.resolve(selectCountResult);
    }
    return chain;
  });

  const mockFrom = vi.fn(() => chain);

  return {
    from: mockFrom,
    auth: {
      signOut: vi.fn(() => Promise.resolve(signOutResult)),
    },
    chain, // exposed for assertions
  };
}

// Standard toast mock
export function makeToastMock() {
  const toast = vi.fn();
  return {
    useToast: () => ({ toast }),
    toast,
  };
}
