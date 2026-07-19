import React, { useState, useMemo } from 'react';
import { SocietyEvent } from '../types';
import SocietySearch from './SocietySearch';
import ShooterSearch from './ShooterSearch';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';

interface TeamManagerProps {
  event: SocietyEvent;
  results: any[];
  users: any[];
  teams: any[];
  token: string;
  onTeamsUpdate: () => void;
  readOnly?: boolean;
  currentUser?: any;
  allSocieties?: any[];
}

const TeamManager: React.FC<TeamManagerProps> = ({ event, results, users, teams, token, onTeamsUpdate, readOnly, currentUser, allSocieties = [] }) => {
  const { t } = useLanguage();
  const { triggerConfirm, triggerToast } = useUI();
  const [isCreating, setIsCreating] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'A' | 'B' | 'CA' | 'LIBERA' | 'ALL'>('A');
  const [formData, setFormData] = useState({
    name: '',
    society: '',
    type: '',
    memberIds: [] as string[]
  });

  const [filterSociety, setFilterSociety] = useState<string>('');

  React.useEffect(() => {
    if (isCreating && !editingTeamId && currentUser?.role === 'society' && currentUser?.society) {
      setFormData(prev => ({ ...prev, society: currentUser.society }));
    }
  }, [isCreating, editingTeamId, currentUser]);

  const sortedAndGroupedTeams = useMemo(() => {
    const teamsWithTotals = teams.map(team => {
      const teamMembers = (team.member_ids || []).map((id: string) => {
        const result = results.find(r => r.user_id === id);
        const shootOffVal = result?.shoot_off !== undefined && result?.shoot_off !== null ? parseInt(String(result.shoot_off), 10) : 0;
        return {
          totalscore: result?.totalscore || 0,
          shoot_off: isNaN(shootOffVal) ? 0 : shootOffVal
        };
      });
      const totalScore = teamMembers.reduce((sum: number, m: any) => sum + (m.totalscore || 0), 0);
      const totalShootOff = teamMembers.reduce((sum: number, m: any) => sum + (m.shoot_off || 0), 0);
      return { ...team, totalScore, totalShootOff };
    });

    const isGroupA = (type: string) => {
      if (!type) return false;
      if (type === 'SP_A' || type === 'PC_A') return true;
      const t = type.toUpperCase();
      return t.includes('(A)') || t.includes('_A') || t === 'A' || t.endsWith(' A');
    };
    const isGroupB = (type: string) => {
      if (!type) return false;
      if (type === 'SP_B' || type === 'PC_B') return true;
      const t = type.toUpperCase();
      return t.includes('(B)') || t.includes('_B') || t === 'B' || t.endsWith(' B');
    };
    const isHunter = (type: string) => {
      if (!type) return false;
      const t = type.toUpperCase();
      return t === 'CACCIATORI' || t.includes('CACCIATOR');
    };
    const isLibera = (type: string) => {
      if (!type) return false;
      const t = type.toUpperCase();
      return t === 'SQUADRA_TIRATORI' || t.includes('TIRATORI');
    };

    const sortFunc = (a: any, b: any) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.totalShootOff - a.totalShootOff;
    };

    const groupA = teamsWithTotals.filter(t => !isHunter(t.type || t.team_type) && !isLibera(t.type || t.team_type) && isGroupA(t.type || t.team_type)).sort(sortFunc);
    const groupB = teamsWithTotals.filter(t => !isHunter(t.type || t.team_type) && !isLibera(t.type || t.team_type) && isGroupB(t.type || t.team_type)).sort(sortFunc);
    const hunters = teamsWithTotals.filter(t => isHunter(t.type || t.team_type)).sort(sortFunc);
    const libera = teamsWithTotals.filter(t => isLibera(t.type || t.team_type)).sort(sortFunc);
    const others = teamsWithTotals.filter(t => !isHunter(t.type || t.team_type) && !isLibera(t.type || t.team_type) && !isGroupA(t.type || t.team_type) && !isGroupB(t.type || t.team_type)).sort(sortFunc);

    const all = teamsWithTotals.sort(sortFunc);

    // Filter by society if selected
    let filteredA = groupA;
    let filteredB = groupB;
    let filteredHunters = hunters;
    let filteredLibera = libera;
    let filteredOthers = others;
    let filteredAll = all;

    if (filterSociety) {
      filteredA = groupA.filter(t => t.society === filterSociety);
      filteredB = groupB.filter(t => t.society === filterSociety);
      filteredHunters = hunters.filter(t => t.society === filterSociety);
      filteredLibera = libera.filter(t => t.society === filterSociety);
      filteredOthers = others.filter(t => t.society === filterSociety);
      filteredAll = all.filter(t => t.society === filterSociety);
    }

    let result = [];
    if (selectedTypeFilter === 'A') result = filteredA;
    else if (selectedTypeFilter === 'B') result = filteredB;
    else if (selectedTypeFilter === 'CA') result = filteredHunters;
    else if (selectedTypeFilter === 'LIBERA') result = filteredLibera;
    else result = filteredAll;

    return { groupA: filteredA, groupB: filteredB, hunters: filteredHunters, libera: filteredLibera, others: filteredOthers, filtered: result };
  }, [teams, results, filterSociety, selectedTypeFilter]);

  const hasFinalSeries = useMemo(() => {
    return sortedAndGroupedTeams.filtered.some(team => {
      return (team.member_ids || []).some((id: string | number) => {
        const result = results.find(r => String(r.user_id) === String(id));
        return result?.scores && result.scores[4] !== undefined && result.scores[4] !== null && result.scores[4] !== '' && Number(result.scores[4]) > 0;
      });
    });
  }, [sortedAndGroupedTeams.filtered, results]);

  const societies = useMemo(() => {
    const socs = new Set<string>();
    results.forEach(r => {
      const s = r.society_at_time || r.society;
      if (s) socs.add(s);
    });
    return Array.from(socs).sort();
  }, [results]);

  const teamTypes = useMemo(() => {
    const list = [];
    if (event.discipline === 'Club Cup (PC)') {
      list.push(
        { id: 'PC_A', name: t('team_section_a_name') || 'Settore A (PC)', size: 3 },
        { id: 'PC_B', name: t('team_section_b_name') || 'Settore B (PC)', size: 3 }
      );
    } else if (event.discipline === 'Sporting (SP)' || event.discipline === 'Compak Sporting (CK)' || event.discipline === 'Doppietto Compak (DCK)') {
      list.push(
        { id: 'SP_A', name: t('team_cat_a_name') || 'Tipologia A', size: 6 },
        { id: 'SP_B', name: t('team_qual_b_name') || 'Tipologia B', size: 3 }
      );
    } else {
      list.push(
        { id: 'TAV_FITAV', name: 'Squadra FITAV', size: 3 }
      );
    }
    list.push(
      { id: 'CACCIATORI', name: 'Squadre Cacciatori', size: 99 },
      { id: 'SQUADRA_TIRATORI', name: 'Squadra Tiratori', size: 99 } // No limit, using 99 as a placeholder for "no limit"
    );
    return list;
  }, [event.discipline, t]);

  const availableShooters = useMemo(() => {
    // If it's a SQUADRA_LIBERA, we don't strictly filter by society based on formData.society
    const isLibera = formData.type === 'SQUADRA_TIRATORI';
    
    const registeredUserIds = new Set(results.map(r => r.user_id));
    
    // Get all users belonging to the selected society (if not Libera)
    return users.filter(u => {
      if (!registeredUserIds.has(u.id)) return false;
      
      if (!isLibera) {
        const s = (u.society || '').toLowerCase().trim();
        const formSoc = (formData.society || '').toLowerCase().trim();
        if (s !== formSoc) return false;
      }
      
      // Check if the user is already in a team for this event
      const isUserInAnotherTeam = teams.some(t => t.id !== editingTeamId && t.member_ids?.includes(u.id));
      if (isUserInAnotherTeam) {
        return false;
      }
      
      return true;
    });
  }, [users, results, formData.society, formData.type, editingTeamId, teams]);

  const mappedShooters = useMemo(() => availableShooters.map(s => ({
    ...s,
    name: s.name || s.user_name,
    surname: s.surname || s.user_surname
  })), [availableShooters]);

  const validateTeam = () => {
    // Society is optional for 'SQUADRA_LIBERA'
    if (!formData.name || !formData.type) return t('fill_required_fields');
    if (formData.type !== 'SQUADRA_TIRATORI' && !formData.society) return t('fill_required_fields');
    
    const typeDef = teamTypes.find(t => t.id === formData.type);
    if (!typeDef) return t('invalid_team_type');
    
    if (formData.type !== 'CACCIATORI' && formData.type !== 'SQUADRA_TIRATORI' && formData.memberIds.length !== typeDef.size) {
      return t('team_members_size_error').replace('{{size}}', String(typeDef.size));
    }
    
    if ((formData.type === 'SQUADRA_TIRATORI' || formData.type === 'CACCIATORI') && formData.memberIds.length < 1) {
      return 'Squadra deve avere almeno un partecipante';
    }

    // Check maximum 3 teams per type per society (doesn't apply to Libera?)
    if (formData.type !== 'SQUADRA_TIRATORI' && formData.type !== 'CACCIATORI') {
      const existingTeamsOfType = teams.filter(t => 
        t.society === formData.society && 
        t.type === formData.type && 
        t.id !== editingTeamId
      );
      if (existingTeamsOfType.length >= 3) {
        return t('max_teams_reached').replace('{{type}}', typeDef.name);
      }
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
    const countCatEccellenza = () => members.filter(m => {
      const cat = getCat(m);
      return cat === 'e' || cat.includes('eccellenza');
    }).length;
    const countQual = (quals: string[]) => members.filter(m => quals.some(q => getQual(m).includes(q))).length;

    if (formData.type === 'PC_A') {
      const ecc = countCatEccellenza();
      if (ecc > 1) return t('max_ecc_reached');
    } else if (formData.type === 'PC_B') {
      const ecc = countCatEccellenza();
      const prima = countCat(['prima', '1', '1°', '1a', '1^', '1*']);
      const seconda = countCat(['seconda', '2', '2°', '2a', '2^', '2*']);
      if (ecc > 0 || prima > 0) return t('no_ecc_prima_allowed');
      if (seconda > 2) return t('max_seconda_reached');
    } else if (formData.type === 'SP_A') {
      const ecc = countCatEccellenza();
      const prima = countCat(['prima', '1', '1°', '1a', '1^', '1*']);
      if (ecc > 1) return t('max_ecc_reached');
      if (ecc + prima > 3) return t('max_ecc_prima_three_reached');
    } else if (formData.type === 'SP_B') {
      const senJun = countQual(['senior', 'junior']);
      if (senJun > 2) return t('max_sen_jun_reached');
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
        body: JSON.stringify({
          ...formData,
          member_ids: formData.memberIds
        })
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

  const handleSendTeam = async (teamId: number) => {
    try {
      const res = await fetch(`/api/events/${event.id}/teams/${teamId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        if (triggerToast) triggerToast(t('team_sent_success'), 'success');
        onTeamsUpdate();
      } else {
        const data = await res.json();
        if (triggerToast) triggerToast(data.error || 'Errore nell\'invio', 'error');
      }
    } catch (err) {
      console.error(err);
      if (triggerToast) triggerToast('Errore di rete', 'error');
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
      {!isCreating && !editingTeamId && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-all shadow-lg shadow-orange-600/20"
          >
            <i className="fas fa-plus"></i>
            {t('new_team_label')}
          </button>
        </div>
      )}

      {(isCreating || editingTeamId) && !readOnly && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">
            {editingTeamId ? t('edit_team_title') : t('new_team_title')}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('team_name_label')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:border-orange-500 outline-none"
                placeholder={t('team_name_placeholder')}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('society')}</label>
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
                  placeholder="Seleziona Società (Opzionale)"
                  className="w-full"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('team_type_label')}</label>
              <select
                value={formData.type}
                onChange={e => {
                  const val = e.target.value;
                  const targetSoc = val === 'CACCIATORI' ? 'Cacciatori' : (currentUser?.role === 'society' ? (currentUser.society || '') : (formData.society === 'Cacciatori' ? '' : formData.society));
                  setFormData({...formData, type: val, society: targetSoc, memberIds: []});
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:border-orange-500 outline-none"
              >
                <option value="">{t('select_type')}</option>
                {teamTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-6">
            {formData.type === 'SP_A' && (
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-800 rounded-lg flex gap-3 text-sm text-blue-200">
                <i className="fas fa-info-circle mt-0.5 text-blue-400"></i>
                <p>
                  <strong>{t('composition_note_title')}</strong> {t('composition_note_body')}
                </p>
              </div>
            )}
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              {t('select_shooters_label')
                .replace(/\{\{current\}\}/g, String(formData.memberIds.length))
                .replace(/\{\{total\}\}/g, String(teamTypes.find(t => t.id === formData.type)?.size || 0))}
            </label>
            <ShooterSearch 
              value={formData.memberIds}
              onChange={(val) => {
                if (Array.isArray(val)) {
                  const typeDef = teamTypes.find(t => t.id === formData.type);
                  // Allow unlimited shooters for hunter or 'free' teams
                  if (typeDef && formData.type !== 'SQUADRA_TIRATORI' && formData.type !== 'CACCIATORI' && val.length > typeDef.size) {
                    if (triggerToast) triggerToast(t('team_members_size_error').replace('{{size}}', String(typeDef.size)), 'info');
                    return;
                  }
                  setFormData({ ...formData, memberIds: val });
                }
              }}
              shooters={mappedShooters}
              useId={true}
              multiple={true}
              placeholder={t('search_select_shooters_placeholder')}
              className="w-full"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingTeamId(null);
                setFormData({ name: '', society: '', type: '', memberIds: [] });
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-all"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-all shadow-lg shadow-orange-600/20"
            >
              {t('save_team_label')}
            </button>
          </div>
        </div>
      )}

      {!isCreating && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedTypeFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedTypeFilter === 'ALL' ? 'bg-slate-800 border-orange-500 text-orange-500 shadow-lg shadow-orange-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
          >
            {t('all_teams')}
          </button>
          {sortedAndGroupedTeams.groupA.length > 0 && (
            <button
              onClick={() => setSelectedTypeFilter('A')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedTypeFilter === 'A' ? 'bg-slate-800 border-orange-500 text-orange-500 shadow-lg shadow-orange-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
            >
              {t('squads_a')}
            </button>
          )}
          {sortedAndGroupedTeams.groupB.length > 0 && (
            <button
              onClick={() => setSelectedTypeFilter('B')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedTypeFilter === 'B' ? 'bg-slate-800 border-orange-500 text-orange-500 shadow-lg shadow-orange-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
            >
              {t('squads_b')}
            </button>
          )}
          {sortedAndGroupedTeams.hunters.length > 0 && (
            <button
              onClick={() => setSelectedTypeFilter('CA')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedTypeFilter === 'CA' ? 'bg-slate-800 border-orange-500 text-orange-500 shadow-lg shadow-orange-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
            >
              Squadre Cacciatori (CA)
            </button>
          )}
          {sortedAndGroupedTeams.libera.length > 0 && (
            <button
              onClick={() => setSelectedTypeFilter('LIBERA')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedTypeFilter === 'LIBERA' ? 'bg-slate-800 border-orange-500 text-orange-500 shadow-lg shadow-orange-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
            >
              Squadra Tiratori
            </button>
          )}
        </div>
      )}

      <div className="space-y-8">
        {!isCreating && sortedAndGroupedTeams.filtered.length > 0 && (
          <div className="overflow-x-auto bg-slate-900/30 rounded-2xl border border-slate-800">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase font-black tracking-widest text-slate-500">
                  <th className="p-4 w-12">Pos</th>
                  <th className="p-4 w-32">Sq</th>
                  <th className="p-4">Nominativo</th>
                  <th className="p-4">Tessera</th>
                  <th className="p-4">Cat</th>
                  <th className="p-4">Qual</th>
                  <th className="p-4 text-center">S. 1</th>
                  <th className="p-4 text-center">S. 2</th>
                  <th className="p-4 text-center">S. 3</th>
                  <th className="p-4 text-center">S. 4</th>
                  {hasFinalSeries && <th className="p-4 text-center">S. Fin.</th>}
                  <th className="p-4 text-right">Tot</th>
                  <th className="p-4 text-right">Sp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {sortedAndGroupedTeams.filtered.map((team, tIdx) => {
                  const teamMembers = (team.member_ids || []).map((id: string | number) => {
                    const result = results.find(r => String(r.user_id) === String(id));
                    const user = users.find(u => String(u.id) === String(id));
                    const teamMember = (team.members || []).find((m: any) => String(m.id) === String(id));
                    return {
                      id: id,
                      user_id: id,
                      user_name: result?.user_name || user?.name || teamMember?.first_name || 'Sconosciuto',
                      user_surname: result?.user_surname || user?.surname || teamMember?.last_name || '',
                      category: result?.category_at_time || user?.category || teamMember?.category || '',
                      qualification: result?.qualification_at_time || user?.qualification || teamMember?.qualification || '',
                      shooter_code: result?.shooter_code || user?.shooter_code || '',
                      totalscore: result?.totalscore || 0,
                      scores: result?.scores || [],
                      shoot_off: result?.shoot_off || ''
                    };
                  }).sort((a, b) => b.totalscore - a.totalscore);

                  const teamShootOffTotal = teamMembers.reduce((sum, m) => {
                    const val = m.shoot_off !== undefined && m.shoot_off !== null ? parseInt(String(m.shoot_off), 10) : 0;
                    return sum + (isNaN(val) ? 0 : val);
                  }, 0);

                  return (
                    <React.Fragment key={team.id}>
                      {teamMembers.map((m, mIdx) => (
                        <tr key={`${team.id}-m-${m.id}`} className="group hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 border-r border-slate-800/30">
                            {mIdx === 0 && (
                              <div className="flex flex-col items-center">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black transition-all ${tIdx < 3 ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-slate-800 text-slate-400'}`}>
                                  {tIdx + 1}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-4 font-black text-xs text-blue-400 uppercase tracking-widest border-r border-slate-800/30">
                            {mIdx === 0 && (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{team.name}</span>
                                  {(team.type || team.team_type) && (() => {
                                    const typeVal = team.type || team.team_type || '';
                                    let displayType = typeVal;
                                    if (typeVal === 'A' || typeVal.includes('(A)') || typeVal.includes('_A')) displayType = 'A';
                                    else if (typeVal === 'B' || typeVal.includes('(B)') || typeVal.includes('_B')) displayType = 'B';
                                    return <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">{displayType}</span>;
                                  })()}
                                </div>
                              </>
                            )}
                          </td>
                          <td className="p-4 font-bold text-slate-200 uppercase text-xs">
                            {m.user_surname} {m.user_name}
                          </td>
                          <td className="p-4 text-[10px] font-mono text-slate-500 uppercase">
                            {m.shooter_code}
                          </td>
                          <td className="p-4 text-[10px] font-black text-slate-400 uppercase">
                            {m.category}
                          </td>
                          <td className="p-4 text-[10px] font-black text-slate-400 uppercase">
                            {m.qualification}
                          </td>
                          {[0, 1, 2, 3, 4].map(sIdx => {
                            if (sIdx === 4 && !hasFinalSeries) return null;
                            return (
                              <td key={sIdx} className={`p-4 text-center tabular-nums text-sm ${m.scores[sIdx] === 25 ? 'text-red-500 font-black' : 'text-slate-400'}`}>
                                {m.scores[sIdx] !== undefined ? m.scores[sIdx] : '--'}
                              </td>
                            );
                          })}
                          <td className="p-4 text-right font-black text-white tabular-nums">
                            {m.totalscore}
                          </td>
                          <td className="p-4 text-right tabular-nums text-slate-500 text-xs">
                            {m.shoot_off}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-emerald-600/20 border-b-2 border-emerald-500/30">
                        <td className="p-3 border-r border-emerald-500/20"></td>
                        <td className="p-3 border-r border-emerald-500/20"></td>
                        <td colSpan={4} className="p-3 text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">{team.name} - TOTAL</td>
                        {[0, 1, 2, 3].map(sIdx => {
                          const seriesSum = teamMembers.reduce((sum, m) => sum + (m.scores[sIdx] || 0), 0);
                          return (
                            <td key={sIdx} className="p-3 text-center font-black text-emerald-400 tabular-nums">
                              {seriesSum || '--'}
                            </td>
                          )
                        })}
                        {hasFinalSeries && (
                          <td className="p-3 text-center font-black text-emerald-400 tabular-nums">
                            {teamMembers.reduce((sum, m) => sum + (m.scores[4] || 0), 0) || '0'}
                          </td>
                        )}
                        <td className="p-3 text-right font-black text-white bg-emerald-600/40">
                          <div className="flex flex-col items-end justify-center">
                            <span className="text-lg tabular-nums">{team.totalScore}</span>
                            {teamShootOffTotal > 0 && (
                              <span className="text-[10px] text-orange-400 font-black leading-none mt-0.5 uppercase tracking-wider">
                                (Barrage: {teamShootOffTotal})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right bg-emerald-600/40 font-black text-white tabular-nums">
                          {teamShootOffTotal > 0 ? teamShootOffTotal : '-'}
                        </td>
                      </tr>
                      {!readOnly && (
                         <tr className="bg-slate-900/50">
                           <td colSpan={hasFinalSeries ? 13 : 12} className="p-4 text-right border-b border-slate-800">
                              <div className="flex justify-end gap-3 items-center">
                                {team.is_sent ? (
                                  <span className="text-[10px] font-black uppercase text-emerald-500 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded-lg">
                                    <i className="fas fa-check-circle"></i> {t('team_confirmed_sent')}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleSendTeam(team.id)}
                                    className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-orange-600/20"
                                  >
                                    {t('send_team_btn')}
                                  </button>
                                )}
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
                           </td>
                         </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {teams.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-16 bg-slate-900/50 rounded-[2rem] border border-slate-800/50 border-dashed">
            <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-users text-3xl text-slate-600"></i>
            </div>
            <h4 className="text-lg font-black text-slate-400 uppercase tracking-widest">{t('no_teams_registered')}</h4>
            <p className="text-xs text-slate-500 mt-2">{t('add_first_team_desc')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamManager;
