const CACHE_NAME = "drift-v2.2";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg"
];

// CDN hosts to cache stale-while-revalidate
const CDN_HOSTS = [
  "unpkg.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

// Network-only hosts (never cache)
const LIVE_HOSTS = [
  "photon.komoot.io",
  "overpass-api.de",
  "overpass.private.coffee",
  "maps.mail.ru",
  "basemaps.cartocdn.com"
];

// Helper to generate local offline OSM fixtures for any given coordinate pair
function generateOfflineFallbackFixtures(lat, lng) {
  return {
    source: 'fallback',
    elements: [
      {
        type: 'node',
        id: 900001,
        lat: lat + 0.001,
        lon: lng - 0.002,
        tags: { amenity: 'cafe', name: 'Offline Oasis Cafe (Service Worker)', opening_hours: '24/7', cuisine: 'coffee' }
      },
      {
        type: 'node',
        id: 900002,
        lat: lat + 0.003,
        lon: lng + 0.002,
        tags: { amenity: 'restaurant', name: 'The Offline Hub Diner', opening_hours: 'Mo-Su 12:00-22:00', cuisine: 'comfort_food' }
      },
      {
        type: 'node',
        id: 900003,
        lat: lat - 0.002,
        lon: lng + 0.001,
        tags: { leisure: 'park', name: 'Wireless Wilderness Park (Offline)' }
      },
      {
        type: 'node',
        id: 900004,
        lat: lat - 0.003,
        lon: lng - 0.003,
        tags: { amenity: 'toilets', name: 'No-Signal Rest Stop', wheelchair: 'yes' }
      },
      {
        type: 'node',
        id: 900005,
        lat: lat + 0.002,
        lon: lng + 0.004,
        tags: { amenity: 'pub', name: 'The Disconnected Pub & Inn', opening_hours: 'Mo-Su 16:00-01:00' }
      }
    ]
  };
}

// Helper to generate offline geocode features for any search term
function generateOfflineGeocodeFixtures(query) {
  const q = String(query || "").trim().toLowerCase();
  
  let lat = 51.5074; // London
  let lng = -0.1278;
  let label = "London (Offline)";
  let region = "Greater London, United Kingdom";

  if (q.includes("york") || q.includes("ny")) {
    lat = 40.7128;
    lng = -74.0060;
    label = "New York (Offline)";
    region = "New York State, United States";
  } else if (q.includes("paris")) {
    lat = 48.8566;
    lng = 2.3522;
    label = "Paris (Offline)";
    region = "Île-de-France, France";
  } else if (q.includes("tokyo")) {
    lat = 35.6762;
    lng = 139.6503;
    label = "Tokyo (Offline)";
    region = "Tokyo Metropolis, Japan";
  } else if (q.includes("berlin")) {
    lat = 52.5200;
    lng = 13.4050;
    label = "Berlin (Offline)";
    region = "Berlin State, Germany";
  } else if (q.includes("sydney")) {
    lat = -33.8688;
    lng = 151.2093;
    label = "Sydney (Offline)";
    region = "New South Wales, Australia";
  } else if (q.includes("san francisco") || q.includes("sf")) {
    lat = 37.7749;
    lng = -122.4194;
    label = "San Francisco (Offline)";
    region = "California, United States";
  } else if (q.length > 0) {
    // Generate mock coordinates deterministically based on character codes
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < q.length; i++) {
      hash1 = q.charCodeAt(i) + ((hash1 << 5) - hash1);
      hash2 = q.charCodeAt(i) + ((hash2 << 7) - hash2);
    }
    lat = 10 + (Math.abs(hash1) % 50);
    lng = (hash2 % 180);
    label = `${query.charAt(0).toUpperCase() + query.slice(1)} (Offline)`;
    region = "Offline Geocoding Database";
  }

  return {
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat]
        },
        properties: {
          name: label,
          city: label,
          state: region.split(",")[0],
          country: region.split(",")[1] || "Offline World"
        }
      }
    ]
  };
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Intercept Overpass API Places Requests (POST)
  if (event.request.method === "POST" && url.pathname === "/api/places") {
    event.respondWith(
      (async () => {
        let lat = 0;
        let lng = 0;
        try {
          const requestClone = event.request.clone();
          const body = await requestClone.json();
          lat = Number(body.lat || 0);
          lng = Number(body.lng || 0);
        } catch (e) {
          console.warn("[SW] Failed to parse places POST JSON body:", e);
        }

        const snappedLat = Math.round(lat * 100) / 100;
        const snappedLng = Math.round(lng * 100) / 100;
        const virtualCacheUrl = `/api/places-cache?lat=${snappedLat}&lng=${snappedLng}`;

        // If explicitly detected offline, try cache first, then fall back to generated fixtures
        if (!navigator.onLine) {
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(virtualCacheUrl);
          if (cachedResponse) {
            try {
              const resClone = cachedResponse.clone();
              const text = await resClone.text();
              const data = JSON.parse(text);
              data.source = 'cache';
              return new Response(JSON.stringify(data), {
                status: 200,
                headers: { "Content-Type": "application/json", "X-Data-Source": "cache" }
              });
            } catch (err) {
              console.warn("[SW] Error parsing cached places payload:", err);
            }
          }

          // Return static offline fixtures
          const fallbackData = generateOfflineFallbackFixtures(lat, lng);
          return new Response(JSON.stringify(fallbackData), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-Data-Source": "fallback" }
          });
        }

        // Online path: attempt network query, save to virtual cache URL, fallback on error
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            const responseData = await responseClone.json();
            
            // Cache successful payload mapped to coordinate key
            const cache = await caches.open(CACHE_NAME);
            await cache.put(virtualCacheUrl, new Response(JSON.stringify(responseData), {
              headers: { "Content-Type": "application/json" }
            }));

            return new Response(JSON.stringify(responseData), {
              status: networkResponse.status,
              statusText: networkResponse.statusText,
              headers: networkResponse.headers
            });
          } else {
            throw new Error(`Proxy returned status ${networkResponse.status}`);
          }
        } catch (err) {
          console.warn("[SW] Places network lookup failed, using offline fallback:", err.message);
          
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(virtualCacheUrl);
          if (cachedResponse) {
            try {
              const resClone = cachedResponse.clone();
              const text = await resClone.text();
              const data = JSON.parse(text);
              data.source = 'cache';
              return new Response(JSON.stringify(data), {
                status: 200,
                headers: { "Content-Type": "application/json", "X-Data-Source": "cache" }
              });
            } catch (e) {
              console.warn("[SW] Failed reading backup cache entry:", e);
            }
          }

          const fallbackData = generateOfflineFallbackFixtures(lat, lng);
          return new Response(JSON.stringify(fallbackData), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-Data-Source": "fallback" }
          });
        }
      })()
    );
    return;
  }

  // 2. Intercept Geocoding Requests (GET)
  if (event.request.method === "GET" && url.pathname === "/api/geocode") {
    event.respondWith(
      (async () => {
        const searchQuery = url.searchParams.get("q") || "";
        const cache = await caches.open(CACHE_NAME);

        // If offline, serve from cache, else geocode fixtures
        if (!navigator.onLine) {
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) return cachedResponse;

          const offlineGeocode = generateOfflineGeocodeFixtures(searchQuery);
          return new Response(JSON.stringify(offlineGeocode), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            await cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }
          throw new Error(`Geocoding server error ${networkResponse.status}`);
        } catch (err) {
          console.warn("[SW] Geocoding lookup failed, returning offline guess:", err.message);
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) return cachedResponse;

          const offlineGeocode = generateOfflineGeocodeFixtures(searchQuery);
          return new Response(JSON.stringify(offlineGeocode), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
      })()
    );
    return;
  }

  // Ignore non-GET requests for other assets
  if (event.request.method !== "GET") return;

  // Live external hosts (like cartodb basemaps or OSM interpreter mirrors directly) - bypass SW caching
  if (LIVE_HOSTS.some((host) => url.hostname.includes(host))) {
    return;
  }

  // Bypass other API endpoints if we didn't explicitly capture them above
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // CDN assets (like fonts, Leaflet script, etc.) - stale-while-revalidate
  if (CDN_HOSTS.some((host) => url.hostname.includes(host))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((response) => {
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Same-origin shell assets (like compiled JS/CSS)
  if (url.origin === self.location.origin) {
    // DO NOT cache dev server assets!
    // Dev server uses dynamic compilation and HMR; caching them causes mismatching chunks and React Hook errors.
    const isDevAsset = 
      url.pathname.startsWith('/src/') || 
      url.pathname.startsWith('/node_modules/') || 
      url.pathname.includes('/@vite/') || 
      url.pathname.includes('/@id/') || 
      url.pathname.includes('/@fs/') || 
      url.pathname.includes('/@react-refresh') ||
      url.searchParams.has('v');

    if (isDevAsset) {
      return;
    }

    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((response) => {
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => {
          // If navigation fails, fallback to index.html shell
          if (event.request.mode === "navigate") {
            return cache.match("/index.html");
          }
          return cached;
        });
        return cached || fetchPromise;
      })
    );
  }
});
