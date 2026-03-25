import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRoute, extractDefinedRoutes, pathMatchesRoute } from './inventory.mjs';

test('extractDefinedRoutes resolves nested route paths', () => {
  const source = `
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="orders" element={<Orders />} />
      </Route>
    </Routes>
  `;

  const routes = extractDefinedRoutes(source, '/tmp/App.tsx').map((route) => route.path);
  assert.deepEqual(routes, ['/', '/dashboard', '/dashboard/orders']);
});

test('pathMatchesRoute supports dynamic segments', () => {
  assert.equal(pathMatchesRoute('/track/123', '/track/:orderId'), true);
  assert.equal(pathMatchesRoute('/dashboard/messages', '/dashboard/orders'), false);
});

test('classifyRoute categorizes major route groups', () => {
  assert.equal(classifyRoute('/dashboard/routes/new'), 'dashboard');
  assert.equal(classifyRoute('/driver/profile'), 'driver');
  assert.equal(classifyRoute('/pricing'), 'marketing');
  assert.equal(classifyRoute('/track/123'), 'tracking');
});
