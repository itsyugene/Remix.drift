# Changelog

All notable changes to the DRIFT application are documented in this file.

## [1.1.0] - 2026-07-09

### Added
- **Demo Hubs (`src/lib/demoHubs.ts`):** Added offline fixtures for London, Lisbon, and Nakuru. This allows users to experience the application's full discovery pipeline fully offline with realistic coordinate grids.
- **Demo Mode Badges:** Added glowing orange "Demo" status pill to the location bar and a floating approximate-position alert above the interactive map when using a demo hub.
- **Thumbs Feedback (`src/lib/feedback.ts` & `src/components/FeedbackControls.tsx`):** Introduced a modern, lightweight thumbs-up / thumbs-down system.
  - Thumbs-UP spots get a green "good drift" chip.
  - Thumbs-DOWN spots get a red "skipped" chip, render with 72% opacity, and sink dynamically to the bottom of the visible list (preserving distance sorting within groups).
- **Legacy Migration:** Added transparent migration from legacy suitability records to the new thumbs-down state upon load.

### Changed
- **OSM Category Mapping (`src/utils/geoUtils.ts`):** Re-implemented specific category filtering.
  - **Leak:** Public toilets AND brothels.
  - **Dilate:** Nightlife (pubs, bars, nightclubs, stripclubs) plus named massage parlours (shop=massage). Unnamed massage parlours are filtered out. Massage parlours now display under a generic "Massage" label without subcategory clutter.
- **Overpass Query Ordering (`server.ts`):** Reordered the query elements so sparse categories (toilets, brothels, nightlife, massage) are processed first, preventing urban density "starvation" from food categories.
- **Search Fallbacks:** Updated the geocoder/Overpass error handlers to direct users to the offline Demo Hubs when searches or networks fail.

### Removed
- **Suitability and Journals:** Removed all deprecated field journal entry state managers, old notes storage logic (`drift-notes-` reads/writes), and the old "Mark as unsuitable" suitability feedback dialog component.
