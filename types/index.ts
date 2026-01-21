import { Language } from '../constants/translations';

export interface User {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
}

export interface JobAd {
  id: string;
  userId: string;
  category: string;
  gender: 'male' | 'female' | 'any';
  description: string;
  phoneNumber: string;
  location: string;
  latitude?: number;
  longitude?: number;
  photoUri?: string;
  createdAt: string;
  status: 'active' | 'completed' | 'cancelled';
}

export interface Company {
  id: string;
  name: string;
  serviceType: string;
  description: string;
  phoneNumber: string;
  address: string;
  photoUrls: string[];
  services: string[];
  workingHours: string;
  experience: string;
  rating: number;
}

export interface ServiceOrder {
  id: string;
  userId: string;
  companyId: string;
  companyName: string;
  serviceType: string;
  customerName: string;
  phoneNumber: string;
  location: string;
  latitude?: number;
  longitude?: number;
  additionalNotes: string;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

export interface AppSettings {
  language: Language;
  darkMode: boolean;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  companyId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Favorite {
  id: string;
  userId: string;
  itemId: string;
  itemType: 'company' | 'worker';
  createdAt: string;
}

export interface Worker {
  id: string;
  name: string;
  age: number;
  category: string;
  dailyRate: number;
  phoneNumber: string;
  arrivalTime: string;
  rating: number;
  photoUrl?: string;
  experience: string;
}

export interface HiredWorker {
  id: string;
  userId: string;
  jobAdId: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  arrivalTime: string;
  dailyRate: number;
  hiredAt: string;
  status: 'pending' | 'confirmed' | 'completed';
}
