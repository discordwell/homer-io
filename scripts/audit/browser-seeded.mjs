import path from 'node:path';
import { chromium, devices } from 'playwright';
import { OUTPUT_DIR } from './lib/config.mjs';
import { mkdirp, slugify, timestampSlug, writeJson, writeText } from './lib/util.mjs';

const runId = timestampSlug();
const runDir = path.join(OUTPUT_DIR, 'browser-seeded', runId);
const screenshotsDir = path.join(runDir, 'screenshots');
const baseUrl = (
  process.env.AUDIT_SEEDED_SITE
  || process.env.AUDIT_PUBLIC_SITE
  || 'http://127.0.0.1:4173'
).replace(/\/+$/, '');

const viewports = {
  desktop: {
    viewport: { width: 1440, height: 960 },
    colorScheme: 'dark',
  },
  tablet: {
    viewport: { width: 1024, height: 900 },
    colorScheme: 'dark',
  },
  mobile: {
    ...devices['iPhone 13'],
    colorScheme: 'dark',
  },
};

const NOW = '2026-03-25T17:00:00.000Z';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';

const OWNER_USER = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'dispatch@audit.test',
  name: 'Morgan Dispatch',
  role: 'owner',
  tenantId: TENANT_ID,
  createdAt: NOW,
  industry: 'pharmacy',
  enabledFeatures: ['dispatch', 'messages', 'billing'],
};

const DRIVER_USER = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'driver@audit.test',
  name: 'Alex Rivera',
  role: 'driver',
  tenantId: TENANT_ID,
  createdAt: NOW,
};

const DEMO_USER = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'demo@audit.test',
  name: 'Demo User',
  role: 'dispatcher',
  tenantId: TENANT_ID,
  createdAt: NOW,
  isDemo: true,
  industry: 'pharmacy',
};

const ORG_SETTINGS = {
  id: '55555555-5555-4555-8555-555555555555',
  tenantId: TENANT_ID,
  timezone: 'America/Los_Angeles',
  units: 'imperial',
  branding: {},
  notificationPrefs: {},
  industry: 'pharmacy',
  enabledFeatures: ['dispatch', 'messages', 'billing'],
  createdAt: NOW,
  updatedAt: NOW,
};

const POPULATED_ORDERS = [
  {
    id: 'order-1001',
    externalId: 'RX-1001',
    status: 'received',
    priority: 'urgent',
    recipientName: 'Jordan Lee',
    recipientPhone: '555-0101',
    recipientEmail: 'jordan@example.com',
    deliveryAddress: {
      street: '101 Market St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      country: 'US',
    },
    deliveryLat: '37.7936',
    deliveryLng: '-122.3958',
    packageCount: 2,
    weight: '1.8',
    volume: null,
    notes: 'Ring the side buzzer.',
    routeId: 'route-9001',
    stopSequence: 1,
    createdAt: NOW,
    requiresSignature: true,
    requiresPhoto: false,
    timeWindowStart: '2026-03-25T17:30:00.000Z',
    timeWindowEnd: '2026-03-25T18:30:00.000Z',
  },
  {
    id: 'order-1002',
    externalId: 'RX-1002',
    status: 'assigned',
    priority: 'high',
    recipientName: 'Priya Shah',
    recipientPhone: '555-0102',
    recipientEmail: 'priya@example.com',
    deliveryAddress: {
      street: '212 Valencia St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94103',
      country: 'US',
    },
    deliveryLat: '37.7667',
    deliveryLng: '-122.4210',
    packageCount: 1,
    weight: '0.6',
    volume: null,
    notes: 'Patient prefers text on arrival.',
    routeId: 'route-9001',
    stopSequence: 2,
    createdAt: '2026-03-25T15:12:00.000Z',
    requiresSignature: false,
    requiresPhoto: false,
    timeWindowStart: null,
    timeWindowEnd: null,
  },
  {
    id: 'order-1003',
    externalId: 'RX-1003',
    status: 'delivered',
    priority: 'normal',
    recipientName: 'Elena Gomez',
    recipientPhone: '555-0103',
    recipientEmail: 'elena@example.com',
    deliveryAddress: {
      street: '88 Howard St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      country: 'US',
    },
    deliveryLat: '37.7897',
    deliveryLng: '-122.3969',
    packageCount: 1,
    weight: '0.4',
    volume: null,
    notes: null,
    routeId: 'route-9002',
    stopSequence: 4,
    createdAt: '2026-03-25T13:45:00.000Z',
    requiresSignature: false,
    requiresPhoto: true,
    timeWindowStart: null,
    timeWindowEnd: null,
    completedAt: '2026-03-25T16:30:00.000Z',
  },
  {
    id: 'order-1004',
    externalId: 'RX-1004',
    status: 'received',
    priority: 'normal',
    recipientName: 'Mina Patel',
    recipientPhone: '555-0104',
    recipientEmail: 'mina@example.com',
    deliveryAddress: {
      street: '500 Howard St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      country: 'US',
    },
    deliveryLat: '37.7883',
    deliveryLng: '-122.3967',
    packageCount: 1,
    weight: '0.7',
    volume: null,
    notes: 'Leave with concierge if recipient is unavailable.',
    routeId: null,
    stopSequence: null,
    createdAt: '2026-03-25T16:05:00.000Z',
    requiresSignature: false,
    requiresPhoto: false,
    timeWindowStart: null,
    timeWindowEnd: null,
  },
];

const POPULATED_ROUTES = [
  {
    id: 'route-9001',
    name: 'Morning Cold Chain',
    status: 'in_progress',
    driverId: DRIVER_USER.id,
    vehicleId: 'veh-1',
    totalStops: 6,
    completedStops: 2,
    totalDistance: '14.2',
    totalDuration: 132,
    optimizationNotes: 'Prioritized time-window deliveries first.',
    waypoints: [],
    createdAt: '2026-03-25T14:00:00.000Z',
    plannedStartAt: '2026-03-25T16:30:00.000Z',
    plannedEndAt: '2026-03-25T19:00:00.000Z',
    actualStartAt: '2026-03-25T16:38:00.000Z',
    actualEndAt: null,
    depotAddress: { street: '1 Ferry Building', city: 'San Francisco', state: 'CA', zip: '94111' },
    depotLat: '37.7955',
    depotLng: '-122.3937',
    orders: POPULATED_ORDERS.slice(0, 2),
  },
  {
    id: 'route-9002',
    name: 'Noon Signature Sweep',
    status: 'planned',
    driverId: 'driver-2',
    vehicleId: 'veh-2',
    totalStops: 4,
    completedStops: 0,
    totalDistance: '9.8',
    totalDuration: 88,
    optimizationNotes: 'Grouped by elevator access constraints.',
    waypoints: [],
    createdAt: '2026-03-25T15:00:00.000Z',
    plannedStartAt: '2026-03-25T18:00:00.000Z',
    plannedEndAt: '2026-03-25T20:30:00.000Z',
    actualStartAt: null,
    actualEndAt: null,
    depotAddress: { street: '1 Ferry Building', city: 'San Francisco', state: 'CA', zip: '94111' },
    depotLat: '37.7955',
    depotLng: '-122.3937',
    orders: [POPULATED_ORDERS[2]],
  },
];

const POPULATED_MESSAGES = [
  {
    id: 'msg-1',
    routeId: 'route-9001',
    senderId: DRIVER_USER.id,
    senderName: 'Alex Rivera',
    recipientId: OWNER_USER.id,
    body: 'Patient at stop 2 asked for a five-minute delay. Updating ETA now.',
    attachmentUrl: null,
    readAt: null,
    createdAt: '2026-03-25T16:18:00.000Z',
  },
  {
    id: 'msg-2',
    routeId: null,
    senderId: 'system',
    senderName: 'Operations Bot',
    recipientId: OWNER_USER.id,
    body: 'Temperature monitor on van 3 dipped below threshold twice this morning.',
    attachmentUrl: null,
    readAt: '2026-03-25T16:00:00.000Z',
    createdAt: '2026-03-25T15:55:00.000Z',
  },
];

