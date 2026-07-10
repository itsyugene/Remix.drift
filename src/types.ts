export interface Place {
  key: string;
  osmType: string;
  osmId: number;
  lat: number;
  lng: number;
  tags: Record<string, string>;
  cats: string[];
  named: boolean;
  name: string;
  typeLabel: string;
  subTags: string;
  distance: number;
  bearing: number;
  _morning?: boolean;
}

export interface HoursResult {
  state: 'open' | 'closed' | 'unknown' | 'none';
  always?: boolean;
  until?: number; // in minutes from midnight
  next?: number | null; // in minutes from midnight
}

export interface RecentSearchItem {
  query: string;
  label: string;
  region: string;
  lat: number;
  lng: number;
  timestamp: number;
}

