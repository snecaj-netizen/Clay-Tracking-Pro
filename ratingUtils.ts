import { Competition, Discipline, User, DISCIPLINE_TO_ACRONYM } from './types';

export const getCategoryForDiscipline = (user: User, discipline: Discipline): string | undefined => {
  if (user.is_cacciatore) return undefined;
  if (!user.discipline_categories) return undefined;

  let targetAcronyms: string[] = [];
  const discStr = String(discipline).toUpperCase();
  if (discipline === Discipline.DCK || discStr.includes('DCK') || discStr.includes('DOPPIETTO')) {
    targetAcronyms = ['PC', 'CK'];
  } else {
    const acronym = DISCIPLINE_TO_ACRONYM[discipline];
    if (!acronym) return undefined;
    targetAcronyms = [acronym.toUpperCase()];
    if (acronym.toUpperCase() === 'PC') {
      targetAcronyms = ['PC', 'CK'];
    }
  }

  // Format: DT:3 EL:3 FO:3 FU:3 PC:3 SK:3 SP:3 TA:3 TC:3
  const parts = user.discipline_categories.split(' ');
  for (const part of parts) {
    const [d, cat] = part.split(':');
    if (d && cat) {
      if (targetAcronyms.includes(d.toUpperCase())) {
        return cat;
      }
    }
  }
  return undefined;
};

export interface RTERating {
  discipline: Discipline;
  rating: number;
  isProvvisorio: boolean;
  count: number;
  bestFive: number[];
}

export const calculateRTE = (competitions: Competition[]): RTERating[] => {
  // Filter for real competitions (not training) and with score > 0
  const realComps = competitions.filter(c => 
    c.discipline !== Discipline.TRAINING && 
    c.totalScore > 0 &&
    c.status !== 'draft' // Assuming draft results shouldn't count
  );
  
  // Last 12 months filter
  const now = new Date();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(now.getFullYear() - 1);

  const recentComps = realComps.filter(c => new Date(c.date) >= twelveMonthsAgo);

  // Group by discipline
  const byDiscipline: Record<string, Competition[]> = {};
  recentComps.forEach(c => {
    if (!byDiscipline[c.discipline]) {
      byDiscipline[c.discipline] = [];
    }
    byDiscipline[c.discipline].push(c);
  });

  const ratings: RTERating[] = [];

  Object.entries(byDiscipline).forEach(([discipline, comps]) => {
    // Sort by average per series descending
    const sortedScores = comps
      .map(c => c.averagePerSeries)
      .sort((a, b) => b - a);

    const count = sortedScores.length;
    const bestFive = sortedScores.slice(0, 5);
    const sum = bestFive.reduce((acc, s) => acc + s, 0);
    const rating = sum / bestFive.length;

    ratings.push({
      discipline: discipline as Discipline,
      rating,
      isProvvisorio: count < 3,
      count,
      bestFive
    });
  });

  return ratings.sort((a, b) => b.rating - a.rating);
};

export const INTERNATIONAL_CODES = ['MAN', 'SEN', 'VET', 'MAS', 'JUN', 'LADY', 'SNR', 'JUM', 'JUW', 'LAD'];

export const INTL_TO_DOMESTIC: Record<string, string> = {
  'SEN': 'SE',
  'VET': 'VE',
  'MAS': 'MA',
  'JUN': 'JU',
  'LADY': 'LA',
  'LAD': 'LA',
  'SNR': 'SE',
  'JUM': 'JU',
  'JUW': 'JU'
};

export const shortenCategoryName = (name: string): string => {
  if (!name) return name;
  const upper = name.toUpperCase();
  
  // Mapping of domestic labels to short codes
  const domesticMapping: Record<string, string> = {
    'ECCELLENZA': 'E',
    'PRIMA': '1*',
    'SECONDA': '2*',
    'TERZA': '3*',
    'VETERANI': 'VE',
    'MASTER': 'MA',
    'SENIOR': 'SE',
    'JUNIOR': 'JU',
    'LADY': 'LA',
    'MANTENIMENTO': 'M'
  };
  
  if (domesticMapping[upper]) return domesticMapping[upper];
  
  // If it's an international code, we might want to return it as is or map it
  // But shortenCategoryName is used generally. 
  // Let's return the mapping if exists, else return original.
  return upper; // Default to upper case for codes
};

export const getDisplayCategory = (cat: string, qual: string, eventType: string): string => {
  const isInternational = eventType === 'Internazionale';
  
  const c = (cat || "").toUpperCase();
  const q = (qual || "").toUpperCase();

  if (isInternational) {
    // In international events, we only show international codes
    const parts = [c, q].filter(p => INTERNATIONAL_CODES.includes(p));
    return parts.join('/');
  }
  
  // In local events:
  // 1. Category: Hide if it's an international code (MAN, SEN, etc.)
  let displayCat = "";
  if (c && !INTERNATIONAL_CODES.includes(c)) {
    displayCat = shortenCategoryName(c);
  }

  // 2. Qualification: If it's an international code, convert to domestic short code. 
  // If it's domestic, shorten it.
  let displayQual = "";
  if (q) {
    if (INTL_TO_DOMESTIC[q]) {
      displayQual = INTL_TO_DOMESTIC[q];
    } else if (!INTERNATIONAL_CODES.includes(q)) {
      displayQual = shortenCategoryName(q);
    }
  }
  
  const parts = [displayCat, displayQual].filter(p => Boolean(p) && p !== '-');
  return parts.join('/');
};
