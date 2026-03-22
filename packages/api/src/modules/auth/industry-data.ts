import type { Industry } from '@homer-io/shared';
import type { GeneratedAddress } from '../../lib/geocoding.js';
import { RECIPIENT_FIRST, RECIPIENT_LAST } from './demo-seed.js';

// ---------------------------------------------------------------------------
// Per-industry order templates
// ---------------------------------------------------------------------------

export interface IndustryTemplate {
  items: string[];
  notes: string[];
  requiresSignature: boolean;
  requiresPhoto: boolean;
  serviceDurationMinutes: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  packageCount: [number, number]; // [min, max]
  weight: [number, number] | null; // [min, max] in lbs, null = omit
}

const COURIER: IndustryTemplate = {
  items: [
    'Small Parcel', 'Large Box', 'Envelope — Legal Documents',
    'Document Pouch', 'Fragile Package — Handle With Care',
    'Return Package', 'Express Envelope', 'Multi-box Shipment (2 of 3)',
    'Padded Mailer', 'Sample Kit', 'Equipment Return',
    'Contract Documents', 'Overnight Express', 'Bulk Mailer Bundle',
  ],
  notes: [
    'Leave at front door', 'Ring bell twice', 'Call on arrival',
    'Receptionist will sign', 'Leave with concierge', 'Do not bend',
    'Side entrance — gate code 4421', 'Business closed after 5pm',
    '', '', '', '', // weighted toward no notes
  ],
  requiresSignature: false,
  requiresPhoto: true,
  serviceDurationMinutes: 3,
  priority: 'normal',
  packageCount: [1, 3],
  weight: [0.5, 15],
};

const RESTAURANT: IndustryTemplate = {
  items: [
    'Pad Thai + Spring Rolls (x2)', '2x Margherita Pizza + Garlic Knots',
    'Sushi Platter — 12pc Assorted', 'Burger Combo x3 + Milkshakes',
    'Pho + Banh Mi + Iced Coffee', 'Family Taco Pack (12 tacos, sides)',
    'Chicken Tikka Masala + Naan (x2)', 'Poke Bowl x2 + Edamame',
    'BBQ Ribs Half Rack + Coleslaw', 'Caesar Salad + Grilled Salmon',
    'Dim Sum Party Platter (24pc)', 'Burrito Bowl x4 — Catering',
    'Pasta Carbonara + Tiramisu', 'Wings (24pc) + Ranch + Celery',
  ],
  notes: [
    'Extra napkins and utensils', 'No onions on the burger',
    'Hot sauce on the side', 'Nut allergy — check all items',
    'Contactless delivery — leave at door', 'Apartment 4B, buzz 402',
    'Office lunch — ask for reception', '', '', '',
  ],
  requiresSignature: false,
  requiresPhoto: false,
  serviceDurationMinutes: 2,
  priority: 'high',
  packageCount: [1, 2],
  weight: null,
};

const FLORIST: IndustryTemplate = {
  items: [
    'Spring Bouquet — Roses & Lilies', 'Dozen Red Roses — Classic',
    'Sympathy Arrangement — White Lilies', 'Birthday Surprise — Mixed Wildflowers',
    'Succulent Planter — Medium', 'Orchid Arrangement — Purple Phalaenopsis',
    'Sunflower Bundle (12 stems)', 'Wedding Corsage + Boutonniere Set',
    'Get Well Soon — Cheerful Daisies', 'Dried Flower Wreath — Autumn',
    'Tulip Arrangement — Pink & White (20)', 'Peony Bouquet — Blush (seasonal)',
    'Lavender & Eucalyptus Bundle', 'Tropical Arrangement — Birds of Paradise',
  ],
  notes: [
    'Surprise delivery — do not call recipient ahead',
    'Leave on porch if not home, text photo to sender',
    'Deliver between 2-4pm — surprise party at 5',
    'Ring doorbell, leave at door if not home',
    'Fragile — handle with care, keep upright',
    'Deliver to reception desk — office building',
    '', '', '', '',
  ],
  requiresSignature: false,
  requiresPhoto: true,
  serviceDurationMinutes: 4,
  priority: 'normal',
  packageCount: [1, 1],
  weight: [2, 8],
};

