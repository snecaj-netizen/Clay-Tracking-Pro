
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { Competition, Discipline } from '../types';
import StatsCharts from './StatsCharts';
import ShareCard from './ShareCard';
import { calculateRTE } from '../ratingUtils';
import { useLanguage } from '../contexts/LanguageContext';

const formatEventDates = (startDate: any, endDate: any, singleDate?: any) => {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const fallback = singleDate ? new Date(singleDate) : null;

  const isValidDate = (d: Date | null) => d && !isNaN(d.getTime());

  if (isValidDate(start) && isValidDate(end)) {
    if (start!.toDateString() === end!.toDateString()) {
      return start!.toLocaleDateString('it-IT');
    }
    
    const startStr = start!.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const endStr = end!.toLocaleDateString('it-IT');
    
    if (start!.getFullYear() === end!.getFullYear()) {
      return `${startStr} - ${endStr}`;
    } else {
      return `${start!.toLocaleDateString('it-IT')} - ${endStr}`;
    }
  }

  if (isValidDate(start)) {
    return start!.toLocaleDateString('it-IT');
  }
  if (isValidDate(end)) {
    return end!.toLocaleDateString('it-IT');
  }
  if (isValidDate(fallback)) {
    return fallback!.toLocaleDateString('it-IT');
  }

  return startDate || endDate || singleDate || '---';
};

const isEventDisputed = (ev: any) => {
  if (!ev) return false;
  if (ev.status === 'completed' || ev.status === 'closed') return true;
  const dateStr = ev.end_date || ev.start_date || ev.date;
  if (!dateStr) return false;
  const evDate = new Date(dateStr);
  evDate.setHours(23, 59, 59, 999);
  return evDate < new Date();
};

