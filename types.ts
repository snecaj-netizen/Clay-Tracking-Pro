
export enum Discipline {
  CK = 'Compak Sporting (CK)',
  SP = 'Sporting (SP)',
  ES = 'English Sporting (ES)',
  PC = 'Club Cup (PC)',
  TRAINING = 'Allenamento'
}

export enum TargetCount {
  T50 = 50,
  T100 = 100,
  T200 = 200
}

export enum CompetitionLevel {
  REGIONAL = 'Regionale',
  NATIONAL = 'Nazionale',
  INTERNATIONAL = 'Internazionale',
  TRAINING = 'Allenamento / Pratica'
}

export interface UsedCartridge {
  cartridgeId: string;
  producer: string;
  model: string;
  leadNumber: string;
  imageUrl?: string;
}

export interface WeatherInfo {
  temp?: number;
  condition?: string;
  icon?: string; // FontAwesome class
}

export interface Competition {
  id: string;
  userId?: number;
  name: string;
  location: string;
  date: string;
  endDate?: string;
  discipline: Discipline;
  totalTargets: number;
  level: CompetitionLevel;
  scores: number[];
  detailedScores?: boolean[][]; // true = hit, false = miss
  seriesImages?: string[]; // array of base64 images or URLs for each series
  totalScore: number;
  averagePerSeries: number;
  position?: number;
  cost: number;
  win: number;
  notes?: string;
  usedCartridges?: UsedCartridge[];
  weather?: WeatherInfo;
  userName?: string;
  userSurname?: string;
}

export interface Cartridge {
  id: string;
  purchaseDate: string;
  producer: string;
  model: string;
  leadNumber: string;
  quantity: number; // Current stock
  initialQuantity: number; // Purchased quantity
  cost: number;
  armory?: string;
  imageUrl?: string;
}

export enum UserRole {
  ADMIN = 'admin',
  SHOOTER = 'user', // Renamed from 'Utente' to 'Tiratore' in UI, but keeping 'user' for DB compatibility if needed, or I can change it to 'shooter'
  SOCIETY = 'society'
}

export interface User {
  id: number;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  category?: string;
  qualification?: string;
  society?: string;
  fitav_card?: string;
  is_logged_in?: boolean;
}

export interface AppData {
  competitions: Competition[];
  cartridges: Cartridge[];
}

export interface Stats {
  totalCompetitions: number;
  overallAverage: number;
  bestScore: number;
  disciplineAverages: Record<string, number>;
}

export const getSeriesLayout = (discipline: Discipline) => {
  if (discipline === Discipline.SP) {
    return {
      label: 'Piazzola',
      layout: [9, 9, 7]
    };
  }
  return {
    label: 'Pedana',
    layout: [5, 5, 5, 5, 5]
  };
};