const PHARMACY: IndustryTemplate = {
  items: [
    'Prescription #RX-4821 — Monthly Refill',
    'Prescription #RX-7733 — Antibiotics (7-day)',
    'Medical Supplies — Diabetic Kit (monthly)',
    'Prescription Refill — 3 items',
    'OTC Bundle + Prescription #RX-2190',
    'Controlled Substance — Prescription #RX-6614',
    'Specialty Medication — Refrigerated',
    'Prescription #RX-1052 — Inhaler + Spacer',
    'Compounded Medication — Custom Dosage',
    'Medical Equipment — Blood Pressure Monitor',
    'Prescription #RX-3387 — Eye Drops (x3)',
    'Immunization Kit — Flu Vaccine',
  ],
  notes: [
    'Verify photo ID required', 'Refrigerate immediately upon delivery',
    'Controlled substance — signature mandatory',
    'Patient requested AM delivery — medical schedule',
    'Insurance card copy attached to order',
    'Call patient 15min before arrival',
    'Deliver to nurse station — 3rd floor',
    'HIPAA: confirm recipient name before handoff',
  ],
  requiresSignature: true,
  requiresPhoto: false,
  serviceDurationMinutes: 5,
  priority: 'high',
  packageCount: [1, 2],
  weight: [0.5, 5],
};

const CANNABIS: IndustryTemplate = {
  items: [
    'Pre-roll Variety Pack (5ct)', 'Edibles — Gummy Assortment (100mg)',
    'Flower — 1/8oz Blue Dream', 'Cartridge — Sativa Blend 1g',
    'Tincture — CBD 1000mg', 'Flower — 1/4oz OG Kush',
    'Live Resin Concentrate — 1g', 'Topical — Pain Relief Cream 200mg',
    'Edibles — Chocolate Bar (100mg)', 'Pre-roll — Indica Single 1g',
    'Cartridge — Hybrid Blend 0.5g', 'Flower — 1/8oz Girl Scout Cookies',
  ],
  notes: [
    '21+ ID verification required at delivery',
    'State-compliant packaging verified',
    'Medical card on file — verified',
    'Must match name on order to ID',
    'Delivery window: after 10am per local ordinance',
    'Do not leave unattended — return to dispatch if no answer',
    'Cash payment on delivery — $47.50 exact',
    '',
  ],
  requiresSignature: true,
  requiresPhoto: true,
  serviceDurationMinutes: 5,
  priority: 'normal',
  packageCount: [1, 1],
  weight: null,
};

const GROCERY: IndustryTemplate = {
  items: [
    'Weekly Essentials Bundle — 12 items', 'Fresh Produce Box — Organic',
    'Dairy + Bakery Order — 8 items', 'Frozen Goods — 6 items',
    'Organic Produce Selection — Family Size', 'Meat & Seafood Pack — Weekly',
    'Pantry Staples Bundle — Rice, Pasta, Oils', 'Baby Supplies — Formula + Diapers',
    'Juice & Beverage Case (12 bottles)', 'Deli Platter — Party Size',
    'Meal Kit — 5 Dinners for 2', 'Snack Box — Office Bundle (24 items)',
  ],
  notes: [
    'Keep refrigerated — perishable', 'No substitutions please',
    'Leave in cooler on front porch', 'Paper bags only — no plastic',
    'Deliver before noon — hosting dinner tonight',
    'Apartment — buzz #305, leave at door',
    'Check expiration dates on dairy items',
    'Ripe avocados preferred', '', '',
  ],
  requiresSignature: false,
  requiresPhoto: true,
  serviceDurationMinutes: 7,
  priority: 'normal',
  packageCount: [2, 5],
  weight: [10, 40],
};

const FURNITURE: IndustryTemplate = {
  items: [
    'Queen Bed Frame — Assembly Required',
    '3-Seater Sofa — Charcoal Linen',
    'Dining Table Set — 6pc Walnut',
    'Bookshelf — Wall Mount — 5 Shelf',
    'Standing Desk — Electric Sit/Stand',
    'Sectional Sofa — L-Shape — 3 boxes',
    'King Mattress — Memory Foam',
    'Dresser — 6 Drawer — Oak',
    'Outdoor Patio Set — 4 chairs + table',
    'TV Console — 72in — Modern',
    'Office Chair — Ergonomic — Mesh',
    'Nightstand Pair — Matching Set',
  ],
  notes: [
    'White-glove delivery — unpack and assemble',
    'Assembly included — allow 45min',
    'Remove old furniture — haul away requested',
    'Elevator access only — freight elevator avail 9am-3pm',
    'Narrow hallway — measure before attempting (32in clearance)',
    '2nd floor — no elevator — 2 person carry required',
    'Deliver to garage — customer will assemble',
    'Customer will inspect before signing off',
  ],
  requiresSignature: true,
  requiresPhoto: true,
  serviceDurationMinutes: 45,
  priority: 'normal',
  packageCount: [1, 4],
  weight: [30, 150],
};

