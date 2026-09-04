import React, { useState, useEffect, useRef } from 'react';
import { Place, RecentSearchItem } from './types.ts';
import { 
  geocodePlace, 
  fetchPlacesFromProxy, 
  normalizeOSMElements, 
  formatDistance,
  calculateDistance
} from './utils/geoUtils.ts';
import { parseHours } from './utils/hoursParser.ts';
import DriftMap from './components/DriftMap.tsx';
import PlaceCard from './components/PlaceCard.tsx';
import PlaceCardSkeleton from './components/PlaceCardSkeleton.tsx';
import { 
  MapPin, 
  Search, 
  Compass, 
  ShieldAlert, 
  Navigation, 
  Share2, 
  HelpCircle, 
  Map, 
  Eye, 
  EyeOff, 
  Radio,
  Coffee,
  Trees,
  Wine,
  Rocket,
  Activity,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  Zap,
  Globe,
  Flame
} from 'lucide-react';
import { hapticFeedback } from './utils/haptic.ts';
import { HUBS, buildDemoElements } from './lib/demoHubs.ts';
import { getFeedback } from './lib/feedback.ts';
import { getLedger, subscribe } from './lib/driftPoints.ts';
// Firebase auth/cloud-sync removed - DRIFT is fully local (localStorage only).

