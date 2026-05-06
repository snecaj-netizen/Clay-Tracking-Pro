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
import FitavScoreSheet from './FitavScoreSheet';
import ExpandingFAB from './ExpandingFAB';
import { EventRegistrationModal } from './EventRegistrationModal';
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
  const [activeTab, setActiveTab] = useState<'registrations' | 'squads' | 'results'>(initialTab);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [squads, setSquads] = useState<EventSquad[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldsCount, setFieldsCount] = useState(event.total_fields || 1);
  const [roundsCount, setRoundsCount] = useState(event.total_rounds || 1);
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
      const [regRes, squadRes, resultsRes] = await Promise.all([
        fetch(`/api/events/${event.id}/registrations`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        fetch(`/api/events/${event.id}/squads`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        }),
        fetch(`/api/events/${event.id}/results`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        })
      ]);

      if (!regRes.ok || !squadRes.ok || !resultsRes.ok) throw new Error('Errore nel caricamento dei dati');

      const [regData, squadData, resultsData] = await Promise.all([
        regRes.json(), 
        squadRes.json(),
        resultsRes.json()
      ]);
      setRegistrations(regData);
      setSquads(squadData);
      setResults(resultsData);
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

  const generateSquadsPDF = () => {
    const fields = Array.from(new Set(displayedSquads.map(s => s.field_number))).sort((a, b) => a - b);
    if (fields.length === 0) return;

    const orientation = fields.length > 4 ? 'l' : 'p';
    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CLAY TRACKER PRO', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Ordine di Tiro', pageWidth / 2, 22, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(event.name.toUpperCase(), pageWidth / 2, 32, { align: 'center' });

    const fieldLines = fields.map(fieldNum => {
      const fieldSquads = displayedSquads.filter(s => s.field_number === fieldNum).sort((a,b) => {
        if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
        return a.squad_number - b.squad_number;
      });
      
      const lines: string[] = [];
      fieldSquads.forEach(squad => {
        lines.push(`BATTERIA ${squad.squad_number} - ${squad.start_time}`);
        for (let i = 1; i <= 6; i++) {
          const member = squad.members.find(m => m.position === i);
          if (member) {
            const formattedCat = formatDisplayValue(member.category);
            const formattedQual = formatDisplayValue(member.qualification);
            const catQual = [formattedCat, formattedQual].filter(Boolean).join(' - ');
            lines.push(`${i}. ${member.last_name} ${member.first_name}${catQual ? ` (${catQual})` : ''}`);
          } else {
            lines.push(`${i}. ---`);
          }
        }
        lines.push(''); // Empty line between squads
      });
      return lines;
    });

    const maxLines = Math.max(...fieldLines.map(lines => lines.length), 0);
    const rows: string[][] = [];
    for (let i = 0; i < maxLines; i++) {
      const row: string[] = [];
      for (let j = 0; j < fields.length; j++) {
        row.push(fieldLines[j][i] || '');
      }
      rows.push(row);
    }

    autoTable(doc, {
      head: [fields.map(f => `CAMPO ${f}`)],
      body: rows,
      startY: 50,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: 'middle',
        halign: 'left'
      },
      headStyles: {
        fillColor: [234, 88, 12], // orange-600
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.cell.raw && typeof data.cell.raw === 'string' && data.cell.raw.startsWith('BATTERIA')) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249]; // slate-100
          data.cell.styles.textColor = [15, 23, 42]; // slate-900
        }
      }
    });

    doc.save(`batterie_${event.name.replace(/\s+/g, '_')}.pdf`);
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
          total_rounds: roundsCount
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
          total_rounds: roundsCount
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
              total_rounds: roundsCount
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
    // If targets are set, calculate rounds (25 targets = 1 round)
    if (event.targets && event.targets > 0) {
      const calculatedRounds = Math.ceil(event.targets / 25);
      
      // Prioritize calculated rounds unless we have a specific saved value > 1
      const rc = (event.total_rounds && event.total_rounds > 1) ? event.total_rounds : (calculatedRounds || 1);
      setRoundsCount(rc);
      
      // For fields, user suggested 1:1 with rounds for this specific logic
      const fc = (event.total_fields && event.total_fields > 1) ? event.total_fields : rc;
      setFieldsCount(fc);
    } else {
      setFieldsCount(event.total_fields || 1);
      setRoundsCount(event.total_rounds || 1);
    }
  }, [event.id, event.total_fields, event.total_rounds, event.targets]);

  const [startTime, setStartTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [swapConfig, setSwapConfig] = useState<{
    fromSquadIndex: number;
    fromMemberIndex: number;
    toSquadIndex: number;
  } | null>(null);
  const [selectedSquadsForSheet, setSelectedSquadsForSheet] = useState<any[] | null>(null);
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

    const reassigned = reassignBibNumbers(finalSquads);
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
    const daySquads = squads.filter(s => normalizeDate(s.squad_day) === (normalizedGenDay === 'all' ? normalizeDate(event.start_date) : normalizedGenDay));
    const nextSquadNumber = daySquads.length > 0 ? Math.max(...daySquads.map(s => s.squad_number)) + 1 : 1;
    
    const newSquad: EventSquad = {
      id: Date.now(),
      event_id: event.id,
      squad_number: nextSquadNumber,
      field_number: 1,
      round_number: 1, // Explicitly set round 1
      start_time: '09:00',
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
        triggerToast?.(`Attenzione: La batteria B${squadToRemove.squad_number} contiene dei tiratori.`, 'error');
      }
      return;
    }
    
    if (triggerConfirm) {
      triggerConfirm(
        'Elimina Batteria',
        `Sei sicuro di voler eliminare la batteria B${squadToRemove.squad_number}?`,
        () => {
          const updated = squads.filter(s => String(s.id) !== String(squadId));
          updateSquadsAndSave(updated);
          triggerToast?.(`Batteria B${squadToRemove.squad_number} rimossa`, 'success');
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
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + "Nome,Cognome,Codice,Societa,Categoria,Qualifica,Email,Telefono\n"
                      + registrations.map(r => `${r.first_name},${r.last_name},${r.shooter_code},${r.society},${r.category},${r.qualification},${r.email},${r.phone}`).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `iscritti_${event.name.replace(/\s+/g, '_')}.csv`);
                    document.body.appendChild(link);
                    link.click();
                  }}
                  className="flex-1 md:flex-none px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200 [.light-theme_&]:bg-slate-100 [.light-theme_&]:border-slate-200 [.light-theme_&]:text-slate-600 [.light-theme_&]:hover:bg-slate-200 [.light-theme_&]:hover:text-black transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Export CSV</span>
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
                                  - {reg.shooting_session === 'morning' ? t('morning_short') : 
                                     reg.shooting_session === 'afternoon' ? t('afternoon_short') : 
                                     t('none_short')}
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
                              {reg.shotgun_brand} {reg.shotgun_model}
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
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Numero Campi</label>
                    <div className="relative">
                      <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                      <select
                        value={fieldsCount}
                        onChange={(e) => setFieldsCount(parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500/50 text-white appearance-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <option key={n} value={n}>{n} {n === 1 ? 'Campo' : 'Campi'}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="w-full">
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
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                      <input 
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500/50 text-white"
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
                    onClick={() => handleDuplicateRounds()}
                    disabled={isGenerating || isSaving || displayedSquads.filter(s => s.round_number === 1).length === 0 || genDay === 'all' || roundsCount <= 1 || !isRound1Definitive}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-orange-600/20 text-orange-500 border border-orange-500/30 font-black text-[10px] uppercase tracking-widest hover:bg-orange-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={roundsCount <= 1 ? "Imposta almeno 2 Giri (Serie) per duplicare" : (genDay === 'all' ? "Seleziona un giorno specifico" : (!isRound1Definitive ? "Blocca (conferma) tutte le batterie della Serie 1 prima di duplicare" : "Duplica batterie Serie 1 per i giri successivi"))}
                  >
                    <Copy className={`w-3.5 h-3.5 ${isGenerating ? 'animate-pulse' : ''}`} />
                    Duplica Giri
                  </button>
                  <button
                    onClick={generateSquadsPDF}
                    disabled={displayedSquads.length === 0 || isSaving}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Stampa
                  </button>
                  <button 
                    onClick={() => {
                      const allTeamsData = displayedSquads.map(s => ({
                        id: String(s.id),
                        name: `${s.squad_number}`,
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
                      setSelectedSquadsForSheet(allTeamsData);
                    }}
                    disabled={displayedSquads.length === 0}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Stampa Tutti Statini
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
                            - {reg.shooting_session === 'morning' ? t('morning_short') : 
                               reg.shooting_session === 'afternoon' ? t('afternoon_short') : 
                               t('none_short')}
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
                                  B{s.squad_number} {s.squad_day ? `(${formatDateDisplay(s.squad_day)})` : '(ALL)'}
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
                            <p className="text-[10px] font-black text-white">B{squad.squad_number} - R{squad.round_number || 1}</p>
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
                                {isDayR1Locked ? "Duplica Giri" : "Sblocca r1 per duplicare"}
                              </button>
                            )}
                          </div>
                          <div className="h-px flex-1 bg-slate-800"></div>
                        </div>

                    <div className="space-y-10">
                      {rounds.map(roundNum => {
                        const squadsInRound = daySquads.filter(s => (s.round_number || 1) === roundNum);
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
                                          >
                                            {squad.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                          </button>
                                          <button
                                            onClick={() => {
                                              const teamData = {
                                                id: String(squad.id),
                                                name: `${squad.squad_number}`,
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
                                                          B{s.squad_number} - R{s.round_number || 1}
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
          onClose={() => setSelectedSquadsForSheet(null)}
          hostingSociety={societies.find(s => s.name === event.location)}
        />
      )}

      {editingRegistration && (
        <EventRegistrationModal
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
