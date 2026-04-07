import { Competition, Discipline } from './types';

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