const CATEGORIES = [
  { id: 'food', label: 'Food', color: '#ff9f1c', bg: 'bg-[#ff9f1c]', text: 'text-[#ff9f1c]', border: 'border-[#ff9f1c]', hover: 'hover:border-[#ff9f1c]', outline: 'focus:outline-[#ff9f1c]', icon: Coffee },
  { id: 'chill', label: 'Chill', color: '#2ec4b6', bg: 'bg-[#2ec4b6]', text: 'text-[#2ec4b6]', border: 'border-[#2ec4b6]', hover: 'hover:border-[#2ec4b6]', outline: 'focus:outline-[#2ec4b6]', icon: Trees },
  { id: 'dilate', label: 'Dilate', color: '#8d4bff', bg: 'bg-[#8d4bff]', text: 'text-[#8d4bff]', border: 'border-[#8d4bff]', hover: 'hover:border-[#8d4bff]', outline: 'focus:outline-[#8d4bff]', icon: Wine },
  { id: 'thrill', label: 'Thrill', color: '#ff4522', bg: 'bg-[#ff4522]', text: 'text-[#ff4522]', border: 'border-[#ff4522]', hover: 'hover:border-[#ff4522]', outline: 'focus:outline-[#ff4522]', icon: Rocket }
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

export default function App() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [label, setLabel] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  
  const [places, setPlaces] = useState<Place[]>([]);
  const [dataSource, setDataSource] = useState<'cache' | 'network' | 'fallback' | 'demo' | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorKind, setErrorKind] = useState<string>('');
  const [feedbackUpdateTrigger, setFeedbackUpdateTrigger] = useState<number>(0);
  
  const handleFeedbackChange = () => {
    setFeedbackUpdateTrigger(prev => prev + 1);
  };

  // Off-chain "drift" points ledger (device-local; see lib/driftPoints.ts).
  const [drift, setDrift] = useState<{ balance: number; streak: number }>({ balance: 0, streak: 0 });
  useEffect(() => {
    const sync = () => {
      const l = getLedger();
      setDrift({ balance: l.balance, streak: l.streak });
    };
    sync();
    return subscribe(sync);
  }, []);
  const handleDriftEarned = () => {
    const l = getLedger();
    setDrift({ balance: l.balance, streak: l.streak });
  };

  const [radius, setRadius] = useState<number>(4000);
  const [openOnly, setOpenOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<CategoryId>('food');
  
  const [isMorning, setIsMorning] = useState<boolean>(false);
  const [currentHour, setCurrentHour] = useState<string>('00');

  const activeTokenRef = useRef<number>(0);
  const lastSearchQueryRef = useRef<string>('');

  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);

  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingStep, setOnboardingStep] = useState<number>(1);

  const [isMapCollapsed, setIsMapCollapsed] = useState<boolean>(false);
  const [liveMode, setLiveMode] = useState<boolean>(false);
  const [showLiveTooltip, setShowLiveTooltip] = useState<boolean>(false);
  const liveModeOriginRef = useRef<{ lat: number; lng: number } | null>(null);

  // Connection diagnostics states
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [preferredMirror, setPreferredMirror] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('drift_preferred_mirror') || 'auto';
    }
    return 'auto';
  });

  const runConnectionTest = async () => {
    hapticFeedback.light();
    setTestingConnection(true);
    setTestResult(null);
    setShowTestModal(true);
    try {
      const response = await fetch('/api/test-connection');
      if (response.ok) {
        const data = await response.json();
        setTestResult(data);
        if (data && Array.isArray(data.mirrors)) {
          const reachable = data.mirrors.filter((m: any) => m.reachable);
          if (reachable.length > 0) {
            const sorted = [...reachable].sort((a: any, b: any) => a.latencyMs - b.latencyMs);
            const fastest = sorted[0].url;
            localStorage.setItem('drift_fastest_mirror_cache', fastest);
          }
        }
        if (data.status === 'ok') {
          hapticFeedback.searchSuccess();
        } else {
          hapticFeedback.longError();
        }
      } else {
        setTestResult({
          status: 'down',
          error: `HTTP Error ${response.status}`,
          mirrors: []
        });
        hapticFeedback.longError();
      }
    } catch (err: any) {
      setTestResult({
        status: 'down',
        error: err.message || 'Failed to contact proxy service',
        mirrors: []
      });
      hapticFeedback.longError();
    } finally {
      setTestingConnection(false);
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('drift_recent_searches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('[RECENT SEARCHES READ ERROR]', e);
    }

    try {
      const onboarded = localStorage.getItem('drift_onboarded');
      if (!onboarded) {
        setShowOnboarding(true);
      }
    } catch (e) {
      console.warn('[ONBOARDING READ ERROR]', e);
    }
  }, []);

  const saveRecentSearch = (query: string, itemLat: number, itemLng: number, itemLabel: string, itemRegion: string) => {
    try {
      const stored = localStorage.getItem('drift_recent_searches');
      let currentList: RecentSearchItem[] = stored ? JSON.parse(stored) : [];
      
      // Filter out existing one for the same query (case-insensitive)
      currentList = currentList.filter(item => 
        item.query.toLowerCase() !== query.toLowerCase()
      );

      const newItem: RecentSearchItem = {
        query,
        label: itemLabel,
        region: itemRegion,
        lat: itemLat,
        lng: itemLng,
        timestamp: Date.now()
      };

      // Put at start
      currentList.unshift(newItem);

      // Keep only last 3
      const updated = currentList.slice(0, 3);
      setRecentSearches(updated);
      localStorage.setItem('drift_recent_searches', JSON.stringify(updated));
    } catch (e) {
      console.warn('[RECENT SEARCHES WRITE ERROR]', e);
    }
  };

  const handleRecentClick = async (item: RecentSearchItem) => {
    hapticFeedback.medium();
    setSearchQuery(item.query);
    const token = activeTokenRef.current + 1;
    activeTokenRef.current = token;
    lastSearchQueryRef.current = item.query;

    setLat(item.lat);
    setLng(item.lng);
    setLabel(item.label);
    setRegion(item.region);

    // Save to recents to bump it to top
    saveRecentSearch(item.query, item.lat, item.lng, item.label, item.region);

    await executeOverpassQuery(item.lat, item.lng, item.label, item.region, token);
  };

  const handleDemoHubClick = (city: keyof typeof HUBS) => {
    hapticFeedback.medium();
    const hub = HUBS[city];
    
    setLat(hub.lat);
    setLng(hub.lng);
    setLabel(hub.label);
    setRegion(`${hub.region} (Approximate Positions)`);
    setSearchQuery('');
    
    const token = activeTokenRef.current + 1;
    activeTokenRef.current = token;
    
    setStatus('loading');
    setStatusMsg(`Loading Demo Hub elements for ${hub.label}...`);
    setErrorKind('');
    
    setTimeout(() => {
      if (token !== activeTokenRef.current) return;
      const rawElements = buildDemoElements(city);
      const normalized = normalizeOSMElements(rawElements, hub.lat, hub.lng);
      setPlaces(normalized);
      setDataSource('demo');
      hapticFeedback.searchSuccess();
      liveModeOriginRef.current = { lat: hub.lat, lng: hub.lng };
      setStatus('idle');
      setStatusMsg('');
    }, 400);
  };

  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [shareFallbackUrl, setShareFallbackUrl] = useState<string | null>(null);

  const getShareUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    if (lastSearchQueryRef.current) {
      params.set('q', lastSearchQueryRef.current);
    } else if (lat !== null && lng !== null) {
      params.set('lat', String(lat));
      params.set('lng', String(lng));
      if (label) params.set('label', label);
      if (region) params.set('region', region);
    }
    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  };

  const handleShare = async () => {
    hapticFeedback.light(); // Subtle haptic pulse on activation
    const shareUrl = getShareUrl();
    const hasActiveLocation = lat !== null && lng !== null;
    const shareTitle = hasActiveLocation ? `DRIFT — ${label}` : 'DRIFT — What\'s Worth Stopping At Right Now';
    const shareText = hasActiveLocation 
      ? `Check out what's worth stopping at near ${label} right now on DRIFT!` 
      : `Explore 'what's around me right now' with DRIFT!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
          setShareFallbackUrl(shareUrl);
          fallbackCopyShare(shareUrl);
        }
      }
    } else {
      setShareFallbackUrl(shareUrl);
      fallbackCopyShare(shareUrl);
    }
  };

  const fallbackCopyShare = (url: string) => {
    navigator.clipboard.writeText(url)
      .then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      })
      .catch((err) => {
        console.error('Clipboard copy failed:', err);
      });
  };

  useEffect(() => {
    // Parse deep link parameters on mount
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      const urlLat = params.get('lat');
      const urlLng = params.get('lng');
      const urlLabel = params.get('label');
      const urlRegion = params.get('region');

      if (q) {
        setSearchQuery(q);
        const token = activeTokenRef.current + 1;
        activeTokenRef.current = token;
        lastSearchQueryRef.current = q;
        setStatus('loading');
        setStatusMsg(`Finding "${q}"...`);
        setErrorKind('');
        setPlaces([]);
        geocodePlace(q)
          .then(location => {
            if (token !== activeTokenRef.current) return;
            setLat(location.lat);
            setLng(location.lng);
            setLabel(location.label);
            setRegion(location.region);
            saveRecentSearch(q, location.lat, location.lng, location.label, location.region);
            return executeOverpassQuery(location.lat, location.lng, location.label, location.region, token);
          })
          .catch(err => {
            if (token !== activeTokenRef.current) return;
            hapticFeedback.longError();
            setStatus('error');
            const kind = classifyError(err.message || 'geocode-net');
            setErrorKind(kind);
            setStatusMsg(getErrorMessage(kind));
          });
      } else if (urlLat && urlLng) {
        const parsedLat = parseFloat(urlLat);
        const parsedLng = parseFloat(urlLng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          const customLabel = urlLabel || 'Shared Location';
          const customRegion = urlRegion || 'Coordinates';
          setLat(parsedLat);
          setLng(parsedLng);
          setLabel(customLabel);
          setRegion(customRegion);
          setSearchQuery(customLabel === 'Your location' ? '' : customLabel);
          
          const token = activeTokenRef.current + 1;
          activeTokenRef.current = token;
          executeOverpassQuery(parsedLat, parsedLng, customLabel, customRegion, token);
        }
      }
    } catch (e) {
      console.warn('[DEEP LINK PARSING ERROR]', e);
    }
  }, []);

  // Check the time of day and adjust sorting behavior dynamically
  const evaluateTimeOfDay = () => {
    const now = new Date();
    const hr = now.getHours();
    setCurrentHour(String(hr).padStart(2, '0'));
    // Morning is 5:00 AM to 11:59 AM
    const morning = hr >= 5 && hr < 12;
    setIsMorning(morning);
  };

  useEffect(() => {
    evaluateTimeOfDay();
    const interval = setInterval(evaluateTimeOfDay, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!liveMode) return;

    const checkLocationAndTrigger = () => {
      if (!navigator.geolocation) return;
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const currentLat = position.coords.latitude;
          const currentLng = position.coords.longitude;
          
          const origin = liveModeOriginRef.current;
          
          if (!origin) {
            // No previous query coordinates stored yet. Set and trigger.
            setLat(currentLat);
            setLng(currentLng);
            setLabel('Your location');
            setRegion('GPS coordinates');
            const token = activeTokenRef.current + 1;
            activeTokenRef.current = token;
            await executeOverpassQuery(currentLat, currentLng, 'Your location', 'GPS coordinates', token);
            return;
          }

          const dist = calculateDistance(currentLat, currentLng, origin.lat, origin.lng);
          if (dist > 500) {
            setLat(currentLat);
            setLng(currentLng);
            setLabel('Your location');
            setRegion('GPS coordinates');
            const token = activeTokenRef.current + 1;
            activeTokenRef.current = token;
            await executeOverpassQuery(currentLat, currentLng, 'Your location', 'GPS coordinates', token);
          }
        },
        (error) => {
          console.warn('[LIVE MODE] Geolocation error:', error);
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
      );
    };

    // Run immediately when turned on
    checkLocationAndTrigger();

    // Re-check every 5 minutes (5 * 60 * 1000)
    const intervalId = setInterval(checkLocationAndTrigger, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [liveMode]);

  // Handle Search Input Geocoding
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    hapticFeedback.medium();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setStatus('error');
      setErrorKind('short-query');
      setStatusMsg('Please enter at least 2 characters.');
      return;
    }

    const token = activeTokenRef.current + 1;
    activeTokenRef.current = token;
    lastSearchQueryRef.current = query;

    setStatus('loading');
    setStatusMsg(`Finding "${query}"...`);
    setErrorKind('');
    setPlaces([]);

    try {
      const location = await geocodePlace(query);
      if (token !== activeTokenRef.current) return;
      
      setLat(location.lat);
      setLng(location.lng);
      setLabel(location.label);
      setRegion(location.region);

      saveRecentSearch(query, location.lat, location.lng, location.label, location.region);

      await executeOverpassQuery(location.lat, location.lng, location.label, location.region, token);
    } catch (err: any) {
      if (token !== activeTokenRef.current) return;
      hapticFeedback.longError();
      setStatus('error');
      const kind = classifyError(err.message || 'geocode-net');
      setErrorKind(kind);
      setStatusMsg(getErrorMessage(kind));
    }
  };

  // Handle User Geolocation Request (GPS)
  const handleGps = () => {
    hapticFeedback.medium();
    if (!navigator.geolocation) {
      setStatus('error');
      setErrorKind('gps-unsupported');
      setStatusMsg('This browser does not support GPS Geolocation. Try searching for a place name instead.');
      return;
    }

    if (!window.isSecureContext) {
      setStatus('error');
      setErrorKind('gps-insecure');
      setStatusMsg('GPS requires a secure context (HTTPS/Localhost) in Chrome on Android. Please type your location name instead.');
      return;
    }

    const token = activeTokenRef.current + 1;
    activeTokenRef.current = token;

    setStatus('loading');
    setStatusMsg('Requesting device location...');
    setErrorKind('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (token !== activeTokenRef.current) return;
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;

        setLat(currentLat);
        setLng(currentLng);
        setLabel('Your location');
        setRegion('GPS coordinates');

        await executeOverpassQuery(currentLat, currentLng, 'Your location', 'GPS coordinates', token);
      },
      (error) => {
        if (token !== activeTokenRef.current) return;
        hapticFeedback.longError();
        setStatus('error');
        setErrorKind('gps-denied');
        if (error.code === error.PERMISSION_DENIED) {
          setStatusMsg('GPS access denied. Please grant location permissions in your Android settings or browse by searching places.');
        } else {
          setStatusMsg('Could not fetch device location. Check your network or search for a location name instead.');
        }
      },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 12000 }
    );
  };

  // Perform Live Overpass queries around lat/lng
  const executeOverpassQuery = async (
    targetLat: number, 
    targetLng: number, 
    targetLabel: string, 
    targetRegion: string, 
    token: number
  ) => {
    setStatus('loading');
    setStatusMsg(`Querying OpenStreetMap near ${targetLabel}...`);
    setErrorKind('');

    try {
      const data = await fetchPlacesFromProxy(targetLat, targetLng);
      if (token !== activeTokenRef.current) return;

      const rawElements = data.elements || [];
      const normalized = normalizeOSMElements(rawElements, targetLat, targetLng);
      setPlaces(normalized);
      setDataSource(data.source || 'network');
      hapticFeedback.searchSuccess();
      liveModeOriginRef.current = { lat: targetLat, lng: targetLng };
      setStatus('idle');
      setStatusMsg('');
    } catch (err: any) {
      if (token !== activeTokenRef.current) return;
      hapticFeedback.longError();
      setPlaces([]);
      setDataSource(null);
      setStatus('error');
      const kind = classifyError(err.message || 'overpass-net');
      setErrorKind(kind);
      setStatusMsg(getErrorMessage(kind));
    }
  };

  const retryLastAction = () => {
    if (errorKind === 'city-not-found' || errorKind === 'short-query') return;
    if (lastSearchQueryRef.current) {
      setSearchQuery(lastSearchQueryRef.current);
      handleSearch(new Event('submit') as any);
    } else if (lat && lng && label) {
      const token = activeTokenRef.current + 1;
      activeTokenRef.current = token;
      executeOverpassQuery(lat, lng, label, region, token);
    }
  };

  const classifyError = (kind: string): string => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
    if (kind === 'city-not-found' || kind === 'geocode-net' || kind === 'overpass-bad') return kind;
    if (kind.startsWith('geocode-http-')) return kind;
    if (kind.startsWith('overpass-http-')) return kind;
    if (kind.startsWith('overpass')) return 'overpass-net';
    if (kind.startsWith('geocode')) return 'geocode-net';
    return 'overpass-net';
  };

  const getErrorMessage = (kind: string): string => {
    const suffix = " Or try exploring offline with the London, Lisbon, or Nakuru Demo Hubs below.";
    if (kind === 'offline') return 'You look offline. Live search needs an internet connection.' + suffix;
    if (kind === 'city-not-found') return 'No match for that place - try a more specific town or city name.' + suffix;
    if (kind === 'geocode-net') return 'Could not reach the Photon geocoder (network blocked or down).' + suffix;
    if (kind.startsWith('geocode-http-429')) return 'The geocoder is busy right now. Please wait a moment.' + suffix;
    if (kind.startsWith('geocode-http-')) return `The geocoder responded with an error (${kind.slice('geocode-http-'.length)}).` + suffix;
    if (kind.startsWith('overpass-http-429') || kind.startsWith('overpass-http-504')) return 'OpenStreetMap mirrors are busy right now. Please wait a minute.' + suffix;
    if (kind.startsWith('overpass-http-')) return `OpenStreetMap mirrors responded with an error (${kind.slice('overpass-http-'.length)}).` + suffix;
    if (kind === 'overpass-bad') return 'OpenStreetMap returned unreadable data.' + suffix;
    return 'Could not connect to OpenStreetMap (network blocked or down).' + suffix;
  };

  // Get active filtered visible places
  const getVisiblePlaces = () => {
    const inCat = places.filter(place => place.cats.includes(currentTab));
    let filtered = inCat.filter(place => place.distance <= radius);
    const inRangeCount = filtered.length;

    if (openOnly) {
      filtered = filtered.filter(place => parseHours(place.tags.opening_hours).state === 'open');
    }

    // Get rid of unnamed spots unless they are the only ones that would appear
    const hasNamedSpots = filtered.some(place => place.named);
    if (hasNamedSpots) {
      filtered = filtered.filter(place => place.named);
    }

    // Morning Time-Aware Sorting: cafe/bakery floats to top of Food tab
    if (currentTab === 'food' && isMorning) {
      const isMorningSpot = (place: Place) => {
        const amenity = String(place.tags.amenity || '').toLowerCase();
        const shop = String(place.tags.shop || '').toLowerCase();
        return amenity === 'cafe' || amenity === 'bakery' || shop === 'bakery';
      };

      filtered = [...filtered].sort((a, b) => {
        const aMorning = isMorningSpot(a);
        const bMorning = isMorningSpot(b);
        if (aMorning !== bMorning) return aMorning ? -1 : 1;
        
        // Secondary sort within categories retains our distance-based rank
        const RANK_BAND = 125;
        const bandA = Math.floor(a.distance / RANK_BAND);
        const bandB = Math.floor(b.distance / RANK_BAND);
        if (bandA !== bandB) return bandA - bandB;
        if (a.named !== b.named) return a.named ? -1 : 1;
        return a.distance - b.distance;
      });

      // Mark morning spots
      filtered.forEach(place => {
        place._morning = isMorningSpot(place);
      });
    } else {
      filtered.forEach(place => {
        place._morning = false;
      });
    }

    // Thumbs-DOWN places sink to the bottom of the visible list (stable sort so the distance ranking is preserved within each group)
    const voteOf = (p: Place) => getFeedback(p.osmType, p.osmId)?.vote ?? null;
    const ranked = [...filtered].sort(
      (a, b) => Number(voteOf(a) === "down") - Number(voteOf(b) === "down")
    );

    return {
      list: ranked,
      shown: ranked.slice(0, 24), // Cap at 24 for DOM speed
      inCatCount: inCat.length,
      inRangeCount
    };
  };

  const { list: visibleList, shown: visibleShown, inCatCount, inRangeCount } = getVisiblePlaces();
  const activeCategory = CATEGORIES.find(c => c.id === currentTab)!;

  const hasLocation = lat !== null && lng !== null;
  const loading = status === 'loading';
  const error = status === 'error';

  return (
    <div className="relative min-h-screen flex flex-col justify-start items-center overflow-hidden px-4 pt-[env(safe-area-inset-top,18px)] pb-[env(safe-area-inset-bottom,40px)] bg-gradient-to-b from-[#090a10] to-[#10111a] text-white">
      {/* v3 signature: blurred radial glow behind the header in the active category color */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-120px] left-1/2 -translate-x-1/2 w-[420px] max-w-[92vw] h-[300px] rounded-full blur-[70px] z-0 transition-colors duration-500"
        style={{ background: `radial-gradient(circle, ${activeCategory.color}55, transparent 70%)` }}
      />

      <div className="relative z-10 w-full max-w-[520px] md:max-w-4xl lg:max-w-6xl flex flex-col transition-all duration-300">
        {/* Header */}
        <header className="relative text-center mt-1.5 mb-4" role="banner">
          {/* Help / Guide button */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              type="button"
              id="help-trigger-btn"
              onClick={() => {
                hapticFeedback.light();
                setOnboardingStep(1);
                setShowOnboarding(true);
              }}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-[#25293a] bg-[#11131f]/60 hover:bg-[#11131f] text-[#b7bdd5] hover:text-white transition-all cursor-pointer hover:border-[#ff4522]/50 active:scale-95"
              title="View onboarding guide"
              aria-label="Open onboarding interactive guide"
            >
              <HelpCircle className="w-4 h-4 text-[#ff4522]" />
            </button>
          </div>

          {/* Core Brand Lockup (Option 1a + Option 1d combined) */}
          <div className="flex flex-col items-center justify-center">
            <div className="inline-flex items-center gap-2.5 justify-center select-none">
              {/* 1a Brand Mark: Skid Tile — a map tile slipping its grid */}
              <svg viewBox="0 0 512 512" className="w-9 h-9 shrink-0" role="img" aria-label="DRIFT">
                <rect x="118" y="118" width="180" height="180" rx="36" fill="none" stroke="#3a4160" strokeWidth="26" />
                <path d="M160 340c50 4 74-14 106-46" fill="none" stroke="#2ec4b6" strokeWidth="24" strokeLinecap="round" opacity="0.45" />
                <path d="M196 376c58 2 88-22 122-60" fill="none" stroke="#2ec4b6" strokeWidth="24" strokeLinecap="round" />
                <rect x="288" y="266" width="116" height="116" rx="26" fill="#ff4522" />
              </svg>

              {/* 1d Wordmark: "DRIFT" with orange "I" acting as 'you are here' indicator */}
              <h1 className="text-3xl font-black font-sans tracking-tight leading-none text-white select-none">
                DR<span className="text-[#FF4522] relative inline-block">I<span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#FF4522] rounded-full animate-ping" /></span>FT
              </h1>
            </div>

            {/* Tagline */}
            <p className="font-mono text-[10px] text-[#7e84a3] mt-1.5 tracking-wider uppercase font-medium flex items-center gap-1.5">
              <span>Live where you land.</span>
              <span className="text-[#25293a]">•</span>
              <span className="text-[#ff4522] lowercase normal-case">
                {isMorning ? `morning drift` : `night drift`}
              </span>
            </p>

            {/* Subtitle — honest, plain-language description */}
            <p className="text-xs text-[#9ca3c6] mt-1">What's open, near, and now — live from OpenStreetMap.</p>
          </div>

          {/* Share Deep Link button */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1.5 sm:gap-2">
            {/* drift points — off-chain, device-local score */}
            <div
              className="inline-flex items-center gap-1 rounded-full border border-[#25293a] bg-[#11131f]/60 px-2.5 h-9 select-none"
              title={`${drift.balance} drift earned on this device${drift.streak > 0 ? ` · ${drift.streak}-day streak` : ''} — local only, not a token`}
              aria-label={`${drift.balance} drift points earned`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-[#ff4522]" aria-hidden="true" />
              <span className="font-mono text-[12px] font-bold text-white tabular-nums">{drift.balance}</span>
              {drift.streak > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#ff9f1c] ml-0.5">
                  <Flame className="w-3 h-3" />
                  {drift.streak}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-[#25293a] bg-[#11131f]/60 hover:bg-[#11131f] text-[#b7bdd5] hover:text-white transition-all cursor-pointer hover:border-[#ff4522]/50 active:scale-95"
              title="Share current location"
              aria-label="Share current location deep link"
            >
              <Share2 className="w-4 h-4 text-[#ff4522]" />
            </button>
          </div>
        </header>

        {/* Search Panel */}
        <section aria-label="Search and GPS controls" className="mb-4">
          <form onSubmit={handleSearch} className="grid grid-cols-[1fr_auto] gap-2" autoComplete="off">
            <input 
              type="search"
              placeholder="Search city — Porto, Melbourne, Chicago..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
              className="min-h-[48px] px-4 py-2 bg-[#090a10] border border-[#25293a] rounded-xl outline-none focus:border-[#ff4522] transition-colors text-white font-sans text-sm font-medium w-full"
              aria-label="Location search"
            />
            <button 
              type="submit"
              disabled={loading}
              className="min-h-[48px] inline-flex items-center justify-center gap-1.5 px-5 bg-[#ff4522] hover:bg-[#ff5c3d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-sans font-bold rounded-xl transition-all border-0 cursor-pointer active:scale-95"
              aria-label="Search location"
            >
              <Search className="w-4.5 h-4.5" />
              <span>Go</span>
            </button>
          </form>

          {/* Recent Searches and GPS controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {recentSearches.length > 0 && (
                <>
                  <span className="font-mono text-[9px] text-[#5b6075] uppercase tracking-wider font-extrabold mr-0.5">Recents</span>
                  {recentSearches.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleRecentClick(item)}
                      disabled={loading}
                      className="min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#25293a] bg-[#11131f]/40 text-[#b7bdd5] hover:border-[#ff4522]/50 hover:text-white transition-all text-[11px] font-sans font-semibold cursor-pointer active:scale-95 disabled:opacity-50"
                      title={`Drift back to ${item.label}`}
                    >
                      <Compass className="w-3 h-3 text-[#ff4522]/70" />
                      <span>{item.query}</span>
                    </button>
                  ))}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={runConnectionTest}
                className="min-h-[36px] inline-flex items-center gap-2 px-4 py-1.5 border border-[#25293a] rounded-full bg-[#11131f] text-[#b7bdd5] hover:text-white hover:border-[#ff4522]/50 transition-all text-xs font-mono cursor-pointer active:scale-95"
                title="Test reachability of Overpass API mirrors"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Test Connection</span>
              </button>

              <button 
                type="button" 
                id="gps-btn"
                onClick={handleGps}
                disabled={loading}
                className={`min-h-[36px] inline-flex items-center gap-2 px-4 py-1.5 border rounded-full bg-[#11131f] text-[#b7bdd5] hover:text-white transition-all text-xs font-mono disabled:opacity-50 disabled:cursor-wait cursor-pointer active:scale-95 ${
                  showOnboarding && onboardingStep === 3 
                    ? 'relative z-[120] border-[#ff4522] ring-4 ring-[#ff4522] shadow-[0_0_30px_rgba(255,69,34,0.6)] scale-110' 
                    : 'border-[#25293a] hover:border-[#ff4522]'
                }`}
                aria-label="Use current location via GPS"
              >
                <Navigation className="w-3.5 h-3.5 text-[#ff4522]" />
                <span>Use GPS</span>
              </button>
            </div>
          </div>
        </section>

        {/* Share Link Persistent Fallback Panel */}
        {shareFallbackUrl && (
          <div 
            className="w-full mb-4 p-4 rounded-xl border border-[#25293a] bg-[#11131f]/90 text-white flex flex-col gap-3 shadow-2xl animate-fadeIn backdrop-blur-sm"
            role="dialog"
            aria-label="Share Location Link"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#ff4522]" />
                <span className="font-sans font-bold text-xs tracking-tight text-[#b7bdd5]">Copy Share Link</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setShareFallbackUrl(null);
                }}
                className="text-[#7e84a3] hover:text-white font-mono text-[11px] font-bold cursor-pointer transition-colors px-1.5 py-0.5 hover:bg-[#25293a]/40 rounded"
                aria-label="Dismiss share panel"
              >
                Dismiss
              </button>
            </div>
            <div className="flex items-center gap-2 bg-[#090a10] border border-[#25293a] rounded-lg p-1.5 overflow-hidden">
              <input 
                type="text" 
                readOnly 
                value={shareFallbackUrl}
                className="bg-transparent text-[#b7bdd5] text-[11px] font-mono outline-none flex-1 truncate select-all px-1"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  fallbackCopyShare(shareFallbackUrl);
                }}
                className="px-3.5 py-1.5 bg-[#ff4522] hover:bg-[#ff5c3d] text-white font-sans font-bold text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer active:scale-95"
              >
                {shareCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}

        {/* Categories Tab Bar */}
        <nav 
          id="categories-nav"
          role="navigation" 
          aria-label="Explore Categories"
          className={`mb-4 transition-all duration-300 ${
            showOnboarding && onboardingStep === 1 
              ? 'relative z-[120] ring-4 ring-[#ff4522] shadow-[0_0_30px_rgba(255,69,34,0.6)] bg-[#10111a] p-1.5 rounded-2xl scale-[1.02]' 
              : ''
          }`}
        >
          <div className="grid grid-cols-4 gap-1.5" role="tablist">
            {CATEGORIES.map((cat) => {
              const selected = currentTab === cat.id;
              return (
                <button
                  key={cat.id}
                  role="tab"
                  id={`tab-${cat.id}`}
                  aria-selected={selected}
                  aria-controls="results-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => {
                    hapticFeedback.light();
                    setCurrentTab(cat.id);
                  }}
                  className={`min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-full border text-[11.5px] font-mono font-extrabold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                    selected 
                      ? 'border-transparent text-[#090A10] font-black' 
                      : 'border-[#25293a] bg-transparent text-[#7e84a3] hover:text-white hover:border-[#5b6075]'
                  } ${cat.outline}`}
                  style={{ backgroundColor: selected ? cat.color : 'transparent' }}
                >
                  {(() => {
                    const IconComponent = cat.icon;
                    return (
                      <IconComponent 
                        className={`w-4 h-4 transition-transform duration-300 ${
                          selected ? 'scale-110' : 'opacity-60'
                        }`} 
                        aria-hidden="true"
                      />
                    );
                  })()}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Range and filters */}
        <section 
          id="filters-range-section"
          aria-label="Filters" 
          className={`mb-4 transition-all duration-300 ${
            showOnboarding && onboardingStep === 2 
              ? 'relative z-[120] ring-4 ring-[#ff4522] shadow-[0_0_30px_rgba(255,69,34,0.6)] bg-[#10111a] p-2.5 rounded-2xl scale-[1.02]' 
              : ''
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-[#5b6075] uppercase tracking-wider font-bold">Range</span>
            {[800, 2000, 4000].map((r) => {
              const active = radius === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    hapticFeedback.light();
                    setRadius(r);
                  }}
                  className={`min-h-[48px] px-3.5 rounded-full border text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    active 
                      ? 'border-accent bg-[#11131f] text-accent' 
                      : 'border-[#25293a] bg-[#11131f] text-[#b7bdd5] hover:border-accent hover:text-white'
                  }`}
                >
                  {formatDistance(r)}
                </button>
              );
            })}

            <div className="flex items-center gap-2 flex-wrap ml-auto">
              {/* Open now toggle */}
              <button
                type="button"
                aria-pressed={openOnly}
                onClick={() => {
                  hapticFeedback.light();
                  setOpenOnly(!openOnly);
                }}
                className={`min-h-[48px] inline-flex items-center gap-1.5 px-3.5 rounded-full border text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  openOnly 
                    ? 'border-[#1f8a4c] bg-[#0c2015] text-[#4cc47e]' 
                    : 'border-[#25293a] bg-[#11131f] text-[#b7bdd5] hover:border-[#1f8a4c] hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${openOnly ? 'bg-[#4cc47e]' : 'bg-neutral-600'}`} aria-hidden="true" />
                Open now
              </button>

              {/* Live Mode toggle with interactive tooltip */}
              <div className="relative group/live inline-block">
                <button
                  type="button"
                  aria-pressed={liveMode}
                  onClick={() => {
                    hapticFeedback.light();
                    setLiveMode(!liveMode);
                  }}
                  className={`min-h-[48px] inline-flex items-center gap-1.5 px-3.5 rounded-full border text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    liveMode 
                      ? 'border-[#e71d36] bg-[#271015] text-[#ff5c6a]' 
                      : 'border-[#25293a] bg-[#11131f] text-[#b7bdd5] hover:border-[#e71d36] hover:text-white'
                  }`}
                >
                  <Radio className={`w-3.5 h-3.5 ${liveMode ? 'animate-pulse text-[#ff5c6a]' : 'text-[#7e84a3]'}`} />
                  <span>Live Mode</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="More information about Live Mode"
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticFeedback.light();
                      setShowLiveTooltip(!showLiveTooltip);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        setShowLiveTooltip(!showLiveTooltip);
                      }
                    }}
                    className="ml-1 p-0.5 rounded-full hover:bg-white/10 transition-colors inline-flex items-center justify-center cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-[#7e84a3] group-hover/live:text-white transition-colors" />
                  </span>
                </button>

                {/* Live Mode Explanation Tooltip */}
                <div 
                  className={`absolute bottom-full right-0 z-50 mb-3 w-64 rounded-2xl border border-[#2d314d] bg-[#161824] p-3.5 shadow-2xl transition-all duration-300 origin-bottom-right pointer-events-none opacity-0 scale-95 group-hover/live:opacity-100 group-hover/live:scale-100 group-hover/live:pointer-events-auto ${
                    showLiveTooltip ? 'opacity-100 scale-100 pointer-events-auto' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5 text-white font-sans font-bold text-[12px]">
                    <Radio className="w-3.5 h-3.5 text-[#ff5c6a]" />
                    <span>How Live Mode works</span>
                  </div>
                  <p className="font-sans text-[11px] leading-relaxed text-[#a3a9c2]">
                    As you move or travel, the app automatically runs live, real-time queries against OpenStreetMap to fetch high-energy thrill venues or chill spots within 4km of your new coordinates.
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-[#25293a] flex items-center justify-between text-[10px] font-mono text-[#5b6075]">
                    <span>Triggers on 500m+ shift</span>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLiveTooltip(false);
                      }}
                      className="text-[#ff5c6a] hover:underline cursor-pointer"
                    >
                      Got it
                    </button>
                  </div>
                  {/* Tooltip pointer arrow */}
                  <div className="absolute top-full right-5 h-2.5 w-2.5 -translate-y-1.5 rotate-45 border-r border-b border-[#2d314d] bg-[#161824]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Selected Location Metadata Bar */}
        {hasLocation && (
          <section 
            className="flex flex-wrap items-center gap-2.5 py-2.5 px-3 mb-3 border border-[#25293a] rounded-xl bg-[#11131f]/70 font-sans"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <MapPin className="w-4 h-4 text-accent" />
              <span className="font-bold text-sm text-white">{label}</span>
              {region && <span className="text-xs text-[#5b6075] font-medium">— {region}</span>}
            </div>
            
            {dataSource && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border select-none ${
                dataSource === 'network'
                  ? 'bg-[#0c2015] border-[#1f8a4c]/50 text-[#4cc47e]'
                  : dataSource === 'cache'
                  ? 'bg-[#181127] border-[#4e1f8a]/50 text-[#a17eff]'
                  : dataSource === 'demo'
                  ? 'bg-[#ff4522]/10 border-[#ff4522]/50 text-[#ff4522]'
                  : 'bg-[#271015] border-[#8a1f2f]/50 text-[#ff5c6a]'
              }`}>
                <span className={`w-1 h-1 rounded-full animate-pulse ${
                  dataSource === 'network' ? 'bg-[#4cc47e]' : dataSource === 'cache' ? 'bg-[#a17eff]' : dataSource === 'demo' ? 'bg-[#ff4522]' : 'bg-[#ff5c6a]'
                }`} />
                {dataSource === 'network' ? 'Live' : dataSource === 'cache' ? 'Cached' : dataSource === 'demo' ? 'Demo' : 'Fallback'}
              </span>
            )}

            {liveMode && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border select-none bg-[#271015] border-[#e71d36]/50 text-[#ff5c6a]">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                Auto-Drift
              </span>
            )}

            <span className="font-mono text-[10px] text-[#7e84a3] ml-auto">{places.length} spots found</span>
          </section>
        )}

        {/* Map Interface */}
        {hasLocation && (
          <section className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-mono font-extrabold uppercase tracking-wider text-[#5b6075] flex items-center gap-1.5">
                <Map className="w-3.5 h-3.5 text-accent" />
                <span>Spatial Radar Map</span>
              </h2>
              <button
                id="toggle-map-button"
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setIsMapCollapsed(!isMapCollapsed);
                }}
                className="min-h-[32px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-[#25293a] bg-[#11131f] hover:bg-[#1b1d2a] hover:border-accent text-[10px] font-mono font-bold uppercase tracking-wider text-[#b7bdd5] hover:text-white transition-all cursor-pointer active:scale-95"
                aria-expanded={!isMapCollapsed}
                aria-label={isMapCollapsed ? 'Expand spatial radar map' : 'Collapse spatial radar map'}
                title={isMapCollapsed ? 'Expand spatial radar map' : 'Collapse spatial radar map'}
              >
                {isMapCollapsed ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-[#4cc47e]" />
                    <span>Show Map</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-[#ff4522]" />
                    <span>Collapse Map</span>
                  </>
                )}
              </button>
            </div>

            {dataSource === 'demo' && (
              <div className="mb-2.5 px-3 py-2 bg-[#ff4522]/10 border border-[#ff4522]/30 rounded-lg text-[11px] font-mono text-[#ff4522] flex items-center gap-1.5 leading-normal">
                <Compass className="w-3.5 h-3.5 animate-spin" />
                <span><strong>Demo Hub Mode:</strong> Offline fixture data. Approximate positions. No real-time GPS queries active.</span>
              </div>
            )}

            {dataSource === 'fallback' && (
              <div className="mb-2.5 px-3 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] font-mono text-amber-500 flex flex-col gap-2 leading-normal">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                  <span><strong>Circuit Breaker Engaged:</strong> Overpass API mirrors timed out or failed. Served safe, pre-loaded local fallback spots near this coordinate so the map is functional.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={runConnectionTest}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold uppercase tracking-wider text-[9px] rounded transition-all active:scale-95 cursor-pointer"
                  >
                    Diagnose Connection
                  </button>
                  <span className="text-[9px] text-amber-600">The server will retry live queries once mirrors are online.</span>
                </div>
              </div>
            )}
            
            <div 
              className="grid transition-all duration-500 ease-in-out origin-top overflow-hidden"
              style={{
                gridTemplateRows: isMapCollapsed ? '0fr' : '1fr',
                opacity: isMapCollapsed ? 0 : 1,
                transform: isMapCollapsed ? 'scale(0.98)' : 'scale(1)',
                marginTop: isMapCollapsed ? '0px' : '8px'
              }}
            >
              <div className="overflow-hidden min-h-0">
                <DriftMap 
                  lat={lat} 
                  lng={lng} 
                  radius={radius} 
                  places={visibleShown} 
                  accentColor={activeCategory.color}
                  isCollapsed={isMapCollapsed}
                />
              </div>
            </div>
          </section>
        )}



        {/* Status Notification Strip */}
        {error && (
          <div 
            className="w-full mb-4 p-4 rounded-xl border border-[#5c1823] bg-[#2d1015] text-[#ff5c6a] font-sans flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-[#ff5c6a] shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold font-mono tracking-tight text-white uppercase flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Connection & Mirror Error</span>
                </span>
                <span className="text-xs text-[#ff969f] leading-normal">{statusMsg}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={runConnectionTest}
                className="px-3 py-1.5 bg-[#40161d] hover:bg-[#521b24] text-[#ff969f] border border-[#ff5c6a]/30 rounded-lg text-[11px] font-mono font-bold transition-all active:scale-95 cursor-pointer"
              >
                Test Connection
              </button>
              <button
                type="button"
                onClick={retryLastAction}
                className="px-3 py-1.5 bg-[#ff4522] hover:bg-[#ff5c3d] text-white rounded-lg text-[11px] font-sans font-bold transition-all active:scale-95 cursor-pointer"
              >
                Retry Query
              </button>
            </div>
          </div>
        )}

        {/* Core Results Feed Panel */}
        <section 
          id="results-panel" 
          className="flex flex-col"
          role="tabpanel"
          aria-labelledby={`tab-${currentTab}`}
          aria-live="polite"
        >
          {/* Skeleton Loading State */}
          {loading && (
            <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 mb-3.5 px-1.5 font-mono text-xs text-[#ffbd4a] col-span-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffbd4a] animate-ping" />
                <span>{statusMsg}</span>
              </div>
              <PlaceCardSkeleton borderClass={activeCategory.border} />
              <PlaceCardSkeleton borderClass={activeCategory.border} />
              <PlaceCardSkeleton borderClass={activeCategory.border} />
            </div>
          )}

          {hasLocation && !loading && !error && (
            <p className="font-mono text-[11px] text-[#7e84a3] mb-3 leading-relaxed">
              Showing {visibleShown.length} of {visibleList.length} {activeCategory.label} spots within {formatDistance(radius)}
              {openOnly && ' (filtered to open now)'}
              {currentTab === 'food' && isMorning && ' — morning picks first'}
            </p>
          )}

          {/* Empty state messages */}
          {!hasLocation && !loading && !error && (
            <div className="border border-[#25293a] rounded-xl bg-[#11131f]/60 text-[#b7bdd5] py-8 px-4 text-center overflow-hidden relative">
              <style>{`
                @keyframes marquee {
                  0% { transform: translateX(0%); }
                  100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                  animation: marquee 28s linear infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                  .animate-marquee {
                    animation-play-state: paused;
                  }
                }
              `}</style>
              
              {/* Landmark Silhouettes Animated Strip */}
              <div 
                className="relative w-full h-[48px] overflow-hidden mb-4 select-none pointer-events-none text-[#25293a]"
                style={{
                  WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
                  maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'
                }}
              >
                <div className="flex w-[200%] h-full animate-marquee">
                  <div className="flex justify-around items-end w-1/2 h-full px-4">
                    {/* Giza Pyramids */}
                    <svg className="w-14 h-12 text-current" viewBox="0 0 56 48" fill="currentColor">
                      <path d="M 12 48 L 38 12 L 56 48 Z" opacity="0.65" />
                      <path d="M 0 48 L 20 22 L 40 48 Z" />
                    </svg>
                    
                    {/* Eiffel Tower */}
                    <svg className="w-8 h-12 text-current" viewBox="0 0 32 48" fill="currentColor">
                      <path d="M 4 48 C 8 40, 10 32, 11 32 L 12 28 L 13 16 L 13 14 L 15 14 L 15 0 L 17 0 L 17 14 L 19 14 L 19 16 L 20 28 L 21 32 C 22 32, 24 40, 28 48 L 21 48 C 19 42, 18 36, 16 36 C 14 36, 13 42, 11 48 Z" />
                    </svg>
                    
                    {/* Tower Bridge */}
                    <svg className="w-16 h-12 text-current" viewBox="0 0 64 48" fill="currentColor">
                      <rect x="12" y="12" width="10" height="36" />
                      <polygon points="12,12 17,4 22,12" />
                      <rect x="42" y="12" width="10" height="36" />
                      <polygon points="42,12 47,4 52,12" />
                      <rect x="22" y="18" width="20" height="3" />
                      <rect x="0" y="38" width="64" height="3" />
                    </svg>
                    
                    {/* Big Ben */}
                    <svg className="w-6 h-12 text-current" viewBox="0 0 24 48" fill="currentColor">
                      <rect x="8" y="18" width="8" height="30" />
                      <rect x="7" y="12" width="10" height="6" />
                      <polygon points="7,12 12,2 17,12" />
                      <rect x="11.5" y="0" width="1" height="2" />
                    </svg>
                    
                    {/* Taj-style Dome */}
                    <svg className="w-10 h-12 text-current" viewBox="0 0 40 48" fill="currentColor">
                      <rect x="10" y="36" width="20" height="12" />
                      <path d="M 10 36 C 7 36, 6 30, 7 24 C 9 14, 18 11, 20 4 C 22 11, 31 14, 33 24 C 34 30, 33 36, 30 36 Z" />
                      <rect x="19.5" y="0" width="1" height="4" />
                    </svg>
                    
                    {/* Arc de Triomphe */}
                    <svg className="w-10 h-12 text-current" viewBox="0 0 40 48" fill="currentColor">
                      <path d="M 6 48 L 6 14 L 34 14 L 34 48 L 26 48 L 26 32 C 26 26, 14 26, 14 32 L 14 48 Z" />
                      <rect x="4" y="10" width="32" height="4" />
                    </svg>
                    
                    {/* Space Needle */}
                    <svg className="w-7 h-12 text-current" viewBox="0 0 28 48" fill="currentColor">
                      <path d="M 9 48 L 13 12 L 15 12 L 19 48 L 17 48 L 14.5 16 L 11 48 Z" />
                      <ellipse cx="14" cy="13" rx="8" ry="2" />
                      <polygon points="11,12 14,8 17,12" />
                      <rect x="13.5" y="0" width="1" height="8" />
                    </svg>
                  </div>
                  <div className="flex justify-around items-end w-1/2 h-full px-4" aria-hidden="true">
                    {/* Duplicate Giza Pyramids */}
                    <svg className="w-14 h-12 text-current" viewBox="0 0 56 48" fill="currentColor">
                      <path d="M 12 48 L 38 12 L 56 48 Z" opacity="0.65" />
                      <path d="M 0 48 L 20 22 L 40 48 Z" />
                    </svg>
                    
                    {/* Duplicate Eiffel Tower */}
                    <svg className="w-8 h-12 text-current" viewBox="0 0 32 48" fill="currentColor">
                      <path d="M 4 48 C 8 40, 10 32, 11 32 L 12 28 L 13 16 L 13 14 L 15 14 L 15 0 L 17 0 L 17 14 L 19 14 L 19 16 L 20 28 L 21 32 C 22 32, 24 40, 28 48 L 21 48 C 19 42, 18 36, 16 36 C 14 36, 13 42, 11 48 Z" />
                    </svg>
                    
                    {/* Duplicate Tower Bridge */}
                    <svg className="w-16 h-12 text-current" viewBox="0 0 64 48" fill="currentColor">
                      <rect x="12" y="12" width="10" height="36" />
                      <polygon points="12,12 17,4 22,12" />
                      <rect x="42" y="12" width="10" height="36" />
                      <polygon points="42,12 47,4 52,12" />
                      <rect x="22" y="18" width="20" height="3" />
                      <rect x="0" y="38" width="64" height="3" />
                    </svg>
                    
                    {/* Duplicate Big Ben */}
                    <svg className="w-6 h-12 text-current" viewBox="0 0 24 48" fill="currentColor">
                      <rect x="8" y="18" width="8" height="30" />
                      <rect x="7" y="12" width="10" height="6" />
                      <polygon points="7,12 12,2 17,12" />
                      <rect x="11.5" y="0" width="1" height="2" />
                    </svg>
                    
                    {/* Duplicate Taj-style Dome */}
                    <svg className="w-10 h-12 text-current" viewBox="0 0 40 48" fill="currentColor">
                      <rect x="10" y="36" width="20" height="12" />
                      <path d="M 10 36 C 7 36, 6 30, 7 24 C 9 14, 18 11, 20 4 C 22 11, 31 14, 33 24 C 34 30, 33 36, 30 36 Z" />
                      <rect x="19.5" y="0" width="1" height="4" />
                    </svg>
                    
                    {/* Duplicate Arc de Triomphe */}
                    <svg className="w-10 h-12 text-current" viewBox="0 0 40 48" fill="currentColor">
                      <path d="M 6 48 L 6 14 L 34 14 L 34 48 L 26 48 L 26 32 C 26 26, 14 26, 14 32 L 14 48 Z" />
                      <rect x="4" y="10" width="32" height="4" />
                    </svg>
                    
                    {/* Duplicate Space Needle */}
                    <svg className="w-7 h-12 text-current" viewBox="0 0 28 48" fill="currentColor">
                      <path d="M 9 48 L 13 12 L 15 12 L 19 48 L 17 48 L 14.5 16 L 11 48 Z" />
                      <ellipse cx="14" cy="13" rx="8" ry="2" />
                      <polygon points="11,12 14,8 17,12" />
                      <rect x="13.5" y="0" width="1" height="8" />
                    </svg>
                  </div>
                </div>
              </div>

              <h2 className="font-bold text-[0.95rem] leading-tight mb-1 text-white">Your coordinates are clear</h2>
              <p className="text-[0.78rem] text-[#7e84a3] max-w-[340px] mx-auto">
                Search a place or hit GPS to start drifting.
              </p>
            </div>
          )}

          {hasLocation && !loading && !error && visibleShown.length === 0 && (
            <div className="border border-[#25293a] rounded-xl bg-[#11131f]/60 text-[#b7bdd5] py-8 px-4 text-center font-sans shadow-lg">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#11131f] border border-[#25293a] mb-3">
                <ShieldAlert className="w-6 h-6 text-amber-500/80 stroke-[1.5]" />
              </div>
              
              <div className="mb-3.5">
                <span className="font-mono text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  Network Online • Query Succeeded
                </span>
              </div>

              {currentTab === 'thrill' ? (
                <>
                  <p className="text-sm font-bold text-white mb-1">No thrill spots nearby</p>
                  <p className="text-xs text-[#7e84a3] max-w-[340px] mx-auto leading-relaxed">
                    No strip clubs, brothels, casinos, massage parlours, adult/sex shops, coffeeshops, or cannabis shops mapped nearby - a sparse-data gap, not a guarantee.
                  </p>
                </>
              ) : currentTab === 'dilate' ? (
                <>
                  <p className="text-sm font-bold text-white mb-1">No dilate spots nearby</p>
                  <p className="text-xs text-[#7e84a3] max-w-[340px] mx-auto leading-relaxed">
                    No pubs, bars, or nightclubs mapped nearby - a sparse-data gap, not a guarantee.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-white mb-1">
                    {places.length === 0 
                      ? 'No OSM results at this coordinate' 
                      : `No ${activeCategory.label} spots in range`}
                  </p>
                  <p className="text-xs text-[#7e84a3] max-w-[340px] mx-auto leading-relaxed">
                    {places.length === 0 
                      ? 'The query completed successfully, but this location currently has an OpenStreetMap coverage gap. Try a different coordinates cluster.'
                      : inRangeCount === 0
                        ? `We found ${inCatCount} ${activeCategory.label} spots further away. Try widening your range filter.`
                        : 'Nothing is verified open right now here. Try turning off the "Open now" toggle.'}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Cards List */}
          {hasLocation && !loading && !error && visibleShown.length > 0 && (
            <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleShown.map((place, index) => (
                <div
                  key={`${place.key}-${feedbackUpdateTrigger}`}
                  className="animate-stagger-fade"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <PlaceCard
                    place={place}
                    userLat={lat!}
                    userLng={lng!}
                    accentColor={activeCategory.color}
                    vibe={currentTab}
                    onChange={handleFeedbackChange}
                    onEarned={handleDriftEarned}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-[#25293a] text-center font-mono text-[10px] text-[#60657b] leading-relaxed">
          Geocoding via Photon — places fetched from OpenStreetMap Overpass — hours parsed from OSM tags (treat as unverified).<br />
          Suitability feedback and comments are fully private and saved on this device only. Map data &copy;{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-[#9ca3c6] hover:underline">
            OpenStreetMap contributors
          </a>{' '}
          — tiles &copy;{' '}
          <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer" className="text-[#9ca3c6] hover:underline">
            CARTO
          </a>
        </footer>
      </div>

      {/* Micro-toast for share copy confirmation */}
      {shareCopied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 bg-[#181127] border border-[#a17eff] text-[#d4c5ff] text-xs font-mono font-bold rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a17eff] animate-pulse" />
          <span>Link copied to clipboard!</span>
        </div>
      )}

      {/* Interactive Onboarding Guide */}
      {showOnboarding && (
        <div 
          id="onboarding-overlay" 
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[110] transition-opacity duration-300 flex flex-col justify-end sm:justify-center items-center p-4"
        >
          <div 
            id="onboarding-card"
            className="w-full max-w-[420px] bg-[#11131f] border-2 border-[#ff4522]/30 rounded-2xl p-5 shadow-[0_0_50px_rgba(255,69,34,0.15)] flex flex-col gap-4 relative z-[130] animate-fadeIn mb-4 sm:mb-0"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] bg-[#ff4522]/10 border border-[#ff4522]/30 text-[#ff4522] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                Drift Guide • Step {onboardingStep} of 3
              </span>
              <button
                type="button"
                id="onboarding-skip-btn"
                onClick={() => {
                  hapticFeedback.light();
                  setShowOnboarding(false);
                  localStorage.setItem('drift_onboarded', 'true');
                }}
                className="text-[#7e84a3] hover:text-white font-mono text-xs font-bold transition-colors cursor-pointer"
              >
                Skip
              </button>
            </div>

            {onboardingStep === 1 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="font-sans font-bold text-lg text-white">1. Select Your Vibe</h3>
                <p className="text-sm text-[#b7bdd5] leading-relaxed">
                  Toggle between <strong className="text-white">Food</strong>, <strong className="text-white">Chill</strong>, <strong className="text-white">Dilate</strong>, and <strong className="text-white">Thrill</strong> to filter local spots. The sorting dynamically adapts depending on morning or evening hours!
                </p>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="font-sans font-bold text-lg text-white">2. Set Your Boundaries</h3>
                <p className="text-sm text-[#b7bdd5] leading-relaxed">
                  Choose a range limit from <strong className="text-white">800m</strong> to <strong className="text-white">4km</strong>. Narrow it down to stay close, or expand it to uncover distant hidden gems.
                </p>
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-sans font-bold text-lg text-white">3. GPS & Real-Time Compass</h3>
                  <p className="text-sm text-[#b7bdd5] leading-relaxed">
                    Tap <strong className="text-white">Use GPS</strong> to center spots around you. Follow the real-time smoothed compass needle to face each location, and use the thumbs-down suitability feedback to flag unsuitable spots!
                  </p>
                </div>
              </div>
            )}

            {/* Pagination dots */}
            <div className="flex justify-center gap-1.5 my-1">
              {[1, 2, 3].map((s) => (
                <span 
                  key={s} 
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    onboardingStep === s ? 'bg-[#ff4522] w-5' : 'bg-[#25293a]'
                  }`} 
                />
              ))}
            </div>

            {/* Button Actions */}
            <div className="flex items-center justify-between gap-3 mt-1 pt-1.5 border-t border-[#25293a]/50">
              {onboardingStep > 1 ? (
                <button
                  type="button"
                  id="onboarding-prev-btn"
                  onClick={() => {
                    hapticFeedback.light();
                    setOnboardingStep(prev => prev - 1);
                  }}
                  className="px-4 py-2 bg-transparent hover:bg-[#25293a]/30 text-[#b7bdd5] hover:text-white font-sans font-bold text-xs rounded-xl transition-all cursor-pointer border border-[#25293a]"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                id="onboarding-next-btn"
                onClick={() => {
                  hapticFeedback.light();
                  if (onboardingStep < 3) {
                    setOnboardingStep(prev => prev + 1);
                  } else {
                    setShowOnboarding(false);
                    localStorage.setItem('drift_onboarded', 'true');
                  }
                }}
                className="px-5 py-2.5 bg-[#ff4522] hover:bg-[#ff5c3d] text-white font-sans font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95"
              >
                {onboardingStep === 3 ? 'Get Drifting!' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overpass Connection Diagnostician Modal */}
      {showTestModal && (
        <div 
          id="connection-test-overlay" 
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
        >
          <div 
            id="connection-test-card"
            className="w-full max-w-lg bg-[#0e1017] border-2 border-[#25293a] rounded-2xl p-6 shadow-[0_0_50px_rgba(76,196,126,0.15)] flex flex-col gap-4 relative animate-scaleUp"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#25293a]/60 pb-3">
              <div className="flex items-center gap-2">
                <Activity className={`w-5 h-5 ${testingConnection ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
                <h3 className="font-sans font-bold text-lg text-white">Overpass API Diagnostician</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setShowTestModal(false);
                }}
                className="text-[#7e84a3] hover:text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                aria-label="Close diagnostician modal"
              >
                ✕
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-[#7e84a3] leading-relaxed">
              Drift queries the decentralized OpenStreetMap network. This utility checks the live latency, response status, and reachability of all official Overpass mirrors.
            </p>

            {/* Content States */}
            {testingConnection ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full border-4 border-emerald-500/10 border-t-emerald-400 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-4 border-amber-500/10 border-b-amber-400 animate-spin duration-1000" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-mono font-bold text-[#ff4522] uppercase tracking-wider animate-pulse">Pinging mirrors...</p>
                  <p className="text-[11px] text-[#7e84a3] mt-1">Measuring roundtrip and HTTP headers (up to 4s limit)</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Overall Network Status Banner */}
                {testResult && (
                  <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    testResult.status === 'ok' 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : testResult.status === 'partial'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                    {testResult.status === 'ok' ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                    ) : testResult.status === 'partial' ? (
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                    ) : (
                      <WifiOff className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold font-mono uppercase tracking-wider">
                        {testResult.status === 'ok' 
                          ? 'All Systems Operational' 
                          : testResult.status === 'partial'
                            ? 'Degraded Network Performance'
                            : 'OSM Network Offline'}
                      </span>
                      <span className="text-[11px] text-slate-300 leading-normal">
                        {testResult.status === 'ok' 
                          ? 'All 5 official Overpass servers responded successfully. Connection is strong.' 
                          : testResult.status === 'partial'
                            ? `Only ${testResult.reachableCount} of ${testResult.totalCount} mirrors are active. High query latency is expected.`
                            : testResult.error || 'No active Overpass API servers could be reached. Circuit breaker engaged.'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Circuit Breaker Box */}
                {testResult?.circuitBreaker && (
                  <div className="p-3 bg-[#11131f] border border-[#25293a] rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#ff4522]" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono text-[#5b6075] uppercase font-bold tracking-wider">Backend Protection State</span>
                        <span className="text-xs font-bold text-white">Circuit Breaker: {testResult.circuitBreaker.state}</span>
                      </div>
                    </div>
                    {testResult.circuitBreaker.state === 'OPEN' ? (
                      <span className="text-[10px] font-mono font-bold bg-red-500/10 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Tripped (Offline Fallback Active)
                      </span>
                    ) : testResult.circuitBreaker.state === 'HALF-OPEN' ? (
                      <span className="text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                        Testing Upstream Recovery
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Healthy & Active
                      </span>
                    )}
                  </div>
                )}

                {/* Region & Real-time Heatmap with Query Optimization Selector */}
                {(() => {
                  const MIRROR_REGIONS: Record<string, { label: string; flag: string; host: string; continent: string }> = {
                    'https://overpass-api.de/api/interpreter': { label: 'Europe (Germany - Main)', flag: '🇩🇪', host: 'overpass-api.de', continent: 'Europe' },
                    'https://lz4.overpass-api.de/api/interpreter': { label: 'Europe (Germany - lz4)', flag: '🇩🇪', host: 'lz4.overpass-api.de', continent: 'Europe' },
                    'https://z.overpass-api.de/api/interpreter': { label: 'Europe (France - FOSSGIS)', flag: '🇫🇷', host: 'z.overpass-api.de', continent: 'Europe' },
                    'https://overpass.kumi.systems/api/interpreter': { label: 'Europe (Germany - Kumi)', flag: '🇪🇺', host: 'overpass.kumi.systems', continent: 'Europe' },
                    'https://overpass.nchc.org.tw/api/interpreter': { label: 'Asia (Taiwan - NCHC)', flag: '🇹🇼', host: 'overpass.nchc.org.tw', continent: 'Asia' }
                  };

                  const getDetectedRegion = () => {
                    try {
                      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                      if (tz.includes('Europe')) return { name: 'Europe', flag: '🇪🇺' };
                      if (tz.includes('Asia')) return { name: 'Asia/Pacific', flag: '🌏' };
                      if (tz.includes('America')) return { name: 'Americas', flag: '🌎' };
                      if (tz.includes('Australia') || tz.includes('Pacific')) return { name: 'Oceania', flag: '🇦🇺' };
                      if (tz.includes('Africa')) return { name: 'Africa', flag: '🌍' };
                      return { name: 'Global West', flag: '🌐' };
                    } catch {
                      return { name: 'Universal', flag: '🌐' };
                    }
                  };

                  const getRegionMatchLabel = (mirrorContinent: string, userContinent: string) => {
                    if (mirrorContinent === userContinent) {
                      return { text: 'Local Peer', style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' };
                    }
                    return { text: 'Transcontinental', style: 'bg-[#181a26]/80 text-[#7e84a3] border border-[#25293a]/50' };
                  };

                  const fastestMirror = testResult?.mirrors?.filter((m: any) => m.reachable)
                    ?.reduce((prev: any, curr: any) => (!prev || curr.latencyMs < prev.latencyMs ? curr : prev), null);

                  const userRegion = getDetectedRegion();

                  return (
                    <div className="flex flex-col gap-4 mt-1">
                      {/* Dynamic Query Routing Controller */}
                      <div className="flex flex-col gap-2.5 p-3.5 bg-[#11131f]/80 border border-[#25293a] rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-[#5b6075] uppercase font-bold tracking-wider flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                            <span>Routing Optimization</span>
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-300">
                            <Globe className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Your Region: <strong className="text-white">{userRegion.flag} {userRegion.name}</strong></span>
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              hapticFeedback.light();
                              setPreferredMirror('auto');
                              localStorage.setItem('drift_preferred_mirror', 'auto');
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-sans font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                              preferredMirror === 'auto'
                                ? 'bg-[#ff4522]/15 border-[#ff4522] text-white shadow-[0_0_15px_rgba(255,69,34,0.1)]'
                                : 'bg-[#090a10] border-[#25293a] text-[#7e84a3] hover:text-white hover:border-[#ff4522]/50'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Auto-Optimize</span>
                          </button>
                          <button
                            type="button"
                            disabled={!fastestMirror}
                            onClick={() => {
                              if (fastestMirror) {
                                hapticFeedback.light();
                                setPreferredMirror(fastestMirror.url);
                                localStorage.setItem('drift_preferred_mirror', fastestMirror.url);
                              }
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-sans font-bold flex items-center justify-center gap-1.5 transition-all border ${
                              preferredMirror !== 'auto'
                                ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                : 'bg-[#090a10] border-[#25293a] text-[#7e84a3] hover:text-white hover:border-emerald-500/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Lock Fastest</span>
                          </button>
                        </div>
                        
                        <p className="text-[10px] text-[#7e84a3] leading-normal font-sans">
                          {preferredMirror === 'auto' ? (
                            <>
                              <strong>Active:</strong> Query routing dynamically maps to the lowest latency endpoint for your region (<span className="text-emerald-400 font-mono">
                                {fastestMirror ? fastestMirror.url.replace('https://', '').split('/')[0] : 'Detecting...'}
                              </span>) during searches.
                            </>
                          ) : (
                            <>
                              <strong>Static Override:</strong> Custom server locked. Future queries will bypass auto-matching and utilize your selected mirror first.
                            </>
                          )}
                        </p>
                      </div>

                      {/* Heatmap List */}
                      <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                        <span className="text-[10px] font-mono text-[#5b6075] uppercase font-bold tracking-wider">
                          Live Endpoint Registry Heatmap
                        </span>
                        {testResult?.mirrors?.map((mirror: any, i: number) => {
                          const meta = MIRROR_REGIONS[mirror.url] || { label: mirror.url, flag: '🌐', host: mirror.url.replace('https://', ''), continent: 'Global' };
                          const isCurrentlyFastest = fastestMirror?.url === mirror.url;
                          const isSelected = preferredMirror === 'auto'
                            ? isCurrentlyFastest
                            : preferredMirror === mirror.url;
                            
                          const latency = mirror.latencyMs;
                          const reachable = mirror.reachable;
                          
                          let speedPercent = 0;
                          let barColor = 'bg-neutral-800';
                          let grade = 'Offline';
                          let gradeColor = 'text-neutral-500';

                          if (reachable) {
                            speedPercent = Math.max(5, Math.min(100, Math.round(((2000 - Math.min(2000, latency)) / 2000) * 100)));
                            if (latency < 300) {
                              barColor = 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
                              grade = 'A+ Optimal';
                              gradeColor = 'text-emerald-400';
                            } else if (latency < 750) {
                              barColor = 'bg-gradient-to-r from-cyan-500 to-blue-400 shadow-[0_0_8px_rgba(6,182,212,0.2)]';
                              grade = 'B+ Excellent';
                              gradeColor = 'text-cyan-400';
                            } else if (latency < 1400) {
                              barColor = 'bg-gradient-to-r from-amber-500 to-yellow-400';
                              grade = 'C Normal';
                              gradeColor = 'text-amber-400';
                            } else {
                              barColor = 'bg-gradient-to-r from-rose-500 to-orange-400';
                              grade = 'D Degraded';
                              gradeColor = 'text-rose-400';
                            }
                          }
                          
                          const alignMeta = getRegionMatchLabel(meta.continent, userRegion.name);
                          
                          return (
                            <div 
                              key={i}
                              onClick={() => {
                                if (reachable) {
                                  hapticFeedback.light();
                                  setPreferredMirror(mirror.url);
                                  localStorage.setItem('drift_preferred_mirror', mirror.url);
                                }
                              }}
                              className={`p-3 border rounded-xl flex flex-col gap-2.5 transition-all cursor-pointer select-none active:scale-[0.99] ${
                                isSelected 
                                  ? 'bg-[#11131f]/90 border-[#ff4522]/55 shadow-[0_0_12px_rgba(255,69,34,0.06)]' 
                                  : 'bg-[#090a10]/50 border-[#25293a]/40 hover:border-[#ff4522]/20 hover:bg-[#11131f]/30'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 truncate">
                                  <input 
                                    type="radio"
                                    name="mirror-routing-pref"
                                    checked={isSelected}
                                    disabled={!reachable}
                                    onChange={() => {}} // Handle click on container instead
                                    className="w-3 h-3 text-[#ff4522] focus:ring-[#ff4522] bg-[#090a10] border-[#25293a] accent-[#ff4522] cursor-pointer"
                                  />
                                  <span className="text-xs font-sans text-slate-200 font-bold truncate">
                                    {meta.flag} {meta.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isCurrentlyFastest && reachable && (
                                    <span className="text-[8px] font-mono font-bold bg-[#ff4522]/15 border border-[#ff4522]/30 text-[#ff4522] px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                      Fastest
                                    </span>
                                  )}
                                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${alignMeta.style}`}>
                                    {alignMeta.text}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                                    style={{ width: `${speedPercent}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-2 shrink-0 w-[85px] justify-end">
                                  <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${gradeColor}`}>
                                    {grade}
                                  </span>
                                  <span className={`text-[10px] font-mono font-bold ${reachable ? 'text-white' : 'text-red-400'}`}>
                                    {reachable ? `${latency}ms` : 'Down'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[#25293a]/60 pt-3 mt-1">
              <button
                type="button"
                disabled={testingConnection}
                onClick={runConnectionTest}
                className="px-4 py-2 border border-[#25293a] hover:border-[#ff4522]/50 text-white font-sans text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 active:scale-95 bg-[#11131f]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>Re-Diagnose Network</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setShowTestModal(false);
                }}
                className="px-4 py-2 bg-[#ff4522] hover:bg-[#ff5c3d] text-white font-sans font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95"
              >
                Close Diagnostician
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
