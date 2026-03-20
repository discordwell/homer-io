import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests that verify mobile responsiveness CSS and class bindings are in place.
 * These are structural tests that check the CSS rules and component markup
 * contain the necessary responsive patterns.
 */

function readSrc(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf-8');
}

describe('Mobile Responsive: CSS media queries', () => {
  const appCss = readSrc('../app.css');

  it('has mobile breakpoint for sidebar at 768px', () => {
    expect(appCss).toContain('@media (max-width: 768px)');
    expect(appCss).toContain('.sidebar');
    expect(appCss).toContain('mobile-open');
  });

  it('hides desktop sidebar toggle on mobile', () => {
    expect(appCss).toContain('.sidebar .sidebar-toggle');
    expect(appCss).toContain('display: none');
  });

  it('has mobile hamburger toggle styles', () => {
    expect(appCss).toContain('.mobile-menu-toggle');
  });

  it('has sidebar backdrop for mobile overlay', () => {
    expect(appCss).toContain('.sidebar-backdrop');
  });

  it('has mobile breakpoint for KPI grids', () => {
    expect(appCss).toContain('.kpi-grid');
    expect(appCss).toContain('repeat(2, 1fr)');
  });

  it('has mobile breakpoint for page headers', () => {
    expect(appCss).toContain('.page-header');
    expect(appCss).toContain('flex-direction: column');
  });

  it('has mobile breakpoint for AI chat panel', () => {
    expect(appCss).toContain('.ai-chat-panel');
    expect(appCss).toContain('width: 100%');
  });

  it('has mobile breakpoint for notification dropdown', () => {
    expect(appCss).toContain('.notification-dropdown');
  });

  it('has data table scrollable container styles', () => {
    expect(appCss).toContain('.data-table-wrap');
  });

  it('has mobile breakpoint for live map layout', () => {
    expect(appCss).toContain('.live-map-content');
    expect(appCss).toContain('flex-direction: column');
  });

  it('has filter pills scrollable on mobile', () => {
    expect(appCss).toContain('.filter-pills');
    expect(appCss).toContain('flex-wrap: nowrap');
  });

  it('ensures adequate touch targets for sidebar links', () => {
    expect(appCss).toContain('min-height: 44px');
  });

  it('has modal bottom-sheet style on mobile', () => {
    expect(appCss).toContain('.modal-content');
    expect(appCss).toContain('.modal-overlay');
  });
});

describe('Mobile Responsive: Landing page CSS', () => {
  const homeCss = readSrc('./landing-v2/home.css');

  it('has responsive breakpoint at 640px', () => {
    expect(homeCss).toContain('@media (max-width: 640px)');
  });

  it('hides nav links on mobile', () => {
    expect(homeCss).toContain('.hp-nav-links { display: none; }');
  });

  it('stacks hero buttons vertically on mobile', () => {
    expect(homeCss).toContain('.hero-buttons');
    expect(homeCss).toContain('flex-direction: column');
  });

  it('hides scroll hint on mobile', () => {
    expect(homeCss).toContain('.hero-scroll { display: none; }');
  });

  it('makes hero buttons full-width with touch targets', () => {
    expect(homeCss).toContain('min-height: 48px');
  });

  it('hides proof strip separators on mobile', () => {
    expect(homeCss).toContain('.proof-strip .sep { display: none; }');
  });

  it('has extra-small device breakpoint', () => {
    expect(homeCss).toContain('@media (max-width: 374px)');
  });

  it('makes pricing grid single-column on mobile', () => {
    expect(homeCss).toContain('.pricing-grid');
    expect(homeCss).toContain('grid-template-columns: 1fr');
  });
});

describe('Mobile Responsive: Hero Map CSS', () => {
  const heroMapCss = readSrc('./landing-v2/heroMap.css');

  it('has mobile breakpoint for grid overlay', () => {
    expect(heroMapCss).toContain('@media (max-width: 640px)');
    expect(heroMapCss).toContain('.hero-map-grid');
  });
});