interface DashboardProps {
  competitions: Competition[];
  userRegistrations?: any[];
  societies: any[];
  events: any[];
  onAddClick: () => void;
  onCoachClick: () => void;
  onNavigate: (view: any, tab?: string, eventId?: string) => void;
  onEditRegistration?: (reg: any) => void;
  user?: any;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  competitions = [], 
  userRegistrations = [],
  societies = [], 
  events = [], 
  onAddClick, 
  onCoachClick, 
  onNavigate, 
  onEditRegistration,
  user 
}) => {
  const { t, language } = useLanguage();
  const [shareData, setShareData] = useState<{ comp: Competition, isPerfect?: boolean } | null>(null);
  
  // Regional Championships Dashboard standings state with Session Storage caching
  const [regionalStandings, setRegionalStandings] = useState<any[]>(() => {
    try {
      const cached = sessionStorage.getItem('clay_tracker_regional_standings');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [isRegLoading, setIsRegLoading] = useState(false);
  const [selectedRegionalRanking, setSelectedRegionalRanking] = useState<any | null>(null);
  const [selectedTrialDetails, setSelectedTrialDetails] = useState<{
    societyName: string;
    trialLabel: string;
    score: number;
    shooters: any[];
  } | null>(null);

  const fetchRegionalStandings = async (forceRefetch = false) => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token || !user) return;

    // Skip auto-fetching if cached data exists and we are not forcing a refresh
    if (!forceRefetch && regionalStandings.length > 0) {
      return;
    }

    setIsRegLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch('/api/regional-championships', { headers });
      if (res.ok) {
        const champs = await res.json();
        // Filter championships where region matches user registered region or is 'Tutte' AND is_visible is true
        const matchingChamps = champs.filter((c: any) => 
          (c.is_visible !== false) && (c.region === 'Tutte' || c.region === user?.society_region)
        );
        
        if (matchingChamps.length === 0) {
          setRegionalStandings([]);
          sessionStorage.removeItem('clay_tracker_regional_standings');
          setIsRegLoading(false);
          return;
        }

        const standingsPromises = matchingChamps.map(async (c: any) => {
          const rRes = await fetch(`/api/regional-championships/${c.id}/ranking`, { headers });
          if (rRes.ok) {
            const rData = await rRes.json();
            // Find our shooter
            const myStanding = rData.shooters?.find((s: any) => 
              (user?.shooter_code && s.shooter_code === user.shooter_code) ||
              (s.surname?.toLowerCase() === user?.surname?.toLowerCase() && s.name?.toLowerCase() === user?.name?.toLowerCase())
            );
            return {
              championship: c,
              myStanding: myStanding || null,
              allRankingData: rData
            };
          }
          return null;
        });

        const results = await Promise.all(standingsPromises);
        const filteredResults = results.filter(Boolean);
        setRegionalStandings(filteredResults);
        try {
          sessionStorage.setItem('clay_tracker_regional_standings', JSON.stringify(filteredResults));
        } catch (e) {
          console.error('Error saving standings cache:', e);
        }
      }
    } catch (err) {
      console.error('Error fetching regional standings on dashboard:', err);
    } finally {
      setIsRegLoading(false);
    }
  };

  useEffect(() => {
    fetchRegionalStandings(false);
  }, [user]);

  const handleDownloadDashboardExcel = (rankingData: any) => {
    if (!rankingData) return;
    try {
      const champ = rankingData.championship || {};
      const wb = XLSX.utils.book_new();

      // --- SHEET 1: EXPERTLY FORMATTED SHOOTERS CHAMPIONSHIP BY CATEGORY / QUALIFICATION ---
      const sortedGroupKeys = Object.keys(rankingData.groupedRankings || {}).sort();
      
      const champInfoRows = [
        ['🏆 CAMPIONATO REGIONALE - CLASSIFICA DETTAGLIATA INDIVIDUALE'],
        [champ.name || ''],
        [],
        ['Disciplina F.I.T.A.V.:', champ.discipline || '', 'Regione:', champ.region || '', 'Anno:', champ.year || ''],
        ['Regolamento Campionato:', 'Sono necessarie almeno 3 prove su 4 per il computo finale. Nel caso si effettuino tutte e 4 le prove, la prova peggiore (penalità più alta) viene scartata.'],
        [],
        []
      ];

      const shootersBodyRows: any[] = [];

      sortedGroupKeys.forEach((groupKey) => {
        const shootersInGroup = rankingData.groupedRankings[groupKey] || [];
        if (shootersInGroup.length === 0) return;
        
        const [mode, value] = groupKey.split('_');
        const modeLabel = mode === 'categoria' ? 'CATEGORIA' : 'QUALIFICA';
        
        // Visual Section Header for group
        shootersBodyRows.push([]);
        shootersBodyRows.push([`⭐ ${modeLabel}: ${value.toUpperCase()} (Tesserati Classificati: ${shootersInGroup.length})`]);
        shootersBodyRows.push([
          'Posizione',
          'Cognome',
          'Nome',
          'Codice FITAV',
          'Società Tesseramento',
          'Regione',
          'Penalità Totali',
          'Piattelli Totali Colpiti',
          'Prove Effettuate',
          'Prova 1 Punteggio',
          'Prova 1 Penalità',
          'Prova 1 Scartata',
          'Prova 2 Punteggio',
          'Prova 2 Penalità',
          'Prova 2 Scartata',
          'Prova 3 Punteggio',
          'Prova 3 Penalità',
          'Prova 3 Scartata',
          'Prova 4 Punteggio',
          'Prova 4 Penalità',
          'Prova 4 Scartata'
        ]);

        // Add shooters rows in this specific category / qualification
        shootersInGroup.forEach((s: any) => {
          const tScores = s.trialScores || {};
          const tPenalties = s.trialPenalties || {};

          shootersBodyRows.push([
            s.position ? `${s.position}°` : 'Non Classificato (NC)',
            s.surname || '',
            s.name || '',
            s.shooter_code || '',
            s.society || '',
            s.society_region || '',
            s.totalPenalties !== undefined && s.totalPenalties !== null ? s.totalPenalties : 0,
            s.totalTargetsHit !== undefined && s.totalTargetsHit !== null ? s.totalTargetsHit : 0,
            s.participatedCount || 0,
            tScores.trial1 !== undefined && tScores.trial1 !== null ? tScores.trial1 : '-',
            tPenalties.trial1 !== undefined && tPenalties.trial1 !== null ? tPenalties.trial1 : '-',
            s.discardedTrialIdx === 1 ? 'SÌ' : 'NO',
            tScores.trial2 !== undefined && tScores.trial2 !== null ? tScores.trial2 : '-',
            tPenalties.trial2 !== undefined && tPenalties.trial2 !== null ? tPenalties.trial2 : '-',
            s.discardedTrialIdx === 2 ? 'SÌ' : 'NO',
            tScores.trial3 !== undefined && tScores.trial3 !== null ? tScores.trial3 : '-',
            tPenalties.trial3 !== undefined && tPenalties.trial3 !== null ? tPenalties.trial3 : '-',
            s.discardedTrialIdx === 3 ? 'SÌ' : 'NO',
            tScores.trial4 !== undefined && tScores.trial4 !== null ? tScores.trial4 : '-',
            tPenalties.trial4 !== undefined && tPenalties.trial4 !== null ? tPenalties.trial4 : '-',
            s.discardedTrialIdx === 4 ? 'SÌ' : 'NO'
          ]);
        });

        shootersBodyRows.push([]); // separation spacer
      });

      // Include also non-classified shooters (NC) with less than 3 trials
      const unclassifiedSec = rankingData.shooters ? rankingData.shooters.filter((s: any) => !s.isClassified && (s.participatedCount || 0) > 0) : [];
      if (unclassifiedSec.length > 0) {
        shootersBodyRows.push([]);
        shootersBodyRows.push([`⚠️ TESSERATI NON CLASSIFICATI (Meno di 3 prove completate)`]);
        shootersBodyRows.push([
          'Posizione',
          'Cognome',
          'Nome',
          'Codice FITAV',
          'Società Tesseramento',
          'Regione',
          'Tipo Classifica',
          'Categoria / Qualifica',
          'Penalità Totali',
          'Piattelli Totali Colpiti',
          'Prove Effettuate',
          'Prova 1 Punteggio',
          'Prova 1 Penalità',
          'Prova 2 Punteggio',
          'Prova 2 Penalità',
          'Prova 3 Punteggio',
          'Prova 3 Penalità',
          'Prova 4 Punteggio',
          'Prova 4 Penalità'
        ]);

        unclassifiedSec.forEach((s: any) => {
          const tScores = s.trialScores || {};
          const tPenalties = s.trialPenalties || {};

          shootersBodyRows.push([
            'Non Classificato (NC)',
            s.surname || '',
            s.name || '',
            s.shooter_code || '',
            s.society || '',
            s.society_region || '',
            s.classificationMode === 'categoria' ? 'Categoria' : 'Qualifica',
            s.classificationValue || '',
            s.totalPenalties !== undefined && s.totalPenalties !== null ? s.totalPenalties : 0,
            s.totalTargetsHit !== undefined && s.totalTargetsHit !== null ? s.totalTargetsHit : 0,
            s.participatedCount || 0,
            tScores.trial1 !== undefined && tScores.trial1 !== null ? tScores.trial1 : '-',
            tPenalties.trial1 !== undefined && tPenalties.trial1 !== null ? tPenalties.trial1 : '-',
            tScores.trial2 !== undefined && tScores.trial2 !== null ? tScores.trial2 : '-',
            tPenalties.trial2 !== undefined && tPenalties.trial2 !== null ? tPenalties.trial2 : '-',
            tScores.trial3 !== undefined && tScores.trial3 !== null ? tScores.trial3 : '-',
            tPenalties.trial3 !== undefined && tPenalties.trial3 !== null ? tPenalties.trial3 : '-',
            tScores.trial4 !== undefined && tScores.trial4 !== null ? tScores.trial4 : '-',
            tPenalties.trial4 !== undefined && tPenalties.trial4 !== null ? tPenalties.trial4 : '-'
          ]);
        });
      }

      const allShooterAoARows = [...champInfoRows, ...shootersBodyRows];
      const wsShooters = XLSX.utils.aoa_to_sheet(allShooterAoARows);

      // Set spacious custom column widths to prevent truncation "###"
      wsShooters['!cols'] = [
        { wch: 20 }, // Posizione
        { wch: 18 }, // Cognome
        { wch: 18 }, // Nome
        { wch: 15 }, // Codice FITAV
        { wch: 30 }, // Società
        { wch: 12 }, // Regione
        { wch: 16 }, // Penalità o Tipo
        { wch: 22 }, // Piattelli o Cat/Qual
        { wch: 16 }, // Prove
        { wch: 18 }, // Prova 1 Punteggio
        { wch: 16 }, // Prova 1 Penalità
        { wch: 16 }, // Prova 1 Scartata
        { wch: 18 }, // Prova 2 Punteggio
        { wch: 16 }, // Prova 2 Penalità
        { wch: 16 }, // Prova 2 Scartata
        { wch: 18 }, // Prova 3 Punteggio
        { wch: 16 }, // Prova 3 Penalità
        { wch: 16 }, // Prova 3 Scartata
        { wch: 18 }, // Prova 4 Punteggio
        { wch: 16 }, // Prova 4 Penalità
        { wch: 16 }  // Prova 4 Scartata
      ];

      XLSX.utils.book_append_sheet(wb, wsShooters, 'Classifica Tiratori');

      // --- SHEET 2: SOCIETIES RANKING ---
      const socInfoRows = [
        ['🏆 CAMPIONATO REGIONALE - CLASSIFICA SOCIETÀ TAV'],
        [champ.name || ''],
        [],
        ['Disciplina F.I.T.A.V.:', champ.discipline || '', 'Regione:', champ.region || '', 'Anno:', champ.year || ''],
        ['Regolamento Società:', `Somma dei punteggi dei migliori ${(champ.discipline || '').toLowerCase().includes('fossa') || (champ.discipline || '').toLowerCase().includes('trap') ? '6' : '3'} tiratori di ciascuna associazione per singola prova regionale.`],
        [],
        []
      ];

      const societiesRaw = (rankingData.classifiedSocieties || []).filter((s: any) => (s.participatedCount || 0) > 0);
      const unsocRaw = (rankingData.societies || []).filter((s: any) => !s.isClassified && (s.participatedCount || 0) > 0);
      const sortedSocieties = [...societiesRaw, ...unsocRaw];

      const socBodyRows: any[] = [];
      socBodyRows.push([
        'Posizione',
        'Società TAV',
        'Penalità Totali',
        'Punti Totali Colpiti (Squadra)',
        'Prove Effettuate',
        'Prova 1 Punteggio',
        'Prova 1 Penalità',
        'Prova 1 Scartata',
        'Prova 2 Punteggio',
        'Prova 2 Penalità',
        'Prova 2 Scartata',
        'Prova 3 Punteggio',
        'Prova 3 Penalità',
        'Prova 3 Scartata',
        'Prova 4 Punteggio',
        'Prova 4 Penalità',
        'Prova 4 Scartata'
      ]);

      sortedSocieties.forEach(soc => {
        const tScores = soc.trialScores || {};
        const tPenalties = soc.trialPenalties || {};

        socBodyRows.push([
          soc.position ? `${soc.position}°` : 'Non Classificata (NC)',
          soc.societyName || '',
          soc.totalPenalties !== undefined && soc.totalPenalties !== null ? soc.totalPenalties : 0,
          soc.totalScoreSum !== undefined && soc.totalScoreSum !== null ? soc.totalScoreSum : 0,
          soc.participatedCount || 0,
          tScores.trial1 !== undefined && tScores.trial1 !== null ? tScores.trial1 : '-',
          tPenalties.trial1 !== undefined && tPenalties.trial1 !== null ? tPenalties.trial1 : '-',
          soc.discardedTrialIdx === 1 ? 'SÌ' : 'NO',
          tScores.trial2 !== undefined && tScores.trial2 !== null ? tScores.trial2 : '-',
          tPenalties.trial2 !== undefined && tPenalties.trial2 !== null ? tPenalties.trial2 : '-',
          soc.discardedTrialIdx === 2 ? 'SÌ' : 'NO',
          tScores.trial3 !== undefined && tScores.trial3 !== null ? tScores.trial3 : '-',
          tPenalties.trial3 !== undefined && tPenalties.trial3 !== null ? tPenalties.trial3 : '-',
          soc.discardedTrialIdx === 3 ? 'SÌ' : 'NO',
          tScores.trial4 !== undefined && tScores.trial4 !== null ? tScores.trial4 : '-',
          tPenalties.trial4 !== undefined && tPenalties.trial4 !== null ? tPenalties.trial4 : '-',
          soc.discardedTrialIdx === 4 ? 'SÌ' : 'NO'
        ]);
      });

      const allSocAoARows = [...socInfoRows, ...socBodyRows];
      const wsSocieties = XLSX.utils.aoa_to_sheet(allSocAoARows);

      // Set nice column widths for sheet 2
      wsSocieties['!cols'] = [
        { wch: 22 }, // Posizione
        { wch: 32 }, // Società TAV
        { wch: 16 }, // Penalità Totali
        { wch: 30 }, // Punti Totali Colpiti (Squadra)
        { wch: 16 }, // Prove Effettuate
        { wch: 18 }, // Prova 1 Punteggio
        { wch: 16 }, // Prova 1 Penalità
        { wch: 16 }, // Prova 1 Scartata
        { wch: 18 }, // Prova 2 Punteggio
        { wch: 16 }, // Prova 2 Penalità
        { wch: 16 }, // Prova 2 Scartata
        { wch: 18 }, // Prova 3 Punteggio
        { wch: 16 }, // Prova 3 Penalità
        { wch: 16 }, // Prova 3 Scartata
        { wch: 18 }, // Prova 4 Punteggio
        { wch: 16 }, // Prova 4 Penalità
        { wch: 16 }  // Prova 4 Scartata
      ];

      XLSX.utils.book_append_sheet(wb, wsSocieties, 'Classifica Società');

      const fileName = `${(champ.name || 'Campionato_Regionale').replace(/\s+/g, '_')}_Classifica.xlsx`;
      
      try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (writeErr) {
        console.error("Blob download failed on Dashboard, trying simple XLSX.writeFile:", writeErr);
        XLSX.writeFile(wb, fileName);
      }
    } catch (err) {
      console.error('Error generating Excel file on dashboard:', err);
    }
  };

  // Filtriamo solo le gare REALI (punteggio > 0) per le statistiche
  const upcomingCompetitions = React.useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const comps = competitions
      .filter(c => {
        const compDate = new Date(c.date);
        compDate.setHours(0, 0, 0, 0);
        // Upcoming if date is today or future AND totalScore is 0 (not yet completed)
        return compDate >= now && c.totalScore === 0;
      })
      .map(c => ({
        ...c,
        type: 'competition' as const
      }));

    const regs = userRegistrations
      .filter(r => {
        const regDate = new Date(r.registration_day);
        regDate.setHours(0, 0, 0, 0);
        return regDate >= now;
      })
      .map(r => ({
        id: r.id,
        name: r.event_name,
        date: r.registration_day,
        location: r.event_location,
        discipline: r.event_discipline,
        type: 'registration' as const,
        originalData: r
      }));
    
    return [...comps, ...regs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [competitions, userRegistrations]);

  const compStats = React.useMemo(() => {
    const gare = competitions.filter(c => c.discipline !== Discipline.TRAINING && c.totalScore > 0);
    if (gare.length === 0) return null;

    const totalHits = gare.reduce((acc, c) => acc + c.totalScore, 0);
    const totalCompletedSeries = gare.reduce((acc, c) => acc + c.scores.filter(s => s > 0).length, 0);
    const avg = totalCompletedSeries > 0 ? (totalHits / totalCompletedSeries) : 0;
    
    const gareWithPosition = gare.filter(c => c.position && c.position > 0);
    let bestPlacementComp = null;
    
    if (gareWithPosition.length > 0) {
      bestPlacementComp = gareWithPosition.reduce((best, current) => {
        if (!best) return current;
        if (current.position! < best.position!) return current;
        if (current.position === best.position) {
          return current.totalScore > best.totalScore ? current : best;
        }
        return best;
      }, null as Competition | null);
    }
    
    return { count: gare.length, avg, bestPlacementComp };
  }, [competitions]);

  const trainingStats = React.useMemo(() => {
    const allenamenti = competitions.filter(c => c.discipline === Discipline.TRAINING && c.totalScore > 0);
    if (allenamenti.length === 0) return null;

    const totalHits = allenamenti.reduce((acc, c) => acc + c.totalScore, 0);
    const totalCompletedSeries = allenamenti.reduce((acc, c) => acc + c.scores.filter(s => s > 0).length, 0);
    const avg = totalCompletedSeries > 0 ? (totalHits / totalCompletedSeries) : 0;
    const totalSeries = allenamenti.reduce((acc, c) => acc + c.scores.filter(s => s > 0).length, 0);
    
    return { count: allenamenti.length, avg, totalSeries };
  }, [competitions]);

  const financial = React.useMemo(() => {
    // I costi e le vincite rimangono calcolati su tutto, 
    // assumendo che una gara pianificata possa avere già un costo d'iscrizione
    const totalCost = competitions.reduce((acc, c) => acc + (c.cost || 0), 0);
    const totalWin = competitions.reduce((acc, c) => acc + (c.win || 0), 0);
    return { totalCost, totalWin, balance: totalWin - totalCost };
  }, [competitions]);

  const ratings = React.useMemo(() => calculateRTE(competitions), [competitions]);

  if (competitions.length === 0) {
    return (
      <div className="bg-slate-900 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center">
        <div className="bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-bullseye text-3xl text-slate-600"></i>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {user?.role === 'society' ? `${t('welcome_society')}, ${user.name}` : t('welcome_shooter')}
        </h2>
        <p className="text-slate-400 mb-8 max-w-sm mx-auto">
          {user?.role === 'society' 
            ? t('your_shooters_no_results') 
            : t('start_recording_results')}
        </p>
        {user?.role !== 'society' && (
          <button onClick={onAddClick} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg">
            {t('add_result')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Report Gare (Prestazioni in Gara) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 ml-2">
          <i className="fas fa-trophy text-orange-500"></i>
          <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">{t('race_performance')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl">
            <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">{t('finished_races')}</p>
            <h3 className="text-4xl font-black text-white">{compStats?.count || 0}</h3>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl border-l-4 border-l-orange-600">
            <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">
              {t('race_average')} {
                competitions.filter(c => c.discipline !== Discipline.TRAINING && c.totalScore > 0)
                  .every(c => c.discipline === Discipline.DCK)
                  ? '/50'
                  : '/25'
              }
            </p>
            <h3 className="text-4xl font-black text-orange-500">{compStats?.avg.toFixed(2) || '0.00'}</h3>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl relative group">
            <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">{t('best_placement')}</p>
            {compStats?.bestPlacementComp ? (
              <div>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-4xl font-black text-white">{compStats.bestPlacementComp.position}°</h3>
                    <span className="text-sm font-bold text-slate-400 uppercase">{t('position_label')}</span>
                  </div>
                  <button 
                    onClick={() => setShareData({ comp: compStats.bestPlacementComp! })}
                    className="w-8 h-8 rounded-lg bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                    title={t('share')}
                  >
                    <i className="fas fa-share-alt text-xs"></i>
                  </button>
                </div>
                <div className="mt-1">
                  <p className="text-xs font-bold text-orange-500 uppercase truncate" title={compStats.bestPlacementComp.name}>
                    {compStats.bestPlacementComp.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('average')}: <span className="text-white font-bold">{compStats.bestPlacementComp.averagePerSeries.toFixed(2)}</span> {
                      (compStats.bestPlacementComp.discipline === Discipline.DCK)
                        ? '/50'
                        : '/25'
                    }
                  </p>
                </div>
              </div>
            ) : (
              <h3 className="text-4xl font-black text-slate-700">-</h3>
            )}
          </div>
        </div>
      </div>

      {/* 1.5 Rating Tecnico di Eccellenza (RTE) */}
      {ratings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between ml-2">
            <div className="flex items-center gap-2">
              <i className="fas fa-star text-amber-500"></i>
              <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">{t('technical_rating_title')}</h2>
            </div>
            <div className="group relative">
              <i className="fas fa-info-circle text-slate-600 cursor-help"></i>
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t('technical_rating_desc')}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ratings.map((r, idx) => (
              <div key={`${r.discipline}-${idx}`} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
                {/* Background Decoration */}
                <div className={`absolute -top-12 -right-12 w-24 h-24 rounded-full blur-3xl transition-colors ${r.isProvvisorio ? 'bg-slate-800/20' : 'bg-amber-500/10'}`}></div>
                
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider truncate max-w-[150px]" title={r.discipline}>
                      {t(r.discipline)}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <h3 className={`text-4xl font-black ${r.isProvvisorio ? 'text-slate-400' : 'text-amber-500'}`}>
                        {r.rating.toFixed(2)}
                      </h3>
                      <span className="text-sm font-bold text-slate-500">
                        /{r.discipline === Discipline.DCK ? '50' : '25'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {r.isProvvisorio ? (
                      <span className="text-[8px] font-black bg-slate-800 text-slate-500 px-2 py-1 rounded-full uppercase tracking-tighter border border-slate-700">
                        {t('provvisional')}
                      </span>
                    ) : (
                      <span className="text-[8px] font-black bg-amber-500/20 text-amber-500 px-2 py-1 rounded-full uppercase tracking-tighter border border-amber-500/30">
                        {t('qualified')}
                      </span>
                    )}
                    <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase">
                      {r.count} {r.count === 1 ? t('race_singular') : t('races_plural')}
                    </p>
                  </div>
                </div>

                {/* Progress bar to qualification */}
                {r.isProvvisorio && (
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                      <span className="text-slate-600">{t('qualification_progress')}</span>
                      <span className="text-orange-500">{r.count}/3</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-600 transition-all duration-1000" 
                        style={{ width: `${(r.count / 3) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1.7 Classifiche Regionali FITAV */}
      <div className="space-y-4">
        <div className="flex items-center justify-between ml-2">
          <div className="flex items-center gap-2">
            <i className="fas fa-trophy text-orange-500 animate-pulse"></i>
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Campionati Regionali Tesserato</h2>
          </div>
          <button
            onClick={() => fetchRegionalStandings(true)}
            disabled={isRegLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[10px] font-black uppercase text-slate-400 hover:text-white rounded-lg transition disabled:opacity-50 shadow-sm"
            title="Aggiorna Classifiche"
          >
            <i className={`fas fa-sync-alt ${isRegLoading ? 'fa-spin text-orange-500' : ''}`}></i>
            <span>Aggiorna</span>
          </button>
        </div>

        {isRegLoading ? (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <i className="fas fa-spinner fa-spin text-orange-500 text-lg"></i>
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Caricamento classifiche regionali...</span>
          </div>
        ) : regionalStandings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {regionalStandings.map((stand, idx) => {
              const rc = stand.championship;
              const mine = stand.myStanding;
              const allData = stand.allRankingData;
              const keyGroup = mine ? `${mine.classificationMode}_${mine.classificationValue}` : '';
              const groupShoot = keyGroup ? (allData.groupedRankings?.[keyGroup] || []) : [];

              return (
                <div key={rc.id} className="bg-slate-900 border border-slate-700/60 p-6 rounded-2xl shadow-xl space-y-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-orange-600/5 rounded-full blur-2xl"></div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[8px] font-black uppercase bg-orange-600/25 text-orange-400 px-2 py-0.5 rounded border border-orange-500/25">
                          {rc.season === 'Invernale' ? '❄️ Invernale' : '☀️ Estivo'}
                        </span>
                        <span className="text-[8px] font-mono text-slate-500">{rc.year}</span>
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">{rc.name}</h4>
                      <span className="text-[9px] font-medium text-slate-500">{rc.discipline}</span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedRegionalRanking(allData);
                      }}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 border border-orange-500/20 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 relative z-10"
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    >
                      <i className="fas fa-trophy pointer-events-none"></i>
                      Vedi tutte le classifiche
                    </button>
                  </div>

                  {mine ? (
                    <div className="space-y-4 pt-2">
                      {/* My standing badge display */}
                      <div className="bg-gradient-to-r from-orange-600/10 to-transparent border border-orange-500/20 p-3.5 rounded-xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Il Tuo Posizionamento</p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-2xl font-black text-white">
                            {mine.position ? `${mine.position}°` : '---'}{' '}
                            <span className="text-xs text-orange-400 uppercase font-bold">In Classifica</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            ({mine.classificationMode === 'categoria' ? 'Cat.' : 'Qual.'} {mine.classificationValue})
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400 font-mono">
                          <span>Penalità: <b className="text-orange-500 font-bold">{mine.totalPenalties}</b></span>
                          <span>Centrati: <b className="text-slate-300 font-bold">{mine.totalTargetsHit}</b></span>
                          <span>Prove: <b className="text-slate-300 font-bold">{mine.participatedCount}/4</b></span>
                        </div>
                      </div>

                      {!mine.isClassified && mine.participatedCount > 0 && (
                        <div className="bg-orange-950/25 border border-orange-500/10 p-2.5 rounded-xl">
                          <p className="text-[8.5px] text-orange-400 font-bold leading-normal uppercase">
                            ⚙️ Classifica Provvisoria
                          </p>
                          <p className="text-[8px] text-slate-400 mt-0.5 leading-relaxed">
                            Sei presente in classifica provvisoria. Devi disputare almeno <b>3 prove</b> per qualificarti a quella finale.
                          </p>
                        </div>
                      )}

                      {/* Display podium snippet of my group */}
                      {groupShoot.length > 0 && (
                        <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Podio Attuale {mine.classificationValue}</span>
                          <div className="space-y-1.5">
                            {groupShoot.slice(0, 3).map((sh: any, shIdx: number) => {
                              const isMe = sh.shooterId === mine.shooterId;
                              return (
                                <div key={sh.shooterId} className={`flex items-center justify-between text-[10px] p-1.5 rounded ${isMe ? 'bg-orange-600/15 border border-orange-500/25 font-bold' : ''}`}>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono">{shIdx === 0 ? '🥇' : shIdx === 1 ? '🥈' : '🥉'}</span>
                                    <span className={isMe ? 'text-orange-400' : 'text-slate-300'}>{sh.surname} {sh.name}</span>
                                    {isMe && <span className="text-[7px] font-black uppercase bg-orange-600 text-white px-1 rounded">Tu</span>}
                                  </div>
                                  <span className="font-mono text-slate-400">{sh.totalPenalties} pen.</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Trials brief */}
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[9px] font-mono">
                        {[1, 2, 3, 4].map(trialIdx => {
                          const scr = mine.trialScores[`trial${trialIdx}` as keyof typeof mine.trialScores];
                          const pen = mine.trialPenalties[`trial${trialIdx}` as keyof typeof mine.trialPenalties];
                          const disc = mine.discardedTrialIdx === trialIdx;

                          return (
                            <div key={trialIdx} className="bg-slate-950/50 p-1.5 rounded border border-slate-850">
                              <span className="text-[8px] text-slate-500 block">P{trialIdx}</span>
                              {scr !== null ? (
                                <div className={disc ? 'line-through text-slate-600' : ''}>
                                  <span className="text-slate-300 bold block">{scr}</span>
                                  <span className="text-[8px] text-slate-500">({pen}p)</span>
                                </div>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                              {disc && <span className="text-[7px] text-red-500 font-bold uppercase block scale-90">Scarto</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-950/20 border-2 border-dashed border-slate-800/85 p-6 rounded-xl text-center space-y-2">
                      <i className="fas fa-exclamation-triangle text-slate-600 text-xs"></i>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-bold">Non qualificat{user?.gender === 'F' ? 'a' : 'o'}</p>
                      <p className="text-[9px] text-slate-500 leading-snug">
                        Devi disputare almeno 3 prove per qualificarti. Finora hai registrato prove regionali non collegate o non caricate.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800/60 p-8 rounded-2xl text-center space-y-3 shadow-md">
            <div className="bg-slate-950 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-slate-600 border border-slate-800">
              <i className="fas fa-award text-base text-slate-500"></i>
            </div>
            <div>
              <p className="text-xs font-black text-white uppercase tracking-wider">Nessun Campionato Attivo</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Non sono presenti campionati regionali configurati per la tua regione (<span className="text-orange-400 font-bold">{user?.society_region || 'Nessuna regione configurata'}</span>).
              </p>
              {!user?.society_region && (
                <p className="text-[9.5px] text-slate-500 mt-2">
                  💡 Configura la tua regione nella scheda <b>Profilo</b> per visualizzare i campionati del tuo comprensorio.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Statistiche Allenamento */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 ml-2">
          <i className="fas fa-dumbbell text-blue-500"></i>
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">{t('training_stats')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">{t('practice_average')} /25</p>
            <h3 className="text-3xl font-black text-blue-500">{trainingStats?.avg.toFixed(2) || '0.00'}</h3>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">{t('finished_series')}</p>
            <h3 className="text-3xl font-black text-white">{trainingStats?.totalSeries || 0}</h3>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-600 shadow-xl">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">{t('finished_sessions')}</p>
            <h3 className="text-3xl font-black text-white">{trainingStats?.count || 0}</h3>
          </div>
        </div>
      </div>

      {/* 3. Grafici Statistici */}
      <StatsCharts competitions={competitions} />

      {/* 4. Bilancio Generale (Bilancio Finanziario) */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-white/10 shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 mb-6">
          <i className="fas fa-wallet text-slate-500"></i>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">{t('general_balance')}</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-6">
          <div className="bg-slate-950/50 p-2 sm:p-3 rounded-xl border border-slate-600 min-w-0 flex flex-col justify-center">
            <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase mb-1 leading-tight">{t('total_costs')}</p>
            <p className="text-xs sm:text-xl font-black text-red-500 break-words">€{financial.totalCost.toFixed(2)}</p>
          </div>
          <div className="bg-slate-950/50 p-2 sm:p-3 rounded-xl border border-slate-600 min-w-0 flex flex-col justify-center">
            <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase mb-1 leading-tight">{t('race_winnings')}</p>
            <p className="text-xs sm:text-xl font-black text-green-500 break-words">€{financial.totalWin.toFixed(2)}</p>
          </div>
          <div className="bg-slate-950/50 p-2 sm:p-3 rounded-xl border border-slate-600 min-w-0 flex flex-col justify-center">
            <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase mb-1 leading-tight">{t('net_balance')}</p>
            <p className={`text-xs sm:text-xl font-black break-words ${financial.balance >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
              {financial.balance >= 0 ? '+' : ''}€{financial.balance.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Prossimi Appuntamenti (Personali) */}
      {upcomingCompetitions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between ml-2">
            <div className="flex items-center gap-2">
              <i className="fas fa-calendar-check text-emerald-500 animate-pulse"></i>
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">{t('your_upcoming_appointments')}</h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {upcomingCompetitions.length} {upcomingCompetitions.length === 1 ? t('event') : t('events_caps')}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingCompetitions.slice(0, 4).map(item => {
              const d = new Date(item.date);
              const isToday = d.toDateString() === new Date().toDateString();
              const isReg = item.type === 'registration';

              return (
                <div key={`${item.type}-${item.id}`} className={`group relative bg-slate-900 p-5 rounded-2xl border ${isToday ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10'} shadow-xl overflow-hidden transition-all hover:border-emerald-500/30`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                          !isReg && (item as any).discipline === Discipline.TRAINING 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {isReg 
                            ? t('registration_confirmed') 
                            : (item as any).discipline === Discipline.TRAINING ? t('training_training_short') : t('race_training_short')
                          }
                        </span>
                        {isToday && <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase">{t('today')}</span>}
                      </div>
                      <h4 className="text-lg font-black text-white leading-tight group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {item.name}
                      </h4>
                      {user?.role === 'society' && (item as any).userName && (
                        <p className="text-[10px] font-black text-orange-500 uppercase tracking-tighter">
                          {t('shooter')}: {(item as any).userSurname} {(item as any).userName}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <i className={`fas ${isReg ? 'fa-building' : 'fa-location-dot'} text-slate-500`}></i>
                        {item.location}
                        {societies.find(s => s.name === item.location)?.code && (
                          <span className="text-orange-500 ml-1">({societies.find(s => s.name === item.location)?.code})</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{d.getDate()}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{d.toLocaleString(language === 'it' ? 'it-IT' : 'en-US', { month: 'short' })}</p>
                    </div>
                  </div>
                  
                  {isReg && (
                    <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">{t('session')}</span>
                        <span className="text-[10px] font-bold text-orange-500 uppercase">
                          {item.originalData.shooting_session?.toLowerCase() === 'morning' || item.originalData.shooting_session === 'Mattina' ? t('morning') : 
                           item.originalData.shooting_session?.toLowerCase() === 'afternoon' || item.originalData.shooting_session === 'Pomeriggio' ? t('afternoon') : 
                           t('none_choice')}
                        </span>
                      </div>
                      <button 
                        onClick={() => onEditRegistration?.(item.originalData)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2"
                      >
                        <i className="fas fa-edit text-orange-500"></i>
                        {t('edit')}
                      </button>
                    </div>
                  )}

                  {!isReg && (item as any).notes && (
                    <p className="mt-3 text-[10px] text-slate-500 italic line-clamp-1 border-t border-slate-800/50 pt-2">
                      "{ (item as any).notes }"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Analisi Coach AI - CTA to Full Page */}
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-xl overflow-hidden relative group cursor-pointer hover:border-orange-600/50 transition-all" onClick={onCoachClick}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-orange-600/20 transition-all"></div>
        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
          <div className="w-20 h-20 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-600/20 shrink-0">
            <i className="fas fa-user-tie text-3xl"></i>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
              {user?.role === 'society' ? t('need_team_analysis') : t('want_to_improve_technique')}
            </h3>
            <p className="text-slate-400 text-sm font-medium mb-4">
              {user?.role === 'society' 
                ? t('ai_consultant_analyzed') 
                : t('ai_coach_analyzed')}
            </p>
            <button className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95">
              {t('talk_to_coach')} <i className="fas fa-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      </div>
      {shareData && (
        <ShareCard
          competition={shareData.comp}
          societies={societies}
          user={user}
          isPerfectSeries={shareData.isPerfect}
          onClose={() => setShareData(null)}
        />
      )}

      {selectedRegionalRanking && (() => {
        const rc = selectedRegionalRanking.championship;
        const groupedRankings = selectedRegionalRanking.groupedRankings || {};
        const classifiedSocieties = selectedRegionalRanking.classifiedSocieties || [];
        const unclassifiedSec = selectedRegionalRanking.shooters ? selectedRegionalRanking.shooters.filter((s: any) => !s.isClassified && (s.participatedCount || 0) > 0) : [];

        const t1Obj = events.find(e => e.id === rc.trial1_event_id);
        const t2Obj = events.find(e => e.id === rc.trial2_event_id);
        const t3Obj = events.find(e => e.id === rc.trial3_event_id);
        const t4Obj = events.find(e => e.id === rc.trial4_event_id);

        return createPortal(
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[3000] overflow-y-auto cursor-pointer animate-fade-in"
            onClick={() => setSelectedRegionalRanking(null)}
          >
            <div 
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 relative my-8 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-orange-600/5 rounded-full blur-3xl pointer-events-none"></div>

              {/* Header Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedRegionalRanking(null)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                    title="Chiudi Classifiche"
                  >
                    <i className="fas fa-chevron-left w-5 h-5 flex items-center justify-center" />
                  </button>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[9px] font-black uppercase bg-orange-600/20 text-orange-400 px-2.5 py-0.5 rounded-full border border-orange-500/20">{rc.discipline}</span>
                      <span className="text-[9px] font-black uppercase bg-blue-600/20 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/20">{rc.region}</span>
                      <span className="text-[9px] font-mono text-slate-500">{rc.year}</span>
                    </div>
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">{rc.name}</h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedRegionalRanking(null)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                    style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                  >
                    Chiudi
                  </button>
                </div>
              </div>

              {/* Info Box about Rules */}
              <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl text-xs text-slate-400 space-y-4">
                <div>
                  <p className="font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <i className="fas fa-user text-orange-400" /> Classifica Individuale FITAV:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-400">
                    <li>Sono previste 4 prove regionali. Per entrare in classifica finale è necessario disputare <b>almeno 3 prove</b>.</li>
                    <li>Se un tiratore effettua tutte e 4 le prove, <b>il peggior punteggio (penalità più alta) viene scartato</b>.</li>
                    <li>Le penalità di ogni prova rappresentano la differenza di piattelli rispetto al primo classificato di quella specifica Categoria/Qualifica nel medesimo round.</li>
                    <li>Il tiratore mantiene per tutto il campionato il vincolo di qualifica o categoria stabilito nella sua prima gara disputata.</li>
                  </ul>
                </div>
                <div className="border-t border-slate-800/60 pt-3">
                  <p className="font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <i className="fas fa-users text-blue-400" /> Classifica Società TAV FITAV:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-400">
                    <li>Il punteggio di squadra in ogni prova è determinato dalla somma dei migliori punteggi individuali (hits totali) dei tiratori iscritti alla medesima società.</li>
                    <li>Nelle discipline di <b>Fossa (Trap)</b> concorrono i migliori <b>6 tiratori</b> per ogni prova. Nelle altre discipline concorrono i migliori <b>3 tiratori</b>.</li>
                    <li>Come per l'individuale, le società devono disputare <b>almeno 3 prove</b> per qualificarsi al campionato. Qualora partecipino a tutte le 4 prove, viene applicato lo <b>scarto della peggiore prestazione</b> (punteggio più basso o penalità più alta).</li>
                  </ul>
                </div>
              </div>

              {/* THE TRIALS MAP */}
              <div className={`grid gap-4 ${
                rc.season === 'Estivo' 
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
                  : 'grid-cols-1 sm:grid-cols-3'
              }`}>
                {[1, 2, 3, 4].filter(idx => rc.season === 'Estivo' || idx <= 3).map((trialIdx) => {
                  const trialName = rc[`trial${trialIdx}_name` as keyof typeof rc];
                  const evObj = [t1Obj, t2Obj, t3Obj, t4Obj][trialIdx - 1];
                  const isDisputed = isEventDisputed(evObj);

                  return (
                    <div 
                      key={trialIdx} 
                      className={`border p-3.5 rounded-xl flex items-start gap-3.5 transition-all ${
                        isDisputed 
                          ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.03)]' 
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <span className="p-2.5 rounded-lg text-xs font-mono font-black shrink-0 bg-slate-800 text-slate-400">
                        {trialIdx}°
                      </span>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase tracking-wider block text-slate-500">
                            Regionale - Prova {trialIdx}
                          </span>
                          {isDisputed && (
                            <span className="text-[7px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded">Disputata</span>
                          )}
                        </div>
                        <p className="text-xs font-bold leading-snug break-words text-slate-200">
                          {trialName || 'Non Configurato'}
                        </p>
                        {evObj && (
                          <span className="text-[10px] font-mono block leading-normal text-slate-400">
                            📍 {evObj.location} <br />
                            📅 {formatEventDates(evObj.start_date, evObj.end_date, evObj.date)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* INDIVIDUAL STANDINGS */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fas fa-trophy text-orange-500" /> Classifiche Individuali per Categoria / Qualifica
                  </h3>

                  {Object.keys(groupedRankings).length === 0 ? (
                    <div className="bg-slate-900/30 border border-slate-800 p-8 rounded-xl text-center text-slate-500 text-xs">
                      Nessun risultato o provino caricato finora per questa disciplina.
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {Object.keys(groupedRankings).sort().map((groupKey) => {
                        const shootersInGroup = groupedRankings[groupKey];
                        const [mode, value] = groupKey.split('_');
                        const top1 = shootersInGroup[0];
                        const top2 = shootersInGroup[1];
                        const top3 = shootersInGroup[2];

                        return (
                          <div key={groupKey} className="bg-slate-950/30 rounded-xl border border-slate-800 overflow-hidden shadow-xl shadow-slate-950/20">
                            {/* Group Header */}
                            <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                              <span className="text-xs font-black uppercase text-orange-400 tracking-widest flex items-center gap-2">
                                <i className="fas fa-award" /> {mode === 'categoria' ? 'Categoria' : 'Qualifica'}: {value}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">{shootersInGroup.length} tesserati classificati</span>
                            </div>

                            {/* Display Podium for Group if exists at least one */}
                            <div className="p-4 bg-slate-950/50 border-b border-slate-800/50 flex justify-center items-end py-8 gap-3 sm:gap-6">
                              {/* 2nd Place */}
                              {top2 && (
                                <div className="flex flex-col items-center">
                                  <span className="text-[11px] font-extrabold text-white uppercase tracking-wider text-center">{top2.surname} {top2.name.substring(0, 1)}.</span>
                                  <span className="text-[9px] font-semibold text-slate-400 mb-1 line-clamp-1 max-w-[90px] text-center">{top2.society}</span>
                                  <span className="text-xs font-black text-slate-100 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1 mb-1 shadow-sm">
                                    <span className="text-orange-500">{top2.totalPenalties}</span>
                                    <span className="text-[8px] text-slate-500 font-normal uppercase font-sans">pen.</span>
                                  </span>
                                  <div className="w-14 sm:w-20 bg-gradient-to-t from-slate-850 to-slate-900 border border-slate-700 rounded-t-lg h-14 flex items-center justify-center shadow relative overflow-hidden group">
                                    <span className="text-sm font-black font-mono text-slate-400">2°</span>
                                  </div>
                                </div>
                              )}

                              {/* 1st Place */}
                              {top1 && (
                                <div className="flex flex-col items-center">
                                  <i className="fas fa-trophy text-amber-500 animate-bounce mb-1 drop-shadow-[0_2px_4px_rgba(245,158,11,0.2)]" />
                                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider text-center">{top1.surname} {top1.name.substring(0, 1)}.</span>
                                  <span className="text-[9px] font-extrabold text-slate-400 mb-1 line-clamp-1 max-w-[110px] text-center">{top1.society}</span>
                                  <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1 mb-1 shadow-sm">
                                    <span className="text-amber-500">{top1.totalPenalties}</span>
                                    <span className="text-[8px] text-amber-500 font-normal uppercase font-sans">pen.</span>
                                  </span>
                                  <div className="w-16 sm:w-24 bg-gradient-to-t from-amber-500/20 to-amber-600/10 border-2 border-amber-500/40 rounded-t-lg h-20 flex items-center justify-center shadow-md relative overflow-hidden group">
                                    <span className="text-lg font-black font-mono text-amber-500">1°</span>
                                  </div>
                                </div>
                              )}

                              {/* 3rd Place */}
                              {top3 && (
                                <div className="flex flex-col items-center">
                                  <span className="text-[11px] font-extrabold text-orange-400 uppercase tracking-wider text-center">{top3.surname} {top3.name.substring(0, 1)}.</span>
                                  <span className="text-[9px] font-semibold text-slate-400 mb-1 line-clamp-1 max-w-[90px] text-center">{top3.society}</span>
                                  <span className="text-xs font-black text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 flex items-center gap-1 mb-1 shadow-sm">
                                    <span className="text-orange-500">{top3.totalPenalties}</span>
                                    <span className="text-[8px] text-slate-500 font-normal uppercase font-sans">pen.</span>
                                  </span>
                                  <div className="w-14 sm:w-20 bg-gradient-to-t from-orange-800/10 to-orange-900/5 border border-orange-800 rounded-t-lg h-10 flex items-center justify-center shadow relative overflow-hidden group">
                                    <span className="text-sm font-black font-mono text-orange-400">3°</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Detailed table for the group */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-slate-900 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                    <th className="py-2.5 px-4 text-center">Pos</th>
                                    <th className="py-2.5 px-2">Tiratore</th>
                                    <th className="py-2.5 px-2">TAV Società</th>
                                    <th className="py-2.5 px-2 text-center">Totale Penalità</th>
                                    <th className="py-2.5 px-2 text-center">1° Prova</th>
                                    <th className="py-2.5 px-2 text-center">2° Prova</th>
                                    <th className="py-2.5 px-2 text-center">3° Prova</th>
                                    <th className="py-2.5 px-2 text-center">4° Prova</th>
                                    <th className="py-2.5 px-4 text-center">Hits Totali</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 bg-slate-950/30 text-slate-300">
                                  {shootersInGroup.map((s: any) => {
                                    const isMe = s.shooterId === user?.id || (user?.surname && s.surname?.toLowerCase() === user.surname?.toLowerCase() && s.name?.toLowerCase() === user.name?.toLowerCase());
                                    return (
                                      <tr key={s.shooterId} className={`hover:bg-slate-900/30 transition ${isMe ? 'bg-orange-600/5 font-bold border-l-2 border-l-orange-500' : ''}`}>
                                        <td className="py-2.5 px-4 font-mono font-black text-center text-slate-400">
                                          {s.position === 1 ? '🥇 1' : s.position === 2 ? '🥈 2' : s.position === 3 ? '🥉 3' : `${s.position}°`}
                                        </td>
                                        <td className="py-2.5 px-2 font-bold text-white">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className={isMe ? 'text-orange-400' : ''}>{s.surname} {s.name}</span>
                                            {isMe && <span className="text-[7px] font-black uppercase bg-orange-600 text-white px-1 rounded-sm">Tu</span>}
                                            {!s.isClassified && (
                                              <span className="text-[7.5px] font-black uppercase tracking-wider bg-orange-600/20 text-orange-400 border border-orange-500/20 px-1 py-0.5 rounded-sm">
                                                {s.participatedCount}/3 prove
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-[8px] font-mono text-slate-500 block">Code: {s.shooter_code || '---'}</span>
                                        </td>
                                        <td className="py-2.5 px-2 text-slate-400">{s.society || '---'}</td>
                                        <td className="py-2.5 px-2 text-center font-black text-orange-400">{s.totalPenalties}</td>

                                        {/* Render Trial 1 */}
                                        <td className="py-2.5 px-2 text-center font-mono">
                                          {s.trialScores.trial1 !== null ? (
                                            <div className={`${s.discardedTrialIdx === 1 ? 'line-through text-slate-500' : ''}`}>
                                              <span className="font-semibold text-slate-300">{s.trialScores.trial1}</span>
                                              <span className="text-[9px] text-slate-500 ml-1">({s.trialPenalties.trial1}p)</span>
                                              {s.discardedTrialIdx === 1 && <span className="text-[8px] font-bold text-red-500 block scale-90">Scarto</span>}
                                            </div>
                                          ) : (
                                            <span className="text-slate-600">-</span>
                                          )}
                                        </td>

                                        {/* Render Trial 2 */}
                                        <td className="py-2.5 px-2 text-center font-mono">
                                          {s.trialScores.trial2 !== null ? (
                                            <div className={`${s.discardedTrialIdx === 2 ? 'line-through text-slate-500' : ''}`}>
                                              <span className="font-semibold text-slate-300">{s.trialScores.trial2}</span>
                                              <span className="text-[9px] text-slate-500 ml-1">({s.trialPenalties.trial2}p)</span>
                                              {s.discardedTrialIdx === 2 && <span className="text-[8px] font-bold text-red-500 block scale-90">Scarto</span>}
                                            </div>
                                          ) : (
                                            <span className="text-slate-600">-</span>
                                          )}
                                        </td>

                                        {/* Render Trial 3 */}
                                        <td className="py-2.5 px-2 text-center font-mono">
                                          {s.trialScores.trial3 !== null ? (
                                            <div className={`${s.discardedTrialIdx === 3 ? 'line-through text-slate-500' : ''}`}>
                                              <span className="font-semibold text-slate-300">{s.trialScores.trial3}</span>
                                              <span className="text-[9px] text-slate-500 ml-1">({s.trialPenalties.trial3}p)</span>
                                              {s.discardedTrialIdx === 3 && <span className="text-[8px] font-bold text-red-500 block scale-90">Scarto</span>}
                                            </div>
                                          ) : (
                                            <span className="text-slate-600">-</span>
                                          )}
                                        </td>

                                        {/* Render Trial 4 */}
                                        <td className="py-2.5 px-2 text-center font-mono">
                                          {s.trialScores.trial4 !== null ? (
                                            <div className={`${s.discardedTrialIdx === 4 ? 'line-through text-slate-500' : ''}`}>
                                              <span className="font-semibold text-slate-300">{s.trialScores.trial4}</span>
                                              <span className="text-[9px] text-slate-500 ml-1">({s.trialPenalties.trial4}p)</span>
                                              {s.discardedTrialIdx === 4 && <span className="text-[8px] font-bold text-red-500 block scale-90">Scarto</span>}
                                            </div>
                                          ) : (
                                            <span className="text-slate-600">-</span>
                                          )}
                                        </td>

                                        <td className="py-2.5 px-4 text-center font-mono text-slate-400 font-bold">{s.totalTargetsHit}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SOCIETIES SECTION */}
                {classifiedSocieties.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <i className="fas fa-building text-orange-500" /> Classifica Campionato Società TAV
                    </h3>

                    <div className="bg-slate-950/30 rounded-xl border border-slate-800 overflow-hidden shadow-xl shadow-slate-950/20">
                      <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-blue-400 tracking-widest">Classifica TAV Regionale</span>
                        <span className="text-[10px] font-mono text-slate-400 font-sans">Top {(rc.discipline || '').toLowerCase().includes('fossa') || (rc.discipline || '').toLowerCase().includes('trap') ? '6' : '3'} Tiratori per prova</span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                              <th className="py-2.5 px-4 text-center">Pos</th>
                              <th className="py-2.5 px-2">Società</th>
                              <th className="py-2.5 px-2 text-center">Totale Penalità</th>
                              <th className="py-2.5 px-2 text-center">1° Prova</th>
                              <th className="py-2.5 px-2 text-center">2° Prova</th>
                              <th className="py-2.5 px-2 text-center">3° Prova</th>
                              <th className="py-2.5 px-2 text-center">4° Prova</th>
                              <th className="py-2.5 px-4 text-center">Punti Totali</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 bg-slate-950/20 text-slate-300">
                            {classifiedSocieties.map((soc: any) => {
                              return (
                                <tr key={soc.societyName} className="hover:bg-slate-900/30 transition">
                                  <td className="py-2.5 px-4 font-mono font-black text-center text-slate-400">
                                    {soc.position === 1 ? '🥇 1' : soc.position === 2 ? '🥈 2' : soc.position === 3 ? '🥉 3' : `${soc.position}°`}
                                  </td>
                                  <td className="py-2.5 px-2 font-bold text-white">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span>{soc.societyName}</span>
                                      {!soc.isClassified && (
                                        <span className="text-[7.5px] font-black uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded-sm">
                                          {soc.participatedCount}/3 prove
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2 text-center font-black text-orange-400">{soc.totalPenalties}</td>

                                  {/* Render Trial 1 */}
                                  <td 
                                    className={`py-2.5 px-2 text-center font-mono ${soc.trialScores.trial1 !== null ? 'cursor-pointer hover:bg-slate-800/30 rounded transition-colors' : ''}`}
                                    onClick={() => {
                                      if (soc.trialScores.trial1 !== null) {
                                        setSelectedTrialDetails({
                                          societyName: soc.societyName,
                                          trialLabel: rc.trial1_name || '1° Prova',
                                          score: soc.trialScores.trial1,
                                          shooters: soc.trialDetails?.trial1 || []
                                        });
                                      }
                                    }}
                                    title={soc.trialScores.trial1 !== null ? "Clicca per visualizzare i dettagli dei tiratori" : undefined}
                                  >
                                    {soc.trialScores.trial1 !== null ? (
                                      <div className={`${soc.discardedTrialIdx === 1 ? 'line-through text-slate-500' : ''}`}>
                                        <span className="font-semibold text-orange-400 hover:text-orange-300 underline decoration-dashed decoration-orange-500/40 underline-offset-2">{soc.trialScores.trial1}</span>
                                        <span className="text-[9px] text-slate-400 ml-1">({soc.trialPenalties.trial1}p)</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>

                                  {/* Render Trial 2 */}
                                  <td 
                                    className={`py-2.5 px-2 text-center font-mono ${soc.trialScores.trial2 !== null ? 'cursor-pointer hover:bg-slate-800/30 rounded transition-colors' : ''}`}
                                    onClick={() => {
                                      if (soc.trialScores.trial2 !== null) {
                                        setSelectedTrialDetails({
                                          societyName: soc.societyName,
                                          trialLabel: rc.trial2_name || '2° Prova',
                                          score: soc.trialScores.trial2,
                                          shooters: soc.trialDetails?.trial2 || []
                                        });
                                      }
                                    }}
                                    title={soc.trialScores.trial2 !== null ? "Clicca per visualizzare i dettagli dei tiratori" : undefined}
                                  >
                                    {soc.trialScores.trial2 !== null ? (
                                      <div className={`${soc.discardedTrialIdx === 2 ? 'line-through text-slate-500' : ''}`}>
                                        <span className="font-semibold text-orange-400 hover:text-orange-300 underline decoration-dashed decoration-orange-500/40 underline-offset-2">{soc.trialScores.trial2}</span>
                                        <span className="text-[9px] text-slate-400 ml-1">({soc.trialPenalties.trial2}p)</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>

                                  {/* Render Trial 3 */}
                                  <td 
                                    className={`py-2.5 px-2 text-center font-mono ${soc.trialScores.trial3 !== null ? 'cursor-pointer hover:bg-slate-800/30 rounded transition-colors' : ''}`}
                                    onClick={() => {
                                      if (soc.trialScores.trial3 !== null) {
                                        setSelectedTrialDetails({
                                          societyName: soc.societyName,
                                          trialLabel: rc.trial3_name || '3° Prova',
                                          score: soc.trialScores.trial3,
                                          shooters: soc.trialDetails?.trial3 || []
                                        });
                                      }
                                    }}
                                    title={soc.trialScores.trial3 !== null ? "Clicca per visualizzare i dettagli dei tiratori" : undefined}
                                  >
                                    {soc.trialScores.trial3 !== null ? (
                                      <div className={`${soc.discardedTrialIdx === 3 ? 'line-through text-slate-500' : ''}`}>
                                        <span className="font-semibold text-orange-400 hover:text-orange-300 underline decoration-dashed decoration-orange-500/40 underline-offset-2">{soc.trialScores.trial3}</span>
                                        <span className="text-[9px] text-slate-400 ml-1">({soc.trialPenalties.trial3}p)</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>

                                  {/* Render Trial 4 */}
                                  <td 
                                    className={`py-2.5 px-2 text-center font-mono ${soc.trialScores.trial4 !== null ? 'cursor-pointer hover:bg-slate-800/30 rounded transition-colors' : ''}`}
                                    onClick={() => {
                                      if (soc.trialScores.trial4 !== null) {
                                        setSelectedTrialDetails({
                                          societyName: soc.societyName,
                                          trialLabel: rc.trial4_name || '4° Prova',
                                          score: soc.trialScores.trial4,
                                          shooters: soc.trialDetails?.trial4 || []
                                        });
                                      }
                                    }}
                                    title={soc.trialScores.trial4 !== null ? "Clicca per visualizzare i dettagli dei tiratori" : undefined}
                                  >
                                    {soc.trialScores.trial4 !== null ? (
                                      <div className={`${soc.discardedTrialIdx === 4 ? 'line-through text-slate-500' : ''}`}>
                                        <span className="font-semibold text-orange-400 hover:text-orange-300 underline decoration-dashed decoration-orange-500/40 underline-offset-2">{soc.trialScores.trial4}</span>
                                        <span className="text-[9px] text-slate-400 ml-1">({soc.trialPenalties.trial4}p)</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-4 text-center font-mono text-slate-400 font-bold">{soc.totalScoreSum}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* UNCLASSIFIED SECTION */}
                {unclassifiedSec.length > 0 && (
                  <div className="bg-slate-950/20 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2 font-sans">Tiratori Iscritti in Attesa di Qualificazione (meno di 3 prove):</span>
                    <div className="flex flex-wrap gap-2">
                      {unclassifiedSec.map((s: any) => (
                        <span key={s.shooterId} className="px-2.5 py-1 bg-slate-900/60 text-slate-400 rounded-lg text-xs font-medium border border-slate-800 font-sans">
                          {s.surname} {s.name} ({s.participatedCount} prove)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button 
                  onClick={() => setSelectedRegionalRanking(null)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer active:scale-95"
                >
                  Chiudi Classifiche
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* --- POPUP DETTAGLI SQUADRA SOCIETÀ PER PROVA --- */}
      {selectedTrialDetails && createPortal(
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[3100] cursor-pointer animate-fade-in"
          onClick={() => setSelectedTrialDetails(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 relative overflow-hidden cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest">Dettaglio Punteggio</h4>
                <p className="text-[10px] font-bold text-white mt-0.5">{selectedTrialDetails.societyName}</p>
              </div>
              <button 
                onClick={() => setSelectedTrialDetails(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition cursor-pointer font-bold text-lg"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Prova Selezionata</span>
                  <p className="text-xs font-bold text-slate-300 mt-0.5">{selectedTrialDetails.trialLabel}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Punteggio Totale</span>
                  <p className="text-lg font-black text-orange-500">{selectedTrialDetails.score}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <i className="fas fa-users text-slate-500" /> Tiratori Contribuenti
                </p>

                {selectedTrialDetails.shooters.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-950/30 rounded-lg">
                    Nessun tiratore ha contribuito a questo punteggio per questa prova.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {selectedTrialDetails.shooters.map((s: any, idx: number) => (
                      <div 
                        key={s.id || idx} 
                        className="bg-slate-950/40 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between hover:bg-slate-950/70 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-mono text-[9px] font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-white uppercase">{s.surname} {s.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {s.category && (
                                <span className="text-[8px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700 px-1 py-0.2 rounded">
                                  {s.category}
                                </span>
                              )}
                              {s.mode && (
                                <span className="text-[7.5px] text-slate-500 font-mono">
                                  ({s.mode === 'categoria' ? 'Categoria' : 'Qualifica'})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-orange-400">{s.score}</span>
                          <span className="text-[8px] text-slate-500 block font-sans">centrati</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setSelectedTrialDetails(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-lg transition cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Dashboard;
