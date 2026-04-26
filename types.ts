
export enum Discipline {
  CK = 'Compak Sporting (CK)',
  SP = 'Sporting (SP)',
  ES = 'English Sporting (ES)',
  PC = 'Club Cup (PC)',
  SK = 'Skeet (SK)',
  FO = 'Fossa Olimpica (FO)',
  FU = 'Fossa Universale (FU)',
  TC = 'Tiro Combinato (TC)',
  EL = 'Elica (EL)',
  SK_ISSF = 'Skeet ISSF (SK ISSF)',
  TR1 = 'Trap 1 (TR1)',
  DT = 'Double Trap (DT)',
  TRAINING = 'Allenamento'
}

export enum TargetCount {
  T50 = 50,
  T75 = 75,
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
  grams?: number;
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
  chokes?: {
    firstBarrel: string;
    secondBarrel: string;
  };
  usedCartridges?: UsedCartridge[];
  weather?: WeatherInfo;
  userName?: string;
  userSurname?: string;
  teamName?: string;
  status?: string;
  ranking_preference?: 'categoria' | 'qualifica';
  ranking_preference_override?: 'categoria' | 'qualifica';
  is_registered_only?: boolean;
  registration_id?: number;
  registration_day?: string;
  registration_type?: string;
  shotgun_brand?: string;
  shotgun_model?: string;
  cartridge_brand?: string;
  cartridge_model?: string;
  shooting_session?: string;
  registration_notes?: string;
  registration_phone?: string;
}

export interface Cartridge {
  id: string;
  typeId?: string; // Link to CartridgeType
  purchaseDate: string;
  producer: string;
  model: string;
  leadNumber: string;
  grams?: number;
  quantity: number; // Current stock
  initialQuantity: number; // Purchased quantity
  cost: number;
  armory?: string;
  imageUrl?: string;
}

export interface CartridgeType {
  id: string;
  producer: string;
  model: string;
  leadNumber: string;
  grams?: number;
  imageUrl?: string;
  createdBy?: number;
  createdByName?: string;
  createdBySurname?: string;
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
  shooter_code?: string;
  avatar?: string;
  birth_date?: string;
  phone?: string;
  is_logged_in?: boolean;
  is_international?: boolean;
  nationality?: string;
  international_id?: string;
  original_club?: string;
  email_verified?: boolean;
}

export interface DashboardStats {
  onlineUsersCount: number;
  onlineSocietiesCount: number;
  topUserName: string;
  topUserTraffic: number;
  topSocName: string;
  topSocTraffic: number;
  topUserByResultsName: string;
  topUserResultsCount: number;
  topSocByResultsName: string;
  topSocResultsCount: number;
  topUserByTargetsName: string;
  topUserTargetsTotal: number;
}

export interface SocietyEvent {
  id: string;
  name: string;
  type: string; // Regionale, Nazionale, Internazionale
  visibility: string; // Gara di Società, Pubblica
  discipline: string;
  location: string;
  targets: number;
  start_date: string;
  end_date: string;
  cost?: string;
  notes?: string;
  poster_url?: string;
  registration_link?: string;
  created_by?: number;
  is_from_competition?: boolean;
  result_count?: number;
  prize_settings?: string; // JSON string of PrizeSetting[]
  status?: string;
  ranking_logic?: 'individual' | 'best_placement' | 'absolute_score';
  ranking_preference_override?: 'categoria' | 'qualifica' | null;
  has_society_ranking?: boolean;
  has_team_ranking?: boolean;
  registration_count?: number;
  is_registered?: boolean;
  is_management_enabled?: boolean;
  is_ongoing?: boolean;
  is_next?: boolean;
  is_public?: boolean;
  region?: string;
  society_code?: string;
}

export interface PrizeSetting {
  type: 'categoria' | 'qualifica';
  name: string;
  count: number;
}

export interface EventRegistration {
  id: number;
  event_id: string;
  user_id: number;
  registration_day: string;
  registration_type: string;
  shotgun_brand: string;
  shotgun_model?: string;
  cartridge_brand: string;
  cartridge_model?: string;
  shooting_session: string;
  notes?: string;
  phone?: string;
  created_at: string;
  // Joined fields
  first_name?: string;
  last_name?: string;
  shooter_code?: string;
  society?: string;
  category?: string;
  qualification?: string;
  email?: string;
}

export interface EventSquadMember {
  id?: number;
  position: number;
  registration_id: number;
  first_name: string;
  last_name: string;
  shooter_code?: string;
  society?: string;
  category?: string;
  qualification?: string;
}

export interface EventSquad {
  id: number;
  event_id: string;
  squad_number: number;
  field_number: number;
  start_time: string;
  members: EventSquadMember[];
  is_locked?: boolean;
}

export interface AppData {
  competitions: Competition[];
  cartridges: Cartridge[];
  cartridgeTypes: CartridgeType[];
}

export enum ChallengeMode {
  BEST_SCORE = 'Miglior Risultato',
  AVERAGE = 'Media Totale',
  TOP_THREE_AVG = 'Media Migliori 3',
  TOTAL_HITS = 'Totale Piattelli Rotti',
  ACCURACY = 'Precisione (%)',
  CONSISTENCY = 'Costanza (Serie)',
  BEST_SERIES = 'Miglior Serie Singola',
  PARTICIPATION = 'Numero di Gare',
  TOP_FIVE_AVG = 'Media Migliori 5',
  CLUTCH_PERFORMANCE = 'Performance Finale (Ultima Serie)',
  PERFECT_SERIES = 'Numero Serie Perfette (25/25)',
  POINTS_RANKING = 'Ranking a Punti (Stile F1)',
  HANDICAP = 'Sfida Handicap (Bonus Categoria)',
  SUM_BEST_THREE = 'Somma Migliori 3',
  SUM_BEST_FIVE = 'Somma Migliori 5'
}

export interface Challenge {
  id: string;
  societyId: number;
  societyName: string;
  name: string;
  discipline: Discipline;
  mode: ChallengeMode;
  startDate: string;
  endDate: string;
  prize: string;
  createdAt: string;
}

export interface ChallengeRankingEntry {
  userId: number;
  userName: string;
  userSurname: string;
  category: string;
  qualification: string;
  value: number;
  competitionCount: number;
  bestScore: number;
  totalHits: number;
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
  if (discipline === Discipline.EL) {
    return {
      label: 'Serie',
      layout: [3, 3, 3, 3] // Example for 12 targets, can be adjusted
    };
  }
  if (discipline === Discipline.DT) {
    return {
      label: 'Pedana',
      layout: [6, 6, 6, 6, 6] // 30 targets
    };
  }
  if (discipline === Discipline.SK_ISSF) {
    return {
      label: 'Pedana',
      layout: [3, 3, 3, 3, 3, 3, 3, 4] // 25 targets over 8 stations
    };
  }
  return {
    label: 'Pedana',
    layout: [5, 5, 5, 5, 5]
  };
};