describe('Mobile Responsive: Component class bindings', () => {
  it('Sidebar accepts mobileOpen prop', () => {
    const sidebar = readSrc('./Sidebar.tsx');
    expect(sidebar).toContain('mobileOpen');
    expect(sidebar).toContain('mobile-open');
  });

  it('DashboardLayout has mobile sidebar logic', () => {
    const layout = readSrc('./DashboardLayout.tsx');
    expect(layout).toContain('mobileSidebarOpen');
    expect(layout).toContain('mobile-menu-toggle');
    expect(layout).toContain('sidebar-backdrop');
    expect(layout).toContain('useIsMobile');
  });

  it('DashboardLayout prevents body scroll when mobile sidebar is open', () => {
    const layout = readSrc('./DashboardLayout.tsx');
    expect(layout).toContain("document.body.style.overflow = 'hidden'");
  });

  it('DashboardLayout closes mobile sidebar on route change', () => {
    const layout = readSrc('./DashboardLayout.tsx');
    expect(layout).toContain('location.pathname');
    expect(layout).toContain('setMobileSidebarOpen(false)');
  });

  it('DataTable has scrollable wrapper class', () => {
    const dataTable = readSrc('./DataTable.tsx');
    expect(dataTable).toContain('data-table-wrap');
    expect(dataTable).toContain('WebkitOverflowScrolling');
  });

  it('DataTable sets minWidth for wide tables', () => {
    const dataTable = readSrc('./DataTable.tsx');
    expect(dataTable).toContain('minWidth');
  });

  it('AIChatPanel has mobile CSS class', () => {
    const chat = readSrc('./AIChatPanel.tsx');
    expect(chat).toContain('ai-chat-panel');
    expect(chat).toContain('ai-chat-toggle');
  });

  it('NotificationCenter has mobile CSS class', () => {
    const notif = readSrc('./NotificationCenter.tsx');
    expect(notif).toContain('notification-dropdown');
  });

  it('Modal has CSS classes for mobile bottom-sheet', () => {
    const modal = readSrc('./Modal.tsx');
    expect(modal).toContain('modal-overlay');
    expect(modal).toContain('modal-content');
  });
});

describe('Mobile Responsive: Page class bindings', () => {
  it('Orders page has page-header and filter-pills classes', () => {
    const orders = readSrc('../pages/Orders.tsx');
    expect(orders).toContain('page-header');
    expect(orders).toContain('page-header-actions');
    expect(orders).toContain('filter-pills');
  });

  it('Drivers page has page-header and filter-pills classes', () => {
    const drivers = readSrc('../pages/Drivers.tsx');
    expect(drivers).toContain('page-header');
    expect(drivers).toContain('filter-pills');
  });

  it('Vehicles page has page-header class', () => {
    const vehicles = readSrc('../pages/Vehicles.tsx');
    expect(vehicles).toContain('page-header');
  });

  it('Routes page has page-header and filter-pills classes', () => {
    const routes = readSrc('../pages/Routes.tsx');
    expect(routes).toContain('page-header');
    expect(routes).toContain('filter-pills');
  });

  it('Dashboard page has kpi-grid class', () => {
    const dashboard = readSrc('../pages/Dashboard.tsx');
    expect(dashboard).toContain('kpi-grid');
  });

  it('Analytics page has kpi-grid class', () => {
    const analytics = readSrc('../pages/Analytics.tsx');
    expect(analytics).toContain('kpi-grid');
  });

  it('RouteDetail page has kpi-grid class', () => {
    const routeDetail = readSrc('../pages/RouteDetail.tsx');
    expect(routeDetail).toContain('kpi-grid');
  });

  it('LiveMap page has mobile layout classes', () => {
    const liveMap = readSrc('../pages/LiveMap.tsx');
    expect(liveMap).toContain('live-map-content');
    expect(liveMap).toContain('live-map-pane');
    expect(liveMap).toContain('live-map-feed');
  });

  it('Settings page has settings-tabs class', () => {
    const settings = readSrc('../pages/Settings.tsx');
    expect(settings).toContain('settings-tabs');
  });
});
