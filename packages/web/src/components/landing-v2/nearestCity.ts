const CITIES: [string, number, number][] = [
  // [name, lat, lng] — ~60 major US metros
  ['Oakland', 37.80, -122.27],
  ['San Francisco', 37.78, -122.42],
  ['San Jose', 37.34, -121.89],
  ['Los Angeles', 34.05, -118.24],
  ['San Diego', 32.72, -117.16],
  ['Sacramento', 38.58, -121.49],
  ['Portland', 45.52, -122.68],
  ['Seattle', 47.61, -122.33],
  ['Phoenix', 33.45, -112.07],
  ['Denver', 39.74, -104.99],
  ['Salt Lake City', 40.76, -111.89],
  ['Las Vegas', 36.17, -115.14],
  ['Austin', 30.27, -97.74],
  ['Dallas', 32.78, -96.80],
  ['Houston', 29.76, -95.37],
  ['San Antonio', 29.42, -98.49],
  ['Chicago', 41.88, -87.63],
  ['Minneapolis', 44.98, -93.27],
  ['Detroit', 42.33, -83.05],
  ['Indianapolis', 39.77, -86.16],
  ['Columbus', 39.96, -82.99],
  ['Cleveland', 41.50, -81.69],
  ['Cincinnati', 39.10, -84.51],
  ['Milwaukee', 43.04, -87.91],
  ['St. Louis', 38.63, -90.20],
  ['Kansas City', 39.10, -94.58],
  ['Nashville', 36.16, -86.78],
  ['Memphis', 35.15, -90.05],
  ['Louisville', 38.25, -85.76],
  ['Atlanta', 33.75, -84.39],
  ['Miami', 25.76, -80.19],
  ['Tampa', 27.95, -82.46],
  ['Orlando', 28.54, -81.38],
  ['Jacksonville', 30.33, -81.66],
  ['Charlotte', 35.23, -80.84],
  ['Raleigh', 35.78, -78.64],
  ['Richmond', 37.54, -77.44],
  ['Virginia Beach', 36.85, -75.98],
  ['Washington DC', 38.91, -77.04],
  ['Baltimore', 39.29, -76.61],
  ['Philadelphia', 39.95, -75.17],
  ['New York', 40.71, -74.01],
  ['Newark', 40.74, -74.17],
  ['Boston', 42.36, -71.06],
  ['Providence', 41.82, -71.41],
  ['Pittsburgh', 40.44, -80.00],
  ['Buffalo', 42.89, -78.88],
  ['New Orleans', 29.95, -90.07],
  ['Oklahoma City', 35.47, -97.52],
  ['Omaha', 41.26, -95.94],
  ['Des Moines', 41.59, -93.62],
  ['Tucson', 32.22, -110.97],
  ['Albuquerque', 35.08, -106.65],
  ['El Paso', 31.76, -106.49],
  ['Boise', 43.62, -116.21],
  ['Honolulu', 21.31, -157.86],
  ['Anchorage', 61.22, -149.90],
];

const DEFAULT_CITY = 'Oakland';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getNearestCity(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return DEFAULT_CITY;

  let best = DEFAULT_CITY;
  let bestDist = Infinity;

  for (const [name, cLat, cLng] of CITIES) {
    const d = haversineDistance(lat, lng, cLat, cLng);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }

  return best;
}
