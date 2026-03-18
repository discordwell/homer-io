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
    title: 'Draft routes before dispatch commits the day.',
    body: 'Build route suggestions around availability, urgency, and route shape.',
    points: ['Preview first', 'Confirm later'],
    tone: 'accent',
  },
  {
    eyebrow: 'Exception recovery',
    title: 'See the slip, make the move, keep going.',
    body: 'Flags, reassignment ideas, and ETA updates stay in one workflow.',
    points: ['Board + copilot', 'Approval gate'],
    tone: 'orange',
  },
  {
    eyebrow: 'Delivery intelligence',
    title: 'Let each completed stop sharpen the next route.',
    body: 'Risky addresses and service-time patterns feed back into dispatch.',
    points: ['Address history', 'Stop patterns'],
    tone: 'green',
  },
];

export const storyCards: StoryCard[] = [
  {
    step: 'Plan',
    title: 'Start with unassigned work.',
    body: 'Draft routes come back with reasoning before dispatch commits them.',
    points: [],
    tone: 'accent',
  },
  {
    step: 'Dispatch',
    title: 'Run the day from one live board.',
    body: 'Route state, ETAs, and ownership stay visible instead of spreading across tabs.',
    points: [],
    tone: 'yellow',
  },
  {
    step: 'Recover',
    title: 'Absorb the next exception fast.',
    body: 'Ask what slipped, approve the change, and queue updates from the same surface.',
    points: [],
    tone: 'green',
  },
];

export const capabilityCards: CapabilityCard[] = [
  {
    title: 'AI dispatch copilot',
    body: 'Ask questions or stage actions without leaving dispatch.',
    points: ['Ask', 'Approve'],
    tone: 'accent',
  },
  {
    title: 'Live dispatch',
    body: 'Keep the map, board, and route state tied together as the day moves.',
    points: ['Map', 'Board', 'ETAs'],
    tone: 'green',
  },
  {
    title: 'Driver workflow and PoD',
    body: 'Support the driver side with route details, failure flow, and proof of delivery.',
    points: ['Driver route', 'PoD'],
    tone: 'orange',
  },
  {
    title: 'Notifications and tracking',
    body: 'Keep recipients informed as routes shift and ETAs change.',
    points: ['ETA updates', 'Tracking'],
    tone: 'purple',
  },
  {
    title: 'Delivery intelligence',
    body: 'Bring learned address risk and service-time patterns back into dispatch.',
    points: ['Risk', 'Patterns'],
    tone: 'green',
  },
  {
    title: 'Migration wizard',
    body: 'Bring over orders, drivers, and vehicles with review before import.',
    points: ['API or CSV', 'Preview'],
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
    points: ['AI copilot (10 / month)', 'Email notifications'],
    tone: 'dim',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$349',
    orders: '5,000 orders / month',
    detail: 'Best fit for teams replacing seat-based tools.',
    points: ['Unlimited drivers', 'Email + SMS'],
    tone: 'accent',
    featured: true,
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '$699',
    orders: '15,000 orders / month',
    detail: 'For higher-volume operations that still want a simple commercial model.',
    points: ['Unlimited drivers', 'Custom branding'],
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
