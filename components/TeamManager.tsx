import React, { useState, useMemo } from 'react';
import { SocietyEvent } from '../types';
import SocietySearch from './SocietySearch';
import ShooterSearch from './ShooterSearch';

interface TeamManagerProps {
  event: SocietyEvent;
  results: any[];
  users: any[];
  teams: any[];
  token: string;
  onTeamsUpdate: () => void;
  triggerToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  triggerConfirm?: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
  readOnly?: boolean;
  currentUser?: any;
  allSocieties?: any[];
}

const TeamManager: React.FC<TeamManagerProps> = ({ event, results, users, teams, token, onTeamsUpdate, triggerToast, triggerConfirm, readOnly, currentUser, allSocieties = [] }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    society: '',
    type: '',
    memberIds: [] as string[]
  });

  React.useEffect(() => {
    if (isCreating && !editingTeamId && currentUser?.role === 'society' && currentUser?.society) {
      setFormData(prev => ({ ...prev, society: currentUser.society }));
    }
  }, [isCreating, editingTeamId, currentUser]);

  const societies = useMemo(() => {
    const socs = new Set<string>();
    results.forEach(r => {
      const s = r.society_at_time || r.society;
      if (s) socs.add(s);
    });
    return Array.from(socs).sort();
  }, [results]);

  const teamTypes = useMemo(() => {
    if (event.discipline === 'Club Cup (PC)') {
      return [
        { id: 'PC_A', name: 'Squadra Sezione (A)', size: 3 },
        { id: 'PC_B', name: 'Squadra Sezione (B)', size: 3 }
      ];
    } else if (event.discipline === 'Sporting (SP)' || event.discipline === 'Compak Sporting (CK)') {
      return [
        { id: 'SP_A', name: 'Squadra Categorie (A)', size: 6 },
        { id: 'SP_B', name: 'Squadra Qualifiche (B)', size: 3 }
      ];
    }
    return [];
  }, [event.discipline]);

  const availableShooters = useMemo(() => {
    if (!formData.society) return [];
    
    const registeredUserIds = new Set(results.map(r => r.user_id));
    
    // Get all users belonging to the selected society
    return users.filter(u => {
      if (!registeredUserIds.has(u.id)) return false;
      
      const s = (u.society || '').toLowerCase().trim();
      const formSoc = (formData.society || '').toLowerCase().trim();
      if (s !== formSoc) return false;
      
      // Check if the user is already in a team for this event
      // We look at the teams array to see if they are in any team's member_ids
      const isUserInAnotherTeam = teams.some(t => t.id !== editingTeamId && t.member_ids?.includes(u.id));
      if (isUserInAnotherTeam) {
        return false;
      }
      
      return true;
    });
  }, [users, results, formData.society, editingTeamId]);

  const validateTeam = () => {
    if (!formData.name || !formData.society || !formData.type) return "Compila tutti i campi obbligatori.";
    
    const typeDef = teamTypes.find(t => t.id === formData.type);
    if (!typeDef) return "Tipo squadra non valido.";
    
    if (formData.memberIds.length !== typeDef.size) {
      return `La squadra deve avere esattamente ${typeDef.size} tiratori.`;
    }

    // Check maximum 3 teams per type per society
    const existingTeamsOfType = teams.filter(t => 
      t.society === formData.society && 
      t.type === formData.type && 
      t.id !== editingTeamId
    );
    if (existingTeamsOfType.length >= 3) {
      return `La società ha già raggiunto il limite massimo di 3 squadre per il tipo ${typeDef.name}.`;
    }

    const members = formData.memberIds.map(id => users.find(u => u.id === id)).filter(Boolean);
    
    const getCat = (m: any) => {
      const userResult = results.find(r => r.user_id === m.id);
      return (userResult?.category_at_time || m.category || '').toLowerCase().trim();
    };
    const getQual = (m: any) => {
      const userResult = results.find(r => r.user_id === m.id);
      return (userResult?.qualification_at_time || m.qualification || '').toLowerCase().trim();
    };

    const countCat = (cats: string[]) => members.filter(m => cats.some(c => getCat(m).includes(c))).length;
    const countQual = (quals: string[]) => members.filter(m => quals.some(q => getQual(m).includes(q))).length;

    if (formData.type === 'PC_A') {
      const ecc = countCat(['eccellenza']);
      if (ecc > 1) return "Massimo 1 tiratore di Eccellenza consentito.";
    } else if (formData.type === 'PC_B') {
      const ecc = countCat(['eccellenza']);
      const prima = countCat(['1', '1°', '1a', '1^', '1*']);
      const seconda = countCat(['2', '2°', '2a', '2^', '2*']);
      if (ecc > 0 || prima > 0) return "Non sono ammessi tiratori di Eccellenza o 1a categoria nella Sezione B.";
      if (seconda > 2) return "Massimo 2 tiratori di 2a categoria consentiti.";
    } else if (formData.type === 'SP_A') {
      const ecc = countCat(['eccellenza']);
      const prima = countCat(['1', '1°', '1a', '1^', '1*']);
      if (ecc > 1) return "Massimo 1 tiratore di Eccellenza consentito.";
      if (ecc + prima > 3) return "Massimo 1 Eccellenza e 2 di 1a categoria (totale 3) consentiti.";
    } else if (formData.type === 'SP_B') {
      const senJun = countQual(['senior', 'junior']);
      if (senJun > 2) return "Massimo 2 tiratori tra Senior e Junior consentiti.";
    }

    return null;
  };

  const handleSave = async () => {
    const error = validateTeam();
    if (error) {
      if (triggerToast) triggerToast(error, 'error');
      else alert(error);
      return;
    }

    try {
      const url = editingTeamId 
        ? `/api/events/${event.id}/teams/${editingTeamId}`
        : `/api/events/${event.id}/teams`;
      
      const method = editingTeamId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        if (triggerToast) triggerToast('Squadra salvata con successo', 'success');
        setIsCreating(false);
        setEditingTeamId(null);
        setFormData({ name: '', society: '', type: '', memberIds: [] });
        onTeamsUpdate();
      } else {
        const data = await res.json();
        if (triggerToast) triggerToast(data.error || 'Errore nel salvataggio', 'error');
      }
    } catch (err) {
      console.error(err);
      if (triggerToast) triggerToast('Errore di rete', 'error');
    }
  };

  const handleDelete = async (teamId: number) => {
    if (triggerConfirm) {
      triggerConfirm(
        'Elimina Squadra',
        'Sei sicuro di voler eliminare questa squadra?',
        async () => {
          try {
            const res = await fetch(`/api/events/${event.id}/teams/${teamId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              if (triggerToast) triggerToast('Squadra eliminata', 'success');
              onTeamsUpdate();
            }
          } catch (err) {
            console.error(err);
          }
        },
        'Elimina',
        'danger'
      );
    }
  };

  const toggleMember = (id: string) => {
    setFormData(prev => {
      if (prev.memberIds.includes(id)) {
        return { ...prev, memberIds: prev.memberIds.filter(m => m !== id) };
      } else {
        const typeDef = teamTypes.find(t => t.id === prev.type);
        if (typeDef && prev.memberIds.length >= typeDef.size) {
          if (triggerToast) triggerToast(`Massimo ${typeDef.size} tiratori per questa squadra`, 'info');
          return prev;
        }
        return { ...prev, memberIds: [...prev.memberIds, id] };
      }
    });
  };

  if (teamTypes.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <i className="fas fa-users-slash text-4xl mb-3 opacity-50"></i>
        <p>La gestione squadre non è disponibile per questa disciplina.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isCreating && !editingTeamId && !readOnly && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-all shadow-lg shadow-orange-600/20"
          >
            <i className="fas fa-plus"></i>
            Nuova Squadra
          </button>
        </div>
      )}

      {(isCreating || editingTeamId) && !readOnly && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">
            {editingTeamId ? 'Modifica Squadra' : 'Nuova Squadra'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Nome Squadra</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:border-orange-500 outline-none"
                placeholder="Es. TAV Roma A"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Società</label>
              {currentUser?.role === 'society' ? (
                <input 
                  type="text" 
                  readOnly 
                  value={formData.society} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white opacity-50 cursor-not-allowed outline-none" 
                />
              ) : (
                <SocietySearch
                  value={formData.society}
                  onChange={(val) => setFormData({...formData, society: val, memberIds: []})}
                  societies={allSocieties.length > 0 ? allSocieties : societies.map(s => ({ name: s, id: s }))}
                  placeholder="Seleziona Società"
                  className="w-full"
                  required
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tipo Squadra</label>
              <select
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value, memberIds: []})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:border-orange-500 outline-none"
              >
                <option value="">Seleziona Tipo</option>
                {teamTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.size} tiratori)</option>
                ))}
              </select>
            </div>
          </div>

          {formData.society && formData.type && (
            <div className="mb-6">
              {formData.type === 'SP_A' && (
                <div className="mb-4 p-3 bg-blue-900/30 border border-blue-800 rounded-lg flex gap-3 text-sm text-blue-200">
                  <i className="fas fa-info-circle mt-0.5 text-blue-400"></i>
                  <p>
                    <strong>Nota:</strong> Per la composizione della squadra (A) potranno partecipare anche le qualifiche rispettando la propria categoria di appartenenza.
                  </p>
                </div>
              )}
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Seleziona Tiratori ({formData.memberIds.length} / {teamTypes.find(t => t.id === formData.type)?.size})
              </label>
              <ShooterSearch 
                value={formData.memberIds}
                onChange={(val) => {
                  if (Array.isArray(val)) {
                    const typeDef = teamTypes.find(t => t.id === formData.type);
                    if (typeDef && val.length > typeDef.size) {
                      if (triggerToast) triggerToast(`Massimo ${typeDef.size} tiratori per questa squadra`, 'info');
                      return;
                    }
                    setFormData({ ...formData, memberIds: val });
                  }
                }}
                shooters={availableShooters.map(s => ({
                  ...s,
                  // Ensure name and surname are available for ShooterSearch display
                  name: s.name || s.user_name,
                  surname: s.surname || s.user_surname
                }))}
                useId={true}
                multiple={true}
                placeholder="Cerca e seleziona tiratori..."
                className="w-full"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingTeamId(null);
                setFormData({ name: '', society: '', type: '', memberIds: [] });
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-all"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-all shadow-lg shadow-orange-600/20"
            >
              Salva Squadra
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {teams.map(team => {
          const typeDef = teamTypes.find(t => t.id === team.type);
          const teamMembers = (team.member_ids || []).map((id: string) => {
            const result = results.find(r => r.user_id === id);
            const user = users.find(u => u.id === id);
            return {
              id: id,
              user_id: id,
              user_name: result?.user_name || user?.name || 'Sconosciuto',
              user_surname: result?.user_surname || user?.surname || '',
              category: result?.category_at_time || user?.category || '',
              qualification: result?.qualification_at_time || user?.qualification || '',
              totalscore: result?.totalscore || 0
            };
          });
          const totalScore = teamMembers.reduce((sum: number, m: any) => sum + (m.totalscore || 0), 0);

          return (
            <div key={team.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 flex justify-between items-start bg-slate-800/30">
                <div 
                  onClick={() => {
                    if (!readOnly) {
                      setFormData({
                        name: team.name,
                        society: team.society,
                        type: team.type || '',
                        memberIds: teamMembers.map((m: any) => m.user_id)
                      });
                      setEditingTeamId(team.id);
                      setIsCreating(true);
                    }
                  }}
                  className={`cursor-pointer group/title ${!readOnly ? 'hover:text-orange-500' : ''} transition-colors`}
                >
                  <h4 className="text-lg font-black text-white uppercase tracking-widest group-hover/title:text-orange-500 transition-colors">{team.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-slate-400 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                      {team.society}
                    </span>
                    <span className="text-xs font-bold text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20">
                      {typeDef?.name || team.type || `${team.discipline || ''} (${team.size} tiratori)`}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-orange-500">{totalScore} <span className="text-xs text-slate-500 font-normal">pt</span></div>
                  {!readOnly && (
                    <div className="flex gap-2 mt-2 justify-end">
                      <button
                        onClick={() => {
                          setFormData({
                            name: team.name,
                            society: team.society,
                            type: team.type || '',
                            memberIds: teamMembers.map(m => m.user_id)
                          });
                          setEditingTeamId(team.id);
                          setIsCreating(true);
                        }}
                        className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all"
                      >
                        <i className="fas fa-edit text-xs"></i>
                      </button>
                      <button
                        onClick={() => handleDelete(team.id)}
                        className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                      >
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 flex-1">
                <div className="space-y-2">
                  {teamMembers.map(m => (
                    <div key={m.id} className="flex justify-between items-center text-sm">
                      <div className="text-slate-300 font-medium">
                        {m.user_surname} {m.user_name}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">
                          {m.category} {m.qualification ? `- ${m.qualification}` : ''}
                        </span>
                        <span className="font-bold text-white w-8 text-right">{m.totalscore}</span>
                      </div>
                    </div>
                  ))}
                  {teamMembers.length === 0 && (
                    <div className="text-sm text-slate-500 italic">Nessun tiratore assegnato o nessun risultato inserito</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {teams.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12 text-slate-500">
            <i className="fas fa-users text-4xl mb-3 opacity-50"></i>
            <p>Nessuna squadra registrata per questo evento.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamManager;
