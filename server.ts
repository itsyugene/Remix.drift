import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

// Upstream URLs
const GEOCODER_URL = 'https://photon.komoot.io/api/';
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
];

// Comply with OSM User-Agent policies
const CUSTOM_USER_AGENT = 'DRIFT/2.1 (ksuclasses16@yahoo.com; https://remix-drift.onrender.com)';

// In-Memory Rate Limiter Map (per IP)
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 60; // Max 60 requests per 10 minutes per IP

// Simple In-Memory Cache Store
interface CacheEntry {
  data: any;
  expiresAt: number;
}
const cacheStore = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Circuit Breaker State
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';
let circuitState: CircuitState = 'CLOSED';
let consecutiveFailures = 0;
let circuitOpenedAt = 0;
const BREAKER_FAILURE_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 15000; // 15 seconds to cooldown/half-open

// Simple fallback fixture templates mapped to user search coordinates
// so they get fully functional offline experiences mapped to their query
function generateCircuitFallbackFixtures(lat: number, lng: number) {
  return {
    elements: [
      {
        type: 'node',
        id: 900001,
        lat: lat + 0.001,
        lon: lng - 0.002,
        tags: { amenity: 'cafe', name: 'Safe Haven Cafe (Circuit Breaker)', opening_hours: '24/7', cuisine: 'coffee' }
      },
      {
        type: 'node',
        id: 900002,
        lat: lat + 0.003,
        lon: lng + 0.002,
        tags: { amenity: 'restaurant', name: 'Static Shelter Diner', opening_hours: 'Mo-Su 12:00-22:00', cuisine: 'comfort_food' }
      },
      {
        type: 'node',
        id: 900003,
        lat: lat - 0.002,
        lon: lng + 0.001,
        tags: { leisure: 'park', name: 'Resilience Grove (Offline Park)' }
      },
      {
        type: 'node',
        id: 900004,
        lat: lat - 0.003,
        lon: lng - 0.003,
        tags: { amenity: 'toilets', name: 'Offline Relief Station', wheelchair: 'yes' }
      },
      {
        type: 'node',
        id: 900005,
        lat: lat + 0.002,
        lon: lng + 0.004,
        tags: { amenity: 'pub', name: 'The Tripped Breaker Pub', opening_hours: 'Mo-Su 16:00-01:00' }
      },
      {
        type: 'node',
        id: 900006,
        lat: lat - 0.001,
        lon: lng + 0.003,
        tags: { amenity: 'casino', name: 'The Golden Circuit Casino (Fallback)', opening_hours: '24/7' }
      }
    ]
  };
}

