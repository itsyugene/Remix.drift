import { Place } from '../types.ts';

export const OVERPASS_MIRRORS = [
  { name: "Overpass DE", url: "https://overpass-api.de/api/interpreter" },
  { name: "private.coffee", url: "https://overpass.private.coffee/api/interpreter" },
  { name: "VK Maps", url: "https://maps.mail.ru/osm/tools/overpass/api/interpreter" }
];

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Radius of the earth in m
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in m
}

export function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function getCompassDirection(bearing: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(bearing / 45) % 8];
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  }
  return `${(meters / 1000).toFixed(1).replace(/\.0$/, "")} km`;
}

function cleanTag(value: string | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function getCategories(tags: Record<string, string>): string[] {
  const amenity = cleanTag(tags.amenity);
  const shop = cleanTag(tags.shop);
  const leisure = cleanTag(tags.leisure);
  const tourism = cleanTag(tags.tourism);
  const cats: string[] = [];

  const hasName = (tags: Record<string, string>) =>
    Boolean(String(tags.name || tags["name:en"] || "").trim());

  // Food — cafés, restaurants, fast food, bakeries, markets
  if (["cafe", "restaurant", "fast_food", "marketplace", "bakery"].includes(amenity) || shop === "bakery") {
    cats.push("food");
  }

  // Chill — parks, gardens, museums, galleries, viewpoints, art studios (excluding public toilets)
  if (
    ["park", "garden"].includes(leisure) || 
    ["museum", "gallery", "viewpoint", "art_gallery", "arts_centre"].includes(tourism) ||
    ["art_gallery", "arts_centre"].includes(amenity)
  ) {
    cats.push("chill");
  }

  // Thrill (Rocket) — adult venues: brothels, strip clubs, love hotels,
  // cabarets, swinger clubs, adult gaming centres, casinos, sex/erotic/adult/
  // cannabis shops, coffeeshops, and NAMED massage parlours (OSM has no
  // ratings, so a name is the only quality signal - unnamed shop=massage is
  // dropped). Matches the Antigravity build's taxonomy.
  if (
    ["brothel", "strip_club", "stripclub", "love_hotel", "lovehotel", "cabaret", "swinger_club", "swingerclub", "coffeeshop", "casino"].includes(amenity) ||
    ["casino", "gambling", "adult_gaming_centre"].includes(leisure) ||
    ["sex", "erotic", "adult", "cannabis", "marijuana", "coffeeshop"].includes(shop) ||
    (shop === "massage" && hasName(tags))
  ) {
    cats.push("thrill");
  }

  // Dilate — nightlife: pubs, bars, nightclubs.
  if (["pub", "bar", "nightclub"].includes(amenity)) {
    cats.push("dilate");
  }

  return cats;
}

export function capString(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getNiceType(tags: Record<string, string>): string {
  const shop = cleanTag(tags.shop);
  const amenity = cleanTag(tags.amenity);
  const leisure = cleanTag(tags.leisure);

  if (shop === "massage") {
    return "Massage";
  }
  if (amenity === "brothel") {
    return "Brothel";
  }
  if (amenity === "strip_club" || amenity === "stripclub") {
    return "Strip Club";
  }
  if (amenity === "love_hotel" || amenity === "lovehotel") {
    return "Love Hotel";
  }
  if (amenity === "swinger_club" || amenity === "swingerclub") {
    return "Swinger Club";
  }
  if (shop === "sex" || shop === "erotic") {
    return "Sex Shop";
  }
  if (shop === "adult") {
    return "Adult Shop";
  }
  if (shop === "cannabis" || shop === "marijuana") {
    return "Cannabis Shop";
  }
  if (amenity === "coffeeshop" || shop === "coffeeshop") {
    return "Coffeeshop";
  }
  if (amenity === "toilets") {
    return "Public Toilets";
  }
  if (amenity === "casino" || leisure === "casino" || leisure === "gambling" || leisure === "adult_gaming_centre") {
    return "Casino";
  }

  const base = capString(tags.amenity || tags.shop || tags.leisure || tags.tourism || "Place");
  if (tags.cuisine) {
    return `${base} - ${capString(String(tags.cuisine).split(";")[0])}`;
  }
  return base;
}

export function getSubTagsLine(tags: Record<string, string>): string {
  const out: string[] = [];
  if (tags.wheelchair) {
    out.push(`wheelchair: ${tags.wheelchair}`);
  }
  if (tags["addr:street"]) {
    out.push(tags["addr:street"]);
  }
  return out.join(" - ");
}

export function normalizeOSMElements(elements: any[], originLat: number, originLng: number): Place[] {
  const seen = new Set<string>();
  const places: Place[] = [];

  for (const element of elements) {
    if (!element || element.id === undefined || !element.type || !["node", "way", "relation"].includes(element.type)) continue;
    const tags = element.tags || {};
    const cats = getCategories(tags);
    if (!cats.length) continue;

    const lat = typeof element.lat === "number" ? element.lat : element.center && element.center.lat;
    const lng = typeof element.lon === "number" ? element.lon : element.center && element.center.lon;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const key = `${element.type}:${element.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const hasName = Boolean(String(tags.name || tags["name:en"] || "").trim());
    const name = tags.name || tags["name:en"] || `Unnamed ${cats[0].toUpperCase()} spot`;

    const distance = calculateDistance(originLat, originLng, lat, lng);
    const bearing = calculateBearing(originLat, originLng, lat, lng);

    places.push({
      key,
      osmType: element.type,
      osmId: element.id,
      lat,
      lng,
      tags,
      cats,
      named: hasName,
      name,
      typeLabel: getNiceType(tags),
      subTags: getSubTagsLine(tags),
      distance,
      bearing
    });
  }

  // Sort: Distance-based ranking (grouped by distance bands, named places rank higher in each band, then distance, then name)
  const RANK_BAND = 125;
  return places.sort((a, b) => {
    const bandA = Math.floor(a.distance / RANK_BAND);
    const bandB = Math.floor(b.distance / RANK_BAND);
    if (bandA !== bandB) return bandA - bandB;
    if (a.named !== b.named) return a.named ? -1 : 1;
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.name.localeCompare(b.name);
  });
}

export async function geocodePlace(query: string): Promise<{ lat: number; lng: number; label: string; region: string }> {
  const tryFetch = async (placeOnly: boolean) => {
    const params = new URLSearchParams({ q: query });
    if (placeOnly) {
      ["place:city", "place:town", "place:village", "place:suburb", "place:neighbourhood"].forEach((tag) => {
        params.append("osm_tag", tag);
      });
    }

    const url = `/api/geocode?${params.toString()}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`geocode-http-${response.status}`);
    }
    const json = await response.json();
    return Array.isArray(json.features) ? json.features : [];
  };

  let features = await tryFetch(true);
  if (!features.length) {
    features = await tryFetch(false);
  }
  if (!features.length) {
    throw new Error("city-not-found");
  }

  const feature = features[0];
  const coords = feature.geometry && feature.geometry.coordinates;
  const lng = Number(coords && coords[0]);
  const lat = Number(coords && coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("city-not-found");
  }

  const props = feature.properties || {};
  const label = props.name || props.city || props.town || props.village || "Selected location";
  const region = [props.state, props.country].filter(Boolean).join(", ");

  return { lat, lng, label, region };
}

