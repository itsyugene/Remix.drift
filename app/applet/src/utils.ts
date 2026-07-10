import { Coordinates } from './types';

/**
 * Calculates the distance between two coordinates in meters using the Haversine formula.
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // Radius of the earth in meters
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLon = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return parseFloat(d.toFixed(1));
}

/**
 * Simulates a small, incremental drift on coordinates.
 * This is great for simulating walking or sensor accuracy drift.
 */
export function simulateDrift(coord: Coordinates, headingDegrees: number, stepSizeMeters: number = 2): Coordinates {
  const R = 6371000; // Earth's radius in meters
  const headingRad = (headingDegrees * Math.PI) / 180;
  
  // Calculate delta lat and lng
  const dLat = (stepSizeMeters * Math.cos(headingRad)) / R;
  const dLng = (stepSizeMeters * Math.sin(headingRad)) / (R * Math.cos((coord.lat * Math.PI) / 180));
  
  // Convert back to degrees
  const lat = coord.lat + (dLat * 180) / Math.PI;
  const lng = coord.lng + (dLng * 180) / Math.PI;
  
  return {
    lat: parseFloat(lat.toFixed(7)),
    lng: parseFloat(lng.toFixed(7)),
    accuracy: Math.floor(Math.random() * 5) + 3, // 3-8 meters accuracy
    altitude: coord.altitude ? coord.altitude + (Math.random() * 0.2 - 0.1) : 45,
    speed: stepSizeMeters / 1.5, // simulate walking speed m/s
  };
}

/**
 * Format distance value nicely for display.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(1)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Format timestamp nicely.
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
