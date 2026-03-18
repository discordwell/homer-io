import type { LandingTone } from '../components/landing/shared.js';

export interface HeroMetric {
  value: string;
  label: string;
  detail: string;
  tone: LandingTone;
}

export interface ProofCard {
  title: string;
  eyebrow: string;
  body: string;
  points: string[];
  tone: LandingTone;
}

export interface StoryCard {
  step: string;
  title: string;
  body: string;
  points: string[];
  tone: LandingTone;
}

export interface CapabilityCard {
  title: string;
  body: string;
  points: string[];
  tone: LandingTone;
}

export interface AnchorPlan {
  id: string;
  name: string;
  price: string;
  orders: string;
  detail: string;
  points: string[];
  tone: LandingTone;
  featured?: boolean;
}

export const landingNavLinks = [
  { label: 'Product', href: '#product' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Migration', href: '#migration' },
] as const;

export const heroMetrics: HeroMetric[] = [
  { value: 'Confirm', label: 'before AI mutates routes', detail: 'Approval gates stay visible', tone: 'accent' },
  { value: 'Recover', label: 'late work in one flow', detail: 'Board, map, and chat stay aligned', tone: 'green' },
  { value: 'Learn', label: 'from address and stop history', detail: 'Risk and service time feed dispatch', tone: 'yellow' },
];

export const proofCards: ProofCard[] = [
  {
    eyebrow: 'AI auto-dispatch',
    title: 'Draft routes around actual operating constraints.',
    body: 'Turn unassigned work into draft routes using driver availability, urgency, and route shape before dispatch commits the day.',
    points: [
      'Preview route groups before confirming',
      'Keep urgent work visible while balancing coverage',
      'Move from backlog to draft routes without spreadsheets',
    ],
    tone: 'accent',
  },
  {
    eyebrow: 'Exception recovery',
    title: 'Spot risk early and recover it from the same screen.',
    body: 'HOMER flags slips, proposes the next move, and queues the follow-up actions that operators usually stitch together by hand.',
    points: [
      'Late route context shows up on the board',
      'Copilot suggests reassignments with clear impact',
      'Customer updates can be staged with the route change',
    ],
    tone: 'orange',
  },
  {
    eyebrow: 'Delivery intelligence',
    title: 'Let completed stops improve the next dispatch day.',
    body: 'Surface risky addresses, recurring failure reasons, and service-time patterns directly inside the operations workflow.',
    points: [
      'Address-level delivery history for dispatchers',
      'Recurring failure reasons stay attached to the stop',
      'Service-time patterns help set believable ETAs',
    ],
    tone: 'green',
  },
];

export const storyCards: StoryCard[] = [
  {
    step: 'Plan',
    title: 'Start with the work that still needs a route.',
    body: 'The copilot can group unassigned orders into draft routes, explain its reasoning, and leave dispatch in control of the final commit.',
    points: [
      'Available drivers and open orders in one view',
      'Draft routes come back with reasoning',
      'Dispatch confirms before the routes go live',
    ],
    tone: 'accent',
  },
  {
    step: 'Dispatch',
    title: 'Run the day from a live board with real route context.',
    body: 'Queued, rolling, and closed routes stay tied to ETAs, route ownership, and current risk instead of spreading across tabs.',
    points: [
      'Board and route state stay in sync',
      'Live route health is visible at a glance',
      'Dispatch can act without rebuilding context',
    ],
    tone: 'yellow',
  },
  {
    step: 'Recover',
    title: 'Use natural language to absorb the next exception.',
    body: 'Ask what slipped, reassign the work, and queue updates from a copilot that stays grounded in the live operation.',
    points: [
      'Query risk, drivers, and route load in plain language',
      'Mutating actions require a visible confirmation',
      'Notifications can be bundled into the recovery flow',
    ],
    tone: 'green',
  },
];

export const capabilityCards: CapabilityCard[] = [
  {
    title: 'AI dispatch copilot',
    body: 'Inspect the fleet or issue actions in natural language without leaving the ops surface.',
    points: ['Operational summary', 'Driver comparison', 'Approval-gated actions'],
    tone: 'accent',
  },
  {
    title: 'Route optimization',
    body: 'Optimize around route shape, urgent work, and real operational constraints instead of abstract demos.',
    points: ['Draft route creation', 'Re-optimization', 'Reasoned changes'],
    tone: 'green',
  },
  {
    title: 'Live board and ETAs',
    body: 'Keep route status, driver ownership, and timing risk visible as the day changes.',
    points: ['Queued / rolling / closed', 'Route health context', 'Live ETA tracking'],
    tone: 'yellow',
  },
  {
    title: 'Driver workflow and PoD',
    body: 'Support the driver side of the operation with route details, completion flow, and proof of delivery.',
    points: ['Driver route view', 'Failure flow', 'Photo and signature capture'],
    tone: 'orange',
  },
  {
    title: 'Customer updates',
    body: 'Keep recipients informed as routes move and exceptions are absorbed.',
    points: ['Email and SMS support', 'Tracking links', 'Notification logs'],
    tone: 'purple',
  },
  {
    title: 'Delivery intelligence',
    body: 'Bring learned address risk and service-time patterns into planning, dispatch, and exception handling.',
    points: ['Top failure addresses', 'Risk scoring', 'Service-time patterns'],
    tone: 'green',
  },
  {
    title: 'Migration wizard',
    body: 'Bring over orders, drivers, and vehicles with API or CSV import and review everything before it lands.',
    points: ['API where supported', 'CSV fallback', 'Preview before import'],
    tone: 'accent',
  },
];

export const anchorPlans: AnchorPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    orders: '100 orders / month',
    detail: 'Get dispatch live without a card on file.',
    points: ['All core features', 'AI copilot (10 / month)', 'Email notifications'],
    tone: 'dim',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$349',
    orders: '5,000 orders / month',
    detail: 'Best fit for teams replacing seat-based tools.',
    points: ['Unlimited drivers', 'Email + SMS', 'Priority support'],
    tone: 'accent',
    featured: true,
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '$699',
    orders: '15,000 orders / month',
    detail: 'For higher-volume operations that still want a simple commercial model.',
    points: ['Unlimited drivers', 'E-commerce integrations', 'Custom branding'],
    tone: 'green',
  },
];

export const migrationPlatforms = ['Tookan', 'Onfleet', 'OptimoRoute', 'SpeedyRoute', 'GetSwift', 'Circuit'];

export const migrationSteps = [
  {
    title: 'Connect or upload',
    detail: 'Use API credentials where supported or upload CSV exports when the source platform is older.',
  },
  {
    title: 'Review the import',
    detail: 'Orders, drivers, and vehicles are previewed before they are written into the account.',
  },
  {
    title: 'Go live faster',
    detail: 'Switch without dragging the team through a heavyweight replatforming project.',
  },
];

export const finalProofPills = ['AI copilot', 'Dispatch board', 'Route optimization', 'Driver workflow', 'Migration wizard'];