// IP-based Rate Limiter Middleware
function ipRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  const now = Date.now();
  const record = ipRequestCounts.get(ip);

  if (!record || now > record.resetAt) {
    ipRequestCounts.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return next();
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests. Please slow down and try again in a few minutes.'
    });
  }

  record.count += 1;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Geocoding Proxy Route with Cache & Rate Limiting
  app.get('/api/geocode', ipRateLimiter, async (req, res) => {
    const query = req.query.q?.toString().trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter "q"' });
    }

    const cacheKey = `geocode:${query.toLowerCase()}`;
    const cached = cacheStore.get(cacheKey);
    const now = Date.now();

    if (cached && now < cached.expiresAt) {
      res.setHeader('X-Data-Source', 'cache');
      return res.json({ ...cached.data, source: 'cache' });
    }

    // Build query params
    const params = new URLSearchParams({ q: query, limit: '8', lang: 'en' });
    if (req.query.osm_tag) {
      const rawTags = Array.isArray(req.query.osm_tag) 
        ? req.query.osm_tag 
        : [req.query.osm_tag];
      const tags = rawTags.map(tag => String(tag));
      tags.forEach(tag => params.append('osm_tag', tag));
    }

    try {
      const response = await fetch(`${GEOCODER_URL}?${params.toString()}`, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': CUSTOM_USER_AGENT
        }
      });

      if (!response.ok) {
        throw new Error(`Photon geocoder responded with status ${response.status}`);
      }

      const data = await response.json();
      
      // Cache results
      cacheStore.set(cacheKey, {
        data,
        expiresAt: now + CACHE_TTL_MS
      });

      res.setHeader('X-Data-Source', 'network');
      res.json({ ...data, source: 'network' });
    } catch (err: any) {
      console.error('[PROXY GEOCODE ERROR]', err.message);
      res.status(502).json({ error: 'Geocoding service currently unavailable.' });
    }
  });

  // 2. Overpass Query Proxy with Geographic Cache Key, Circuit Breaker, Rate Limiting
  app.post('/api/places', ipRateLimiter, async (req, res) => {
    const { lat, lng, preferredMirror } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Missing or invalid "lat" or "lng" coordinate parameters' });
    }

    // Geokey Subtlety [SPECIFIC TO DRIFT]: Round coordinates to 2 decimal places (approx ~1.1km cells)
    const snappedLat = Math.round(lat * 100) / 100;
    const snappedLng = Math.round(lng * 100) / 100;
    const cacheKey = `places_v5:${snappedLat}:${snappedLng}`;

    const now = Date.now();
    const cached = cacheStore.get(cacheKey);

    if (cached && now < cached.expiresAt) {
      console.log(`[CACHE HIT] served snapping coordinate places for grid (${snappedLat}, ${snappedLng})`);
      res.setHeader('X-Data-Source', 'cache');
      return res.json({ ...cached.data, source: 'cache' });
    }

    // Evaluate Circuit Breaker State
    if (circuitState === 'OPEN') {
      if (now - circuitOpenedAt > BREAKER_COOLDOWN_MS) {
        console.log('[CIRCUIT BREAKER] Cooldown elapsed. Transitioning to HALF-OPEN.');
        circuitState = 'HALF-OPEN';
      } else {
        console.warn('[CIRCUIT BREAKER] State is OPEN. Serving safe local fallback fixtures to protect upstream.');
        res.setHeader('X-Data-Source', 'fallback');
        return res.json({ ...generateCircuitFallbackFixtures(lat, lng), source: 'fallback' });
      }
    }

    // Prepare overpass query based on snapped target coordinate grid to maximize hits
    // Sparser classes (thrill, parks, museums) use around:2000 to remain light and fast. Very common food places use around:1200 to prevent dense cities from exceeding limits.
    const query =
      `[out:json][timeout:20];(` +
      `nwr["amenity"~"^(brothel|casino|stripclub|strip_club|love_hotel|lovehotel|cabaret|swinger_club|swingerclub|pub|bar|nightclub|arts_centre|coffeeshop)$"](around:2000,${snappedLat},${snappedLng});` +
      `nwr["leisure"~"^(casino|gambling|adult_gaming_centre)$"](around:2000,${snappedLat},${snappedLng});` +
      `nwr["shop"~"^(massage|sex|erotic|adult|cannabis|marijuana|coffeeshop)$"](around:2000,${snappedLat},${snappedLng});` +
      `nwr["leisure"~"^(park|garden)$"](around:2000,${snappedLat},${snappedLng});` +
      `nwr["tourism"~"^(museum|gallery|viewpoint|art_gallery|arts_centre)$"](around:2000,${snappedLat},${snappedLng});` +
      `nwr["amenity"~"^(cafe|restaurant|fast_food|marketplace|bakery)$"](around:1200,${snappedLat},${snappedLng});` +
      `nwr["shop"="bakery"](around:1200,${snappedLat},${snappedLng});` +
      `);out center tags 1200;`;

    let success = false;
    let responseData: any = null;
    let routedMirror: string | null = null;

    // Dynamically prioritize the user's preferred regional mirror
    const mirrorsToTry = [...OVERPASS_MIRRORS];
    if (preferredMirror && OVERPASS_MIRRORS.includes(preferredMirror)) {
      const idx = mirrorsToTry.indexOf(preferredMirror);
      if (idx > -1) {
        mirrorsToTry.splice(idx, 1);
        mirrorsToTry.unshift(preferredMirror);
        console.log(`[ROUTE OPTIMIZATION] Prioritizing user regional mirror: ${preferredMirror}`);
      }
    }

    // Try Overpass Mirrors in sequence
    for (const url of mirrorsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout for fast failover

      try {
        console.log(`[UPSTREAM FETCH] Attempting fetch to ${url}...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': CUSTOM_USER_AGENT
          },
          body: new URLSearchParams({ data: query }).toString(),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Upstream mirror ${url} failed with status ${response.status}`);
        }

        responseData = await response.json();
        success = true;
        routedMirror = url;
        break; // Stop at first succeeding mirror
      } catch (err: any) {
        console.error(`[UPSTREAM FAIL] Error querying ${url}:`, err.message);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (success && responseData && Array.isArray(responseData.elements)) {
      // If we were HALF-OPEN and succeeded, close the circuit
      if (circuitState === 'HALF-OPEN') {
        console.log('[CIRCUIT BREAKER] Upstream recovered. Closing circuit.');
        circuitState = 'CLOSED';
        consecutiveFailures = 0;
      }

      // Cache the result
      cacheStore.set(cacheKey, {
        data: responseData,
        expiresAt: now + CACHE_TTL_MS
      });

      res.setHeader('X-Data-Source', 'network');
      return res.json({ ...responseData, source: 'network', routedMirror });
    } else {
      // Increment failures and check circuit trip
      consecutiveFailures += 1;
      console.warn(`[CIRCUIT BREAKER] consecutive failures: ${consecutiveFailures}`);

      if (consecutiveFailures >= BREAKER_FAILURE_THRESHOLD) {
        console.error('[CIRCUIT BREAKER] Threshold reached. Tripping circuit to OPEN.');
        circuitState = 'OPEN';
        circuitOpenedAt = now;
      }

      // Return generated fallback fixtures for the local coordinate mapping
      res.setHeader('X-Data-Source', 'fallback');
      return res.json({ ...generateCircuitFallbackFixtures(lat, lng), source: 'fallback' });
    }
  });

  // 3. Test Connection Proxy Endpoint
  app.get('/api/test-connection', ipRateLimiter, async (req, res) => {
    const results = [];
    let overallStatus = 'down';
    let reachableCount = 0;

    for (const url of OVERPASS_MIRRORS) {
      const startTime = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s fast ping timeout

      try {
        const pingUrl = `${url}?data=%5Bout%3Ajson%5D%5Btimeout%3A3%5D%3Bout%3B`;
        const response = await fetch(pingUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': CUSTOM_USER_AGENT
          },
          signal: controller.signal
        });

        const latencyMs = Math.round(performance.now() - startTime);

        if (response.ok) {
          results.push({
            url,
            reachable: true,
            status: response.status,
            latencyMs
          });
          reachableCount++;
        } else {
          results.push({
            url,
            reachable: false,
            status: response.status,
            error: `HTTP ${response.status}`,
            latencyMs
          });
        }
      } catch (err: any) {
        const latencyMs = Math.round(performance.now() - startTime);
        results.push({
          url,
          reachable: false,
          error: err.name === 'AbortError' ? 'Timeout (4s)' : err.message || 'Fetch failed',
          latencyMs
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (reachableCount === OVERPASS_MIRRORS.length) {
      overallStatus = 'ok';
    } else if (reachableCount > 0) {
      overallStatus = 'partial';
    }

    res.json({
      status: overallStatus,
      reachableCount,
      totalCount: OVERPASS_MIRRORS.length,
      mirrors: results,
      circuitBreaker: {
        state: circuitState,
        consecutiveFailures,
        cooldownRemainingMs: circuitState === 'OPEN' ? Math.max(0, BREAKER_COOLDOWN_MS - (Date.now() - circuitOpenedAt)) : 0
      }
    });
  });

  // Handle Vite Asset Serving & SPA fallback
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DRIFT SERVER] Running on http://localhost:${PORT} in ${isProd ? 'production' : 'development'} mode`);
  });
}

startServer();
