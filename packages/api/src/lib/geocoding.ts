import { config } from '../config.js';

// Street name pool for generating realistic addresses
const STREET_NAMES = [
  'Main St', 'Oak Ave', 'Elm St', 'Park Blvd', 'Broadway',
  'Market St', 'Washington Ave', 'Maple Dr', 'Cedar Ln', 'Pine St',
  'Lake Ave', 'Highland Rd', 'Central Ave', 'Union St', 'River Rd',
  'Franklin St', 'Jefferson Ave', 'Lincoln Blvd', 'Madison Ave', 'Jackson St',
  'Commerce Dr', 'Industrial Blvd', 'State St', 'Spring St', 'Mill Rd',
];

// 60 US cities fallback list (same as frontend nearestCity.ts)
const CITIES: [string, string, number, number][] = [
  ['Oakland', 'CA', 37.80, -122.27],
  ['San Francisco', 'CA', 37.78, -122.42],
  ['San Jose', 'CA', 37.34, -121.89],
  ['Los Angeles', 'CA', 34.05, -118.24],
  ['San Diego', 'CA', 32.72, -117.16],
  ['Sacramento', 'CA', 38.58, -121.49],
  ['Portland', 'OR', 45.52, -122.68],
  ['Seattle', 'WA', 47.61, -122.33],
  ['Phoenix', 'AZ', 33.45, -112.07],
  ['Denver', 'CO', 39.74, -104.99],
  ['Salt Lake City', 'UT', 40.76, -111.89],
  ['Las Vegas', 'NV', 36.17, -115.14],
  ['Austin', 'TX', 30.27, -97.74],
  ['Dallas', 'TX', 32.78, -96.80],
  ['Houston', 'TX', 29.76, -95.37],
  ['San Antonio', 'TX', 29.42, -98.49],
  ['Chicago', 'IL', 41.88, -87.63],
  ['Minneapolis', 'MN', 44.98, -93.27],
  ['Detroit', 'MI', 42.33, -83.05],
  ['Indianapolis', 'IN', 39.77, -86.16],
  ['Columbus', 'OH', 39.96, -82.99],
  ['Cleveland', 'OH', 41.50, -81.69],
  ['Cincinnati', 'OH', 39.10, -84.51],
  ['Milwaukee', 'WI', 43.04, -87.91],
  ['St. Louis', 'MO', 38.63, -90.20],
  ['Kansas City', 'MO', 39.10, -94.58],
  ['Nashville', 'TN', 36.16, -86.78],
  ['Memphis', 'TN', 35.15, -90.05],
  ['Louisville', 'KY', 38.25, -85.76],
  ['Atlanta', 'GA', 33.75, -84.39],
  ['Miami', 'FL', 25.76, -80.19],
  ['Tampa', 'FL', 27.95, -82.46],
  ['Orlando', 'FL', 28.54, -81.38],
  ['Jacksonville', 'FL', 30.33, -81.66],
  ['Charlotte', 'NC', 35.23, -80.84],
  ['Raleigh', 'NC', 35.78, -78.64],
  ['Richmond', 'VA', 37.54, -77.44],
  ['Virginia Beach', 'VA', 36.85, -75.98],
  ['Washington DC', 'DC', 38.91, -77.04],
  ['Baltimore', 'MD', 39.29, -76.61],
  ['Philadelphia', 'PA', 39.95, -75.17],
  ['New York', 'NY', 40.71, -74.01],
  ['Newark', 'NJ', 40.74, -74.17],
  ['Boston', 'MA', 42.36, -71.06],
  ['Providence', 'RI', 41.82, -71.41],
  ['Pittsburgh', 'PA', 40.44, -80.00],
  ['Buffalo', 'NY', 42.89, -78.88],
  ['New Orleans', 'LA', 29.95, -90.07],
  ['Oklahoma City', 'OK', 35.47, -97.52],
  ['Omaha', 'NE', 41.26, -95.94],
  ['Des Moines', 'IA', 41.59, -93.62],
  ['Tucson', 'AZ', 32.22, -110.97],
  ['Albuquerque', 'NM', 35.08, -106.65],
  ['El Paso', 'TX', 31.76, -106.49],
  ['Boise', 'ID', 43.62, -116.21],
  ['Honolulu', 'HI', 21.31, -157.86],
  ['Anchorage', 'AK', 61.22, -149.90],
];

interface ReverseGeoResult {
  city: string;
  state: string;
  zip: string;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // km
}

/** Find nearest city from the built-in list */
export function getNearestCity(lat: number, lng: number): { city: string; state: string } {
  let best = { city: 'Oakland', state: 'CA' };
  let bestDist = Infinity;
  for (const [name, state, cLat, cLng] of CITIES) {
    const d = haversineDistance(lat, lng, cLat, cLng);
    if (d < bestDist) {
      bestDist = d;
      best = { city: name, state };
    }
  }
  return best;
}

/** Try MapTiler reverse geocoding, return null on failure */
async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeoResult | null> {
  const apiKey = config.maptiler.apiKey;
  if (!apiKey) return null;

  try {
    const url = `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${apiKey}&types=address,place&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      features?: Array<{
        context?: Array<{ id: string; text: string }>;
        properties?: Record<string, string>;
      }>;
    };

    const feature = data.features?.[0];
    if (!feature) return null;

    // Extract city/state/zip from context array
    let city = '', state = '', zip = '';
    for (const ctx of feature.context ?? []) {
      if (ctx.id.startsWith('place')) city = ctx.text;
      if (ctx.id.startsWith('region')) state = ctx.text;
      if (ctx.id.startsWith('postcode') || ctx.id.startsWith('postal_code')) zip = ctx.text;
    }

    // Fallback: try properties
    if (!city) city = feature.properties?.city || feature.properties?.place || '';
    if (!state) state = feature.properties?.region || feature.properties?.state || '';
    if (!zip) zip = feature.properties?.postcode || feature.properties?.postal_code || '';

    if (city || state) return { city, state, zip };
    return null;
  } catch {
    return null;
  }
}

export interface GeneratedAddress {
  name: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  zip: string;
}

/**
 * Generate `count` local addresses around a center point.
 * Tries MapTiler for city/state/zip, falls back to nearest-city list.
 */
export async function generateLocalAddresses(
  centerLat: number,
  centerLng: number,
  count = 24,
): Promise<GeneratedAddress[]> {
  // Try reverse geocoding the center point for city/state/zip
  const geo = await reverseGeocode(centerLat, centerLng);
  const fallback = getNearestCity(centerLat, centerLng);

  const city = geo?.city || fallback.city;
  const state = geo?.state || fallback.state;
  const zip = geo?.zip || '';

  const addresses: GeneratedAddress[] = [];

  for (let i = 0; i < count; i++) {
    // Random offset within ~15km radius
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * 0.135; // ~15km in degrees
    const lat = centerLat + distance * Math.sin(angle);
    const lng = centerLng + distance * Math.cos(angle) / Math.cos(centerLat * Math.PI / 180);

    const streetNum = 100 + Math.floor(Math.random() * 9900);
    const street = STREET_NAMES[i % STREET_NAMES.length];

    addresses.push({
      name: `${streetNum} ${street}, ${city}`,
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
      city,
      state,
      zip,
    });
  }

  return addresses;
}