const NOTIFICATIONS = [
  {
    id: 'notif-1',
    type: 'route_delay',
    title: 'Route running late',
    body: 'Morning Cold Chain is 12 minutes behind the promised window.',
    data: {},
    readAt: null,
    createdAt: '2026-03-25T16:20:00.000Z',
  },
  {
    id: 'notif-2',
    type: 'delivery_failure',
    title: 'Delivery exception resolved',
    body: 'Stop 4 on Noon Signature Sweep was rescheduled successfully.',
    data: {},
    readAt: '2026-03-25T16:00:00.000Z',
    createdAt: '2026-03-25T15:50:00.000Z',
  },
];

const SUBSCRIPTION = {
  plan: 'growth',
  status: 'active',
  ordersLimit: 5000,
  ordersUsed: 1320,
  payAsYouGoEnabled: true,
  trialEndsAt: null,
  currentPeriodEnd: '2026-04-01T00:00:00.000Z',
  canceledAt: null,
  usage: {
    driverCount: 6,
    orderCount: 1320,
    routeCount: 48,
  },
  metered: {
    aiOptimizations: 12,
    aiDispatches: 3,
    aiChatMessages: 19,
    smsSent: 112,
    emailsSent: 488,
    podStorageMb: 128,
  },
};

const ONBOARDING_STATUS = {
  completed: false,
  currentStep: 4,
  steps: [
    { key: 'industry', label: 'Choose your industry', completed: true },
    { key: 'vehicle', label: 'Add your first vehicle', completed: true },
    { key: 'driver', label: 'Add a driver', completed: true },
    { key: 'order', label: 'Import or create an order', completed: false, skippable: false },
    { key: 'route', label: 'Create a route', completed: false, skippable: false },
    { key: 'notification', label: 'Configure notifications', completed: false, skippable: true },
  ],
};

const INTELLIGENCE_INSIGHTS = {
  summary: {
    totalAddressesLearned: 248,
    totalDeliveriesTracked: 834,
    overallFailureRate: 0.06,
  },
  last7Days: {
    deliveriesTracked: 119,
    avgServiceTimeSeconds: 412,
    avgEtaErrorMinutes: 4.8,
  },
  topFailureAddresses: [
    {
      addressHash: 'hash-1',
      addressNormalized: {
        street: '212 Valencia St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94103',
      },
      totalDeliveries: 8,
      failedDeliveries: 3,
      successfulDeliveries: 5,
      commonFailureReasons: [{ reason: 'no_answer', count: 2 }],
    },
  ],
};

const ADDRESS_INTELLIGENCE = {
  addressHash: 'hash-1',
  totalDeliveries: 12,
  successfulDeliveries: 9,
  failedDeliveries: 3,
  avgServiceTimeSeconds: 405,
  accessInstructions: 'Use service elevator via alley entrance.',
  parkingNotes: 'Loading zone after 10am only.',
  commonFailureReasons: [{ reason: 'no_answer', count: 2 }],
  recentMetrics: [
    {
      deliveryStatus: 'delivered',
      failureCategory: null,
      serviceTimeSeconds: 398,
      completedAt: '2026-03-20T16:12:00.000Z',
    },
  ],
};

const DRIVER_PROFILE = {
  id: DRIVER_USER.id,
  name: DRIVER_USER.name,
  email: DRIVER_USER.email,
  phone: '555-0168',
  licenseNumber: 'CA-D1234567',
  status: 'available',
  currentVehicleId: 'veh-1',
};

const DRIVER_CURRENT_ROUTE = {
  ...POPULATED_ROUTES[0],
  orders: [
    {
      ...POPULATED_ORDERS[0],
      status: 'assigned',
      stopSequence: 1,
    },
    {
      ...POPULATED_ORDERS[1],
      status: 'in_transit',
      stopSequence: 2,
    },
  ],
};

const DRIVER_UPCOMING_ROUTES = [
  {
    ...POPULATED_ROUTES[1],
    status: 'planned',
    orders: [],
  },
];

const DISPATCH_PREVIEW = {
  routes: [
    {
      id: 'dispatch-route-1',
      name: 'Auto Dispatch 1',
      driverName: 'Alex Rivera',
      totalStops: 4,
      estimatedDistance: 11.4,
      reasoning: 'Balanced cold-chain urgency with current vehicle location.',
      status: 'planned',
    },
    {
      id: 'dispatch-route-2',
      name: 'Auto Dispatch 2',
      driverName: 'Taylor Kim',
      totalStops: 3,
      estimatedDistance: 8.1,
      reasoning: 'Kept signature-required stops clustered downtown.',
      status: 'planned',
    },
  ],
  unassignedOrderIds: [],
  totalOrders: 7,
  totalDrivers: 2,
};

const ROUTE_RISK = [
  {
    orderId: 'order-1001',
    score: 28,
    factors: [
      {
        name: 'parking',
        points: 10,
        detail: 'Loading zone availability is inconsistent after 10am.',
      },
    ],
  },
];

const ANALYTICS_OVERVIEW = {
  totalDeliveries: 482,
  successRate: 96.8,
  avgDeliveryTime: 31,
  totalRoutes: 48,
  totalDistance: 712,
  ordersReceived: 501,
  onTimeRate: 93.4,
  activeDriverCount: 6,
  totalDriverCount: 8,
  sparklines: {
    deliveries: [52, 58, 61, 59, 66, 70, 72],
    successRate: [94, 95, 96, 96, 95, 97, 97],
    onTimeRate: [89, 90, 91, 92, 93, 93, 94],
    avgDeliveryTime: [36, 35, 34, 33, 32, 31, 31],
    activeDrivers: [5, 5, 6, 6, 6, 6, 6],
    ordersReceived: [57, 63, 65, 67, 76, 84, 89],
  },
  deltas: {
    deliveries: 14,
    successRate: 2,
    onTimeRate: 4,
    avgDeliveryTime: -9,
    activeDrivers: 20,
    ordersReceived: 11,
  },
};

const ANALYTICS_DRIVERS = [
  {
    driverId: '33333333-3333-4333-8333-333333333333',
    driverName: 'Alex Rivera',
    totalDeliveries: 128,
    successRate: 98,
    avgDeliveryTime: 27,
    totalDistance: 188,
    sparkline: [15, 17, 16, 20, 18, 21, 21],
    efficiencyScore: 92,
    vsFleetAvg: 4,
  },
  {
    driverId: '77777777-7777-4777-8777-777777777777',
    driverName: 'Taylor Kim',
    totalDeliveries: 104,
    successRate: 95,
    avgDeliveryTime: 31,
    totalDistance: 171,
    sparkline: [12, 15, 14, 16, 15, 16, 16],
    efficiencyScore: 84,
    vsFleetAvg: 1,
  },
  {
    driverId: '88888888-8888-4888-8888-888888888888',
    driverName: 'Jordan Chen',
    totalDeliveries: 93,
    successRate: 92,
    avgDeliveryTime: 35,
    totalDistance: 164,
    sparkline: [11, 12, 13, 13, 14, 15, 15],
    efficiencyScore: 76,
    vsFleetAvg: -2,
  },
  {
    driverId: '99999999-9999-4999-8999-999999999999',
    driverName: 'Casey Nguyen',
    totalDeliveries: 81,
    successRate: 90,
    avgDeliveryTime: 39,
    totalDistance: 143,
    sparkline: [9, 10, 11, 12, 12, 13, 14],
    efficiencyScore: 68,
    vsFleetAvg: -4,
  },
];