export async function fetchPlacesFromProxy(lat: number, lng: number): Promise<any> {
  const startTime = performance.now();
  const snapLat = Math.round(lat * 100) / 100;
  const snapLng = Math.round(lng * 100) / 100;
  const cacheKey = `drift_places_cache_v5:${snapLat}:${snapLng}`;
  const TTL = 5 * 60 * 1000; // 5 minutes cache TTL

  // Check localStorage first
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        const age = Date.now() - parsed.timestamp;
        if (age < TTL) {
          const duration = Math.round(performance.now() - startTime);
          const data = parsed.data;
          data.source = 'cache';

          console.log(
            `%c[DRIFT DIAGNOSTIC] Place data retrieved successfully!
 • Snapping Target Grid: (${snapLat}, ${snapLng})
 • Upstream Query Source: LOCAL STORAGE (CACHED)
 • Execution Time: ${duration}ms
 • Elements Loaded: ${data.elements?.length || 0}`,
            "color: #a17eff; font-weight: bold; background: #181127; padding: 4px; border-radius: 4px;"
          );

          return data;
        }
      }
    } catch (e) {
      console.warn('[LOCAL STORAGE CACHE READ ERROR]', e);
    }
  }

  // Not in cache or expired, fetch from API
  const OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter'
  ];

  let preferredMirror: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedPref = localStorage.getItem('drift_preferred_mirror');
      if (storedPref && storedPref !== 'auto') {
        preferredMirror = storedPref;
      } else {
        preferredMirror = localStorage.getItem('drift_fastest_mirror_cache');
      }
    } catch (e) {
      console.warn('[LOCAL STORAGE PREF READ ERROR]', e);
    }
  }

  // Build a prioritized sequence of mirrors to try
  const mirrorsToTry: (string | null)[] = [];
  if (preferredMirror && OVERPASS_MIRRORS.includes(preferredMirror)) {
    mirrorsToTry.push(preferredMirror);
  } else {
    mirrorsToTry.push(null); // 'auto' (backend choice) first
  }

  // Append other mirrors to try sequentially as fallbacks
  for (const m of OVERPASS_MIRRORS) {
    if (m !== preferredMirror) {
      mirrorsToTry.push(m);
    }
  }

  // If we had a preferred mirror, append null (auto) to the end as a final catch-all attempt
  if (preferredMirror) {
    mirrorsToTry.push(null);
  }

  let lastError: Error | null = null;
  const maxAttempts = mirrorsToTry.length;
  const baseDelayMs = 500; // base exponential delay start

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const currentMirror = mirrorsToTry[attempt];

    try {
      if (attempt > 0) {
        // Calculate exponential backoff: 500ms, 1000ms, 2000ms... with ±20% jitter
        const delay = baseDelayMs * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4);
        console.warn(`%c[RETRY BACKOFF] Attempt ${attempt} failed. Retrying in ${Math.round(delay)}ms using mirror: ${currentMirror || 'auto (dynamic)'}`, 'color: #ffaa00; font-weight: bold;');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const response = await fetch("/api/places", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ 
          lat, 
          lng,
          preferredMirror: currentMirror || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`overpass-http-${response.status}`);
      }

      const json = await response.json();

      if (!json || !Array.isArray(json.elements)) {
        throw new Error("overpass-bad");
      }

      // Override source for badge mapping: served from API directly -> 'network' ('Live')
      json.source = 'network';

      // Save to localStorage cache
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: json
          }));
        } catch (e) {
          console.warn('[LOCAL STORAGE CACHE WRITE ERROR]', e);
        }
      }

      const duration = Math.round(performance.now() - startTime);

      // Diagnostic Log Summary
      console.log(
        `%c[DRIFT DIAGNOSTIC] Place data retrieved successfully!
 • Snapping Target Grid: (${snapLat}, ${snapLng})
 • Upstream Query Source: API (LIVE)
 • Routed Mirror: ${json.routedMirror || currentMirror || 'auto'}
 • Retry Attempts: ${attempt}
 • Execution Time: ${duration}ms
 • Elements Loaded: ${json.elements.length}`,
        "color: #4cc47e; font-weight: bold; background: #0c2015; padding: 4px; border-radius: 4px;"
      );

      return json;

    } catch (err: any) {
      console.error(`[RETRY BACKOFF] Attempt ${attempt + 1}/${maxAttempts} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All Overpass mirror queries failed");
}