const TEMPLATES: Record<Industry, IndustryTemplate> = {
  courier: COURIER,
  restaurant: RESTAURANT,
  florist: FLORIST,
  pharmacy: PHARMACY,
  cannabis: CANNABIS,
  grocery: GROCERY,
  furniture: FURNITURE,
  other: COURIER,
};

export { TEMPLATES as INDUSTRY_ORDER_TEMPLATES };

// ---------------------------------------------------------------------------
// Generate industry-flavored orders
// (Recipient name pools imported from demo-seed.ts)
// ---------------------------------------------------------------------------

export interface IndustryOrderData {
  recipientName: string;
  deliveryAddress: { street: string; city: string; state: string; zip: string };
  deliveryLat: string;
  deliveryLng: string;
  notes: string | null;
  requiresSignature: boolean;
  requiresPhoto: boolean;
  serviceDurationMinutes: number | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  packageCount: number;
  weight: string | null;
  customFields: Record<string, unknown>;
  createdAt: Date;
  // Gift/sender fields (florist)
  senderName?: string;
  senderEmail?: string;
  giftMessage?: string;
  isGift?: boolean;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function generateIndustryOrders(
  industry: Industry,
  count: number,
  locations: Array<{ name: string; lat: number; lng: number; city?: string; state?: string; zip?: string }>,
): IndustryOrderData[] {
  const template = TEMPLATES[industry];
  const now = new Date();
  const shuffledLocs = [...locations].sort(() => Math.random() - 0.5);

  return Array.from({ length: count }, (_, i) => {
    const loc = shuffledLocs[i % shuffledLocs.length];
    const first = pick(RECIPIENT_FIRST);
    const last = pick(RECIPIENT_LAST);

    const createdAt = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      6 + Math.floor(i / 5), (i * 7) % 60, 0, 0,
    ));

    const note = pick(template.notes);
    const packageCount = randInt(template.packageCount[0], template.packageCount[1]);
    const weight = template.weight
      ? String(Math.round((template.weight[0] + Math.random() * (template.weight[1] - template.weight[0])) * 10) / 10)
      : null;

    // Add slight variation to service duration (±30%)
    const baseDuration = template.serviceDurationMinutes;
    const serviceDuration = Math.round(baseDuration * (0.7 + Math.random() * 0.6));

    const customFields: Record<string, unknown> = {};
    if (industry === 'cannabis') {
      customFields.ageVerificationRequired = true;
      customFields.complianceManifest = `MAN-${randInt(10000, 99999)}`;
    }
    if (industry === 'pharmacy') {
      customFields.rxVerification = true;
    }

    // Florist: add sender info and gift message for ~80% of orders
    let senderName: string | undefined;
    let senderEmail: string | undefined;
    let giftMessage: string | undefined;
    let isGift = false;
    if (industry === 'florist' && Math.random() < 0.8) {
      const sFirst = pick(RECIPIENT_FIRST);
      const sLast = pick(RECIPIENT_LAST);
      senderName = `${sFirst} ${sLast}`;
      senderEmail = `${sFirst.toLowerCase()}.${sLast.toLowerCase()}@example.com`;
      isGift = true;
      const giftMessages = [
        `Happy Birthday! Love, ${sFirst}`,
        `Congratulations on the new home! — ${sFirst} & family`,
        `With deepest sympathy — The ${sLast} family`,
        `Thank you for everything! — ${sFirst}`,
        `Just because I love you`,
        `Get well soon! Thinking of you — ${sFirst}`,
        `Happy Anniversary! Here's to many more years together`,
        `Wishing you a wonderful day!`,
      ];
      giftMessage = pick(giftMessages);
    }

    return {
      recipientName: `${first} ${last}`,
      deliveryAddress: {
        street: loc.name,
        city: (loc as GeneratedAddress).city || '',
        state: (loc as GeneratedAddress).state || 'CA',
        zip: (loc as GeneratedAddress).zip || '',
      },
      deliveryLat: loc.lat.toString(),
      deliveryLng: loc.lng.toString(),
      notes: note || null,
      requiresSignature: template.requiresSignature,
      requiresPhoto: template.requiresPhoto,
      serviceDurationMinutes: serviceDuration,
      priority: template.priority,
      packageCount,
      weight,
      customFields,
      createdAt,
      ...(senderName ? { senderName } : {}),
      ...(senderEmail ? { senderEmail } : {}),
      ...(giftMessage ? { giftMessage } : {}),
      ...(isGift ? { isGift } : {}),
    };
  });
}

/**
 * Generate an industry-flavored item description for historical/analytics orders.
 * Lighter than full generateIndustryOrders — just returns the item text.
 */
export function pickIndustryItem(industry: Industry): string {
  return pick(TEMPLATES[industry].items);
}