const ANALYTICS_ROUTES = {
  totalRoutes: 48,
  completedRoutes: 43,
  avgStopsPerRoute: 7.4,
  avgCompletionRate: 94,
  avgDuration: 116,
  routes: [
    {
      routeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      routeName: 'Morning Cold Chain',
      stops: 6,
      durationMinutes: 132,
      plannedDurationMinutes: 124,
      completionRate: 100,
      driverName: 'Alex Rivera',
    },
    {
      routeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      routeName: 'Downtown Signature Sweep',
      stops: 8,
      durationMinutes: 145,
      plannedDurationMinutes: 138,
      completionRate: 100,
      driverName: 'Taylor Kim',
    },
    {
      routeId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      routeName: 'Neighborhood Refill Loop',
      stops: 7,
      durationMinutes: 101,
      plannedDurationMinutes: 109,
      completionRate: 96,
      driverName: 'Jordan Chen',
    },
    {
      routeId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      routeName: 'University Campus Run',
      stops: 9,
      durationMinutes: 158,
      plannedDurationMinutes: 141,
      completionRate: 89,
      driverName: 'Casey Nguyen',
    },
    {
      routeId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      routeName: 'Afternoon Med Sync',
      stops: 5,
      durationMinutes: 84,
      plannedDurationMinutes: 90,
      completionRate: 100,
      driverName: 'Alex Rivera',
    },
    {
      routeId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      routeName: 'Sunset Assisted Living',
      stops: 10,
      durationMinutes: 166,
      plannedDurationMinutes: 152,
      completionRate: 82,
      driverName: 'Taylor Kim',
    },
  ],
};

const ANALYTICS_TRENDS = [
  { date: '2026-03-19', deliveries: 52, failedDeliveries: 3, newOrders: 57, onTimeRate: 89 },
  { date: '2026-03-20', deliveries: 58, failedDeliveries: 2, newOrders: 63, onTimeRate: 90 },
  { date: '2026-03-21', deliveries: 61, failedDeliveries: 2, newOrders: 65, onTimeRate: 91 },
  { date: '2026-03-22', deliveries: 59, failedDeliveries: 4, newOrders: 67, onTimeRate: 90 },
  { date: '2026-03-23', deliveries: 66, failedDeliveries: 1, newOrders: 76, onTimeRate: 94 },
  { date: '2026-03-24', deliveries: 70, failedDeliveries: 2, newOrders: 84, onTimeRate: 94 },
  { date: '2026-03-25', deliveries: 72, failedDeliveries: 1, newOrders: 89, onTimeRate: 95 },
];

const ANALYTICS_HEATMAP = Array.from({ length: 7 }, (_, dayOfWeek) =>
  Array.from({ length: 24 }, (_, hour) => ({
    dayOfWeek,
    hour,
    count: hour >= 9 && hour <= 17 ? Math.max(0, Math.round((18 - Math.abs(13 - hour)) * (dayOfWeek < 5 ? 1 : 0.55))) : 0,
  }))).flat();

const ANALYTICS_INSIGHTS = [
  {
    id: 'insight-1',
    type: 'positive',
    category: 'on-time',
    headline: 'Downtown routes are consistently recovering time by the final third.',
    detail: 'Alex Rivera and Taylor Kim are both averaging better-than-planned completion on their last three stops.',
    impact: 8,
    action: { type: 'copilot_query', payload: 'How can I reuse Alex Rivera’s late-route recovery pattern?' },
  },
  {
    id: 'insight-2',
    type: 'warning',
    category: 'service-time',
    headline: 'Campus deliveries are dragging average stop time upward.',
    detail: 'University Campus Run is taking 12% longer than planned because access and handoff times spike after 2pm.',
    impact: 6,
    action: { type: 'navigate', payload: '/dashboard/routes' },
  },
  {
    id: 'insight-3',
    type: 'suggestion',
    category: 'staffing',
    headline: 'A sixth driver is absorbing the afternoon volume spike.',
    detail: 'Orders rise sharply after noon; keeping one flexible swing driver online protects on-time performance.',
    impact: 5,
    action: { type: 'none' },
  },
];

const ANALYTICS_OUTCOMES = {
  statusDistribution: [
    { date: '2026-03-19', delivered: 49, failed: 3, inTransit: 2, assigned: 3 },
    { date: '2026-03-20', delivered: 55, failed: 2, inTransit: 1, assigned: 5 },
    { date: '2026-03-21', delivered: 58, failed: 2, inTransit: 1, assigned: 4 },
    { date: '2026-03-22', delivered: 55, failed: 4, inTransit: 2, assigned: 6 },
    { date: '2026-03-23', delivered: 64, failed: 1, inTransit: 1, assigned: 10 },
    { date: '2026-03-24', delivered: 68, failed: 2, inTransit: 1, assigned: 13 },
    { date: '2026-03-25', delivered: 71, failed: 1, inTransit: 0, assigned: 17 },
  ],
  failureCategories: [
    { category: 'No answer', count: 6, percentage: 40 },
    { category: 'Access issue', count: 4, percentage: 27 },
    { category: 'Bad address', count: 3, percentage: 20 },
    { category: 'Cold-chain retry', count: 2, percentage: 13 },
  ],
  timeWindowCompliance: 92,
  totalWithTimeWindow: 143,
  onTimeCount: 132,
};

const scenarios = [
  {
    id: 'owner-dashboard-populated',
    path: '/dashboard',
    viewport: 'desktop',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'owner-dashboard-tablet',
    path: '/dashboard',
    viewport: 'tablet',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'owner-dashboard-empty',
    path: '/dashboard',
    viewport: 'desktop',
    authUser: OWNER_USER,
    fixture: 'empty',
  },
  {
    id: 'owner-dashboard-mobile-nav',
    path: '/dashboard',
    viewport: 'mobile',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'owner-orders-populated',
    path: '/dashboard/orders',
    viewport: 'desktop',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'owner-orders-tablet',
    path: '/dashboard/orders',
    viewport: 'tablet',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'owner-orders-billing-blocked',
    path: '/dashboard/orders',
    viewport: 'desktop',
    authUser: OWNER_USER,
    fixture: 'billing-blocked',
  },
  {
    id: 'owner-routes-populated',
    path: '/dashboard/routes',
    viewport: 'desktop',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'owner-routes-tablet',
    path: '/dashboard/routes',
    viewport: 'tablet',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'owner-routes-empty',
    path: '/dashboard/routes',
    viewport: 'desktop',
    authUser: OWNER_USER,
    fixture: 'empty',
  },
  {
    id: 'owner-messages-populated',
    path: '/dashboard/messages',
    viewport: 'desktop',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'owner-analytics-desktop',
    path: '/dashboard/analytics',
    viewport: 'desktop',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'owner-analytics-tablet',
    path: '/dashboard/analytics',
    viewport: 'tablet',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'owner-stale-auth',
    path: '/dashboard',
    viewport: 'desktop',
    authUser: OWNER_USER,
    fixture: 'stale-auth',
  },
  {
    id: 'driver-route-active',
    path: '/driver',
    viewport: 'mobile',
    authUser: DRIVER_USER,
    fixture: 'driver-active',
  },
  {
    id: 'driver-route-empty',
    path: '/driver',
    viewport: 'mobile',
    authUser: DRIVER_USER,
    fixture: 'driver-empty',
  },
  {
    id: 'driver-profile',
    path: '/driver/profile',
    viewport: 'mobile',
    authUser: DRIVER_USER,
    fixture: 'driver-active',
  },
  {
    id: 'driver-invalid-role',
    path: '/driver',
    viewport: 'mobile',
    authUser: OWNER_USER,
    fixture: 'populated',
  },
  {
    id: 'demo-orders-ready',
    path: '/demo/orders',
    viewport: 'desktop',
    authUser: null,
    fixture: 'demo-ready',
  },
  {
    id: 'demo-routes-ready',
    path: '/demo/routes',
    viewport: 'mobile',
    authUser: null,
    fixture: 'demo-ready',
  },
  {
    id: 'demo-provisioning-error',
    path: '/demo',
    viewport: 'desktop',
    authUser: null,
    fixture: 'demo-error',
  },
];

