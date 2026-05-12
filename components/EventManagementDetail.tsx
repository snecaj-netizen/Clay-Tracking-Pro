import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Users, RefreshCw, Save, Clock, Target, ArrowRight, 
  ChevronLeft, Mail, Phone, Shield, User, Calendar,
  Download, Trash2, Edit3, Search, Plus, AlertCircle, Printer, Lock, Unlock, X, Copy, AlertTriangle
} from 'lucide-react';
import { SocietyEvent, EventSquad, EventRegistration } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import FitavScoreSheet from './FitavScoreSheet';
import ShootingOrderPreview from './ShootingOrderPreview';
import ExpandingFAB from './ExpandingFAB';
import { EventRegistrationModal } from './EventRegistrationModal';
import { BibPrintModal } from './BibPrintModal';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';

interface EventManagementDetailProps {
  event: SocietyEvent;
  onClose: () => void;
  initialTab?: 'registrations' | 'squads' | 'results';
  user?: any;
  token?: string;
  societies?: any[];
  setManagingResultsEvent?: (ev: SocietyEvent | null) => void;
  setViewingResultsEvent?: (ev: SocietyEvent | null) => void;
  onRegisterShooter?: () => void;
  onEventUpdate?: () => void;
  refreshVersion?: number;
}

export const EventManagementDetail: React.FC<EventManagementDetailProps> = ({
  event,
  onClose,
  initialTab = 'registrations',
  user,
  token,
  societies = [],
  setManagingResultsEvent,
  setViewingResultsEvent,
  onRegisterShooter,
  onEventUpdate,
  refreshVersion = 0
}) => {
  const { triggerConfirm, triggerToast } = useUI();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'registrations' | 'squads' | 'teams' | 'results'>(initialTab as any || 'registrations');
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [squads, setSquads] = useState<EventSquad[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldsCount, setFieldsCount] = useState(event.total_fields || 1);
  const [roundsCount, setRoundsCount] = useState(event.total_fields || 1);
  const [useFieldsCapacity, setUseFieldsCapacity] = useState(event.use_fields_capacity || false);
  const [genDay, setGenDay] = useState<'all' | string>('all');

  const normalizeDate = (d: any) => {
    if (!d || d === 'all') return 'all';
    const s = String(d);
    // Standardize to YYYY-MM-DD
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[0];
    const itMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (itMatch) return `${itMatch[3]}-${itMatch[2]}-${itMatch[1]}`;
    try {
      const date = new Date(s);
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    } catch {}
    return s;
  };

  const squadNumberMap = useMemo(() => {
    const map = new Map<number | string, number>();
    
    // Group squads by day and round
    const grouped: Record<string, EventSquad[]> = {};
    squads.forEach(s => {
      const day = normalizeDate(s.squad_day);
      const round = s.round_number || 1;
      const key = `${day}_${round}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    // For each group, sort by start_time and assign numbers
    Object.values(grouped).forEach(group => {
      group.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      group.forEach((s, index) => {
        map.set(s.id, index + 1);
      });
    });

    return map;
  }, [squads]);

  const displayedSquads = useMemo(() => {
    const normalizedGenDay = normalizeDate(genDay);
    if (normalizedGenDay === 'all') return squads;
    return squads.filter(s => normalizeDate(s.squad_day) === normalizedGenDay);
  }, [squads, genDay]);

  const unassignedRegistrations = useMemo(() => {
    const assignedRegistrationIds = new Set(squads.flatMap(s => s.members.map(m => m.registration_id)));
    const normalizedGenDay = normalizeDate(genDay);

    return registrations.filter(r => {
      const isUnassigned = !assignedRegistrationIds.has(r.id);
      if (normalizedGenDay === 'all') return isUnassigned;
      
      const regDay = normalizeDate(r.registration_day);
      return isUnassigned && (regDay === 'all' || !regDay || regDay === normalizedGenDay);
    });
  }, [registrations, squads, genDay]);

  const isRound1Definitive = useMemo(() => {
    const r1 = displayedSquads.filter(s => (s.round_number || 1) === 1);
    if (r1.length === 0) return false;
    return r1.every(s => s.is_locked);
  }, [displayedSquads]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [regRes, squadRes, resultsRes, teamsRes] = await Promise.all([
        fetch(`/api/events/${event.id}/registrations`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        fetch(`/api/events/${event.id}/squads`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        fetch(`/api/events/${event.id}/results`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        fetch(`/api/events/${event.id}/teams`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        })
      ]);

      if (!regRes.ok || !squadRes.ok || !resultsRes.ok || !teamsRes.ok) throw new Error('Errore nel caricamento dei dati');

      const [regData, squadData, resultsData, teamsData] = await Promise.all([
        regRes.json(), 
        squadRes.json(),
        resultsRes.json(),
        teamsRes.json()
      ]);
      setRegistrations(regData);
      setSquads(squadData);
      setResults(resultsData);
      setTeams(teamsData.filter((t: any) => t.is_sent));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [event.id, refreshVersion]);

  const handleEditRegistration = (reg: EventRegistration) => {
    setEditingRegistration(reg);
  };

  const handleDeleteRegistration = (reg: EventRegistration) => {
    if (!triggerConfirm) return;

    triggerConfirm(
      'Elimina Iscrizione',
      `Sei sicuro di voler eliminare l'iscrizione di ${reg.first_name} ${reg.last_name}?`,
      async () => {
        try {
          const response = await fetch(`/api/events/${event.id}/registrations/${reg.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Errore durante l\'eliminazione');
          }

          triggerToast?.('Iscrizione eliminata con successo', 'success');
          fetchData();
        } catch (err: any) {
          triggerToast?.(err.message, 'error');
        }
      },
      'Elimina',
      'danger'
    );
  };

  const handleSaveSettings = async () => {
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ 
          total_fields: fieldsCount,
          total_rounds: roundsCount,
          use_fields_capacity: useFieldsCapacity,
          start_time: startTime,
          end_time: endTime
        })
      });
      if (!response.ok) throw new Error('Errore nel salvataggio delle impostazioni');
      triggerToast?.('Impostazioni salvate con successo', 'success');
      if (onEventUpdate) onEventUpdate();
    } catch (err: any) {
      triggerToast?.(err.message, 'error');
    }
  };

  const handleGenerate = async () => {
    console.log('handleGenerate called', { fieldsCount, roundsCount, startTime, eventId: event.id, registrationDay: genDay });
    setIsGenerating(true);
    setError(null);
    try {
      // First save the settings to ensure backend uses the correct counts
      const saveResponse = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ 
          total_fields: fieldsCount,
          total_rounds: roundsCount,
          use_fields_capacity: useFieldsCapacity,
          start_time: startTime,
          end_time: endTime
        })
      });
      
      if (!saveResponse.ok) throw new Error('Errore nel salvataggio preliminare delle impostazioni');

      const response = await fetch(`/api/events/${event.id}/squads/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ 
          fieldsCount, 
          startTime,
          registrationDay: genDay
        })
      });
      console.log('generate response status:', response.status);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('generate error data:', errData);
        throw new Error(errData.error || 'Errore nella generazione delle batterie');
      }
      await fetchData();
      setActiveTab('squads');
      setHasUnsavedChanges(false);
      triggerToast?.('Batterie generate con successo', 'success');
    } catch (err: any) {
      console.error('handleGenerate error:', err);
      setError(err.message);
      triggerToast?.(err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleRoundLock = async (day: string, roundNumber: number, lock: boolean) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}/squads/bulk-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          squadDay: day,
          roundNumber,
          lock
        })
      });

      if (res.ok) {
        triggerToast?.(lock ? 'Serie 1 aggiornata' : 'Serie 1 aggiornata', 'success');
        fetchData();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Errore durante l\'aggiornamento delle batterie');
      }
    } catch (err: any) {
      triggerToast?.(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateRounds = async (targetDay?: string) => {
    if (!triggerConfirm) return;

    const dayToUse = targetDay || genDay;
    const dayLabel = dayToUse === 'all' ? 'tutti i giorni' : formatDateDisplay(dayToUse);

    triggerConfirm(
      "Duplica Serie",
      `Sei sicuro di voler duplicare le batterie della Serie 1 per ${dayLabel}? Tutte le serie successive per questo giorno verranno rimosse e ricreate sulla base della Serie 1 attuale.`,
      async () => {
        setIsGenerating(true);
        setError(null);
        try {
          // First save settings
          const saveResponse = await fetch(`/api/events/${event.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ 
              total_fields: fieldsCount,
              total_rounds: roundsCount,
              use_fields_capacity: useFieldsCapacity
            })
          });
          if (!saveResponse.ok) throw new Error('Errore nel salvataggio preliminare delle impostazioni');

          const response = await fetch(`/api/events/${event.id}/squads/duplicate-rounds`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ 
              registrationDay: dayToUse,
              startTime
            })
          });
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Errore nella duplicazione delle serie');
          }
          const data = await response.json();
          await fetchData();
          triggerToast?.(data.message, 'success');
        } catch (err: any) {
          triggerToast?.(err.message, 'error');
        } finally {
          setIsGenerating(false);
        }
      }
    );
  };

  const getEventDays = () => {
    if (!event.start_date || !event.end_date) return [];
    
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    const days = [];
    let current = new Date(start);
    
    while (current <= end) {
      // Use YYYY-MM-DD for internal consistency
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const eventDays = getEventDays();

  const formatDateDisplay = (dateStr: string | undefined) => {
    if (!dateStr || dateStr === 'all') return 'ALL';
    
    // Check if it's format YYYY-MM-DD
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}`;
    }

    // Check if it's already in DD/MM/YYYY format
    if (dateStr.includes('/') && dateStr.split('/').length >= 2) {
      const parts = dateStr.split('/');
      return `${parts[0]}/${parts[1]}`;
    }

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}`;
    } catch {
      return dateStr;
    }
  };

  useEffect(() => {
    // Numero di serie (roundsCount) deve essere uguale al numero di campi (fieldsCount)
    // Se targets sono impostati, calcoliamo i campi (25 bersagli = 1 campo)
    let fc = event.total_fields || 1;
    if (event.targets && event.targets > 0) {
      const calculated = Math.max(1, Math.ceil(event.targets / 25));
      fc = (event.total_fields && event.total_fields > 1) ? event.total_fields : calculated;
    }
    
    setFieldsCount(fc);
    setRoundsCount(fc);
    setUseFieldsCapacity(event.use_fields_capacity || false);
  }, [event.id, event.total_fields, event.targets, event.use_fields_capacity]);

  const maxPossibleFields = useMemo(() => {
    if (!event.targets) return 8;
    return Math.max(1, Math.floor(event.targets / 25));
  }, [event.targets]);

  const [startTime, setStartTime] = useState(event.start_time || '08:00');
  const [endTime, setEndTime] = useState(event.end_time || '18:00');
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [swapConfig, setSwapConfig] = useState<{
    fromSquadIndex: number;
    fromMemberIndex: number;
    toSquadIndex: number;
  } | null>(null);
  const [selectedSquadsForSheet, setSelectedSquadsForSheet] = useState<any[] | null>(null);
  const [selectedShootersForBibsSheet, setSelectedShootersForBibsSheet] = useState<any[] | null>(null);
  const [autoAction, setAutoAction] = useState<'print' | 'download' | null>(null);
  const [showOrderPreview, setShowOrderPreview] = useState(false);
  const [orderPreviewSquads, setOrderPreviewSquads] = useState<EventSquad[]>([]);
  const [showTimes, setShowTimes] = useState(true);
  const [editingRegistration, setEditingRegistration] = useState<EventRegistration | null>(null);

  const INTERNATIONAL_CODES = ['MAN', 'LAD', 'JUN', 'SEN', 'VET', 'MAS'];
  const shouldShowInternational = event.type === 'Internazionale';

  const formatDisplayValue = (val: string | null | undefined) => {
    if (!val) return '';
    if (!shouldShowInternational && INTERNATIONAL_CODES.includes(val.toUpperCase())) {
      return '';
    }
    return val;
  };

  const handleExportExcel = () => {
    // Preparazione dati Batterie
    const squadRows = squads.flatMap(squad => {
      const sqNum = squadNumberMap.get(squad.id) || squad.squad_number;
      return squad.members.map(m => ({
        'Giorno': formatDateDisplay(squad.squad_day) || 'ALL',
        'Batteria': `B${sqNum}`,
        'Orario': squad.start_time || '--:--',
        'Serie': squad.round_number || 1,
        'Campo': squad.field_number,
        'Posizione': m.position,
        'Pettorale': m.bib_number || '',
        'Nome': m.first_name,
        'Cognome': m.last_name,
        'Codice FITAV': m.shooter_code || '',
        'Società': m.society || '',
        'Categoria': formatDisplayValue(m.category),
        'Qualifica': formatDisplayValue(m.qualification)
      }));
    });

    // Ordinamento: Giorno, Serie, Batteria, Posizione
    squadRows.sort((a, b) => {
      const dayA = a.Giorno === 'ALL' ? '0' : String(a.Giorno);
      const dayB = b.Giorno === 'ALL' ? '0' : String(b.Giorno);
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      if (a.Serie !== b.Serie) return (a.Serie as number) - (b.Serie as number);
      const aNum = parseInt(a.Batteria.replace('B', '')) || 0;
      const bNum = parseInt(b.Batteria.replace('B', '')) || 0;
      if (aNum !== bNum) return aNum - bNum;
      return (a.Posizione as number) - (b.Posizione as number);
    });

    // Preparazione dati Iscritti
    const regRows = registrations.map(r => ({
      'Pettorale': r.bib_number || '',
      'Cognome': r.last_name,
      'Nome': r.first_name,
      'Codice FITAV': r.shooter_code || '',
      'Società': r.society || '',
      'Categoria': formatDisplayValue(r.category) || '',
      'Qualifica': formatDisplayValue(r.qualification) || '',
      'Email': r.email || '',
      'Telefono': r.phone || '',
      'Note': r.notes || ''
    }));

    const workbook = XLSX.utils.book_new();
    
    // Se siamo nella tab iscritti, esportiamo solo iscritti o entrambi? 
    // Per ora teniamo entrambi se disponibili, ma diamo priorità a iscritti se richiesto
    if (activeTab === 'registrations') {
      const regSheet = XLSX.utils.json_to_sheet(regRows);
      XLSX.utils.book_append_sheet(workbook, regSheet, "Elenco Iscritti");
    } else {
      if (squadRows.length > 0) {
        const squadSheet = XLSX.utils.json_to_sheet(squadRows);
        XLSX.utils.book_append_sheet(workbook, squadSheet, "Batterie");
      }
      if (regRows.length > 0) {
        const regSheet = XLSX.utils.json_to_sheet(regRows);
        XLSX.utils.book_append_sheet(workbook, regSheet, "Iscritti");
      }
    }

    XLSX.writeFile(workbook, `${activeTab === 'registrations' ? 'iscritti' : 'gara'}_${event.name.replace(/\s+/g, '_')}.xlsx`);
  };

  const reassignBibNumbers = (currentSquads: EventSquad[]) => {
    // Sort squads by day then by number then by round
    const sortedSquads = [...currentSquads].sort((a, b) => {
      const dayA = normalizeDate(a.squad_day);
      const dayB = normalizeDate(b.squad_day);
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      if (a.squad_number !== b.squad_number) return a.squad_number - b.squad_number;
      return (a.round_number || 1) - (b.round_number || 1);
    });

    const bibMap = new Map<number | string, number>();
    let currentBib = 1;

    sortedSquads.forEach(squad => {
      // Sort members by position
      squad.members.sort((a, b) => a.position - b.position);
      squad.members.forEach(member => {
        if (!bibMap.has(member.registration_id)) {
          bibMap.set(member.registration_id, currentBib++);
        }
        member.bib_number = bibMap.get(member.registration_id) || 0;
      });
    });
    return currentSquads;
  };

  const handleSaveSquadsAction = async (updatedSquads: EventSquad[]) => {
    setIsSaving(true);
    try {
      // If we are filtering by day, we need the full list to update
      // But typically we update all squads for this event.
      const response = await fetch(`/api/events/${event.id}/squads/update-members`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ 
          squads: updatedSquads,
          squad_day: 'all' // Auto-save always pushes everything
        })
      });
      if (!response.ok) throw new Error('Errore nel salvataggio automatico');
      
      // Refresh local state without triggering another effect
      const regRes = await fetch(`/api/events/${event.id}/registrations`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const squadRes = await fetch(`/api/events/${event.id}/squads`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      
      if (regRes.ok && squadRes.ok) {
        const regData = await regRes.json();
        const squadData = await squadRes.json();
        setRegistrations(regData);
        setSquads(squadData);
      }
      
      setHasUnsavedChanges(false);
    } catch (err: any) {
      triggerToast?.(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Sync UI changes for rounds and keep consistency
  const updateSquadsAndSave = (newSquads: EventSquad[]) => {
    // Sync Round 1 changes to subsequent rounds if they exist
    const finalSquads = [...newSquads];
    newSquads.filter(s => (s.round_number || 1) === 1 && !s.is_locked).forEach(r1Squad => {
      finalSquads.forEach((otherSquad, idx) => {
        if (otherSquad.squad_number === r1Squad.squad_number && (otherSquad.round_number || 1) > 1) {
          // Sync members from R1 to this round
          finalSquads[idx] = {
            ...otherSquad,
            members: r1Squad.members.map(m => ({ ...m, squad_id: otherSquad.id }))
          };
        }
      });
    });

    // Dynamic squad numbering based on start time
    const renumberedSquads = JSON.parse(JSON.stringify(finalSquads));
    
    // Group, Sort and Update squad_number within renumberedSquads
    const grouped: Record<string, EventSquad[]> = {};
    renumberedSquads.forEach((s: any) => {
      const day = normalizeDate(s.squad_day);
      const round = s.round_number || 1;
      const key = `${day}_${round}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    Object.values(grouped).forEach((group: any) => {
      group.sort((a: any, b: any) => (a.start_time || '').localeCompare(b.start_time || ''));
      group.forEach((s: any, index: number) => {
        s.squad_number = index + 1; // UPDATE SQUAD NUMBER
      });
    });

    const reassigned = reassignBibNumbers(renumberedSquads);
    setSquads(reassigned);
    setHasUnsavedChanges(true);
    handleSaveSquadsAction(reassigned);
  };

  const toggleSquadLock = async (squadId: number, currentLock: boolean) => {
    try {
      const response = await fetch(`/api/events/${event.id}/squads/${squadId}/lock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ is_locked: !currentLock })
      });
      if (!response.ok) throw new Error('Errore nel cambio stato blocco');
      
      setSquads(prev => prev.map(s => s.id === squadId ? { ...s, is_locked: !currentLock } : s));
      triggerToast?.(`Batteria ${currentLock ? 'sbloccata' : 'bloccata'} con successo`, 'success');
    } catch (err: any) {
      triggerToast?.(err.message, 'error');
    }
  };

  const moveMember = (fromSquadIndex: number, fromMemberIndex: number, toSquadIndex: number) => {
    if (squads[fromSquadIndex].is_locked || squads[toSquadIndex].is_locked) {
      triggerToast?.('Una delle batterie è bloccata e non può essere modificata.', 'info');
      return;
    }
    const newSquads = JSON.parse(JSON.stringify(squads));
    
    if (newSquads[toSquadIndex].members.length < 6 || fromSquadIndex === toSquadIndex) {
      const [member] = newSquads[fromSquadIndex].members.splice(fromMemberIndex, 1);
      newSquads[toSquadIndex].members.push(member);
      newSquads[fromSquadIndex].members.forEach((m: any, idx: number) => m.position = idx + 1);
      newSquads[toSquadIndex].members.forEach((m: any, idx: number) => m.position = idx + 1);
      updateSquadsAndSave(newSquads);
    } else {
      setSwapConfig({ fromSquadIndex, fromMemberIndex, toSquadIndex });
    }
  };

  const changePosition = (squadIndex: number, fromIndex: number, toIndex: number) => {
    if (squads[squadIndex].is_locked) {
      triggerToast?.('Questa batteria è bloccata e non può essere modificata.', 'info');
      return;
    }
    const newSquads = JSON.parse(JSON.stringify(squads));
    const squad = newSquads[squadIndex];
    const [member] = squad.members.splice(fromIndex, 1);
    squad.members.splice(toIndex, 0, member);
    squad.members.forEach((m: any, idx: number) => m.position = idx + 1);
    updateSquadsAndSave(newSquads);
  };

  const handleSwapMember = (toMemberIndex: number) => {
    if (!swapConfig) return;
    const { fromSquadIndex, fromMemberIndex, toSquadIndex } = swapConfig;
    const newSquads = JSON.parse(JSON.stringify(squads));
    
    const memberA = newSquads[fromSquadIndex].members[fromMemberIndex];
    const memberB = newSquads[toSquadIndex].members[toMemberIndex];
    
    const tempRegId = memberA.registration_id;
    const tempFirstName = memberA.first_name;
    const tempLastName = memberA.last_name;
    
    memberA.registration_id = memberB.registration_id;
    memberA.first_name = memberB.first_name;
    memberA.last_name = memberB.last_name;
    
    memberB.registration_id = tempRegId;
    memberB.first_name = tempFirstName;
    memberB.last_name = tempLastName;
    
    updateSquadsAndSave(newSquads);
    setSwapConfig(null);
  };

  const handleAddSquad = () => {
    const normalizedGenDay = normalizeDate(genDay);
    const dayToUse = normalizedGenDay === 'all' ? normalizeDate(event.start_date) : normalizedGenDay;
    const daySquads = squads.filter(s => normalizeDate(s.squad_day) === dayToUse && (s.round_number === 1));
    
    // Find first available time slot starting from startTime with 20 min intervals
    let newStartTime = startTime || '09:00';
    const existingTimes = new Set(daySquads.map(s => s.start_time));
    
    // Search for the first available 20-minute slot
    let foundTime = false;
    const [startH, startM] = newStartTime.split(':').map(Number);
    const baseDate = new Date();
    baseDate.setHours(startH, startM, 0, 0);
    
    // Max 10 hours of searching (30 slots)
    for (let i = 0; i < 30; i++) {
      const searchDate = new Date(baseDate.getTime() + i * 20 * 60000);
      const searchTimeStr = `${String(searchDate.getHours()).padStart(2, '0')}:${String(searchDate.getMinutes()).padStart(2, '0')}`;
      if (!existingTimes.has(searchTimeStr)) {
        newStartTime = searchTimeStr;
        foundTime = true;
        break;
      }
    }
    
    const nextSquadNumber = daySquads.length > 0 ? Math.max(...daySquads.map(s => s.squad_number)) + 1 : 1;

    const newSquad: EventSquad = {
      id: Date.now(),
      event_id: event.id,
      squad_number: nextSquadNumber,
      field_number: 1,
      round_number: 1, // Explicitly set round 1
      start_time: newStartTime,
      squad_day: genDay === 'all' ? (event.start_date || undefined) : genDay,
      members: []
    };
    updateSquadsAndSave([...squads, newSquad]);
  };

  const handleAddMemberToSquad = (squadIndex: number, registration: EventRegistration) => {
    if (squads[squadIndex].is_locked) {
      triggerToast?.('Questa batteria è bloccata e non può essere modificata.', 'info');
      return;
    }
    const newSquads = JSON.parse(JSON.stringify(squads));
    if (newSquads[squadIndex].members.length < 6) {
      newSquads[squadIndex].members.push({
        registration_id: registration.id,
        first_name: registration.first_name,
        last_name: registration.last_name,
        category: registration.category,
        qualification: registration.qualification,
        position: newSquads[squadIndex].members.length + 1,
        bib_number: 0 // Will be reassigned
      });
      updateSquadsAndSave(newSquads);
    }
  };

  const handleRemoveSquad = (squadId: number | string) => {
    const squadToRemove = squads.find(s => String(s.id) === String(squadId));
    if (!squadToRemove) return;

    if (squadToRemove.is_locked) {
      triggerToast?.('Per poter eliminare la batteria, bisogna prima sbloccarla.', 'info');
      return;
    }

    if (squadToRemove.members && squadToRemove.members.length > 0) {
      if (triggerConfirm) {
        triggerConfirm(
          'Impossibile Eliminare',
          'Questa batteria contiene dei tiratori. Per eliminarla, devi prima spostare o rimuovere tutti i tiratori assegnati.',
          () => {}, // No action on confirm, just info
          'Ho capito',
          'primary'
        );
      } else {
        triggerToast?.(`Attenzione: La batteria B${squadNumberMap.get(squadToRemove.id) || squadToRemove.squad_number} contiene dei tiratori.`, 'error');
      }
      return;
    }
    
    if (triggerConfirm) {
      triggerConfirm(
        'Elimina Batteria',
        `Sei sicuro di voler eliminare la batteria B${squadNumberMap.get(squadToRemove.id) || squadToRemove.squad_number}?`,
        () => {
          const updated = squads.filter(s => String(s.id) !== String(squadId));
          updateSquadsAndSave(updated);
          triggerToast?.(`Batteria B${squadNumberMap.get(squadToRemove.id) || squadToRemove.squad_number} rimossa`, 'success');
        },
        'Elimina',
        'danger'
      );
    } else {
      setSquads(prev => prev.filter(s => String(s.id) !== String(squadId)));
      setHasUnsavedChanges(true);
    }
  };

  const handleResetAll = () => {
    const hasPopulated = squads.some(s => s.members.length > 0);
    
    if (triggerConfirm) {
      triggerConfirm(
        'Svuota Tutto',
        hasPopulated 
          ? `Attenzione: ci sono batterie che contengono tiratori. Procedendo, TUTTE le batterie verranno eliminate e i tiratori torneranno nell'elenco da assegnare. Vuoi continuare?`
          : 'Sei sicuro di voler eliminare TUTTE le batterie? Questa operazione non può essere annullata.',
        () => {
          updateSquadsAndSave([]);
          triggerToast?.('Tutte le batterie rimosse', 'success');
        },
        'Svuota Tutto',
        'danger'
      );
    }
  };

  const handleToggleLock = (squadId: number | string) => {
    // This is now replaced by toggleSquadLock but keeping the function definition empty or removed
  };

  const handleRemoveMemberFromSquad = (squadIndex: number, memberIndex: number) => {
    if (squads[squadIndex].is_locked) {
      triggerToast?.('Questa batteria è bloccata e non può essere modificata.', 'info');
      return;
    }
    const newSquads = JSON.parse(JSON.stringify(squads));
    newSquads[squadIndex].members.splice(memberIndex, 1);
    newSquads[squadIndex].members.forEach((m: any, idx: number) => m.position = idx + 1);
    updateSquadsAndSave(newSquads);
  };

  const filteredRegistrations = registrations.filter(reg => 
    `${reg.first_name} ${reg.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.shooter_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 relative">
      {/* Global Saving/Generating Overlay */}
      {(isSaving || isGenerating) && (
        <div className="fixed inset-0 z-[100] bg-slate-950/20 backdrop-blur-[2px] cursor-wait pointer-events-auto" />
      )}
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-slate-400 hover:text-orange-500 transition-colors mb-4 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold uppercase tracking-widest">Torna alle Gare</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase tracking-widest border border-orange-500/20">
                Gestione Gara
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-none">
              {event.name}
            </h1>
            <p className="text-slate-400 mt-2 font-medium flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-500" />
                {new Date(event.start_date).toLocaleDateString('it-IT')}
                {event.end_date && event.end_date !== event.start_date && (
                  <> - {new Date(event.end_date).toLocaleDateString('it-IT')}</>
                )}
              </span>
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-500" />
                {event.location}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar w-full md:w-fit">
            <button
              onClick={() => { setActiveTab('registrations'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={`px-4 sm:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${
                activeTab === 'registrations' 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              Iscritti ({registrations.length})
            </button>
            <button
              onClick={() => { setActiveTab('squads'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={`px-4 sm:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${
                activeTab === 'squads' 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              Batterie ({displayedSquads.length})
            </button>
            <button
              onClick={() => { setActiveTab('teams'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={`px-4 sm:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${
                activeTab === 'teams' 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {t('teams_label')} ({teams.length})
            </button>
            <button
              onClick={() => { setActiveTab('results'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={`px-4 sm:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative ${
                activeTab === 'results' 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              Classifiche
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-32">
        {activeTab === 'registrations' && (
          <div className="space-y-6">
            {/* Registrations Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Cerca tiratore o codice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={fetchData}
                  className="flex-1 md:flex-none px-4 py-3 rounded-xl bg-slate-900 [.light-theme_&]:bg-slate-100 border border-slate-800 [.light-theme_&]:border-slate-200 text-slate-400 [.light-theme_&]:text-slate-600 hover:text-slate-200 [.light-theme_&]:hover:text-black transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{t('refresh')}</span>
                </button>
                <button 
                  onClick={handleExportExcel}
                  className="flex-1 md:flex-none px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200 [.light-theme_&]:bg-slate-100 [.light-theme_&]:border-slate-200 [.light-theme_&]:text-slate-600 [.light-theme_&]:hover:bg-slate-200 [.light-theme_&]:hover:text-black transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Scarica in Excel</span>
                </button>
              </div>
            </div>

            {/* Registrations Table */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-bottom border-slate-800 bg-slate-900/50">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Pett.</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tiratore</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Codice</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Società</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Dettagli</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Contatti</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredRegistrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 text-center">
                          {reg.bib_number ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-600 text-[10px] font-black text-white shadow-lg shadow-orange-600/20">
                              {reg.bib_number}
                            </span>
                          ) : (
                            <span className="text-slate-700 text-[10px] font-black uppercase tracking-widest">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-white uppercase tracking-tight">{reg.last_name} {reg.first_name}</p>
                              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                                {formatDateDisplay(reg.registration_day)}
                                <span className="ml-1 text-orange-500/80 text-[8px] font-bold">
                                  - {(() => {
                                      if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(reg.shooting_session)) return reg.shooting_session;
                                      return (reg.shooting_session?.toLowerCase() === 'morning' || reg.shooting_session === 'Mattina' || reg.shooting_session === t('morning')) ? t('morning_short') : 
                                             (reg.shooting_session?.toLowerCase() === 'afternoon' || reg.shooting_session === 'Pomeriggio' || reg.shooting_session === t('afternoon')) ? t('afternoon_short') : 
                                             t('none_short');
                                    })()}
                                </span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-slate-400">{reg.shooter_code || 'N/D'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-300 uppercase">{reg.society || 'N/D'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {formatDisplayValue(reg.category) && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  {formatDisplayValue(reg.category)}
                                </span>
                              )}
                              {formatDisplayValue(reg.qualification) && (
                                <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-[9px] font-black text-orange-500 uppercase tracking-widest">
                                  {formatDisplayValue(reg.qualification)}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 italic truncate max-w-[150px]">
                              {reg.shotgun_brand}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {reg.email && (
                              <div className="flex items-center gap-1.5 text-slate-500 hover:text-orange-500 transition-colors">
                                <Mail className="w-3 h-3" />
                                <span className="text-[10px] font-medium">{reg.email}</span>
                              </div>
                            )}
                            {reg.phone && (
                              <div className="flex items-center gap-1.5 text-slate-500 hover:text-orange-500 transition-colors">
                                <Phone className="w-3 h-3" />
                                <span className="text-[10px] font-medium">{reg.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleEditRegistration(reg)}
                              className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20"
                              title="Modifica iscrizione"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteRegistration(reg)}
                              className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center hover:bg-red-500 transition-all shadow-lg shadow-red-600/20"
                              title="Elimina iscrizione"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Squads Tab */}
        {activeTab === 'squads' && (
          <div className="space-y-8">
            {/* Squads Controls */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Numero Campi</label>
                      <button 
                        onClick={() => {
                          setUseFieldsCapacity(!useFieldsCapacity);
                          setHasUnsavedChanges(true);
                        }}
                        className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${useFieldsCapacity ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}
                      >
                        <span className="text-[9px] font-bold uppercase">{useFieldsCapacity ? 'ON' : 'OFF'}</span>
                        <div className={`w-6 h-3 rounded-full relative transition-colors ${useFieldsCapacity ? 'bg-orange-500' : 'bg-slate-700'}`}>
                          <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${useFieldsCapacity ? 'left-3.5' : 'left-0.5'}`} />
                        </div>
                      </button>
                    </div>
                    <div className="relative">
                      <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                      <select
                        value={fieldsCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setFieldsCount(val);
                          setRoundsCount(val);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500/50 text-white appearance-none"
                      >
                        {Array.from({ length: maxPossibleFields }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} {n === 1 ? 'Campo' : 'Campi'}</option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-1.5 text-[9px] text-slate-500 leading-tight">
                      {useFieldsCapacity 
                        ? `Capacità: ${fieldsCount * 6} posti per orario (${maxPossibleFields} campi max)` 
                        : "Capacità: default 6 posti per orario (fissa)"}
                    </p>
                  </div>

                  {/* Hidden Rounds setting - synchronized with fieldsCount */}
                  <div className="hidden">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Numero Serie (Giri)</label>
                    <div className="relative">
                      <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                      <select
                        value={roundsCount}
                        onChange={(e) => setRoundsCount(parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500/50 text-white appearance-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <option key={n} value={n}>{n} {n === 1 ? 'Serie' : 'Serie'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="w-full">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Orario Inizio</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Clock className="w-3.5 h-3.5 text-orange-500 group-focus-within:scale-110 transition-transform" />
                      </div>
                      <input 
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500/50 text-white [.light-theme_&]:bg-white [.light-theme_&]:border-slate-200 [.light-theme_&]:text-slate-900 appearance-none"
                      />
                    </div>
                  </div>

                  <div className="w-full">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Orario Fine</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Clock className="w-3.5 h-3.5 text-orange-500 group-focus-within:scale-110 transition-transform" />
                      </div>
                      <input 
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500/50 text-white [.light-theme_&]:bg-white [.light-theme_&]:border-slate-200 [.light-theme_&]:text-slate-900 appearance-none"
                      />
                    </div>
                  </div>

                  <div className="w-full">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Giorno Iscritti</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                      <select
                        value={genDay}
                        onChange={(e) => setGenDay(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500/50 text-white appearance-none"
                      >
                        <option value="all">Tutti i giorni</option>
                        {eventDays.map(day => (
                          <option key={day} value={day}>{formatDateDisplay(day)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="w-full">
                    <button
                      onClick={handleSaveSettings}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Salva Impos.
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-end pt-2 border-t border-slate-800/50">
                  <button
                    onClick={() => setShowTimes(!showTimes)}
                    className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                      showTimes 
                        ? 'bg-orange-600/20 border-orange-500/30 text-orange-500 shadow-lg shadow-orange-600/5' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {showTimes ? "Nascondi Orari" : "Mostra Orari"}
                  </button>
                  <button
                    onClick={handleAddSquad}
                    disabled={genDay === 'all'}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={genDay === 'all' ? "Seleziona un giorno specifico per aggiungere una batteria" : ""}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || isSaving || registrations.length === 0 || genDay === 'all'}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={genDay === 'all' ? "Seleziona un giorno specifico per generare le batterie" : ""}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating || isSaving ? 'animate-spin' : ''}`} />
                    {isSaving ? 'Salvataggio...' : 'Genera'}
                  </button>
                  <button
                    onClick={() => {
                      const normalizedGenDay = normalizeDate(genDay);
                      const targetSquads = normalizedGenDay === 'all' ? squads : squads.filter(s => normalizeDate(s.squad_day) === normalizedGenDay);
                      setOrderPreviewSquads(targetSquads);
                      setShowOrderPreview(true);
                    }}
                    disabled={displayedSquads.length === 0 || isSaving}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Ordine di tiro (PDF)
                  </button>
                    <button 
                      onClick={() => {
                        const allTeamsData = displayedSquads
                          .filter(s => s.members && s.members.length > 0)
                          .map(s => ({
                          id: String(s.id),
                          name: `${squadNumberMap.get(s.id) || s.squad_number}`,
                          members: s.members.map(m => ({
                            id: String(m.registration_id),
                            name: m.first_name,
                            surname: m.last_name,
                            category: [formatDisplayValue(m.category), formatDisplayValue(m.qualification)].filter(Boolean).join(' - '),
                            bib_number: m.bib_number
                          })),
                          competition_name: event.name,
                          society: event.location,
                          date: s.squad_day || event.start_date,
                          startTime: s.start_time,
                          roundNumber: s.round_number
                        }));
                        
                        if (allTeamsData.length === 0) {
                          triggerToast?.('Nessuna batteria con tiratori da stampare', 'error');
                          return;
                        }
                        
                        setAutoAction('print');
                        setSelectedSquadsForSheet(allTeamsData);
                      }}
                      disabled={displayedSquads.length === 0}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Stampa Tutti Statini
                    </button>

                    <button 
                      onClick={() => {
                        const shootersList = squads.flatMap(s => s.members);
                        setAutoAction('print');
                        setSelectedShootersForBibsSheet(shootersList);
                      }}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-orange-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Stampa Tutti Pettorali
                    </button>
                </div>
              </div>
              
              {isSaving && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-500 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Salvataggio automatico in corso...
                </div>
              )}

              {registrations.length === 0 && (
                <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Impossibile generare le batterie: nessun tiratore iscritto alla gara.
                </div>
              )}
            </div>

            {/* Squads Grid */}
            
            {unassignedRegistrations.length > 0 && (
              <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">Tiratori da Assegnare ({unassignedRegistrations.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {unassignedRegistrations.map(reg => (
                    <div key={reg.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-tight">
                          {reg.last_name} {reg.first_name}
                          {(formatDisplayValue(reg.category) || formatDisplayValue(reg.qualification)) && (
                            <span className="ml-2 text-[10px] text-slate-500 font-medium">
                              ({[formatDisplayValue(reg.category), formatDisplayValue(reg.qualification)].filter(Boolean).join(' - ')})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                            {formatDateDisplay(reg.registration_day)}
                          </span>
                          <span className="text-[8px] font-bold text-orange-500/60 uppercase">
                            - {(() => {
                                if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(reg.shooting_session)) return reg.shooting_session;
                                return (reg.shooting_session?.toLowerCase() === 'morning' || reg.shooting_session === 'Mattina' || reg.shooting_session === t('morning')) ? t('morning_short') : 
                                       (reg.shooting_session?.toLowerCase() === 'afternoon' || reg.shooting_session === 'Pomeriggio' || reg.shooting_session === t('afternoon')) ? t('afternoon_short') : 
                                       t('none_short');
                              })()}
                          </span>
                        </div>
                        {displayedSquads.length > 0 && (
                          <select 
                            onChange={(e) => {
                              if (e.target.value !== "") {
                                const targetIdx = squads.findIndex(s => String(s.id) === String(e.target.value));
                                if (targetIdx !== -1) handleAddMemberToSquad(targetIdx, reg);
                                e.target.value = "";
                              }
                            }}
                            className="bg-slate-900 border border-slate-800 text-[9px] font-black uppercase tracking-widest text-orange-500 rounded px-2 py-1 focus:outline-none focus:border-orange-500/50 transition-colors"
                            defaultValue=""
                          >
                            <option value="" disabled>ASSEGNA</option>
                            {displayedSquads.map((s) => (
                              s.members.length < 6 && !s.is_locked && (
                                <option key={s.id} value={s.id}>
                                  B{squadNumberMap.get(s.id) || s.squad_number} {s.squad_day ? `(${formatDateDisplay(s.squad_day)})` : '(ALL)'} - {s.start_time}
                                </option>
                              )
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Squads Rendering */}
            <div className="space-y-12">
              {/* Orphan Squads (No assigned day or 'all') - Only show if they exist */}
              {squads.filter(s => {
                const nd = normalizeDate(s.squad_day);
                return !nd || nd === 'all';
              }).length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-red-900/30"></div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-4">
                        <h3 className="text-sm font-black text-red-500 uppercase tracking-[0.3em]">Batterie Non Associate (ALL)</h3>
                        <button 
                          onClick={() => {
                            const orphanSquads = squads.filter(s => {
                              const nd = normalizeDate(s.squad_day);
                              return !nd || nd === 'all';
                            });
                            const populatedSquads = orphanSquads.filter(s => s.members && s.members.length > 0);
                            
                            if (orphanSquads.length === 0) {
                              triggerToast?.('Non ci sono batterie ALL da eliminare.', 'info');
                              return;
                            }

                            if (populatedSquads.length > 0) {
                              triggerToast?.(`Ci sono ${populatedSquads.length} batterie ALL che contengono tiratori. Svuotale prima di eliminarle.`, 'error');
                              return;
                            }

                            if (triggerConfirm) {
                              triggerConfirm(
                                'Elimina tutte le batterie ALL',
                                'Sei sicuro di voler eliminare tutte le batterie non associate a un giorno? Solo le batterie vuote verranno rimosse.',
                                () => {
                                  setSquads(prev => prev.filter(s => {
                                    const nd = normalizeDate(s.squad_day);
                                    return nd !== 'all' && !!nd;
                                  }));
                                  setHasUnsavedChanges(true);
                                  triggerToast?.('Tutte le batterie ALL vuote rimosse (ricordati di salvare)', 'success');
                                },
                                'Elimina Tutto',
                                'danger'
                              );
                            }
                          }}
                          className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white [.light-theme_&]:bg-red-50 [.light-theme_&]:border-red-200 text-[10px] font-black uppercase tracking-widest border border-red-500/20 transition-all"
                        >
                          Elimina Tutte
                        </button>
                      </div>
                      <p className="text-[10px] font-bold text-slate-600">Queste batterie non appariranno nel PDF o negli statini specifici per giorno</p>
                    </div>
                    <div className="h-px flex-1 bg-red-900/30"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {squads.filter(s => {
                      const nd = normalizeDate(s.squad_day);
                      return !nd || nd === 'all';
                    }).map((squad) => {
                      const sOriginalIdx = squads.findIndex(s => s.id === squad.id);
                      return (
                        <div key={squad.id} className="bg-slate-900/30 border border-red-900/20 rounded-3xl p-4 hover:border-red-900/40 transition-all group relative">
                          {/* Common Squad Card Body (Abstracting would be better but keeping it compatible with existing structure) */}
                          <div className="flex flex-col gap-3 mb-6">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center flex-wrap gap-2">
                                  <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                                    <span className="text-sm font-black text-slate-500">B</span>
                                    <input 
                                      type="number"
                                      value={squad.squad_number}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 1;
                                        setSquads(prev => prev.map(s => String(s.id) === String(squad.id) ? { ...s, squad_number: val } : s));
                                        setHasUnsavedChanges(true);
                                      }}
                                      disabled={squad.is_locked}
                                      className="w-10 bg-transparent text-sm font-black text-white focus:outline-none disabled:opacity-50"
                                    />
                                  </div>
                                  <span className="text-[9px] font-black text-red-500 bg-red-500/10 px-2 py-1 rounded-lg uppercase tracking-widest border border-red-500/20">
                                    SENZA DATA
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-4 mt-3">
                                  <div className="flex items-center gap-1.5">
                                    <Target className="w-3 h-3 text-slate-600" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Campo</span>
                                    <input 
                                      type="number"
                                      value={squad.field_number}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 1;
                                        setSquads(prev => prev.map(s => String(s.id) === String(squad.id) ? { ...s, field_number: val } : s));
                                        setHasUnsavedChanges(true);
                                      }}
                                      disabled={squad.is_locked}
                                      className="w-8 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 text-slate-600" />
                                    <input 
                                      type="time"
                                      value={squad.start_time}
                                      onChange={(e) => {
                                        setSquads(prev => prev.map(s => String(s.id) === String(squad.id) ? { ...s, start_time: e.target.value } : s));
                                        setHasUnsavedChanges(true);
                                      }}
                                      disabled={squad.is_locked}
                                      className="bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => toggleSquadLock(Number(squad.id), !!squad.is_locked)}
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                    squad.is_locked 
                                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                                      : 'bg-slate-950 border border-slate-800 text-slate-500 hover:text-orange-500 hover:border-orange-500/50 [.light-theme_&]:bg-white [.light-theme_&]:border-slate-200'
                                  }`}
                                  title={squad.is_locked ? "Sblocca batteria" : "Blocca batteria"}
                                >
                                  {squad.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                </button>
                                  <button 
                                    onClick={() => handleRemoveSquad(squad.id)}
                                    disabled={squad.is_locked}
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                      squad.is_locked 
                                        ? 'bg-slate-900 border border-slate-800 text-slate-800 cursor-not-allowed opacity-30' 
                                        : 'bg-slate-950 border border-slate-800 text-slate-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30'
                                    }`}
                                    title={squad.is_locked ? "Batteria bloccata" : "Elimina batteria"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-950/20 border border-slate-800/30 border-dashed rounded-xl p-4 text-center">
                            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                              {squad.members.length} Tiratori Presenti
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Orphan Squads Warning */}
              {(() => {
                const normalizedEventDays = eventDays.map(d => normalizeDate(d));
                const orphanSquads = squads.filter(s => {
                  const nd = normalizeDate(s.squad_day);
                  return nd !== 'all' && nd !== null && !normalizedEventDays.includes(nd) && nd !== '';
                });

                if (orphanSquads.length === 0) return null;

                return (
                  <div className="p-6 bg-red-950/20 border border-red-900/30 rounded-3xl space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-red-500">
                      <AlertTriangle className="w-5 h-5" />
                      <h3 className="font-black uppercase tracking-tight">Batterie Orfane Rilevate</h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Sono state trovate {orphanSquads.length} batterie con date non corrispondenti ai giorni della gara. 
                      Queste batterie potrebbero impedire la duplicazione corretta.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {orphanSquads.map(squad => (
                        <div key={squad.id} className="bg-slate-900/50 border border-red-900/20 p-3 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black text-white">B{squadNumberMap.get(squad.id) || squad.squad_number} - R{squad.round_number || 1}</p>
                            <p className="text-[9px] text-red-400 font-bold">{squad.squad_day || 'Senza Data'}</p>
                          </div>
                          <button 
                            onClick={() => handleRemoveSquad(squad.id)}
                            className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {(genDay === 'all' ? eventDays : [genDay]).map(day => {
                    const normalizedDay = normalizeDate(day);
                    const daySquads = squads.filter(s => normalizeDate(s.squad_day) === normalizedDay);
                    if (daySquads.length === 0) return null;

                    const maxRound = Math.max(...daySquads.map(s => s.round_number || 1));
                    const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

                    const dayR1 = daySquads.filter(s => (s.round_number || 1) === 1);
                    const isDayR1Locked = dayR1.length > 0 && dayR1.every(s => s.is_locked);

                    return (
                      <div key={day} className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="h-px flex-1 bg-slate-800"></div>
                          <div className="flex items-center gap-4">
                            <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">{formatDateDisplay(day)}</h3>
                            <div className="flex items-center gap-2">
                              {roundsCount > 1 && (
                                <button
                                  onClick={() => handleDuplicateRounds(day)}
                                  disabled={isGenerating || isSaving || !isDayR1Locked}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${
                                    isDayR1Locked 
                                      ? 'bg-orange-600/10 text-orange-500 border-orange-500/30 hover:bg-orange-600/20' 
                                      : 'bg-slate-900 border-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                                  }`}
                                  title={!isDayR1Locked ? "Blocca tutte le batterie della Serie 1 per questo giorno prima di duplicare" : "Duplica Serie 1 per questo giorno"}
                                >
                                  <Copy className="w-3 h-3" />
                                  <span className="hidden sm:inline">{isDayR1Locked ? "Duplica Serie 1" : t('lock_squads_duplicate')}</span>
                                  <span className="sm:hidden">Serie 1</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleRoundLock(day, 1, !isDayR1Locked)}
                                disabled={isGenerating || isSaving || dayR1.length === 0}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${
                                  isDayR1Locked 
                                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' 
                                    : 'bg-green-600/10 text-green-500 border-green-500/30 hover:bg-green-600/20'
                                }`}
                              >
                                {isDayR1Locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                <span>{isDayR1Locked ? "Sblocca Serie 1" : "Blocca Serie 1"}</span>
                              </button>
                            </div>
                          </div>
                          <div className="h-px flex-1 bg-slate-800"></div>
                        </div>

                    <div className="space-y-10">
                      {rounds.map(roundNum => {
                        const squadsInRound = daySquads
                          .filter(s => (s.round_number || 1) === roundNum)
                          .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
                        if (squadsInRound.length === 0) return null;

                        return (
                          <div key={roundNum} className="space-y-4">
                            <div className="flex items-center gap-2 px-2">
                              <span className="px-3 py-1 bg-orange-600/20 text-orange-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-orange-600/30 shadow-lg shadow-orange-600/5">
                                {t('series_number')} {roundNum}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                              {squadsInRound.map((squad) => {
                                const sOriginalIdx = squads.findIndex(s => s.id === squad.id);
                                return (
                                  <div key={squad.id} className="bg-slate-900/30 border border-slate-800 rounded-3xl p-4 hover:border-slate-700 transition-all group relative">
                                    {/* Squad Card Content */}
                                    <div className="flex flex-col gap-3 mb-6">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center flex-wrap gap-2">
                                            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                                              <span className="text-sm font-black text-slate-500">B</span>
                                              <input 
                                                type="number"
                                                value={squad.squad_number}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value) || 1;
                                                  setSquads(prev => prev.map(s => String(s.id) === String(squad.id) ? { ...s, squad_number: val } : s));
                                                  setHasUnsavedChanges(true);
                                                }}
                                                disabled={squad.is_locked}
                                                className="w-10 bg-transparent text-sm font-black text-white focus:outline-none disabled:opacity-50"
                                              />
                                            </div>
                                            {squad.squad_day && (
                                              <span className="text-[9px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded-lg uppercase tracking-widest border border-orange-500/20">
                                                {formatDateDisplay(squad.squad_day)}
                                              </span>
                                            )}
                                          </div>
                                          
                                          <div className="flex items-center gap-4 mt-3">
                                            <div className="flex items-center gap-1.5">
                                              <Target className="w-3 h-3 text-slate-600" />
                                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Campo</span>
                                              <input 
                                                type="number"
                                                value={squad.field_number}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value) || 1;
                                                  setSquads(prev => prev.map(s => String(s.id) === String(squad.id) ? { ...s, field_number: val } : s));
                                                  setHasUnsavedChanges(true);
                                                }}
                                                disabled={squad.is_locked}
                                                className="w-8 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                              />
                                            </div>
                                            {showTimes && (
                                              <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3 text-slate-600" />
                                                <input 
                                                  type="time"
                                                  value={squad.start_time}
                                                  onChange={(e) => {
                                                    setSquads(prev => prev.map(s => String(s.id) === String(squad.id) ? { ...s, start_time: e.target.value } : s));
                                                    setHasUnsavedChanges(true);
                                                  }}
                                                  disabled={squad.is_locked}
                                                  className="bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-orange-500 [.light-theme_&]:bg-white [.light-theme_&]:border-slate-200 [.light-theme_&]:text-slate-900"
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() => toggleSquadLock(Number(squad.id), !!squad.is_locked)}
                                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                              squad.is_locked 
                                                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                                                : 'bg-slate-950 border border-slate-800 text-slate-500 hover:text-orange-500 hover:border-orange-500/50 [.light-theme_&]:bg-white [.light-theme_&]:border-slate-200'
                                            }`}
                                          >
                                            {squad.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                          </button>
                                          <button
                                            onClick={() => {
                                              const teamData = {
                                                id: String(squad.id),
                                                name: `${squadNumberMap.get(squad.id) || squad.squad_number}`,
                                                members: squad.members.map(m => ({
                                                  id: String(m.registration_id),
                                                  name: m.first_name,
                                                  surname: m.last_name,
                                                  category: [formatDisplayValue(m.category), formatDisplayValue(m.qualification)].filter(Boolean).join(' - '),
                                                  bib_number: m.bib_number
                                                })),
                                                competition_name: event.name,
                                                society: event.location,
                                                date: squad.squad_day || event.start_date,
                                                startTime: squad.start_time,
                                                roundNumber: squad.round_number
                                              };
                                              setSelectedSquadsForSheet([teamData]);
                                            }}
                                            className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 flex items-center justify-center hover:text-orange-500 hover:border-orange-500/50 [.light-theme_&]:bg-white [.light-theme_&]:border-slate-200 transition-all"
                                          >
                                            <Printer className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            onClick={() => handleRemoveSquad(squad.id)}
                                            disabled={squad.is_locked}
                                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                              squad.is_locked 
                                                ? 'bg-slate-900 border border-slate-800 text-slate-800 cursor-not-allowed opacity-30' 
                                                : 'bg-slate-950 border border-slate-800 text-slate-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30'
                                            }`}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      {[1, 2, 3, 4, 5, 6].map((pos) => {
                                        const memberIdx = squad.members.findIndex(m => m.position === pos);
                                        const member = memberIdx !== -1 ? squad.members[memberIdx] : null;

                                        return (
                                          <div 
                                            key={pos}
                                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl border transition-all group/member gap-2 ${
                                              member 
                                                ? 'bg-slate-950/50 border-slate-800/80' 
                                                : 'bg-slate-950/20 border-slate-800/30 border-dashed'
                                            }`}
                                          >
                                            <div className="flex items-center gap-3 min-w-0 w-full sm:flex-1">
                                              <span className="w-5 h-5 rounded-lg bg-slate-900 text-[9px] font-black text-slate-600 flex items-center justify-center border border-slate-800 shrink-0">
                                                {pos}
                                              </span>
                                              {member ? (
                                                <div className="truncate flex-1 min-w-0">
                                                  <p className="text-xs font-bold text-white truncate group-hover/member:text-orange-400 transition-colors">
                                                    #{member.bib_number} {member.last_name} {member.first_name}
                                                  </p>
                                                  {(formatDisplayValue(member.category) || formatDisplayValue(member.qualification)) && (
                                                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest mt-0.5 truncate">
                                                      {[formatDisplayValue(member.category), formatDisplayValue(member.qualification)].filter(Boolean).join(' - ')}
                                                    </p>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest italic text-slate-700">Vuoto</span>
                                              )}
                                            </div>

                                            {member && (
                                              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end sm:ml-2 lg:opacity-0 lg:group-hover/member:opacity-100 transition-all shrink-0">
                                                <div className="relative group/tool">
                                                  <select 
                                                    onChange={(e) => {
                                                      if (e.target.value !== "" && sOriginalIdx !== -1) {
                                                        changePosition(sOriginalIdx, memberIdx, parseInt(e.target.value));
                                                        e.target.value = "";
                                                      }
                                                    }}
                                                    className="bg-slate-900 border border-slate-800 text-[9px] font-black text-slate-400 rounded-lg h-7 px-2 focus:outline-none focus:border-orange-500 transition-colors cursor-pointer appearance-none min-w-[32px] text-center hover:text-orange-500 [.light-theme_&]:bg-white [.light-theme_&]:border-slate-200"
                                                    defaultValue=""
                                                    disabled={squad.is_locked}
                                                  >
                                                    <option value="" disabled>P</option>
                                                    {[0, 1, 2, 3, 4, 5].map(p => (
                                                      <option key={p} value={p}>{p + 1}</option>
                                                    ))}
                                                  </select>
                                                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-950 text-[8px] font-bold text-slate-500 px-1.5 py-0.5 rounded border border-slate-800 opacity-0 group-hover/tool:opacity-100 pointer-events-none transition-opacity uppercase tracking-widest">Pos</div>
                                                </div>

                                                <div className="relative group/tool">
                                                  <select 
                                                    onChange={(e) => {
                                                      if (e.target.value !== "" && sOriginalIdx !== -1) {
                                                        const targetSquadId = parseInt(e.target.value);
                                                        const targetIdx = squads.findIndex(s => s.id === targetSquadId);
                                                        moveMember(sOriginalIdx, memberIdx, targetIdx);
                                                        e.target.value = "";
                                                      }
                                                    }}
                                                    className="bg-slate-900 border border-slate-800 text-[9px] font-black text-slate-400 rounded-lg h-7 px-2 focus:outline-none focus:border-orange-500 transition-colors cursor-pointer appearance-none min-w-[32px] text-center hover:text-orange-500 [.light-theme_&]:bg-white [.light-theme_&]:border-slate-200"
                                                    defaultValue=""
                                                    disabled={squad.is_locked}
                                                  >
                                                    <option value="" disabled>S</option>
                                                    {squads.map((s) => (
                                                      String(s.id) !== String(squad.id) && 
                                                      (s.squad_day === squad.squad_day || (!s.squad_day && !squad.squad_day)) && 
                                                      !s.is_locked && 
                                                      s.members.length < 6 && (
                                                        <option key={s.id} value={s.id}>
                                                          B{squadNumberMap.get(s.id) || s.squad_number} - {s.start_time}
                                                        </option>
                                                      )
                                                    ))}
                                                  </select>
                                                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-950 text-[8px] font-bold text-slate-500 px-1.5 py-0.5 rounded border border-slate-800 opacity-0 group-hover/tool:opacity-100 pointer-events-none transition-opacity uppercase tracking-widest whitespace-nowrap">Sposta</div>
                                                </div>

                                                <button
                                                  onClick={() => sOriginalIdx !== -1 && handleRemoveMemberFromSquad(sOriginalIdx, memberIdx)}
                                                  disabled={squad.is_locked}
                                                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-500 hover:text-red-500 hover:border-red-500/30 transition-all disabled:opacity-30"
                                                  title="Rimuovi"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {displayedSquads.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-slate-700" />
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Nessuna batteria</h3>
                  <p className="text-slate-500 text-sm mt-2 max-w-sm">
                    {genDay === 'all' 
                      ? "Non ci sono batterie divise per giorno. Seleziona un giorno per iniziarle."
                      : "Utilizza il pannello sopra per generare le batterie o aggiungerne una manualmente."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="space-y-8">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{t('teams_managed_title')}</h2>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Riepilogo squadre inviate dalle società</p>
                </div>
              </div>

              {teams.length === 0 ? (
                <div className="text-center py-20 bg-slate-950/50 rounded-2xl border border-slate-800/50 border-dashed">
                  <Users className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-50" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nessuna squadra inviata per questa gara</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8">
                  {Array.from(new Set(teams.map(t => t.society))).sort().map(socName => {
                    const socTeams = teams.filter(t => t.society === socName);
                    return (
                      <div key={socName} className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                          <div className="h-px flex-1 bg-slate-800"></div>
                          <h3 className="text-xs font-black text-orange-500 uppercase tracking-[0.25em] bg-slate-900 px-4 py-1.5 rounded-full border border-slate-800 shadow-sm">{socName}</h3>
                          <div className="h-px flex-1 bg-slate-800"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {socTeams.map(team => {
                            const typeDef = (event.discipline === 'Club Cup (PC)' ? [
                              { id: 'PC_A', name: 'SQUADRA A', size: 3 },
                              { id: 'PC_B', name: 'SQUADRA B', size: 3 }
                            ] : [
                              { id: 'SP_A', name: 'SQUADRA A', size: 6 },
                              { id: 'SP_B', name: 'SQUADRA B', size: 3 }
                            ]).find(td => td.id === team.type);

                            return (
                              <div key={team.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl overflow-hidden group hover:border-orange-500/30 transition-all flex flex-col shadow-xl">
                                <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                                  <div className="flex-1">
                                    <h4 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                                      {team.name}
                                      {team.type && <span className="text-[9px] text-orange-500 bg-orange-600/10 px-1.5 py-0.5 rounded-full">{team.type === 'A' || team.type.includes('(A)') || team.type.includes('_A') ? 'A' : team.type === 'B' || team.type.includes('(B)') || team.type.includes('_B') ? 'B' : team.type}</span>}
                                    </h4>
                                  </div>
                                  {team.is_sent && (
                                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1">
                                      <i className="fas fa-check"></i> Inviata
                                    </span>
                                  )}
                                </div>
                                <div className="p-4 space-y-2 flex-1">
                                  {(team.member_ids || []).map((mId: string, mIdx: number) => {
                                    const u = registrations.find(r => String(r.user_id) === String(mId)) || registrations.find(r => String(r.id) === String(mId));
                                    const teamMember = (team.members || []).find((m: any) => String(m.id) === String(mId));
                                    
                                    const displayName = u ? `${u.last_name} ${u.first_name}` : (teamMember ? `${teamMember.last_name || ''} ${teamMember.first_name || ''}`.trim() : 'Tiratore non trovato');
                                    const displayCat = u?.category || teamMember?.category;
                                    const displayQual = u?.qualification || teamMember?.qualification;

                                    return (
                                      <div key={mId} className="flex items-center gap-3 py-1.5 border-b border-slate-800/30 last:border-0">
                                        <span className="text-[9px] font-black text-slate-600">{mIdx + 1}.</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-black text-slate-200 uppercase truncate">
                                            {displayName}
                                          </p>
                                          <div className="flex gap-2">
                                            {displayCat && <span className="text-[8px] font-bold text-slate-500 uppercase">{displayCat}</span>}
                                            {displayQual && <span className="text-[8px] font-bold text-slate-500 uppercase">{displayQual}</span>}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-orange-600/10 text-orange-500 flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner border border-orange-500/20">
                <i className="fas fa-trophy"></i>
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Gestione Classifiche e Risultati</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                Utilizza il sistema avanzato per inserire i punteggi, gestire le categorie, le qualifiche e generare le classifiche ufficiali in PDF.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {(user?.role === 'admin' || (user?.role === 'society' && (event.location === user?.society || event.created_by === user?.id) && event.status !== 'validated')) ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button 
                      onClick={() => {
                        setManagingResultsEvent?.(event);
                      }}
                      className="px-8 py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-orange-600/20 flex items-center gap-3 group"
                    >
                      <i className="fas fa-edit group-hover:rotate-12 transition-transform"></i>
                      Gestisci Risultati
                    </button>
                    {user?.role === 'admin' && event.status === 'validated' && (
                      <button
                        onClick={() => {
                          triggerConfirm?.(
                            'Riapri Classifica',
                            'Sei sicuro di voler riaprire questa classifica per modifiche? Lo stato tornerà a "In Corso".',
                            async () => {
                              try {
                                const res = await fetch(`/api/events/${event.id}/reopen`, {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (res.ok) {
                                  triggerToast?.('Classifica riaperta con successo', 'success');
                                  fetchData();
                                  if (onEventUpdate) onEventUpdate();
                                } else {
                                  triggerToast?.('Errore durante la riapertura', 'error');
                                }
                              } catch (error) {
                                triggerToast?.('Errore di rete', 'error');
                              }
                            }
                          );
                        }}
                        className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 flex items-center gap-3 group"
                      >
                        <i className="fas fa-unlock group-hover:-rotate-12 transition-transform"></i>
                        Riapri Classifica
                      </button>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setViewingResultsEvent?.(event);
                      onClose();
                    }}
                    className="px-8 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg flex items-center gap-3 group"
                  >
                    <i className="fas fa-eye group-hover:scale-110 transition-transform"></i>
                    Vedi Classifica
                  </button>
                )}
              </div>
            </div>

            {results.length > 0 && (
              <div className="bg-slate-900/30 border border-slate-800/50 rounded-3xl p-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <i className="fas fa-info-circle text-orange-500"></i>
                  Riepilogo Risultati Caricati
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Tiratori con Risultato</p>
                    <p className="text-2xl font-black text-white">{results.filter(r => !r.is_registered_only).length}</p>
                  </div>
                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Punteggio Massimo</p>
                    <p className="text-2xl font-black text-orange-500">{Math.max(...results.filter(r => !r.is_registered_only).map(r => r.totalscore || 0), 0)}</p>
                  </div>
                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Stato Gara</p>
                    <p className="text-sm font-bold text-white uppercase tracking-tight">
                      {event.status === 'validated' ? 'Convalidata' : 'In Corso'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Add Button for Registrations */}
      <ExpandingFAB 
        show={activeTab === 'registrations' && (user?.role === 'admin' || user?.role === 'society') && !!onRegisterShooter}
        label="Iscrivi Tiratore"
        onClick={onRegisterShooter}
      />

      {/* Swap Modal */}
      {swapConfig && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">Scambia Tiratore</h3>
            <p className="text-sm text-slate-400 mb-6">
              La batteria di destinazione è piena. Seleziona il tiratore con cui scambiare 
              <strong className="text-white ml-1">
                {squads[swapConfig.fromSquadIndex].members[swapConfig.fromMemberIndex].last_name} {squads[swapConfig.fromSquadIndex].members[swapConfig.fromMemberIndex].first_name}
              </strong>:
            </p>
            <div className="space-y-2">
              {squads[swapConfig.toSquadIndex].members.map((member, mIdx) => (
                <button
                  key={mIdx}
                  onClick={() => handleSwapMember(mIdx)}
                  className="w-full flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800/50 rounded-xl hover:bg-slate-800 hover:border-slate-700 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded bg-slate-900 text-[10px] font-black text-slate-500 flex items-center justify-center border border-slate-800">
                      {member.position}
                    </span>
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-tight">
                      {member.last_name} {member.first_name}
                    </span>
                  </div>
                  <RefreshCw className="w-4 h-4 text-slate-500 group-hover:text-orange-500 transition-colors" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setSwapConfig(null)}
              className="mt-6 w-full py-3 rounded-xl bg-slate-800 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
      {selectedSquadsForSheet && (
        <FitavScoreSheet 
          teams={selectedSquadsForSheet}
          event={event}
          onClose={() => {
            setSelectedSquadsForSheet(null);
            setAutoAction(null);
          }}
          hostingSociety={societies.find(s => s.name === event.location)}
          hideTimes={!showTimes}
          autoAction={autoAction}
        />
      )}
      {selectedShootersForBibsSheet && (
        <BibPrintModal
          shooters={selectedShootersForBibsSheet}
          event={event}
          onClose={() => {
            setSelectedShootersForBibsSheet(null);
            setAutoAction(null);
          }}
          hostingSocietyName={event.location || 'SOCIETÀ'}
          autoAction={autoAction}
        />
      )}

      {showOrderPreview && (
        <ShootingOrderPreview
          event={event}
          squads={orderPreviewSquads}
          onClose={() => setShowOrderPreview(false)}
          squadNumberMap={squadNumberMap}
        />
      )}

      {editingRegistration && (
        <EventRegistrationModal
          key={`edit-${editingRegistration.id}`}
          event={event}
          user={user}
          initialData={editingRegistration}
          onClose={() => setEditingRegistration(null)}
          onSuccess={() => {
            fetchData();
            triggerToast?.('Iscrizione aggiornata con successo', 'success');
          }}
        />
      )}
    </div>
  );
};
