/**
 * Cannabis delivery jurisdiction data.
 * Sources: PMC/NIH state delivery law survey (2024), CA DCC jurisdiction map (2025).
 * Used to populate dropdowns in cannabis settings.
 */

// ---------------------------------------------------------------------------
// US States that allow cannabis delivery
// ---------------------------------------------------------------------------

export interface DeliveryState {
  code: string;
  name: string;
  deliveryType: 'recreational' | 'medical' | 'both';
  minimumAge: number;
  notes?: string;
}

export const DELIVERY_LEGAL_STATES: DeliveryState[] = [
  // Recreational delivery states (14)
  { code: 'CA', name: 'California', deliveryType: 'both', minimumAge: 21, notes: 'Licensed retailers/microbusinesses; local licensing required' },
  { code: 'CO', name: 'Colorado', deliveryType: 'both', minimumAge: 21, notes: 'Requires delivery permit; local approval needed' },
  { code: 'CT', name: 'Connecticut', deliveryType: 'both', minimumAge: 21, notes: 'Licensed delivery services; local zoning required' },
  { code: 'ME', name: 'Maine', deliveryType: 'both', minimumAge: 21, notes: 'Tier 1/2 cultivation facilities; local authorization required' },
  { code: 'MA', name: 'Massachusetts', deliveryType: 'both', minimumAge: 21, notes: 'Delivery operator or courier licenses; local compliance' },
  { code: 'MI', name: 'Michigan', deliveryType: 'both', minimumAge: 21, notes: 'Licensed sales locations with agency approval' },
  { code: 'MN', name: 'Minnesota', deliveryType: 'both', minimumAge: 21, notes: 'Licensed cannabis delivery services' },
  { code: 'MO', name: 'Missouri', deliveryType: 'both', minimumAge: 21, notes: 'Licensed dispensary/microbusiness facilities' },
  { code: 'NV', name: 'Nevada', deliveryType: 'both', minimumAge: 21, notes: 'Registered agents with pre-approval' },
  { code: 'NJ', name: 'New Jersey', deliveryType: 'both', minimumAge: 21, notes: 'Licensed delivery services; signature verification required' },
  { code: 'NM', name: 'New Mexico', deliveryType: 'both', minimumAge: 21, notes: 'Cannabis couriers via retailers' },
  { code: 'NY', name: 'New York', deliveryType: 'both', minimumAge: 21, notes: 'Licensed retailers/microbusinesses or independent delivery licenses' },
  { code: 'OR', name: 'Oregon', deliveryType: 'both', minimumAge: 21, notes: 'Licensed retailers via agents with marijuana handler permit' },
  { code: 'RI', name: 'Rhode Island', deliveryType: 'both', minimumAge: 21, notes: 'Licensed retailers conduct delivery' },
  // Medical-only delivery states (13 additional)
  { code: 'AZ', name: 'Arizona', deliveryType: 'medical', minimumAge: 18, notes: 'Registered dispensaries to qualified patients/caregivers' },
  { code: 'AR', name: 'Arkansas', deliveryType: 'medical', minimumAge: 18, notes: 'Licensed dispensaries to registered patients' },
  { code: 'DE', name: 'Delaware', deliveryType: 'medical', minimumAge: 18, notes: 'Registered compassion centers with approved delivery plans' },
  { code: 'DC', name: 'District of Columbia', deliveryType: 'medical', minimumAge: 18, notes: 'Dispensary delivery to registered patients' },
  { code: 'FL', name: 'Florida', deliveryType: 'medical', minimumAge: 18, notes: 'Licensed treatment centers to registered patients' },
  { code: 'KY', name: 'Kentucky', deliveryType: 'medical', minimumAge: 18, notes: 'Licensed dispensaries operate delivery services' },
  { code: 'LA', name: 'Louisiana', deliveryType: 'medical', minimumAge: 18, notes: 'Licensed pharmacies required to offer home delivery per zip code' },
  { code: 'MD', name: 'Maryland', deliveryType: 'medical', minimumAge: 18, notes: 'Registered dispensaries with written delivery requests' },
  { code: 'MT', name: 'Montana', deliveryType: 'medical', minimumAge: 18, notes: 'Licensed transporters to cardholders' },
  { code: 'NH', name: 'New Hampshire', deliveryType: 'medical', minimumAge: 18, notes: 'Non-profit treatment centers to registered patients' },
  { code: 'UT', name: 'Utah', deliveryType: 'medical', minimumAge: 18, notes: 'Licensed pharmacies with electronic verification system' },
  { code: 'VT', name: 'Vermont', deliveryType: 'medical', minimumAge: 18, notes: 'Licensed dispensaries to registered patients' },
  { code: 'VA', name: 'Virginia', deliveryType: 'medical', minimumAge: 18, notes: 'Pharmaceutical processors/dispensaries to patients' },
];