function issue(severity, title, summary, evidence = []) {
  return {
    id: slugify(`${severity}-${title}`),
    severity,
    title,
    summary,
    evidence,
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function mergeIssues(issues) {
  const merged = new Map();

  for (const current of issues) {
    const key = `${current.severity}::${current.title}::${current.summary}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...current, evidence: unique(current.evidence) });
      continue;
    }

    existing.evidence = unique([...existing.evidence, ...current.evidence]);
  }

  return [...merged.values()];
}

function filterConsoleErrors(scenario, errors) {
  return errors.filter((message) => {
    if (
      message.includes('[GSI_LOGGER]: The given origin is not allowed for the given client ID.')
      || message.includes('Failed to load resource: the server responded with a status of 403 ()')
    ) {
      return false;
    }

    if (scenario.fixture === 'stale-auth' && message.includes('401 (Unauthorized)')) {
      return false;
    }

    if (scenario.fixture === 'billing-blocked' && message.includes('402 (Payment Required)')) {
      return false;
    }

    if (
      scenario.fixture === 'demo-error'
      && (message.includes('500 (Internal Server Error)') || message.includes('[demo] Tenant provisioning failed:'))
    ) {
      return false;
    }

    return true;
  });
}

function jsonHeaders() {
  return {
    'access-control-allow-origin': '*',
    'content-type': 'application/json',
  };
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
}

function createAuthStorage(user) {
  return {
    state: {
      user,
      accessToken: 'audit-access-token',
      refreshToken: 'audit-refresh-token',
      isAuthenticated: true,
    },
    version: 0,
  };
}

function getFixtureBundle(scenario) {
  const empty = scenario.fixture === 'empty';
  const driverEmpty = scenario.fixture === 'driver-empty';

  return {
    dashboardStats: empty
      ? {
          ordersToday: 0,
          activeRoutes: 0,
          activeDrivers: 0,
          deliveryRate: 0,
          totalVehicles: 0,
          recentOrders: [],
        }
      : {
          ordersToday: 37,
          activeRoutes: 6,
          activeDrivers: 4,
          deliveryRate: 96,
          totalVehicles: 8,
          recentOrders: POPULATED_ORDERS.slice(0, 3).map((order) => ({
            id: order.id,
            recipientName: order.recipientName,
            status: order.status,
            priority: order.priority,
            packageCount: order.packageCount,
            createdAt: order.createdAt,
          })),
        },
    orders: empty ? [] : POPULATED_ORDERS,
    routes: empty ? [] : POPULATED_ROUTES,
    messages: empty ? [] : POPULATED_MESSAGES,
    notifications: empty ? [] : NOTIFICATIONS,
    subscription: SUBSCRIPTION,
    onboarding: ONBOARDING_STATUS,
    intelligenceInsights: empty
      ? {
          summary: {
            totalAddressesLearned: 0,
            totalDeliveriesTracked: 0,
            overallFailureRate: 0,
          },
          last7Days: {
            deliveriesTracked: 0,
            avgServiceTimeSeconds: null,
            avgEtaErrorMinutes: null,
          },
          topFailureAddresses: [],
        }
      : INTELLIGENCE_INSIGHTS,
    addressIntelligence: ADDRESS_INTELLIGENCE,
    analyticsOverview: empty ? {
      ...ANALYTICS_OVERVIEW,
      totalDeliveries: 0,
      successRate: 0,
      avgDeliveryTime: null,
      totalRoutes: 0,
      totalDistance: null,
      ordersReceived: 0,
      onTimeRate: 0,
      activeDriverCount: 0,
      totalDriverCount: 0,
      sparklines: {
        deliveries: [0, 0, 0, 0, 0, 0, 0],
        successRate: [0, 0, 0, 0, 0, 0, 0],
        onTimeRate: [0, 0, 0, 0, 0, 0, 0],
        avgDeliveryTime: [0, 0, 0, 0, 0, 0, 0],
        activeDrivers: [0, 0, 0, 0, 0, 0, 0],
        ordersReceived: [0, 0, 0, 0, 0, 0, 0],
      },
      deltas: {
        deliveries: 0,
        successRate: 0,
        onTimeRate: 0,
        avgDeliveryTime: 0,
        activeDrivers: 0,
        ordersReceived: 0,
      },
    } : ANALYTICS_OVERVIEW,
    analyticsDrivers: empty ? [] : ANALYTICS_DRIVERS,
    analyticsRoutes: empty ? { ...ANALYTICS_ROUTES, totalRoutes: 0, completedRoutes: 0, avgStopsPerRoute: 0, avgCompletionRate: 0, avgDuration: null, routes: [] } : ANALYTICS_ROUTES,
    analyticsTrends: empty ? [] : ANALYTICS_TRENDS,
    analyticsHeatmap: empty ? [] : ANALYTICS_HEATMAP,
    analyticsInsights: empty ? [] : ANALYTICS_INSIGHTS,
    analyticsOutcomes: empty ? {
      statusDistribution: [],
      failureCategories: [],
      timeWindowCompliance: 0,
      totalWithTimeWindow: 0,
      onTimeCount: 0,
    } : ANALYTICS_OUTCOMES,
    driverCurrentRoute: driverEmpty ? null : DRIVER_CURRENT_ROUTE,
    driverUpcomingRoutes: driverEmpty ? DRIVER_UPCOMING_ROUTES : DRIVER_UPCOMING_ROUTES,
    driverProfile: {
      ...DRIVER_PROFILE,
      status: driverEmpty ? 'offline' : DRIVER_PROFILE.status,
    },
  };
}

function getPaginated(items, page = 1, limit = 20) {
  return {
    items,
    total: items.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
  };
}

function createApiHandler(scenario, state) {
  const fixtures = getFixtureBundle(scenario);

  return async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api/, '') || '/';
    const method = request.method().toUpperCase();
    const target = `${method} ${pathname}${url.search}`;

    state.apiRequests.push(target);

    if (scenario.fixture === 'stale-auth') {
      if (pathname === '/auth/refresh') {
        await fulfillJson(route, { message: 'Refresh token expired' }, 401);
        return;
      }

      await fulfillJson(route, { message: 'Unauthorized' }, 401);
      return;
    }

    if (pathname === '/auth/demo-session' && method === 'POST') {
      if (scenario.fixture === 'demo-error') {
        await fulfillJson(route, { message: 'Audit fixture could not provision the demo workspace.' }, 500);
        return;
      }

      await fulfillJson(route, {
        accessToken: 'demo-audit-token',
        refreshToken: 'demo-audit-refresh',
        user: DEMO_USER,
      });
      return;
    }

    if (pathname === '/dashboard/stats' && method === 'GET') {
      await fulfillJson(route, fixtures.dashboardStats);
      return;
    }

    if (pathname === '/settings/organization' && method === 'GET') {
      await fulfillJson(route, ORG_SETTINGS);
      return;
    }

    if (pathname === '/billing/subscription' && method === 'GET') {
      await fulfillJson(route, fixtures.subscription);
      return;
    }

    if (pathname === '/onboarding/status' && method === 'GET') {
      await fulfillJson(route, fixtures.onboarding);
      return;
    }

    if (pathname === '/notifications/unread-count' && method === 'GET') {
      const unread = fixtures.notifications.filter((item) => !item.readAt).length;
      await fulfillJson(route, { count: unread });
      return;
    }

    if (pathname === '/notifications' && method === 'GET') {
      await fulfillJson(route, getPaginated(fixtures.notifications));
      return;
    }

    if (/^\/notifications\/[^/]+\/read$/.test(pathname) && method === 'PATCH') {
      await fulfillJson(route, {});
      return;
    }

    if (pathname === '/notifications/mark-all-read' && method === 'POST') {
      await fulfillJson(route, {});
      return;
    }

    if (pathname === '/messages' && method === 'GET') {
      await fulfillJson(route, fixtures.messages);
      return;
    }

    if (pathname === '/messages/unread-count' && method === 'GET') {
      const unread = fixtures.messages.filter((item) => !item.readAt).length;
      await fulfillJson(route, { count: unread });
      return;
    }

    if (/^\/messages\/[^/]+\/read$/.test(pathname) && method === 'PATCH') {
      await fulfillJson(route, {});
      return;
    }

    if (pathname === '/intelligence/insights' && method === 'GET') {
      await fulfillJson(route, fixtures.intelligenceInsights);
      return;
    }

    if (pathname === '/analytics/enhanced/overview' && method === 'GET') {
      await fulfillJson(route, fixtures.analyticsOverview);
      return;
    }

    if (pathname === '/analytics/enhanced/drivers' && method === 'GET') {
      await fulfillJson(route, fixtures.analyticsDrivers);
      return;
    }

    if (pathname === '/analytics/enhanced/routes' && method === 'GET') {
      await fulfillJson(route, fixtures.analyticsRoutes);
      return;
    }

    if (pathname === '/analytics/enhanced/trends' && method === 'GET') {
      await fulfillJson(route, fixtures.analyticsTrends);
      return;
    }

    if (pathname === '/analytics/heatmap' && method === 'GET') {
      await fulfillJson(route, fixtures.analyticsHeatmap);
      return;
    }

    if (pathname === '/analytics/insights' && method === 'GET') {
      await fulfillJson(route, fixtures.analyticsInsights);
      return;
    }

    if (pathname === '/analytics/outcomes' && method === 'GET') {
      await fulfillJson(route, fixtures.analyticsOutcomes);
      return;
    }

    if (/^\/intelligence\/address\/[^/]+$/.test(pathname) && method === 'GET') {
      await fulfillJson(route, fixtures.addressIntelligence);
      return;
    }

    if (/^\/intelligence\/risk\/[^/]+$/.test(pathname) && method === 'GET') {
      await fulfillJson(route, ROUTE_RISK);
      return;
    }

    if (pathname === '/orders' && method === 'GET') {
      if (scenario.fixture === 'billing-blocked') {
        await fulfillJson(route, { message: 'Your subscription no longer allows order management.' }, 402);
        return;
      }

      const status = url.searchParams.get('status');
      const unassigned = url.searchParams.get('unassigned');
      let items = fixtures.orders;

      if (status) {
        items = items.filter((order) => order.status === status);
      }
      if (unassigned === 'true') {
        items = items.filter((order) => !order.routeId);
      }

      await fulfillJson(route, getPaginated(items));
      return;
    }

    if (pathname === '/orders/batch/status' && method === 'POST') {
      await fulfillJson(route, { updated: 1 });
      return;
    }

    if (pathname === '/routes' && method === 'GET') {
      await fulfillJson(route, getPaginated(fixtures.routes));
      return;
    }

    if (/^\/routes\/[^/]+$/.test(pathname) && method === 'GET') {
      const routeId = pathname.split('/')[2];
      const currentRoute = fixtures.routes.find((item) => item.id === routeId) || fixtures.routes[0];
      await fulfillJson(route, currentRoute || {});
      return;
    }

    if (pathname === '/fleet/drivers' && method === 'GET') {
      await fulfillJson(route, getPaginated([
        { id: DRIVER_USER.id, name: DRIVER_USER.name, status: 'available' },
        { id: 'driver-2', name: 'Taylor Kim', status: 'available' },
      ]));
      return;
    }

    if (pathname === '/dispatch/auto-dispatch' && method === 'POST') {
      await fulfillJson(route, DISPATCH_PREVIEW);
      return;
    }

    if (pathname === '/dispatch/auto-dispatch/confirm' && method === 'POST') {
      await fulfillJson(route, { success: true });
      return;
    }

    if (pathname === '/driver/current-route' && method === 'GET') {
      await fulfillJson(route, fixtures.driverCurrentRoute);
      return;
    }

    if (pathname === '/driver/upcoming-routes' && method === 'GET') {
      await fulfillJson(route, fixtures.driverUpcomingRoutes);
      return;
    }

    if (pathname === '/driver/profile' && method === 'GET') {
      await fulfillJson(route, state.driverProfile || fixtures.driverProfile);
      return;
    }

    if (pathname === '/driver/status' && method === 'PATCH') {
      let nextStatus = 'available';
      try {
        nextStatus = request.postDataJSON()?.status || 'available';
      } catch {
        nextStatus = 'available';
      }
      state.driverProfile = {
        ...(state.driverProfile || fixtures.driverProfile),
        status: nextStatus,
      };
      await fulfillJson(route, {});
      return;
    }

    state.unhandledApiRequests.push(target);
    await fulfillJson(route, { message: `Unhandled audit API route: ${target}` }, 500);
  };
}

async function attachPageInstrumentation(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText || 'failed'}`);
  });

  return { consoleErrors, pageErrors, requestFailures };
}

