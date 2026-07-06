import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Trophy, 
  Award, 
  Calendar, 
  ChevronLeft, 
  Download, 
  Plus, 
  Trash, 
  Edit, 
  MapPin, 
  RotateCcw, 
  Building, 
  Check, 
  Loader2, 
  Users,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Search
} from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useLanguage } from '../../contexts/LanguageContext';

const formatDateStr = (dateStr: any) => {
  if (!dateStr) return '---';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('it-IT');
};

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

interface RegionalChampionshipsProps {
  user: any;
  token: string;
  onBack?: () => void;
}

export const RegionalChampionships: React.FC<RegionalChampionshipsProps> = ({ user, token, onBack }) => {
  const { triggerToast, triggerConfirm } = useUI();
  const { t } = useLanguage();
  
  const [championships, setChampionships] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChampId, setSelectedChampId] = useState<string | null>(null);
  const [rankingData, setRankingData] = useState<any | null>(null);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [selectedTrialDetails, setSelectedTrialDetails] = useState<{
    societyName: string;
    trialLabel: string;
    score: number;
    shooters: any[];
  } | null>(null);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formSeason, setFormSeason] = useState<'Invernale' | 'Estivo'>('Invernale');
  const [formRegion, setFormRegion] = useState('');
  const [formDiscipline, setFormDiscipline] = useState('Fossa Olimpica');
  
  // 4 Trials
  const [trial1Name, setTrial1Name] = useState('');
  const [trial1EventId, setTrial1EventId] = useState('');
  const [trial2Name, setTrial2Name] = useState('');
  const [trial2EventId, setTrial2EventId] = useState('');
  const [trial3Name, setTrial3Name] = useState('');
  const [trial3EventId, setTrial3EventId] = useState('');
  const [trial4Name, setTrial4Name] = useState('');
  const [trial4EventId, setTrial4EventId] = useState('');

  // 4 trial search states and dropdown control
  const [trialSearches, setTrialSearches] = useState<{[key: number]: string}>({ 1: '', 2: '', 3: '', 4: '' });
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  // Dropdown options
  const regions = [
    'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 
    'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 
    'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 
    'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto', 'Tutte'
  ];

  const disciplines = [
    'Fossa Olimpica', 'Skeet', 'Compak Sporting', 'Fossa Universale', 
    'Double Trap', 'Elica', 'Percorso di Caccia'
  ];

  // Load championships and events with cache fallback
  const loadData = async (forceRefetch = false) => {
    if (!forceRefetch) {
      try {
        const cachedChamps = sessionStorage.getItem('clay_tracker_champs_list');
        const cachedEvents = sessionStorage.getItem('clay_tracker_champs_events');
        if (cachedChamps && cachedEvents) {
          const parsedEvents = JSON.parse(cachedEvents);
          const hasStatusField = Array.isArray(parsedEvents) && (parsedEvents.length === 0 || ('start_date' in parsedEvents[0] && 'status' in parsedEvents[0]));
          if (hasStatusField) {
            setChampionships(JSON.parse(cachedChamps));
            setEvents(parsedEvents);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error('Error reading championships cache:', e);
      }
    }

    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const chRes = await fetch('/api/regional-championships', { headers });
      let champsData = [];
      if (chRes.ok) {
        champsData = await chRes.json();
        setChampionships(champsData);
      }

      const evRes = await fetch('/api/events?lightweight=true', { headers });
      let evData = [];
      if (evRes.ok) {
        evData = await evRes.json();
        setEvents(evData);
      }

      try {
        const lightweightEvents = evData.map((e: any) => ({
          id: e.id,
          name: e.name,
          location: e.location,
          discipline: e.discipline,
          date: e.start_date,
          start_date: e.start_date,
          end_date: e.end_date,
          status: e.status
        }));
        sessionStorage.setItem('clay_tracker_champs_list', JSON.stringify(champsData));
        sessionStorage.setItem('clay_tracker_champs_events', JSON.stringify(lightweightEvents));
      } catch (e) {
        console.warn('Unable to cache championships data in sessionStorage due to storage limits or restrictions:', e);
      }
    } catch (err) {
      console.error('Error loading regional championships data:', err);
      triggerToast('Errore nel caricamento dei dati', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [token]);

  // Load ranking for a specific championship
  const selectChampionship = async (id: string) => {
    setSelectedChampId(id);
    setIsRankingLoading(true);
    try {
      const chRes = await fetch(`/api/regional-championships/${id}/ranking`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (chRes.ok) {
        const data = await chRes.json();
        setRankingData(data);
      } else {
        triggerToast('Impossibile calcolare la classifica.', 'error');
      }
    } catch (err) {
      console.error('Error loading ranking:', err);
      triggerToast('Errore nel calcolo della classifica.', 'error');
    } finally {
      setIsRankingLoading(false);
    }
  };

  // Close ranking view
  const closeRanking = () => {
    setSelectedChampId(null);
    setRankingData(null);
  };

  // Handle Event selection for trial to prefill name
  const handleEventSelect = (trialIdx: number, eventId: string) => {
    const selectedEv = events.find(e => e.id === eventId);
    const eventName = selectedEv ? `${selectedEv.name} - ${selectedEv.location}` : '';
    
    if (trialIdx === 1) {
      setTrial1EventId(eventId);
      if (eventName) setTrial1Name(eventName);
    } else if (trialIdx === 2) {
      setTrial2EventId(eventId);
      if (eventName) setTrial2Name(eventName);
    } else if (trialIdx === 3) {
      setTrial3EventId(eventId);
      if (eventName) setTrial3Name(eventName);
    } else if (trialIdx === 4) {
      setTrial4EventId(eventId);
      if (eventName) setTrial4Name(eventName);
    }
  };

  // CRUD actions
  const openCreateForm = () => {
    setEditingId(null);
    setFormName('');
    setFormYear(new Date().getFullYear());
    setFormSeason('Invernale');
    setFormRegion(user?.society_region || 'Lazio');
    setFormDiscipline('Fossa Olimpica');
    setTrial1Name('');
    setTrial1EventId('');
    setTrial2Name('');
    setTrial2EventId('');
    setTrial3Name('');
    setTrial3EventId('');
    setTrial4Name('');
    setTrial4EventId('');
    setTrialSearches({ 1: '', 2: '', 3: '', 4: '' });
    setActiveDropdown(null);
    setIsFormOpen(true);
  };

  const openEditForm = (rc: any) => {
    setEditingId(rc.id);
    setFormName(rc.name);
    setFormYear(rc.year);
    setFormSeason(rc.season);
    setFormRegion(rc.region);
    setFormDiscipline(rc.discipline);
    setTrial1Name(rc.trial1_name || '');
    setTrial1EventId(rc.trial1_event_id || '');
    setTrial2Name(rc.trial2_name || '');
    setTrial2EventId(rc.trial2_event_id || '');
    setTrial3Name(rc.trial3_name || '');
    setTrial3EventId(rc.trial3_event_id || '');
    setTrial4Name(rc.trial4_name || '');
    setTrial4EventId(rc.trial4_event_id || '');
    setTrialSearches({ 1: '', 2: '', 3: '', 4: '' });
    setActiveDropdown(null);
    setIsFormOpen(true);
  };

  const deleteChampionship = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerConfirm(
      'Elimina Campionato',
      'Sei sicuro di voler eliminare questo campionato regionale? L\'azione è irreversibile.',
      async () => {
        try {
          const res = await fetch(`/api/regional-championships/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            triggerToast('Campionato regionale eliminato con successo', 'success');
            loadData(true);
          } else {
            triggerToast('Errore durante l\'eliminazione', 'error');
          }
        } catch (err) {
          triggerToast('Errore di connessione', 'error');
        }
      },
      'Elimina',
      'danger'
    );
  };

  const toggleVisibility = async (id: string) => {
    const championship = championships.find(rc => rc.id === id);
    if (!championship) return;

    try {
      const response = await fetch(`/api/regional-championships/${id}/toggle-visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ is_visible: !championship.is_visible })
      });
      
      if (!response.ok) throw new Error('Failed to toggle visibility');
      
      triggerToast('Visibilità aggiornata con successo', 'success');
      loadData(true);
    } catch (err) {
      console.error(err);
      triggerToast('Errore durante l\'aggiornamento della visibilità', 'error');
    }
  };

  const saveChampionship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      triggerToast('Inserisci un nome valido', 'error');
      return;
    }

    const payload = {
      name: formName,
      year: formYear,
      season: formSeason,
      region: formRegion,
      discipline: formDiscipline,
      trial1_name: trial1Name,
      trial1_event_id: trial1EventId,
      trial2_name: trial2Name,
      trial2_event_id: trial2EventId,
      trial3_name: trial3Name,
      trial3_event_id: trial3EventId,
      trial4_name: formSeason === 'Invernale' ? '' : trial4Name,
      trial4_event_id: formSeason === 'Invernale' ? '' : trial4EventId
    };

    try {
      const url = editingId ? `/api/regional-championships/${editingId}` : '/api/regional-championships';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        triggerToast(editingId ? 'Campionato aggiornato' : 'Campionato creato', 'success');
        setIsFormOpen(false);
        loadData(true);
      } else {
        const errorData = await res.json();
        triggerToast(errorData.error || 'Errore nel salvataggio', 'error');
      }
    } catch (err) {
      triggerToast('Errore di connessione', 'error');
    }
  };

  // Excel exporter
  const downloadExcel = () => {
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

      // Save file
      const safeChampName = (champ.name || 'Campionato_Regionale').replace(/\s+/g, '_');
      const fileName = `${safeChampName}_Classifica.xlsx`;
      
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
        console.error("Blob download failed, trying simple XLSX.writeFile:", writeErr);
        XLSX.writeFile(wb, fileName);
      }

      triggerToast('Classifica scaricata con successo', 'success');
    } catch (err) {
      console.error('Error generating Excel file:', err);
      triggerToast('Errore nella generazione del file Excel', 'error');
    }
  };

  const downloadPDF = () => {
    if (!rankingData) return;

    try {
      const rc = rankingData.championship || {};
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Header block
      doc.setFillColor(15, 23, 42); // slate-900 (brand dark)
      doc.rect(0, 0, pageWidth, 40, 'F');

      // Top branding banner
      doc.setFillColor(234, 88, 12); // orange-600 accent bar
      doc.rect(0, 38, pageWidth, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('CLAY PERFORMANCE', pageWidth / 2, 13, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('CLASSIFICA CAMPIONATO REGIONALE', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text((rc.name || '').toUpperCase(), pageWidth / 2, 30, { align: 'center' });

      let currentY = 48;

      // Event Info Box
      doc.setTextColor(51, 65, 85); // slate-700
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Disciplina FITAV:', 15, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(rc.discipline || 'N/D', 42, currentY);

      doc.setFont('helvetica', 'bold');
      doc.text('Regione:', 115, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(rc.region || 'N/D', 132, currentY);

      currentY += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Anno:', 15, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text((rc.year || '').toString(), 42, currentY);

      doc.setFont('helvetica', 'bold');
      doc.text('Regolamento:', 115, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text('Scarto della prova peggiore su 4 totali (min 3 gare)', 138, currentY);

      currentY += 12;

      // Individual Classifications grouped by category/qualification
      const sortedGroupKeys = Object.keys(rankingData.groupedRankings || {}).sort();

      sortedGroupKeys.forEach((groupKey) => {
        const shootersInGroup = rankingData.groupedRankings[groupKey] || [];
        if (shootersInGroup.length === 0) return;

        const [mode, value] = groupKey.split('_');
        const modeLabel = mode === 'categoria' ? 'CATEGORIA' : 'QUALIFICA';
        const groupTitle = `${modeLabel}: ${value.toUpperCase()}`;

        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(234, 88, 12); // orange-600
        doc.text(groupTitle, 15, currentY);
        currentY += 4;

        const headers = [['Pos', 'Tiratore', 'Società Tesseramento', 'Pen. Tot', 'Pr 1', 'Pr 2', 'Pr 3', 'Pr 4', 'Hits Tot']];

        const body = shootersInGroup.map((s: any) => {
          const formatTrial = (idx: number) => {
            const scoreKey = `trial${idx}` as keyof typeof s.trialScores;
            const penaltyKey = `trial${idx}` as keyof typeof s.trialPenalties;
            const score = s.trialScores[scoreKey];
            const penalty = s.trialPenalties[penaltyKey];

            if (score === null || score === undefined) return '-';
            
            const isDiscarded = s.discardedTrialIdx === idx;
            let text = `${score} (${penalty}p)`;
            if (isDiscarded) {
              text += '*';
            }
            return text;
          };

          const posStr = s.position ? `${s.position}°` : 'NC';
          const shooterName = `${s.surname || ''} ${s.name || ''}${s.shooter_code ? `\n(${s.shooter_code})` : ''}`;

          return [
            posStr,
            shooterName,
            s.society || '---',
            s.totalPenalties !== undefined && s.totalPenalties !== null ? s.totalPenalties.toString() : '0',
            formatTrial(1),
            formatTrial(2),
            formatTrial(3),
            formatTrial(4),
            s.totalTargetsHit !== undefined && s.totalTargetsHit !== null ? s.totalTargetsHit.toString() : '0'
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: headers,
          body: body,
          theme: 'striped',
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 7, valign: 'middle' },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' }, // Pos
            1: { cellWidth: 35 }, // Tiratore
            2: { cellWidth: 'auto' }, // Società
            3: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }, // Pen. Tot
            4: { cellWidth: 16, halign: 'center' }, // Pr 1
            5: { cellWidth: 16, halign: 'center' }, // Pr 2
            6: { cellWidth: 16, halign: 'center' }, // Pr 3
            7: { cellWidth: 16, halign: 'center' }, // Pr 4
            8: { cellWidth: 14, halign: 'center' }  // Hits Tot
          },
          margin: { left: 15, right: 15 },
          didDrawPage: (data: any) => {
            currentY = data.cursor.y + 12;
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 12;
      });

      // Societies Section
      const societiesRaw = (rankingData.classifiedSocieties || []).filter((s: any) => (s.participatedCount || 0) > 0);
      const unsocRaw = (rankingData.societies || []).filter((s: any) => !s.isClassified && (s.participatedCount || 0) > 0);
      const sortedSocieties = [...societiesRaw, ...unsocRaw];

      if (sortedSocieties.length > 0) {
        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(234, 88, 12); // orange-600
        doc.text('CLASSIFICA SOCIETÀ TAV', 15, currentY);
        currentY += 4;

        const headers = [['Pos', 'Associazione TAV', 'Penalità Totali', 'Punti Totali', 'Prove', 'Pr 1', 'Pr 2', 'Pr 3', 'Pr 4']];

        const body = sortedSocieties.map((soc: any) => {
          const formatTrial = (idx: number) => {
            const scoreKey = `trial${idx}` as keyof typeof soc.trialScores;
            const penaltyKey = `trial${idx}` as keyof typeof soc.trialPenalties;
            const score = soc.trialScores[scoreKey];
            const penalty = soc.trialPenalties[penaltyKey];

            if (score === null || score === undefined) return '-';
            
            const isDiscarded = soc.discardedTrialIdx === idx;
            let text = `${score} (${penalty}p)`;
            if (isDiscarded) {
              text += '*';
            }
            return text;
          };

          const posStr = soc.position ? `${soc.position}°` : 'NC';

          return [
            posStr,
            soc.societyName || '---',
            soc.totalPenalties !== undefined && soc.totalPenalties !== null ? soc.totalPenalties.toString() : '0',
            soc.totalScoreSum !== undefined && soc.totalScoreSum !== null ? soc.totalScoreSum.toString() : '0',
            (soc.participatedCount || 0).toString(),
            formatTrial(1),
            formatTrial(2),
            formatTrial(3),
            formatTrial(4)
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: headers,
          body: body,
          theme: 'striped',
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 7, valign: 'middle' },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' }, // Pos
            1: { cellWidth: 'auto' }, // Società
            2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, // Pen. Tot
            3: { cellWidth: 20, halign: 'center' }, // Punti Tot
            4: { cellWidth: 14, halign: 'center' }, // Prove
            5: { cellWidth: 16, halign: 'center' }, // Pr 1
            6: { cellWidth: 16, halign: 'center' }, // Pr 2
            7: { cellWidth: 16, halign: 'center' }, // Pr 3
            8: { cellWidth: 16, halign: 'center' }  // Pr 4
          },
          margin: { left: 15, right: 15 },
          didDrawPage: (data: any) => {
            currentY = data.cursor.y + 12;
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 12;
      }

      // Footer and Page numbers
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.setFont('helvetica', 'normal');
        doc.text(`Pagina ${i} di ${totalPages} - Classifica Campionato Regionale - Clay Performance`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      const safeChampName = (rc.name || 'Campionato_Regionale').replace(/\s+/g, '_');
      doc.save(`${safeChampName}_Classifica.pdf`);
      triggerToast('Classifica scaricata in formato PDF con successo', 'success');
    } catch (err) {
      console.error('Error generating PDF:', err);
      triggerToast('Errore nella generazione della classifica PDF', 'error');
    }
  };

  // Helper render for premium card
  const formatSeason = (season: string) => {
    return season === 'Invernale' ? '❄️ Invernale' : '☀️ Estiva';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-4" />
        <span className="text-xs text-slate-400 font-mono">Elaborazione campionati regionali in corso...</span>
      </div>
    );
  }

  // --- RENDERING DETAIL VIEW (RANKINGS & PODIUMS) ---
  if (selectedChampId && rankingData) {
    const rc = rankingData.championship;
    const groupedRankings = rankingData.groupedRankings || {};
    const societies = rankingData.classifiedSocieties || [];
    const unclassifiedSec = rankingData.shooters ? rankingData.shooters.filter((s: any) => !s.isClassified) : [];
    const unclassifiedSoc = rankingData.societies ? rankingData.societies.filter((s : any) => !s.isClassified) : [];

    // Filter events to find the ones matching trials
    const t1Obj = events.find(e => e.id === rc.trial1_event_id);
    const t2Obj = events.find(e => e.id === rc.trial2_event_id);
    const t3Obj = events.find(e => e.id === rc.trial3_event_id);
    const t4Obj = events.find(e => e.id === rc.trial4_event_id);

    return (
      <div className="space-y-6">
        {/* Header navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <button 
              onClick={closeRanking}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Indietro ai Campionati"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-black uppercase bg-orange-600/20 text-orange-400 px-2.5 py-0.5 rounded-full border border-orange-500/20">{rc.discipline}</span>
                <span className="text-[9px] font-black uppercase bg-blue-600/20 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/20">{rc.region}</span>
                <span className="text-[9px] font-mono text-slate-500">{rc.year}</span>
              </div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">{rc.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={downloadExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/10 cursor-pointer active:scale-95"
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Scarica Classifica Excel
            </button>
            <button 
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-500/10 cursor-pointer active:scale-95"
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            >
              <FileText className="w-4 h-4" />
              Scarica Classifica PDF
            </button>
          </div>
        </div>

        {/* Info Box about Rules */}
        <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl text-xs text-slate-400 space-y-2">
          <p className="font-bold text-slate-300">💡 Regolamento Classifica FITAV:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Sono previste 4 prove regionali. Per entrare in classifica finale è necessario disputare <b>almeno 3 prove</b>.</li>
            <li>Se un tiratore effettua tutte e 4 le prove, <b>il peggior punteggio (penalità più alta) viene scartato</b>.</li>
            <li>Le penalità di ogni prova rappresentano la differenza di piattelli rispetto al primo classificato di quella specifica Categoria/Qualifica nel medesimo round.</li>
            <li>Il tiratore mantiene per tutto il campionato il vincolo di qualifica o categoria stabilito nella sua prima gara disputata.</li>
          </ul>
        </div>

        {/* THE TRIALS MAP */}
        <div className={`grid gap-4 ${
          rc.season === 'Estivo' 
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
            : 'grid-cols-1 sm:grid-cols-3'
        }`}>
          {[1, 2, 3, 4].filter(idx => rc.season === 'Estivo' || idx <= 3).map((trialIdx) => {
            const trialName = rc[`trial${trialIdx}_name` as keyof typeof rc];
            const trialEvId = rc[`trial${trialIdx}_event_id` as keyof typeof rc];
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

        {/* VISUAL SECTIONS (TIRATORI O SOCIETÀ TABS) */}
        <div className="space-y-8">
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-orange-500" /> Classifiche Individuali per Categoria / Qualifica
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
                    <div key={groupKey} className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-xl shadow-slate-950/20">
                      {/* Group Header */}
                      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-orange-400 tracking-widest flex items-center gap-2">
                          <Award className="w-4 h-4" /> {mode === 'categoria' ? 'Categoria' : 'Qualifica'}: {value}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{shootersInGroup.length} tesserati classificati</span>
                      </div>

                      {/* Display Podium for Group if exists at least one */}
                      <div className="p-4 bg-white border-b border-slate-200 flex justify-center items-end py-8 gap-3 sm:gap-6">
                        {/* 2nd Place */}
                        {top2 && (
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider text-center">{top2.surname} {top2.name.substring(0, 1)}.</span>
                            <span className="text-[9px] font-semibold text-slate-500 mb-1 line-clamp-1 max-w-[90px] text-center">{top2.society}</span>
                            <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 flex items-center gap-1 mb-1 shadow-sm">
                              <span className="text-orange-600">{top2.totalPenalties}</span>
                              <span className="text-[8px] text-slate-500 font-normal uppercase">pen.</span>
                            </span>
                            <div className="w-14 sm:w-20 bg-gradient-to-t from-slate-200 to-slate-100 border border-slate-300 rounded-t-lg h-14 flex items-center justify-center shadow relative overflow-hidden group">
                              <span className="text-sm font-black font-mono text-slate-700">2°</span>
                              <div className="absolute inset-0 bg-white/40 skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            </div>
                          </div>
                        )}

                        {/* 1st Place */}
                        {top1 && (
                          <div className="flex flex-col items-center">
                            <Trophy className="w-5 h-5 text-amber-500 animate-bounce mb-1 drop-shadow-[0_2px_4px_rgba(245,158,11,0.2)]" />
                            <span className="text-xs font-black text-amber-800 uppercase tracking-wider text-center">{top1.surname} {top1.name.substring(0, 1)}.</span>
                            <span className="text-[9px] font-extrabold text-slate-500 mb-1 line-clamp-1 max-w-[110px] text-center">{top1.society}</span>
                            <span className="text-xs font-black text-slate-800 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-300 flex items-center gap-1 mb-1 shadow-sm">
                              <span className="text-amber-600">{top1.totalPenalties}</span>
                              <span className="text-[8px] text-amber-700 font-normal uppercase">pen.</span>
                            </span>
                            <div className="w-16 sm:w-24 bg-gradient-to-t from-yellow-200 to-amber-100 border-2 border-yellow-400 rounded-t-lg h-20 flex items-center justify-center shadow-md relative overflow-hidden group">
                              <span className="text-lg font-black font-mono text-amber-800">1°</span>
                              <div className="absolute inset-0 bg-white/40 skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            </div>
                          </div>
                        )}

                        {/* 3rd Place */}
                        {top3 && (
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider text-center">{top3.surname} {top3.name.substring(0, 1)}.</span>
                            <span className="text-[9px] font-semibold text-slate-500 mb-1 line-clamp-1 max-w-[90px] text-center">{top3.society}</span>
                            <span className="text-xs font-black text-slate-800 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 flex items-center gap-1 mb-1 shadow-sm">
                              <span className="text-orange-600">{top3.totalPenalties}</span>
                              <span className="text-[8px] text-slate-500 font-normal uppercase">pen.</span>
                            </span>
                            <div className="w-14 sm:w-20 bg-gradient-to-t from-orange-200 to-orange-100 border border-orange-300 rounded-t-lg h-10 flex items-center justify-center shadow relative overflow-hidden group">
                              <span className="text-sm font-black font-mono text-orange-800">3°</span>
                              <div className="absolute inset-0 bg-white/40 skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
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
                          <tbody className="divide-y divide-slate-800 bg-slate-950/30">
                            {shootersInGroup.map((s) => {
                              return (
                                <tr key={s.shooterId} className="hover:bg-slate-900/30 transition text-slate-300">
                                  <td className="py-2.5 px-4 font-mono font-black text-center text-slate-400">
                                    {s.position === 1 ? '🥇 1' : s.position === 2 ? '🥈 2' : s.position === 3 ? '🥉 3' : `${s.position}°`}
                                  </td>
                                  <td className="py-2.5 px-2 font-bold text-white">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span>{s.surname} {s.name}</span>
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
                                        {s.discardedTrialIdx === 1 && <span className="text-[8px] font-bold text-red-500 block">Scartata</span>}
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
                                        {s.discardedTrialIdx === 2 && <span className="text-[8px] font-bold text-red-500 block">Scartata</span>}
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
                                        {s.discardedTrialIdx === 3 && <span className="text-[8px] font-bold text-red-500 block">Scartata</span>}
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
                                        {s.discardedTrialIdx === 4 && <span className="text-[8px] font-bold text-red-500 block">Scartata</span>}
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
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Building className="w-4 h-4 text-orange-500" /> Classifica Campionato Società TAV
            </h3>

            {societies.length === 0 ? (
              <div className="bg-slate-900/30 border border-slate-800 p-8 rounded-xl text-center text-slate-500 text-xs">
                Nessun punteggio per le società registrato finora.
              </div>
            ) : (
              <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-xl shadow-slate-950/20">
                <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-blue-400 tracking-widest">Classifica TAV Regionale</span>
                  <span className="text-[10px] font-mono text-slate-400">Top {(rc.discipline || '').toLowerCase().includes('fossa') || (rc.discipline || '').toLowerCase().includes('trap') ? '6' : '3'} Tiratori per prova</span>
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
                    <tbody className="divide-y divide-slate-800 bg-slate-950/30 text-slate-300">
                      {societies.map((soc) => {
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
                                  {soc.discardedTrialIdx === 1 && <span className="text-[8px] font-bold text-red-500 block">Scartata</span>}
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
                                  {soc.discardedTrialIdx === 2 && <span className="text-[8px] font-bold text-red-500 block">Scartata</span>}
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
                                  {soc.discardedTrialIdx === 3 && <span className="text-[8px] font-bold text-red-500 block">Scartata</span>}
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
                                  {soc.discardedTrialIdx === 4 && <span className="text-[8px] font-bold text-red-500 block">Scartata</span>}
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
            )}
          </div>

          {/* UNCLASSIFIED SECTION */}
          {unclassifiedSec.length > 0 && (
            <div className="bg-slate-900/20 border border-slate-800/60 p-4 rounded-xl">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Tiratori Iscritti in Attesa di Qualificazione (meno di 3 prove):</span>
              <div className="flex flex-wrap gap-2">
                {unclassifiedSec.map((s: any) => (
                  <span key={s.shooterId} className="px-2.5 py-1 bg-slate-900/60 text-slate-400 rounded-lg text-xs font-medium border border-slate-800">
                    {s.surname} {s.name} ({s.participatedCount} prove)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* --- POPUP DETTAGLI SQUADRA SOCIETÀ PER PROVA --- */}
          {selectedTrialDetails && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-full blur-2xl"></div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest">Dettaglio Punteggio</h4>
                    <p className="text-[10px] font-bold text-white mt-0.5">{selectedTrialDetails.societyName}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedTrialDetails(null)}
                    className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
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
                      <Users className="w-3.5 h-3.5 text-slate-500" /> Tiratori Contribuenti (Top {(rc.discipline || '').toLowerCase().includes('fossa') || (rc.discipline || '').toLowerCase().includes('trap') ? '6' : '3'})
                    </p>

                    {selectedTrialDetails.shooters.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-950/30 rounded-lg">
                        Nessun tiratore ha contribuito a questo punteggio per questa prova.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {selectedTrialDetails.shooters.map((s, idx) => (
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
                              <span className="text-[8px] text-slate-500 block">centrati</span>
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
                    className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-lg transition cursor-pointer"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- RENDERING CHAMPIONSHIPS LIST (HOME TAB VIEW) ---
  return (
    <div className="space-y-6">
      {/* Header layout */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-5 h-5 text-orange-500 animate-pulse" /> Campionati Regionali FITAV
          </h2>
          <p className="text-xs text-slate-400">Gestisci e traccia i campionati regionali italiani Invernale ed Estivo.</p>
        </div>
        {user?.role === 'admin' && (
          <button 
            onClick={openCreateForm}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition shadow-lg shadow-orange-600/10"
          >
            <Plus className="w-4 h-4" /> Crea Campionato
          </button>
        )}
      </div>

      {/* Grid of existing championships */}
      {championships.length === 0 ? (
        <div className="bg-slate-900/40 border-2 border-dashed border-slate-800 p-12 rounded-xl text-center flex flex-col items-center justify-center space-y-3">
          <Trash className="w-10 h-10 text-slate-600" />
          <p className="text-xs text-slate-400">Nessun campionato regionale registrato.</p>
          {user?.role === 'admin' && (
            <button 
              onClick={openCreateForm}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-[10px] font-black uppercase tracking-wider rounded-lg"
            >
              Crea Ora
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {championships.filter(rc => user?.role === 'admin' || rc.is_visible).map((rc) => {
            // Check if user is in this region
            const isUserInRegion = user?.society_region === rc.region || rc.region === 'Tutte';

            return (
              <div key={rc.id} className="flex flex-col gap-2">
                {user?.role === 'admin' && (
                  <div className="flex items-center justify-end gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleVisibility(rc.id); }}
                      className={`p-1.5 bg-slate-800 ${rc.is_visible ? 'text-slate-300' : 'text-orange-500'} hover:text-white rounded-lg hover:bg-slate-700 transition`}
                      title="Toggle Visibility"
                    >
                      {rc.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); openEditForm(rc); }}
                      className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition"
                      title="Modifica"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => deleteChampionship(rc.id, e)}
                      className="p-1.5 bg-slate-800 text-red-400 hover:text-red-300 rounded-lg hover:bg-slate-700 transition"
                      title="Elimina"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div 
                  onClick={() => selectChampionship(rc.id)}
                  className="group cursor-pointer bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 p-5 rounded-xl transition-all shadow hover:shadow-xl hover:translate-y-[-2px] relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-orange-600/5 rounded-full blur-2xl group-hover:bg-orange-600/10 transition"></div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/50">
                        {formatSeason(rc.season)}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">{rc.year}</span>
                    </div>
                  </div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider group-hover:text-orange-400 transition mb-4">{rc.name}</h3>
                  <div className="space-y-2.5 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                       <MapPin className="w-3.5 h-3.5 text-slate-500" />
                       <span>Regione: <b className="text-slate-300">{rc.region}</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Award className="w-3.5 h-3.5 text-slate-500" />
                       <span>Disciplina: <b className="text-slate-300">{rc.discipline}</b></span>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-black uppercase text-orange-400 tracking-wider">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> Visualizza Classifiche
                    </span>
                    {isUserInRegion && (
                      <span className="text-[9px] font-medium bg-emerald-600/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/10">Tua Regione</span>
                    )}
                  </div>
                </div>
              </div>

            );
          })}
        </div>
      )}

      {/* --- CRUD DIALOG / FORM --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {editingId ? '📝 Modifica Campionato Regionale' : '🏆 Nuovo Campionato Regionale'}
            </h3>

            <form onSubmit={saveChampionship} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Nome del Campionato</label>
                  <input 
                    type="text" 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="E.g. Campionato Regionale Lazio"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Anno</label>
                  <input 
                    type="number" 
                    value={formYear}
                    onChange={(e) => setFormYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Stagione</label>
                  <select 
                    value={formSeason}
                    onChange={(e) => setFormSeason(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="Invernale">Invernale</option>
                    <option value="Estivo">Estivo (Estivo)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Regione di tesseramento</label>
                  <select 
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Disciplina</label>
                  <select 
                    value={formDiscipline}
                    onChange={(e) => setFormDiscipline(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* 4 TRIALS SETUP */}
              <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl space-y-4 relative">
                {activeDropdown !== null && (
                  <div 
                    className="fixed inset-0 z-[998]" 
                    onClick={() => setActiveDropdown(null)} 
                  />
                )}

                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-800 pb-2">
                  Prove Regionali (Configura fino a 4 Prove)
                </span>

                {[1, 2, 3, 4].filter(idx => formSeason === 'Estivo' || idx <= 3).map((trialIdx) => {
                  const evId = trialIdx === 1 ? trial1EventId : trialIdx === 2 ? trial2EventId : trialIdx === 3 ? trial3EventId : trial4EventId;
                  const nameVal = trialIdx === 1 ? trial1Name : trialIdx === 2 ? trial2Name : trialIdx === 3 ? trial3Name : trial4Name;
                  const selectedEvent = events.find(e => e.id === evId);

                  return (
                    <div key={trialIdx} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end bg-slate-950/45 p-3 rounded-lg border border-slate-900 relative">
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-orange-400 uppercase block">Gara Collegata {trialIdx}° Prova</label>
                        
                        <div className="relative z-[999]">
                          <input 
                            type="text"
                            placeholder={selectedEvent ? `${selectedEvent.name} - ${selectedEvent.location}` : "-- Cerca e Seleziona Gara --"}
                            value={trialSearches[trialIdx] || ''}
                            onFocus={() => setActiveDropdown(trialIdx)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTrialSearches(prev => ({ ...prev, [trialIdx]: val }));
                              setActiveDropdown(trialIdx);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                          />
                          <div className="absolute left-2.5 top-2.5 text-slate-500 font-sans">
                            <Search className="w-3.5 h-3.5" />
                          </div>
                          
                          {(evId || trialSearches[trialIdx]) && (
                            <button
                              type="button"
                              onClick={() => {
                                handleEventSelect(trialIdx, '');
                                setTrialSearches(prev => ({ ...prev, [trialIdx]: '' }));
                              }}
                              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-100 font-bold text-sm"
                            >
                              ×
                            </button>
                          )}
                        </div>

                        {activeDropdown === trialIdx && (
                          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-[1000] scrollbar-thin divide-y divide-slate-800/65">
                            {(() => {
                              const searchTxt = (trialSearches[trialIdx] || '').toLowerCase().trim();
                              
                              const filtered = events.filter(e => {
                                const cleanDisc = (str: string) => {
                                  return (str || '')
                                    .toLowerCase()
                                    .replace(/\s*\(.*?\)\s*/g, '') // Rimuove sigle tra parentesi tipo (CK) o (FO)
                                    .trim();
                                };
                                const matchesSearch = !searchTxt ||
                                  (e.name || '').toLowerCase().includes(searchTxt) ||
                                  (e.location || '').toLowerCase().includes(searchTxt);
                                
                                return matchesSearch;
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-3 text-center text-xs text-slate-500 font-medium">
                                    Nessuna gara trovata per "{formDiscipline}" ({formRegion})
                                  </div>
                                );
                              }

                              return filtered.map(e => {
                                const isSelected = e.id === evId;
                                return (
                                  <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => {
                                      handleEventSelect(trialIdx, e.id);
                                      setTrialSearches(prev => ({ ...prev, [trialIdx]: '' }));
                                      setActiveDropdown(null);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 transition ${
                                      isSelected ? 'bg-orange-600/20 text-orange-400' : 'hover:bg-slate-900 text-slate-300'
                                    }`}
                                  >
                                    <div className="font-bold flex items-center justify-between gap-2">
                                      <span className="truncate">{e.name}</span>
                                      {isSelected && <span className="text-[9px] bg-orange-600 text-white px-1.5 py-0.2 rounded font-black uppercase">Selezionato</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium flex items-center justify-between">
                                      <span>📍 {e.location || 'N/A'}</span>
                                      <span>📅 {formatEventDates(e.start_date, e.end_date, e.date)}</span>
                                    </div>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase block">Nome Personalizzato {trialIdx}° Prova</label>
                        <input 
                          type="text"
                          value={trialIdx === 1 ? trial1Name : trialIdx === 2 ? trial2Name : trialIdx === 3 ? trial3Name : trial4Name}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (trialIdx === 1) setTrial1Name(val);
                            else if (trialIdx === 2) setTrial2Name(val);
                            else if (trialIdx === 3) setTrial3Name(val);
                            else if (trialIdx === 4) setTrial4Name(val);
                          }}
                          placeholder="Inserisci nome manuale o localita se non trovi la gara"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-lg transition"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition shadow-lg shadow-orange-600/10"
                >
                  Salva Campionato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