/** Get all state codes that allow delivery */
export function getDeliveryLegalStateCodes(): string[] {
  return DELIVERY_LEGAL_STATES.map(s => s.code);
}

/** Check if a state allows cannabis delivery */
export function isDeliveryLegalState(stateCode: string): boolean {
  return DELIVERY_LEGAL_STATES.some(s => s.code === stateCode);
}

// ---------------------------------------------------------------------------
// California jurisdictions (from DCC data, updated June 2025)
// ---------------------------------------------------------------------------

export type JurisdictionType = 'city' | 'county';
export type DeliveryStatus = 'allowed' | 'prohibited' | 'medical_only';

export interface CaliforniaJurisdiction {
  name: string;
  type: JurisdictionType;
  deliveryStatus: DeliveryStatus;
}

export const CA_JURISDICTIONS: CaliforniaJurisdiction[] = [
  // ── Counties ────────────────────────────────────────────────────────
  { name: 'Alameda County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Alpine County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Amador County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Butte County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Calaveras County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Colusa County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Contra Costa County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Del Norte County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'El Dorado County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Fresno County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Glenn County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Humboldt County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Imperial County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Inyo County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Kern County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Kings County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Lake County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Lassen County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Los Angeles County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Madera County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Marin County', type: 'county', deliveryStatus: 'medical_only' },
  { name: 'Mariposa County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Mendocino County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Merced County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Modoc County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Mono County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Monterey County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Napa County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Nevada County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Orange County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Placer County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Plumas County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Riverside County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Sacramento County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'San Benito County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'San Bernardino County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'San Diego County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'San Francisco County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'San Joaquin County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'San Luis Obispo County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'San Mateo County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Santa Barbara County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Santa Clara County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Santa Cruz County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Shasta County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Sierra County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Siskiyou County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Solano County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Sonoma County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Stanislaus County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Sutter County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Tehama County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Trinity County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Tulare County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Tuolumne County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Ventura County', type: 'county', deliveryStatus: 'prohibited' },
  { name: 'Yolo County', type: 'county', deliveryStatus: 'allowed' },
  { name: 'Yuba County', type: 'county', deliveryStatus: 'prohibited' },
  // ── Cities (delivery-allowed) ───────────────────────────────────────
  { name: 'Adelanto', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Alameda', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Arcata', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Baldwin Park', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Bellflower', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Benicia', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Berkeley', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Cathedral City', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Chula Vista', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Coachella', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Coalinga', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Commerce', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Culver City', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Desert Hot Springs', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Emeryville', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Eureka', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Fresno', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Goleta', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Gonzales', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Grover Beach', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Hayward', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Hollister', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Huntington Beach', type: 'city', deliveryStatus: 'allowed' },
  { name: 'King City', type: 'city', deliveryStatus: 'allowed' },
  { name: 'La Mesa', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Lemon Grove', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Long Beach', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Los Angeles', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Lynwood', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Maywood', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Modesto', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Morro Bay', type: 'city', deliveryStatus: 'allowed' },
  { name: 'National City', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Needles', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Oakland', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Oceanside', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Palm Springs', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Pasadena', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Port Hueneme', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Richmond', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Sacramento', type: 'city', deliveryStatus: 'allowed' },
  { name: 'San Diego', type: 'city', deliveryStatus: 'allowed' },
  { name: 'San Francisco', type: 'city', deliveryStatus: 'allowed' },
  { name: 'San Jose', type: 'city', deliveryStatus: 'allowed' },
  { name: 'San Leandro', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Santa Ana', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Santa Barbara', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Santa Cruz', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Santa Rosa', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Seaside', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Stockton', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Vallejo', type: 'city', deliveryStatus: 'allowed' },
  { name: 'Vista', type: 'city', deliveryStatus: 'allowed' },
  { name: 'West Hollywood', type: 'city', deliveryStatus: 'allowed' },
  { name: 'West Sacramento', type: 'city', deliveryStatus: 'allowed' },
];

/** Get CA jurisdictions that allow delivery (for dropdown) */
export function getCADeliveryJurisdictions(): CaliforniaJurisdiction[] {
  return CA_JURISDICTIONS.filter(j => j.deliveryStatus === 'allowed' || j.deliveryStatus === 'medical_only');
}

/** Get all CA jurisdictions (for reference/display) */
export function getCAJurisdictions(): CaliforniaJurisdiction[] {
  return CA_JURISDICTIONS;
}