async function waitForAppContent(page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#root');
    const text = document.body?.innerText?.trim() || '';
    return Boolean(root && root.childElementCount > 0) || text.length > 0;
  }, { timeout: 5000 });

  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(350);
}

async function collectVisibleTexts(page, selector, limit) {
  return page.locator(selector).evaluateAll((nodes, max) =>
    nodes
      .map((node) => {
        const text = node.textContent?.replace(/\s+/g, ' ').trim() || '';
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        const hidden = style.display === 'none'
          || style.visibility === 'hidden'
          || style.opacity === '0'
          || rect.width === 0
          || rect.height === 0;
        return { text, hidden };
      })
      .filter((item) => item.text && !item.hidden)
      .map((item) => item.text)
      .slice(0, max), limit);
}

async function gatherSnapshot(page) {
  return {
    title: await page.title(),
    url: page.url(),
    headings: await collectVisibleTexts(page, 'h1, h2, h3', 20),
    ctas: await page.locator('a, button').evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const text = node.textContent?.replace(/\s+/g, ' ').trim() || '';
          const href = node instanceof HTMLAnchorElement ? node.href : '';
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          const hidden = style.display === 'none'
            || style.visibility === 'hidden'
            || style.opacity === '0'
            || rect.width === 0
            || rect.height === 0;
          return { text, href, hidden };
        })
        .filter((item) => item.text && !item.hidden)
        .slice(0, 24)),
    bodyTextSample: await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1000)),
  };
}

function topScreenshotPath(scenario) {
  return path.join(screenshotsDir, `${scenario.id}-${scenario.viewport}-top.png`);
}

function fullScreenshotPath(scenario) {
  return path.join(screenshotsDir, `${scenario.id}-${scenario.viewport}-full.png`);
}

async function ensureVisible(page, locator, issues, severity, title, summary, evidence) {
  if ((await locator.count()) === 0 || !(await locator.first().isVisible().catch(() => false))) {
    issues.push(issue(severity, title, summary, evidence));
    return false;
  }
  return true;
}

async function checkOwnerDashboardPopulated(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  await ensureVisible(
    page,
    page.getByRole('heading', { name: /welcome back/i }),
    issues,
    'P1',
    'Dashboard loses its primary heading in the populated state',
    'Authenticated dashboard sessions should open with a visible heading instead of a silent shell.',
    evidence,
  );

  if ((await page.getByText(/Delivery Intelligence/i).count()) === 0) {
    issues.push(issue(
      'P2',
      'Dashboard omits the intelligence widget in the populated state',
      'The populated dashboard should surface delivery intelligence instead of hiding a high-signal block.',
      evidence,
    ));
  }

  const viewAll = page.getByRole('button', { name: /view all/i }).first();
  if ((await viewAll.count()) > 0) {
    await viewAll.click();
    await page.waitForURL('**/dashboard/orders', { timeout: 5000 }).catch(() => {});
    if (!page.url().includes('/dashboard/orders')) {
      issues.push(issue(
        'P2',
        'Dashboard recent-orders CTA does not reach Orders',
        'The recent-orders card should navigate to the orders list when a human clicks View all.',
        [page.url(), ...evidence],
      ));
    } else {
      await page.goBack().catch(() => {});
      await page.waitForTimeout(250);
    }
  }
}

