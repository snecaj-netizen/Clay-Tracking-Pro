import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, RefreshCw, Save, Clock, Target, ArrowRight, 
  ChevronLeft, Mail, Phone, Shield, User, Calendar,
  Download, Trash2, Edit3, Search, Plus, AlertCircle
} from 'lucide-react';
import { SocietyEvent, EventSquad, EventRegistration } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EventManagementDetailProps {
  event: SocietyEvent;
  onClose: () => void;
  initialTab?: 'registrations' | 'squads' | 'results';
  user?: any;
  token?: string;
  triggerConfirm?: any;
  triggerToast?: any;
  societies?: any[];
  setManagingResultsEvent?: (ev: SocietyEvent | null) => void;
  setViewingResultsEvent?: (ev: SocietyEvent | null) => void;
  onRegisterShooter?: () => void;
  refreshVersion?: number;
}

export const EventManagementDetail: React.FC<EventManagementDetailProps> = ({
  event,
  onClose,
  initialTab = 'registrations',
  user,
  token,
  triggerConfirm,
  triggerToast,
  societies = [],
  setManagingResultsEvent,
  setViewingResultsEvent,
  onRegisterShooter,
  refreshVersion = 0
}) => {
  const [activeTab, setActiveTab] = useState<'registrations' | 'squads' | 'results'>(initialTab);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [squads, setSquads] = useState<EventSquad[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fieldsCount, setFieldsCount] = useState(2);
  const [startTime, setStartTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [swapConfig, setSwapConfig] = useState<{
    fromSquadIndex: number;
    fromMemberIndex: number;
    toSquadIndex: number;
  } | null>(null);

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

  const generateSquadsPDF = () => {
    const fields = Array.from(new Set(squads.map(s => s.field_number))).sort((a, b) => a - b);
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
      const fieldSquads = squads.filter(s => s.field_number === fieldNum).sort((a,b) => {
        if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
        return a.squad_number - b.squad_number;
      });
      
      const lines: string[] = [];
      fieldSquads.forEach(squad => {
        lines.push(`BATTERIA ${squad.squad_number} - ${squad.start_time}`);
        for (let i = 1; i <= 6; i++) {
          const member = squad.members.find(m => m.position === i);
          if (member) {
            const catQual = [member.category, member.qualification].filter(Boolean).join(' - ');
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

  const handleGenerate = async () => {
    console.log('handleGenerate called', { fieldsCount, startTime, eventId: event.id });
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${event.id}/squads/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ fieldsCount, startTime })
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

  const handleSaveSquads = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${event.id}/squads/update-members`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ squads })
      });
      if (!response.ok) throw new Error('Errore nel salvataggio delle batterie');
      await fetchData();
      setHasUnsavedChanges(false);
      triggerToast?.('Batterie salvate con successo', 'success');
    } catch (err: any) {
      setError(err.message);
      triggerToast?.(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const moveMember = (fromSquadIndex: number, fromMemberIndex: number, toSquadIndex: number) => {
    const newSquads = JSON.parse(JSON.stringify(squads));
    
    if (newSquads[toSquadIndex].members.length < 6 || fromSquadIndex === toSquadIndex) {
      const [member] = newSquads[fromSquadIndex].members.splice(fromMemberIndex, 1);
      newSquads[toSquadIndex].members.push(member);
      newSquads[fromSquadIndex].members.forEach((m: any, idx: number) => m.position = idx + 1);
      newSquads[toSquadIndex].members.forEach((m: any, idx: number) => m.position = idx + 1);
      setSquads(newSquads);
      setHasUnsavedChanges(true);
    } else {
      setSwapConfig({ fromSquadIndex, fromMemberIndex, toSquadIndex });
    }
  };

  const changePosition = (squadIndex: number, fromIndex: number, toIndex: number) => {
    const newSquads = JSON.parse(JSON.stringify(squads));
    const squad = newSquads[squadIndex];
    const [member] = squad.members.splice(fromIndex, 1);
    squad.members.splice(toIndex, 0, member);
    squad.members.forEach((m: any, idx: number) => m.position = idx + 1);
    setSquads(newSquads);
    setHasUnsavedChanges(true);
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
    
    setSquads(newSquads);
    setSwapConfig(null);
    setHasUnsavedChanges(true);
  };

  const handleAddSquad = () => {
    const nextSquadNumber = squads.length > 0 ? Math.max(...squads.map(s => s.squad_number)) + 1 : 1;
    const newSquad: EventSquad = {
      id: Date.now(),
      event_id: event.id,
      squad_number: nextSquadNumber,
      field_number: 1,
      start_time: '09:00',
      members: []
    };
    setSquads([...squads, newSquad]);
    setHasUnsavedChanges(true);
  };

  const handleAddMemberToSquad = (squadIndex: number, registration: EventRegistration) => {
    const newSquads = JSON.parse(JSON.stringify(squads));
    if (newSquads[squadIndex].members.length < 6) {
      newSquads[squadIndex].members.push({
        registration_id: registration.id,
        first_name: registration.first_name,
        last_name: registration.last_name,
        category: registration.category,
        qualification: registration.qualification,
        position: newSquads[squadIndex].members.length + 1
      });
      setSquads(newSquads);
      setHasUnsavedChanges(true);
    }
  };

  const handleRemoveMemberFromSquad = (squadIndex: number, memberIndex: number) => {
    const newSquads = JSON.parse(JSON.stringify(squads));
    newSquads[squadIndex].members.splice(memberIndex, 1);
    newSquads[squadIndex].members.forEach((m: any, idx: number) => m.position = idx + 1);
    setSquads(newSquads);
    setHasUnsavedChanges(true);
  };

  const assignedRegistrationIds = new Set(squads.flatMap(s => s.members.map(m => m.registration_id)));
  const unassignedRegistrations = registrations.filter(r => !assignedRegistrationIds.has(r.id));

  const filteredRegistrations = registrations.filter(reg => 
    `${reg.first_name} ${reg.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.shooter_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 group"
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
            <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight leading-none">
              {event.name}
            </h1>
            <p className="text-slate-400 mt-2 font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              {new Date(event.start_date).toLocaleDateString('it-IT')} - {event.location}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('registrations')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === 'registrations' 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Iscritti ({registrations.length})
            </button>
            <button
              onClick={() => setActiveTab('squads')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === 'squads' 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Batterie ({squads.length})
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === 'results' 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Classifiche
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {activeTab === 'registrations' ? (
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
                  className="flex-1 md:flex-none px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Aggiorna</span>
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
                  className="flex-1 md:flex-none px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
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
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tiratore</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Codice</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Società</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Dettagli</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Contatti</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredRegistrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-white uppercase tracking-tight">{reg.last_name} {reg.first_name}</p>
                              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{reg.registration_day}</p>
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
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {reg.category}
                              </span>
                              {reg.qualification && (
                                <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-[9px] font-black text-orange-500 uppercase tracking-widest">
                                  {reg.qualification}
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
                          <div className="flex items-center gap-2">
                            <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all">
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
        ) : activeTab === 'squads' ? (
          <div className="space-y-8">
            {/* Squads Controls */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
              <div className="flex flex-col md:flex-row items-end gap-4">
                <div className="w-full md:w-48">
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
                
                <div className="w-full md:w-48">
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

                <div className="flex-1 flex flex-wrap items-center gap-2 justify-end w-full">
                  <button
                    onClick={handleAddSquad}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || registrations.length === 0}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    Genera
                  </button>
                  <button
                    onClick={handleSaveSquads}
                    disabled={squads.length === 0}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salva
                  </button>
                  <button
                    onClick={generateSquadsPDF}
                    disabled={squads.length === 0}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Stampa
                  </button>
                </div>
              </div>
              
              {hasUnsavedChanges && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500 text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Hai delle modifiche non salvate. Ricordati di salvare per non perderle.
                  </div>
                  <button
                    onClick={handleSaveSquads}
                    disabled={isLoading}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-black rounded-lg transition-colors whitespace-nowrap"
                  >
                    Salva Ora
                  </button>
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
                    <div key={reg.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-tight">
                        {reg.last_name} {reg.first_name}
                        {(reg.category || reg.qualification) && (
                          <span className="ml-2 text-[10px] text-slate-500 font-medium">
                            ({[reg.category, reg.qualification].filter(Boolean).join(' - ')})
                          </span>
                        )}
                      </span>
                      {squads.length > 0 && (
                        <select 
                          onChange={(e) => {
                            if (e.target.value !== "") {
                              handleAddMemberToSquad(parseInt(e.target.value), reg);
                              e.target.value = "";
                            }
                          }}
                          className="bg-slate-900 border border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 rounded px-1 py-0.5 focus:outline-none"
                          defaultValue=""
                        >
                          <option value="" disabled>Aggiungi a...</option>
                          {squads.map((s, idx) => (
                            s.members.length < 6 && <option key={idx} value={idx}>B{s.squad_number}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {squads.map((squad, sIdx) => (
                <div key={squad.id} className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition-all group">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-white uppercase tracking-tight">Batteria</span>
                        <input 
                          type="number" 
                          value={squad.squad_number}
                          onChange={(e) => {
                            const newSquads = [...squads];
                            newSquads[sIdx].squad_number = parseInt(e.target.value) || 1;
                            setSquads(newSquads);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white font-black text-lg focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="w-3 h-3 text-orange-500" />
                        <input 
                          type="time"
                          value={squad.start_time}
                          onChange={(e) => {
                            const newSquads = [...squads];
                            newSquads[sIdx].start_time = e.target.value;
                            setSquads(newSquads);
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest focus:outline-none focus:border-orange-500"
                        />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">- Campo</span>
                        <input 
                          type="number"
                          value={squad.field_number}
                          onChange={(e) => {
                            const newSquads = [...squads];
                            newSquads[sIdx].field_number = parseInt(e.target.value) || 1;
                            setSquads(newSquads);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-12 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (confirm('Sei sicuro di voler eliminare questa batteria? I tiratori torneranno nella lista da assegnare.')) {
                          const newSquads = squads.filter((_, idx) => idx !== sIdx);
                          setSquads(newSquads);
                          setHasUnsavedChanges(true);
                        }
                      }}
                      className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 hover:border-red-500/30 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      title="Elimina batteria"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {squad.members.map((member, mIdx) => (
                      <div 
                        key={member.registration_id}
                        className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800/50 rounded-xl group/member"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded bg-slate-900 text-[10px] font-black text-slate-500 flex items-center justify-center border border-slate-800">
                            {member.position}
                          </span>
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-tight">
                            {member.last_name} {member.first_name}
                            {(member.category || member.qualification) && (
                              <span className="ml-2 text-[10px] text-slate-500 font-medium">
                                ({[member.category, member.qualification].filter(Boolean).join(' - ')})
                              </span>
                            )}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                          <select 
                            onChange={(e) => {
                              changePosition(sIdx, mIdx, parseInt(e.target.value));
                            }}
                            className="bg-slate-900 border border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 rounded px-1 py-0.5 focus:outline-none"
                            value={mIdx}
                          >
                            {[0, 1, 2, 3, 4, 5].slice(0, squad.members.length).map(posIdx => (
                              <option key={posIdx} value={posIdx}>Pos {posIdx + 1}</option>
                            ))}
                          </select>
                          {squads.length > 1 && (
                            <select 
                              onChange={(e) => {
                                if (e.target.value !== "") {
                                  moveMember(sIdx, mIdx, parseInt(e.target.value));
                                  e.target.value = "";
                                }
                              }}
                              className="bg-slate-900 border border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 rounded px-1 py-0.5 focus:outline-none"
                              defaultValue=""
                            >
                              <option value="" disabled>Sposta in...</option>
                              {squads.map((s, idx) => (
                                idx !== sIdx && <option key={idx} value={idx}>B{s.squad_number}</option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => handleRemoveMemberFromSquad(sIdx, mIdx)}
                            className="p-1 text-slate-500 hover:text-red-500 transition-colors"
                            title="Rimuovi dalla batteria"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {Array.from({ length: 6 - squad.members.length }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-10 border border-dashed border-slate-800/50 rounded-xl flex items-center justify-center">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Posto Libero</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
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
                                  // The parent should refresh
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
      {activeTab === 'registrations' && (user?.role === 'admin' || user?.role === 'society') && onRegisterShooter && (
        <button 
          onClick={onRegisterShooter}
          className="fixed bottom-28 sm:bottom-8 right-8 w-16 h-16 bg-orange-600 shadow-orange-600/40 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-all active:scale-95 z-40 floating-add-btn group"
          title="Iscrivi Tiratore"
        >
          <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}

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
    </div>
  );
};
