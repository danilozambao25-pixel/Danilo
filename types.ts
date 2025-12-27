
export enum UserRole {
  COMPANY = 'COMPANY',
  DRIVER = 'DRIVER',
  USER = 'USER'
}

export type MapStyle = 'light' | 'dark' | 'satellite';

export interface LatLng {
  lat: number;
  lng: number;
  isStop?: boolean;
  stopName?: string;
}

export interface DriverProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyId: string;
}

export interface BusRoute {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  points: LatLng[]; 
  geometry?: LatLng[]; 
  status: 'NORMAL' | 'DELAYED' | 'BROKEN' | 'TRAFFIC';
  incidentDescription?: string;
  currentLocation?: LatLng;
  qrCodeData: string;
  isOffRoute: boolean;
  assignedDriverId?: string;
  schedule?: string; // Ex: "06:00, 07:30, 09:00"
  itineraryText?: string; // Descrição textual das paradas
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  favoriteRoutes: string[];
  companyId?: string;
}

export type IncidentType = 'BREAKDOWN' | 'TRAFFIC' | 'ACCIDENT' | 'OTHER' | 'CLEAR';