async function checkOwnerDashboardEmpty(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  await ensureVisible(
    page,
    page.getByText(/Get started with HOMER\.io/i),
    issues,
    'P1',
    'Dashboard empty state does not explain how to start',
    'A new tenant should get a clear getting-started state instead of a blank or misleading dashboard.',
    evidence,
  );

  const ctas = [
    page.getByRole('button', { name: /add vehicle/i }),
    page.getByRole('button', { name: /import orders/i }),
    page.getByRole('button', { name: /create route/i }),
  ];
  const visibleCount = await Promise.all(ctas.map(async (locator) => (
    (await locator.count()) > 0 && await locator.first().isVisible().catch(() => false)
  )));
  if (visibleCount.filter(Boolean).length < 3) {
    issues.push(issue(
      'P2',
      'Dashboard empty state is missing one or more recovery CTAs',
      'The empty dashboard should surface all three primary setup actions: vehicle, orders, and routes.',
      evidence,
    ));
  }
}

async function checkOwnerDashboardMobileNav(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  const toggle = page.getByRole('button', { name: /toggle navigation menu/i });
  if (!await ensureVisible(
    page,
    toggle,
    issues,
    'P1',
    'Mobile dashboard shell hides the navigation toggle',
    'A mobile dashboard without a working nav toggle strands the user inside the current route.',
    evidence,
  )) {
    return;
  }

  await toggle.click();
  await page.waitForTimeout(250);
  const ordersLink = page.getByRole('link', { name: /orders/i }).first();
  if (!await ensureVisible(
    page,
    ordersLink,
    issues,
    'P1',
    'Mobile dashboard nav does not expose Orders',
    'The hamburger menu should expose the route list on mobile.',
    evidence,
  )) {
    return;
  }

  await ordersLink.click();
  await page.waitForURL('**/dashboard/orders', { timeout: 5000 }).catch(() => {});
  if (!page.url().includes('/dashboard/orders')) {
    issues.push(issue(
      'P1',
      'Mobile dashboard nav does not navigate to Orders',
      'Tapping Orders in the mobile sidebar should change the route.',
      [page.url(), ...evidence],
    ));
  }
}

