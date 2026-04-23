import { z } from 'zod';

// ---------------------------------------------------------------------------
// Feature definitions
// ---------------------------------------------------------------------------

export const FEATURE_KEYS = [
  'id_verification',
  'manifests',
  'delivery_limits',
  'cash_on_delivery',
  'delivery_zones',
  'driver_kits',
  'gift_messages',
  'sender_notifications',
  'delivery_photo',
  'controlled_substances',
  'cold_chain',
  'dob_verification',
  'hipaa_display',
  'copay_collection',
  'prescriber_info',
  'temp_drivers',
  // Restaurant
  'speed_priority',
  // Grocery
  'substitution_management',
  'temperature_zones',
  // Furniture
  'crew_assignment',
  'assembly_tracking',
  'haul_away',
  'wide_time_windows',
  // Integrations
  'fleet_tracking',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const featureKeySchema = z.enum(FEATURE_KEYS);

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  description: string;
  category: 'compliance' | 'operations' | 'customer_experience' | 'integrations';
}

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  // Compliance
  { key: 'id_verification', label: 'ID Verification', description: 'Verify customer government ID at delivery', category: 'compliance' },
  { key: 'controlled_substances', label: 'Controlled Substances', description: 'Track Schedule II-V controlled substance deliveries', category: 'compliance' },
  { key: 'hipaa_display', label: 'HIPAA-Safe Display', description: 'Strip sensitive data from driver-visible order notes', category: 'compliance' },
  { key: 'dob_verification', label: 'DOB Verification', description: 'Verify patient date of birth at delivery', category: 'compliance' },
  { key: 'manifests', label: 'Delivery Manifests', description: 'Generate legal delivery manifest PDFs per route', category: 'compliance' },

  // Operations
  { key: 'delivery_limits', label: 'Delivery Limits', description: 'Enforce max value/weight per vehicle', category: 'operations' },
  { key: 'delivery_zones', label: 'Delivery Zones', description: 'Restrict delivery by radius and zip codes', category: 'operations' },
  { key: 'driver_kits', label: 'Driver Kits', description: 'Track inventory loaded in each delivery vehicle', category: 'operations' },
  { key: 'cold_chain', label: 'Cold Chain', description: 'Flag temperature-sensitive items, confirm at delivery', category: 'operations' },
  { key: 'temp_drivers', label: 'Temp Driver Onboarding', description: 'Quick-invite links for seasonal/temporary drivers', category: 'operations' },
  { key: 'cash_on_delivery', label: 'Cash on Delivery', description: 'Track cash collection amounts at delivery', category: 'operations' },
  { key: 'copay_collection', label: 'Copay Collection', description: 'Collect insurance copay at delivery', category: 'operations' },

  // Customer Experience
  { key: 'gift_messages', label: 'Gift Messages', description: 'Sender/recipient model with gift card messages', category: 'customer_experience' },
  { key: 'sender_notifications', label: 'Sender Notifications', description: 'Notify the person who ordered (not just recipient)', category: 'customer_experience' },
  { key: 'delivery_photo', label: 'Delivery Photo', description: 'Auto-require photo proof of every delivery', category: 'customer_experience' },
  { key: 'prescriber_info', label: 'Prescriber Info', description: 'Track prescriber/doctor name and NPI on orders', category: 'customer_experience' },

  // Restaurant
  { key: 'speed_priority', label: 'Speed Priority', description: 'Optimize for fastest delivery times with tight windows', category: 'operations' },

  // Grocery
  { key: 'substitution_management', label: 'Substitution Management', description: 'Allow item substitutions when products are out of stock', category: 'operations' },
  { key: 'temperature_zones', label: 'Temperature Zones', description: 'Track frozen, refrigerated, and ambient items separately', category: 'operations' },

  // Furniture
  { key: 'crew_assignment', label: 'Crew Assignment', description: 'Assign 2+ person delivery crews to heavy/large items', category: 'operations' },
  { key: 'assembly_tracking', label: 'Assembly Tracking', description: 'Track assembly-required deliveries with extended service times', category: 'operations' },
  { key: 'haul_away', label: 'Haul Away', description: 'Flag deliveries that include old item removal', category: 'operations' },
  { key: 'wide_time_windows', label: 'Wide Time Windows', description: '4-hour delivery windows with day-before notifications', category: 'customer_experience' },

  // Integrations
  { key: 'fleet_tracking', label: 'Fleet Telematics', description: 'Stream truck positions from Samsara / Motive / Geotab alongside driver-phone GPS', category: 'integrations' },
];

// ---------------------------------------------------------------------------
// Industry → default features mapping
// ---------------------------------------------------------------------------

export const INDUSTRY_DEFAULT_FEATURES: Record<string, FeatureKey[]> = {
  cannabis: [
    'id_verification', 'manifests', 'delivery_limits', 'cash_on_delivery',
    'delivery_zones', 'driver_kits', 'delivery_photo',
  ],
  florist: [
    'gift_messages', 'sender_notifications', 'delivery_photo', 'temp_drivers',
  ],
  pharmacy: [
    'controlled_substances', 'cold_chain', 'dob_verification', 'hipaa_display',
    'copay_collection', 'prescriber_info', 'delivery_photo',
  ],
  restaurant: ['delivery_photo', 'speed_priority'],
  grocery: ['cold_chain', 'delivery_photo', 'substitution_management', 'temperature_zones'],
  furniture: ['delivery_photo', 'crew_assignment', 'assembly_tracking', 'haul_away', 'wide_time_windows'],
  courier: ['delivery_photo'],
  other: [],
};

/** Get default features for an industry */
export function getDefaultFeatures(industry: string): FeatureKey[] {
  return INDUSTRY_DEFAULT_FEATURES[industry] ?? [];
}

/** Check if a feature is enabled in a features array */
export function hasFeature(enabledFeatures: string[] | undefined | null, feature: FeatureKey): boolean {
  return (enabledFeatures ?? []).includes(feature);
}
