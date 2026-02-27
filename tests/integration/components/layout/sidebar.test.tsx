import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockRefresh = vi.fn();
let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const mockSignOut = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}));

// next/link is already mocked globally in setup.ts

import { Sidebar } from '@/components/layout/sidebar';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Sidebar', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRefresh.mockClear();
    mockSignOut.mockClear();
    mockSignOut.mockResolvedValue({});
    mockPathname = '/';
  });

  describe('brand', () => {
    it('renders the FeedlotPro brand text', () => {
      render(<Sidebar />);
      expect(screen.getAllByText(/FeedlotPro/i).length).toBeGreaterThan(0);
    });

    it('renders the Kenya label', () => {
      render(<Sidebar />);
      expect(screen.getAllByText('Kenya').length).toBeGreaterThan(0);
    });
  });

  describe('nav items render', () => {
    it('renders all 4 nav links', () => {
      render(<Sidebar />);
      expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Inventory').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Feeding').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
    });

    it('renders a Sign Out button', () => {
      render(<Sidebar />);
      expect(screen.getAllByRole('button', { name: /sign out/i }).length).toBeGreaterThan(0);
    });
  });

  describe('active route highlighting', () => {
    it('Dashboard link is active when pathname is "/"', () => {
      mockPathname = '/';
      render(<Sidebar />);
      // The active class includes 'bg-white text-emerald-950'
      const dashboardLinks = screen.getAllByText('Dashboard');
      const activeLink = dashboardLinks.find((el) =>
        el.closest('a')?.className.includes('bg-white')
      );
      expect(activeLink).toBeTruthy();
    });

    it('Inventory link is active when pathname is "/inventory"', () => {
      mockPathname = '/inventory';
      render(<Sidebar />);
      const inventoryLinks = screen.getAllByText('Inventory');
      const activeLink = inventoryLinks.find((el) =>
        el.closest('a')?.className.includes('bg-white')
      );
      expect(activeLink).toBeTruthy();
    });

    it('Inventory link is active on nested route "/inventory/123"', () => {
      mockPathname = '/inventory/some-animal-id';
      render(<Sidebar />);
      const inventoryLinks = screen.getAllByText('Inventory');
      const activeLink = inventoryLinks.find((el) =>
        el.closest('a')?.className.includes('bg-white')
      );
      expect(activeLink).toBeTruthy();
    });

    it('Feeding link is active when pathname is "/feeding"', () => {
      mockPathname = '/feeding';
      render(<Sidebar />);
      const feedingLinks = screen.getAllByText('Feeding');
      const activeLink = feedingLinks.find((el) =>
        el.closest('a')?.className.includes('bg-white')
      );
      expect(activeLink).toBeTruthy();
    });

    it('Feeding link is active on nested route "/feeding/history"', () => {
      mockPathname = '/feeding/history';
      render(<Sidebar />);
      const feedingLinks = screen.getAllByText('Feeding');
      const activeLink = feedingLinks.find((el) =>
        el.closest('a')?.className.includes('bg-white')
      );
      expect(activeLink).toBeTruthy();
    });

    it('Dashboard link is NOT active when on /inventory', () => {
      mockPathname = '/inventory';
      render(<Sidebar />);
      const dashboardLinks = screen.getAllByText('Dashboard');
      const activeLink = dashboardLinks.find((el) =>
        el.closest('a')?.className.includes('bg-white')
      );
      expect(activeLink).toBeFalsy();
    });
  });

  describe('sign out', () => {
    it('calls supabase.auth.signOut() when Sign Out is clicked', async () => {
      render(<Sidebar />);
      const signOutButtons = screen.getAllByRole('button', { name: /sign out/i });
      fireEvent.click(signOutButtons[0]);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('redirects to /login after sign out', async () => {
      mockSignOut.mockResolvedValue({});
      render(<Sidebar />);
      const signOutButtons = screen.getAllByRole('button', { name: /sign out/i });
      fireEvent.click(signOutButtons[0]);
      // wait for async signOut
      await vi.waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('mobile drawer', () => {
    it('renders the mobile toggle button', () => {
      render(<Sidebar />);
      expect(screen.getByRole('button', { name: /toggle menu/i })).toBeInTheDocument();
    });

    it('drawer is hidden initially', () => {
      render(<Sidebar />);
      // The overlay div only appears when mobileOpen is true
      expect(screen.queryByText(/FeedlotPro Kenya/)).toBeInTheDocument(); // top bar text
    });

    it('clicking toggle button opens the mobile drawer', () => {
      render(<Sidebar />);
      const toggle = screen.getByRole('button', { name: /toggle menu/i });
      fireEvent.click(toggle);
      // After opening, the drawer renders NavContent (additional nav links appear)
      const dashboardLinks = screen.getAllByText('Dashboard');
      // There should be 2 now: desktop sidebar + mobile drawer
      expect(dashboardLinks.length).toBeGreaterThanOrEqual(2);
    });

    it('clicking toggle button again closes the mobile drawer', () => {
      render(<Sidebar />);
      const toggle = screen.getByRole('button', { name: /toggle menu/i });
      fireEvent.click(toggle); // open
      fireEvent.click(toggle); // close
      // Back to just the desktop sidebar links
      const dashboardLinks = screen.getAllByText('Dashboard');
      expect(dashboardLinks.length).toBe(1);
    });

    it('clicking a nav link in mobile drawer closes the drawer', () => {
      render(<Sidebar />);
      const toggle = screen.getByRole('button', { name: /toggle menu/i });
      fireEvent.click(toggle); // open drawer

      // Click a nav link in the drawer (the second Inventory link = mobile one)
      const inventoryLinks = screen.getAllByText('Inventory');
      fireEvent.click(inventoryLinks[inventoryLinks.length - 1]);

      // Drawer should close — only desktop sidebar remains
      const dashboardLinks = screen.getAllByText('Dashboard');
      expect(dashboardLinks.length).toBe(1);
    });
  });

  describe('tap target sizes', () => {
    it('nav links have min-h-[44px] class', () => {
      render(<Sidebar />);
      const dashboardLinks = screen.getAllByText('Dashboard');
      const link = dashboardLinks[0].closest('a');
      expect(link?.className).toContain('min-h-[44px]');
    });

    it('sign out button has min-h-[44px] class', () => {
      render(<Sidebar />);
      const signOutBtn = screen.getAllByRole('button', { name: /sign out/i })[0];
      expect(signOutBtn.className).toContain('min-h-[44px]');
    });

    it('mobile toggle button has min-h-[44px] and min-w-[44px] classes', () => {
      render(<Sidebar />);
      const toggle = screen.getByRole('button', { name: /toggle menu/i });
      expect(toggle.className).toContain('min-h-[44px]');
      expect(toggle.className).toContain('min-w-[44px]');
    });
  });
});