async function checkOwnerOrdersPopulated(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  await ensureVisible(
    page,
    page.getByRole('heading', { name: /^orders$/i }),
    issues,
    'P1',
    'Orders route lacks a visible page heading',
    'The orders route should expose a clear heading and not rely on table chrome alone.',
    evidence,
  );

  const addOrder = page.getByRole('button', { name: /add order/i }).first();
  if ((await addOrder.count()) > 0) {
    await addOrder.click();
    await page.waitForTimeout(200);
    if ((await page.getByText(/Pharmacy Fields/i).count()) === 0) {
      issues.push(issue(
        'P1',
        'Orders modal drops industry-specific fields',
        'This tenant is configured as a pharmacy, so the add-order flow should expose pharmacy-specific fields without requiring a prior visit to Settings.',
        evidence,
      ));
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }

  const rowCheckbox = page.locator('tbody input[type="checkbox"]').first();
  if ((await rowCheckbox.count()) > 0) {
    await rowCheckbox.click();
    if ((await page.getByText(/selected/i).count()) === 0) {
      issues.push(issue(
        'P2',
        'Orders bulk-action bar does not appear after selecting a row',
        'Selecting an order should expose the batch action bar immediately.',
        evidence,
      ));
    }
  }

  const firstRow = page.locator('tbody tr').first();
  if ((await firstRow.count()) > 0) {
    await firstRow.click();
    await page.waitForTimeout(350);
    if ((await page.getByText(/Address Intelligence/i).count()) === 0) {
      issues.push(issue(
        'P2',
        'Orders route does not surface address intelligence on row click',
        'Clicking an order row should expand the address-intelligence panel instead of feeling inert.',
        evidence,
      ));
    }
  }
}

async function checkOwnerOrdersBillingBlocked(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  if ((await page.getByText(/Subscription Required/i).count()) === 0) {
    issues.push(issue(
      'P1',
      'Billing-blocked orders state does not surface the upgrade modal',
      'When the orders API returns a billing block, the user should see the billing modal instead of a silent failure.',
      evidence,
    ));
  }

  if (result.pageErrors.some((message) => /BillingError|Subscription required/i.test(message))
    || result.consoleErrors.some((message) => /BillingError|Subscription required/i.test(message))) {
    issues.push(issue(
      'P2',
      'Billing-blocked orders flow leaks a thrown error into the console',
      'The billing-blocked route should surface a controlled modal without also leaving an unhandled client-side error.',
      [...evidence, ...result.pageErrors, ...result.consoleErrors],
    ));
  }
}

async function checkOwnerRoutesPopulated(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  await ensureVisible(
    page,
    page.getByText(/AI Auto-Dispatch/i),
    issues,
    'P1',
    'Routes route hides the auto-dispatch panel',
    'The routes page should show the auto-dispatch surface when routes and unassigned orders are present.',
    evidence,
  );

  const runButton = page.getByRole('button', { name: /run auto-dispatch/i });
  if (!await ensureVisible(
    page,
    runButton,
    issues,
    'P2',
    'Routes route does not expose the auto-dispatch CTA',
    'The routes page should let the operator run auto-dispatch from the main panel.',
    evidence,
  )) {
    return;
  }

  if (await runButton.isDisabled()) {
    issues.push(issue(
      'P2',
      'Auto-dispatch CTA is disabled despite available work and drivers',
      'With unassigned orders and available drivers in the fixture, auto-dispatch should be runnable.',
      evidence,
    ));
    return;
  }

  await runButton.click();
  await page.waitForTimeout(500);
  if ((await page.getByText(/Dispatch Preview/i).count()) === 0) {
    issues.push(issue(
      'P1',
      'Auto-dispatch does not transition to a preview state',
      'Running auto-dispatch should produce a preview instead of leaving the operator in place with no feedback.',
      evidence,
    ));
  }
}

async function checkOwnerRoutesEmpty(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  await ensureVisible(
    page,
    page.getByText(/No routes yet/i),
    issues,
    'P1',
    'Routes empty state does not explain itself',
    'An empty routes page should explain that there are no routes yet and offer a creation path.',
    evidence,
  );

  if ((await page.getByRole('button', { name: /create route/i }).count()) === 0) {
    issues.push(issue(
      'P2',
      'Routes empty state is missing the create-route CTA',
      'Humans should be able to recover from the empty routes state without guessing what to click next.',
      evidence,
    ));
  }
}

async function checkOwnerAnalytics(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  await ensureVisible(
    page,
    page.getByRole('heading', { name: /^analytics$/i }),
    issues,
    'P1',
    'Analytics route lacks a visible heading',
    'The analytics route should open with a clear heading and not feel like an anonymous chart wall.',
    evidence,
  );

  const kpiLabels = ['Deliveries', 'Success Rate', 'On-Time Rate', 'Avg Time', 'Active Drivers', 'Orders'];
  const visibleKpis = await Promise.all(kpiLabels.map(async (label) => (
    (await page.getByText(new RegExp(`^${label}$`, 'i')).count()) > 0
  )));
  if (visibleKpis.filter(Boolean).length < 5) {
    issues.push(issue(
      'P2',
      'Analytics route is missing KPI cards in the overview band',
      'The analytics overview should show a full KPI strip before dropping the operator into charts and detail tabs.',
      evidence,
    ));
  }

  await ensureVisible(
    page,
    page.getByText(/Delivery Trends/i),
    issues,
    'P2',
    'Analytics route does not surface the trend chart',
    'The main trends chart should render before the tabbed detail section.',
    evidence,
  );

  const routesTab = page.getByRole('button', { name: /^routes$/i }).first();
  if ((await routesTab.count()) > 0) {
    await routesTab.click();
    await page.waitForTimeout(250);
    if ((await page.getByText(/Route Duration Comparison/i).count()) === 0) {
      issues.push(issue(
        'P2',
        'Analytics routes tab does not reveal route-comparison content',
        'Switching to the Routes tab should replace the driver table with route analysis content.',
        evidence,
      ));
    }
  }

  const outcomesTab = page.getByRole('button', { name: /delivery outcomes/i }).first();
  if ((await outcomesTab.count()) > 0) {
    await outcomesTab.click();
    await page.waitForTimeout(250);
    if ((await page.getByText(/Failure Reasons/i).count()) === 0) {
      issues.push(issue(
        'P2',
        'Analytics outcomes tab does not reveal delivery-outcomes content',
        'Switching to the Delivery Outcomes tab should surface the failure breakdown and compliance gauges.',
        evidence,
      ));
    }
  }
}

async function checkOwnerMessagesPopulated(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  await ensureVisible(
    page,
    page.getByRole('heading', { name: /^messages$/i }),
    issues,
    'P1',
    'Messages route does not expose a heading',
    'The messages route should render a visible heading and not look like stray cards inside the shell.',
    evidence,
  );

  const markRead = page.getByRole('button', { name: /mark read/i }).first();
  if ((await markRead.count()) === 0) {
    issues.push(issue(
      'P2',
      'Messages route does not surface unread actions',
      'Unread messages should expose a mark-read action.',
      evidence,
    ));
    return;
  }

  await markRead.click();
  await page.waitForTimeout(300);
  const remaining = await page.getByRole('button', { name: /mark read/i }).count();
  if (remaining !== 0) {
    issues.push(issue(
      'P2',
      'Mark-read action does not clear the unread affordance',
      'Marking a message as read should remove its unread action so the state change is obvious.',
      evidence,
    ));
  }
}

async function checkOwnerStaleAuth(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  if (!page.url().includes('/login')) {
    issues.push(issue(
      'P1',
      'Expired auth does not bounce the user back to Login',
      'A stale session should redirect out of protected dashboard routes instead of leaving the app in a broken state.',
      [page.url(), ...evidence],
    ));
  }

  if ((await page.getByRole('button', { name: /sign in/i }).count()) === 0) {
    issues.push(issue(
      'P2',
      'Expired auth redirect lands on a page without the sign-in affordance',
      'The stale-auth path should end on a usable login screen.',
      evidence,
    ));
  }
}

async function checkDriverRouteActive(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  if ((await page.getByText(/Morning Cold Chain/i).count()) === 0) {
    issues.push(issue(
      'P1',
      'Driver home route does not render the active route header',
      'An active driver session should open directly into the current route details.',
      evidence,
    ));
  }

  const stopSignals = ['Jordan Lee', 'Priya Shah'];
  const visibleStops = await Promise.all(stopSignals.map(async (name) => (
    (await page.getByText(new RegExp(name, 'i')).count()) > 0
  )));
  if (visibleStops.filter(Boolean).length === 0) {
    issues.push(issue(
      'P2',
      'Driver route view does not show stop cards',
      'An active route should expose tappable stops, not just summary numbers.',
      evidence,
    ));
  }
}

async function checkDriverRouteEmpty(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  if ((await page.getByText(/No Active Route/i).count()) === 0) {
    issues.push(issue(
      'P1',
      'Driver empty state does not explain that no route is assigned',
      'Drivers without an active route should get a direct explanation instead of a silent shell.',
      evidence,
    ));
  }

  if ((await page.getByText(/Upcoming Routes/i).count()) === 0) {
    issues.push(issue(
      'P2',
      'Driver empty state omits upcoming assigned work',
      'If upcoming routes exist, the driver empty state should surface them.',
      evidence,
    ));
  }
}

async function checkDriverProfile(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  await ensureVisible(
    page,
    page.getByRole('button', { name: /sign out/i }),
    issues,
    'P2',
    'Driver profile misses the sign-out affordance',
    'The profile route should expose a clear exit path.',
    evidence,
  );

  const statusBefore = await page.getByText(/^Online$/i).count();
  const toggle = page.locator('button').filter({ has: page.locator('div[style*="border-radius: 50%"]') }).first();
  const allButtons = page.locator('button');
  let candidate = null;
  for (let index = 0; index < await allButtons.count(); index += 1) {
    const button = allButtons.nth(index);
    const width = await button.evaluate((node) => node.getBoundingClientRect().width).catch(() => 0);
    if (width >= 44) {
      candidate = button;
      break;
    }
  }
  const statusToggle = candidate || toggle;
  if ((await statusToggle.count()) > 0) {
    await statusToggle.click().catch(() => {});
    await page.waitForTimeout(350);
    const statusAfter = await page.getByText(/^Offline$/i).count();
    if (statusBefore > 0 && statusAfter === 0) {
      issues.push(issue(
        'P2',
        'Driver profile availability toggle does not update visible state',
        'Toggling availability should immediately update the status label so the driver knows the action worked.',
        evidence,
      ));
    }
  }
}

async function checkDriverInvalidRole(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  if (!page.url().includes('/dashboard')) {
    issues.push(issue(
      'P1',
      'Owner session can still reach the driver shell',
      'Users without the driver role should be redirected out of `/driver` immediately.',
      [page.url(), ...evidence],
    ));
  }
}

async function submitDemoGate(page) {
  const email = page.getByPlaceholder(/you@company.com/i);
  const button = page.getByRole('button', { name: /start demo/i });
  if ((await email.count()) === 0 || (await button.count()) === 0) return false;
  await email.fill('audit@example.com');
  await button.click();
  return true;
}

async function checkDemoOrdersReady(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  const submitted = await submitDemoGate(page);
  if (!submitted) {
    issues.push(issue(
      'P1',
      'Demo orders route never showed the email gate',
      'Protected demo subroutes should still give the user a gate to enter the demo.',
      evidence,
    ));
    return;
  }

  await page.waitForTimeout(600);
  if ((await page.getByRole('heading', { name: /^orders$/i }).count()) === 0) {
    issues.push(issue(
      'P1',
      'Demo orders route does not recover into the orders page after email submit',
      'Submitting the demo email gate on `/demo/orders` should land the user in the orders subroute, not leave them stranded.',
      [page.url(), ...evidence],
    ));
  }
}

async function checkDemoRoutesReady(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  const submitted = await submitDemoGate(page);
  if (!submitted) {
    issues.push(issue(
      'P1',
      'Demo routes route never showed the email gate',
      'Protected demo subroutes should still render the entry gate.',
      evidence,
    ));
    return;
  }

  await page.waitForTimeout(600);
  if ((await page.getByRole('heading', { name: /^routes$/i }).count()) === 0) {
    issues.push(issue(
      'P1',
      'Demo routes route does not recover into the routes page after email submit',
      'Submitting the demo gate on `/demo/routes` should land the user in the requested subroute.',
      [page.url(), ...evidence],
    ));
  }
}

async function checkDemoProvisioningError(page, result, issues) {
  const evidence = [result.screenshotPaths.top];
  const submitted = await submitDemoGate(page);
  if (!submitted) {
    issues.push(issue(
      'P1',
      'Demo route never rendered its email gate',
      'The public demo entry point should always render the email gate before provisioning.',
      evidence,
    ));
    return;
  }

  await page.waitForTimeout(600);
  if ((await page.getByText(/could not provision the demo workspace/i).count()) === 0) {
    issues.push(issue(
      'P1',
      'Demo provisioning failure is not shown to the user',
      'If demo provisioning fails server-side, the gate should surface the error and allow retry.',
      evidence,
    ));
  }

  const button = page.getByRole('button', { name: /start demo/i });
  if ((await button.count()) === 0 || await button.first().isDisabled().catch(() => true)) {
    issues.push(issue(
      'P2',
      'Demo provisioning failure leaves the CTA unusable',
      'After a provisioning failure, the Start Demo button should recover so the user can retry.',
      evidence,
    ));
  }
}

async function runScenarioChecks(scenario, page, result, issues) {
  if (scenario.id === 'owner-dashboard-populated') return checkOwnerDashboardPopulated(page, result, issues);
  if (scenario.id === 'owner-dashboard-tablet') return checkOwnerDashboardPopulated(page, result, issues);
  if (scenario.id === 'owner-dashboard-empty') return checkOwnerDashboardEmpty(page, result, issues);
  if (scenario.id === 'owner-dashboard-mobile-nav') return checkOwnerDashboardMobileNav(page, result, issues);
  if (scenario.id === 'owner-orders-populated') return checkOwnerOrdersPopulated(page, result, issues);
  if (scenario.id === 'owner-orders-tablet') return checkOwnerOrdersPopulated(page, result, issues);
  if (scenario.id === 'owner-orders-billing-blocked') return checkOwnerOrdersBillingBlocked(page, result, issues);
  if (scenario.id === 'owner-routes-populated') return checkOwnerRoutesPopulated(page, result, issues);
  if (scenario.id === 'owner-routes-tablet') return checkOwnerRoutesPopulated(page, result, issues);
  if (scenario.id === 'owner-routes-empty') return checkOwnerRoutesEmpty(page, result, issues);
  if (scenario.id === 'owner-messages-populated') return checkOwnerMessagesPopulated(page, result, issues);
  if (scenario.id === 'owner-analytics-desktop') return checkOwnerAnalytics(page, result, issues);
  if (scenario.id === 'owner-analytics-tablet') return checkOwnerAnalytics(page, result, issues);
  if (scenario.id === 'owner-stale-auth') return checkOwnerStaleAuth(page, result, issues);
  if (scenario.id === 'driver-route-active') return checkDriverRouteActive(page, result, issues);
  if (scenario.id === 'driver-route-empty') return checkDriverRouteEmpty(page, result, issues);
  if (scenario.id === 'driver-profile') return checkDriverProfile(page, result, issues);
  if (scenario.id === 'driver-invalid-role') return checkDriverInvalidRole(page, result, issues);
  if (scenario.id === 'demo-orders-ready') return checkDemoOrdersReady(page, result, issues);
  if (scenario.id === 'demo-routes-ready') return checkDemoRoutesReady(page, result, issues);
  if (scenario.id === 'demo-provisioning-error') return checkDemoProvisioningError(page, result, issues);
}

function renderReport(results, issues) {
  const lines = [];
  lines.push('# Seeded Protected Browser Audit');
  lines.push('');
  lines.push(`- Run: \`${runId}\``);
  lines.push(`- Base URL: ${baseUrl}`);
  lines.push(`- Scenario cells checked: ${results.length}`);
  lines.push(`- Issues found: ${issues.length}`);
  lines.push('');
  lines.push('## Results');
  lines.push('');

  for (const result of results) {
    lines.push(`### ${result.id}`);
    lines.push('');
    lines.push(`- URL: ${result.url}`);
    lines.push(`- Viewport: ${result.viewport}`);
    lines.push(`- Fixture: ${result.fixture}`);
    lines.push(`- Console errors: ${result.consoleErrors.length}`);
    lines.push(`- Page errors: ${result.pageErrors.length}`);
    lines.push(`- Failed requests: ${result.requestFailures.length}`);
    lines.push(`- Unhandled API routes: ${result.unhandledApiRequests.length}`);
    lines.push(`- Top screenshot: ${result.screenshotPaths.top}`);
    lines.push(`- Full screenshot: ${result.screenshotPaths.full}`);
    if (result.headings.length > 0) {
      lines.push(`- Headings: ${result.headings.join(' | ')}`);
    }
    if (result.ctas.length > 0) {
      lines.push(`- CTAs: ${result.ctas.map((item) => item.text).join(' | ')}`);
    }
    if (result.bodyTextSample) {
      lines.push(`- Text sample: ${result.bodyTextSample.slice(0, 220)}${result.bodyTextSample.length > 220 ? '…' : ''}`);
    }
    if (result.unhandledApiRequests.length > 0) {
      lines.push(`- Unhandled API: ${result.unhandledApiRequests.join(' | ')}`);
    }
    lines.push('');
  }

  if (issues.length > 0) {
    lines.push('## Issues');
    lines.push('');
    for (const current of issues) {
      lines.push(`### ${current.severity} · ${current.title}`);
      lines.push(current.summary);
      if (current.evidence.length > 0) {
        lines.push('');
        lines.push('Evidence:');
        for (const entry of current.evidence) {
          lines.push(`- ${entry}`);
        }
      }
      lines.push('');
    }
  }

  return `${lines.join('\n').trim()}\n`;
}

async function runScenario(browser, scenario) {
  const context = await browser.newContext(viewports[scenario.viewport]);
  const state = {
    apiRequests: [],
    unhandledApiRequests: [],
    driverProfile: null,
  };

  if (scenario.authUser) {
    await context.addInitScript((authState) => {
      window.localStorage.setItem('homer-auth', JSON.stringify(authState));
    }, createAuthStorage(scenario.authUser));
  }

  await context.route('**/api/**', createApiHandler(scenario, state));

  const page = await context.newPage();
  const instrumentation = await attachPageInstrumentation(page);
  const result = {
    id: scenario.id,
    viewport: scenario.viewport,
    fixture: scenario.fixture,
    url: '',
    title: '',
    headings: [],
    ctas: [],
    bodyTextSample: '',
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    unhandledApiRequests: [],
    apiRequests: [],
    screenshotPaths: {
      top: topScreenshotPath(scenario),
      full: fullScreenshotPath(scenario),
    },
  };
  const issues = [];

  try {
    await page.goto(`${baseUrl}${scenario.path}`, { waitUntil: 'domcontentloaded' });
    await waitForAppContent(page);
    await page.screenshot({ path: result.screenshotPaths.top, fullPage: false });
    await runScenarioChecks(scenario, page, result, issues);
    await page.waitForTimeout(300);
    await page.screenshot({ path: result.screenshotPaths.full, fullPage: true });

    Object.assign(result, await gatherSnapshot(page));
    result.consoleErrors = filterConsoleErrors(scenario, instrumentation.consoleErrors);
    result.pageErrors = instrumentation.pageErrors;
    result.requestFailures = instrumentation.requestFailures;
    result.unhandledApiRequests = state.unhandledApiRequests;
    result.apiRequests = state.apiRequests;

    if (result.headings.length === 0) {
      issues.push(issue(
        'P2',
        'Scenario renders without any visible headings',
        `${scenario.id} produced a route with no visible headings, which makes orientation and accessibility weaker than it should be.`,
        [result.screenshotPaths.top],
      ));
    }

    if (result.consoleErrors.length > 0) {
      issues.push(issue(
        'P2',
        'Scenario emits console errors during seeded navigation',
        `${scenario.id} logged console errors during normal interaction.`,
        [...result.consoleErrors, result.screenshotPaths.top],
      ));
    }

    if (result.pageErrors.length > 0) {
      issues.push(issue(
        'P1',
        'Scenario emits uncaught page errors during seeded navigation',
        `${scenario.id} triggered uncaught runtime errors during normal interaction.`,
        [...result.pageErrors, result.screenshotPaths.top],
      ));
    }

    if (result.unhandledApiRequests.length > 0) {
      issues.push(issue(
        'P1',
        'Seeded audit hit unhandled protected-route API calls',
        `${scenario.id} exercised API paths that the audit fixture did not yet model. That means this route is doing more work than the current audit harness accounts for.`,
        [...result.unhandledApiRequests, result.screenshotPaths.top],
      ));
    }
  } catch (error) {
    issues.push(issue(
      'P1',
      `Scenario crashed before completion: ${scenario.id}`,
      error instanceof Error ? error.message : String(error),
      [result.screenshotPaths.top],
    ));
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }

  return {
    result,
    issues,
  };
}

async function main() {
  await mkdirp(runDir);
  await mkdirp(screenshotsDir);

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let issues = [];

  try {
    for (const scenario of scenarios) {
      const current = await runScenario(browser, scenario);
      results.push(current.result);
      issues = issues.concat(current.issues);
    }
  } finally {
    await browser.close();
  }

  const mergedIssues = mergeIssues(issues);
  const report = renderReport(results, mergedIssues);

  await writeJson(path.join(runDir, 'results.json'), { runId, baseUrl, results, issues: mergedIssues });
  await writeText(path.join(runDir, 'report.md'), report);

  process.stdout.write(`${report}\n`);

  if (mergedIssues.length > 0) {
    process.exitCode = 1;
  }
}

await main();
