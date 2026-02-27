import '@testing-library/jest-dom';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server } from './mocks/server';

// Start MSW — warn on unhandled requests (not error, to avoid flakiness)
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock next/navigation — components use useRouter and usePathname
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/',
}));

// Mock next/link — forward onClick so components that set state on link click work correctly
vi.mock('next/link', () => ({
  default: ({ href, children, className, onClick }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler;
  }) => {
    const React = require('react');
    return React.createElement('a', { href, className, onClick }, children);
  },
}));

// Suppress noisy React act() warnings from async state updates in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) return;
    if (typeof args[0] === 'string' && args[0].includes('act(')) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
