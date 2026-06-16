
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Competition, Discipline } from '../types';
import StatsCharts from './StatsCharts';
import ShareCard from './ShareCard';
import { calculateRTE } from '../ratingUtils';
import { useLanguage } from '../contexts/LanguageContext';

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
                        console.log('Dashboard Excel button clicked, data:', allData);
                        handleDownloadDashboardExcel(allData);
                      }}
                      className="px-3 py-1.5 bg-emerald-600/15 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 relative z-10"
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    >
                      <i className="fas fa-file-excel pointer-events-none"></i>
                      XLSX
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
    </div>
  );
};

export default Dashboard;
