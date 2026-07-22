import { Discipline } from '../types';

export interface MakeABreakTargetInfo {
  station: number; // 1, 2, or 3
  machine: number; // 1, 2, 3, 4, or 5
  type: 'singolo' | 'doppietto';
  points: number; // 1..5
  label: string; // e.g., "M1 (1pt)"
  fullLabel: string; // e.g., "P1 - Singolo M1 (1 pt)"
}

export function isMakeABreak(discipline: string | Discipline | undefined | null): boolean {
  if (!discipline) return false;
  const d = String(discipline);
  return (
    d === Discipline.MB ||
    d.includes('Make a Break') ||
    d === 'MB' ||
    d.toLowerCase().includes('make a break')
  );
}

export function getMakeABreakTargetInfo(targetIdx: number): MakeABreakTargetInfo {
  if (targetIdx >= 0 && targetIdx <= 7) {
    // Piazzola 1 (8 targets: 4 singoli, 4 doppi)
    if (targetIdx < 4) {
      const m = targetIdx + 1;
      return {
        station: 1,
        machine: m,
        type: 'singolo',
        points: m,
        label: `M${m} (${m}pt)`,
        fullLabel: `P1 - Singolo M${m} (${m} pt)`
      };
    } else {
      const m = targetIdx - 4 + 1;
      return {
        station: 1,
        machine: m,
        type: 'doppietto',
        points: m,
        label: `M${m} (${m}pt)`,
        fullLabel: `P1 - Doppietto M${m} (${m} pt)`
      };
    }
  } else if (targetIdx >= 8 && targetIdx <= 15) {
    // Piazzola 2 (8 targets: 4 singoli, 4 doppi)
    const rel = targetIdx - 8;
    if (rel < 4) {
      const m = rel + 1;
      return {
        station: 2,
        machine: m,
        type: 'singolo',
        points: m,
        label: `M${m} (${m}pt)`,
        fullLabel: `P2 - Singolo M${m} (${m} pt)`
      };
    } else {
      const m = rel - 4 + 1;
      return {
        station: 2,
        machine: m,
        type: 'doppietto',
        points: m,
        label: `M${m} (${m}pt)`,
        fullLabel: `P2 - Doppietto M${m} (${m} pt)`
      };
    }
  } else {
    // Piazzola 3 (9 targets: 5 singoli, 4 doppi)
    const rel = targetIdx - 16;
    if (rel < 5) {
      const m = rel + 1;
      return {
        station: 3,
        machine: m,
        type: 'singolo',
        points: m,
        label: `M${m} (${m}pt)`,
        fullLabel: `P3 - Singolo M${m} (${m} pt)`
      };
    } else {
      const m = rel - 5 + 1;
      return {
        station: 3,
        machine: m,
        type: 'doppietto',
        points: m,
        label: `M${m} (${m}pt)`,
        fullLabel: `P3 - Doppietto M${m} (${m} pt)`
      };
    }
  }
}

export function getSeriesMaxScore(discipline: string | Discipline | undefined | null, defaultTargets: number = 25): number {
  if (isMakeABreak(discipline)) {
    return 65; // Max score in Make a Break per series (20 + 20 + 25)
  }
  return defaultTargets;
}

export function calculateSeriesScore(discipline: string | Discipline | undefined | null, detailedHits: boolean[]): number {
  if (!detailedHits || detailedHits.length === 0) return 0;
  if (isMakeABreak(discipline)) {
    return detailedHits.reduce((acc, isHit, idx) => {
      if (!isHit) return acc;
      const info = getMakeABreakTargetInfo(idx);
      return acc + info.points;
    }, 0);
  }
  return detailedHits.filter(Boolean).length;
}
