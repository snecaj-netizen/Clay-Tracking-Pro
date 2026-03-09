import React, { useState, useEffect } from 'react';
import Settings from './Settings';
import { Competition, Cartridge, AppData } from '../types';

interface AdminPanelProps {
  user: any;
  token: string;
  // Settings props
  competitions: Competition[];
  cartridges: Cartridge[];
  clientId: string;
  onClientIdChange: (id: string) => void;
  onImport: (data: AppData) => void;
  syncStatus: string;
  lastSync: string | null;
  isDriveConnected: boolean;
  onConnectDrive: () => void;
  onDisconnectDrive: () => void;
  onSaveDrive: () => void;
  onLoadDrive: () => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  user: currentUser, token, competitions, cartridges, clientId, onClientIdChange, onImport,
  syncStatus, lastSync, isDriveConnected, onConnectDrive, onDisconnectDrive, onSaveDrive, onLoadDrive,
  triggerConfirm
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'profile' | 'team' | 'results'>('results');
  const [showUserForm, setShowUserForm] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(currentUser?.role === 'admin' || currentUser?.role === 'society');
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // Team Creation State
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSize, setNewTeamSize] = useState<3 | 6>(3);
  const [newTeamCompetitionName, setNewTeamCompetitionName] = useState('');
  const [newTeamDiscipline, setNewTeamDiscipline] = useState('');
  const [selectedShooterIds, setSelectedShooterIds] = useState<number[]>([]);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  
  // Results Filtering State
  const [showFilters, setShowFilters] = useState(false);
  const [filterShooter, setFilterShooter] = useState('');
  const [filterSociety, setFilterSociety] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [resultsPage, setResultsPage] = useState(1);
  const resultsPerPage = 50;

  const filterOptions = React.useMemo(() => {
    const societies = new Set<string>();
    const disciplines = new Set<string>();
    const locations = new Set<string>();
    const years = new Set<string>();

    allResults.forEach(r => {
      if (r.society) societies.add(r.society);
      if (r.discipline) disciplines.add(r.discipline);
      if (r.location) locations.add(r.location);
      if (r.date) {
        // Handle both YYYY-MM-DD and DD/MM/YYYY if possible, but usually it's ISO from DB
        const dateParts = r.date.split(/[-/]/);
        if (dateParts.length === 3) {
          // If YYYY-MM-DD
          if (dateParts[0].length === 4) years.add(dateParts[0]);
          // If DD/MM/YYYY
          else if (dateParts[2].length === 4) years.add(dateParts[2]);
        }
      }
    });

    return {
      societies: Array.from(societies).sort(),
      disciplines: Array.from(disciplines).sort(),
      locations: Array.from(locations).sort(),
      years: Array.from(years).sort((a, b) => b.localeCompare(a))
    };
  }, [allResults]);

  const shooters = React.useMemo(() => {
    const unique = new Map();
    teamStats.forEach(s => {
      if (!unique.has(s.user_id)) {
        unique.set(s.user_id, { id: s.user_id, name: s.name, surname: s.surname });
      }
    });
    return Array.from(unique.values()) as { id: number, name: string, surname: string }[];
  }, [teamStats]);

  // Form state for Admin User Management
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [category, setCategory] = useState('');
  const [qualification, setQualification] = useState('');
  const [society, setSociety] = useState('');
  const [fitavCard, setFitavCard] = useState('');
  const [isNewSociety, setIsNewSociety] = useState(false);

  // Profile state for current user
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileSurname, setProfileSurname] = useState(currentUser?.surname || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [profileCategory, setProfileCategory] = useState(currentUser?.category || '');
  const [profileQualification, setProfileQualification] = useState(currentUser?.qualification || '');
  const [profileSociety, setProfileSociety] = useState(currentUser?.society || '');
  const [profileFitavCard, setProfileFitavCard] = useState(currentUser?.fitav_card || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const fetchUsers = async () => {
    if (currentUser?.role !== 'admin') return;
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchTeamStats = async () => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    try {
      const res = await fetch('/api/admin/team-stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch team stats');
      const data = await res.json();
      setTeamStats(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchAllResults = async () => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    try {
      const res = await fetch('/api/admin/all-results', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch all results');
      const data = await res.json();
      setAllResults(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchTeams = async () => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    try {
      const res = await fetch('/api/teams', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch teams');
      const data = await res.json();
      setTeams(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'society') {
      setLoading(true);
      const promises = [fetchTeamStats(), fetchAllResults(), fetchTeams()];
      if (currentUser?.role === 'admin') promises.push(fetchUsers());
      Promise.all(promises).finally(() => setLoading(false));
    }
  }, [token]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProfileSuccess('');

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: profileName,
          surname: profileSurname,
          email: profileEmail,
          category: profileCategory,
          qualification: profileQualification,
          society: profileSociety,
          fitav_card: profileFitavCard,
          password: profilePassword || undefined
        }),
      });

      if (!res.ok) throw new Error('Errore durante l\'aggiornamento del profilo');
      
      setProfileSuccess('Profilo aggiornato con successo! Alcune modifiche potrebbero richiedere il ricaricamento.');
      setProfilePassword('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedShooterIds.length !== newTeamSize) {
      setError(`Devi selezionare esattamente ${newTeamSize} tiratori.`);
      return;
    }

    try {
      const endpoint = editingTeam ? `/api/teams/${editingTeam.id}` : '/api/teams';
      const method = editingTeam ? 'PUT' : 'POST';
      
      const res = await fetch(endpoint, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: newTeamName,
          size: newTeamSize,
          competition_name: newTeamCompetitionName,
          discipline: newTeamDiscipline,
          memberIds: selectedShooterIds
        }),
      });

      if (!res.ok) throw new Error(`Errore durante ${editingTeam ? 'la modifica' : 'la creazione'} della squadra`);
      
      setNewTeamName('');
      setNewTeamCompetitionName('');
      setNewTeamDiscipline('');
      setSelectedShooterIds([]);
      setShowTeamForm(false);
      setEditingTeam(null);
      fetchTeams();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditTeam = (team: any) => {
    setEditingTeam(team);
    setNewTeamName(team.name);
    setNewTeamSize(team.size as 3 | 6);
    setNewTeamCompetitionName(team.competition_name || '');
    setNewTeamDiscipline(team.discipline || '');
    setSelectedShooterIds(team.members ? team.members.map((m: any) => m.id) : []);
    setShowTeamForm(true);
  };

  const handleDeleteTeam = (id: number) => {
    triggerConfirm(
      'Elimina Squadra',
      'Sei sicuro di voler eliminare questa squadra?',
      async () => {
        try {
          const res = await fetch(`/api/teams/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) fetchTeams();
          else throw new Error('Errore durante l\'eliminazione');
        } catch (err: any) {
          setError(err.message);
        }
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const endpoint = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
    const method = editingUser ? 'PUT' : 'POST';
    const body = { name, surname, email, role, category, qualification, society, fitav_card: fitavCard, password: password || undefined };

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Errore durante il salvataggio');
      
      setEditingUser(null);
      setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); setSociety(''); setFitavCard('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    triggerConfirm(
      'Elimina Utente',
      'Sei sicuro di voler eliminare questo utente e tutti i suoi dati? L\'azione è irreversibile.',
      async () => {
        try {
          const res = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Errore durante l\'eliminazione');
          fetchUsers();
        } catch (err: any) {
          setError(err.message);
        }
      }
    );
  };

  const editUser = (user: any) => {
    setEditingUser(user);
    setName(user.name);
    setSurname(user.surname);
    setEmail(user.email);
    setRole(user.role);
    setCategory(user.category || '');
    setQualification(user.qualification || '');
    setSociety(user.society || '');
    setFitavCard(user.fitav_card || '');
    setPassword('');
  };

  if (loading && (activeTab === 'users' || activeTab === 'team' || activeTab === 'results')) return <div className="p-8 text-center text-slate-500"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  const resultsToDisplay = (currentUser?.role === 'admin' || currentUser?.role === 'society') ? allResults : competitions.map(c => ({
    ...c,
    userName: currentUser?.name || '',
    userSurname: currentUser?.surname || '',
    userId: currentUser?.id || ''
  }));

  const filteredResults = resultsToDisplay
    .filter(r => r.totalScore > 0)
    .filter(r => {
      const shooterMatch = `${r.userName} ${r.userSurname}`.toLowerCase().includes(filterShooter.toLowerCase()) || 
                           `${r.userSurname} ${r.userName}`.toLowerCase().includes(filterShooter.toLowerCase());
      const societyMatch = !filterSociety || r.society === filterSociety;
      const disciplineMatch = !filterDiscipline || r.discipline === filterDiscipline;
      const locationMatch = !filterLocation || r.location === filterLocation;
      
      let yearMatch = true;
      if (filterYear && r.date) {
        const dateParts = r.date.split(/[-/]/);
        const year = dateParts[0].length === 4 ? dateParts[0] : dateParts[2];
        yearMatch = year === filterYear;
      }

      return shooterMatch && societyMatch && disciplineMatch && locationMatch && yearMatch;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date.split(/[-/]/).reverse().join('-')).getTime() || new Date(a.date).getTime();
      const dateB = new Date(b.date.split(/[-/]/).reverse().join('-')).getTime() || new Date(b.date).getTime();
      return dateA - dateB;
    });

  const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
  const paginatedResults = filteredResults.slice((resultsPage - 1) * resultsPerPage, resultsPage * resultsPerPage);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setter(e.target.value);
    setResultsPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="sticky top-16 sm:top-[104px] z-40 flex bg-slate-900 p-1 rounded-2xl border border-slate-800 max-w-2xl mx-auto overflow-x-auto no-scrollbar shadow-xl">
        <button 
          onClick={() => setActiveTab('results')}
          className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'results' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <i className="fas fa-history mr-2"></i> Risultati
        </button>
        {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
          <>
            <button 
              onClick={() => setActiveTab('team')}
              className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'team' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <i className="fas fa-trophy mr-2"></i> Squadre
            </button>
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('users')}
                className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <i className="fas fa-users mr-2"></i> Utenti
              </button>
            )}
          </>
        )}
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <i className="fas fa-user mr-2"></i> Profilo
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'settings' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <i className="fas fa-cog mr-2"></i> {currentUser?.role === 'admin' ? 'Avanzate' : 'Backup'}
        </button>
      </div>

      {activeTab === 'settings' ? (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
          <Settings 
            user={currentUser}
            token={token}
            competitions={competitions}
            cartridges={cartridges}
            clientId={clientId}
            onClientIdChange={onClientIdChange}
            onImport={onImport}
            syncStatus={syncStatus}
            lastSync={lastSync}
            isDriveConnected={isDriveConnected}
            onConnectDrive={onConnectDrive}
            onDisconnectDrive={onDisconnectDrive}
            onSaveDrive={onSaveDrive}
            onLoadDrive={onLoadDrive}
          />
        </div>
      ) : activeTab === 'profile' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-2">
            <i className="fas fa-user-circle text-orange-500"></i> Il Tuo Profilo
          </h2>

          {profileSuccess && <div className="bg-emerald-950/50 text-emerald-500 p-3 rounded-xl text-sm mb-4 border border-emerald-900/50">{profileSuccess}</div>}
          {error && <div className="bg-red-950/50 text-red-500 p-3 rounded-xl text-sm mb-4 border border-red-900/50">{error}</div>}

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cognome</label>
                <input type="text" value={profileSurname} onChange={e => setProfileSurname(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nuova Password (opzionale)</label>
                <input type="password" value={profilePassword} onChange={e => setProfilePassword(e.target.value)} placeholder="Lascia vuoto per non cambiare" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società</label>
                <input type="text" value={profileSociety} onChange={e => setProfileSociety(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tessera Fitav</label>
                <input type="text" value={profileFitavCard} onChange={e => setProfileFitavCard(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
                <select value={profileCategory} onChange={e => setProfileCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                  <option value="">Seleziona...</option>
                  <option value="Eccellenza">Eccellenza</option>
                  <option value="1*">1*</option>
                  <option value="2*">2*</option>
                  <option value="3*">3*</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Qualifica</label>
                <select value={profileQualification} onChange={e => setProfileQualification(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                  <option value="">Seleziona...</option>
                  <option value="Veterani">Veterani</option>
                  <option value="Master">Master</option>
                  <option value="Senior">Senior</option>
                </select>
              </div>
            </div>
            <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-black py-3 px-8 rounded-xl transition-all active:scale-95 text-xs uppercase shadow-lg shadow-orange-600/20">
              Aggiorna Profilo
            </button>
          </form>
        </div>
      ) : activeTab === 'team' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Gestione Squadre */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <i className="fas fa-users text-orange-500"></i> Gestione Squadre
              </h2>
              <button 
                onClick={() => setShowTeamForm(!showTeamForm)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${showTeamForm ? 'bg-slate-800 text-slate-400' : 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'}`}
              >
                <i className={`fas ${showTeamForm ? 'fa-times' : 'fa-plus'}`}></i>
                {showTeamForm ? 'Chiudi' : 'Nuova Squadra'}
              </button>
            </div>

            {showTeamForm && (
              <form onSubmit={handleCreateTeam} className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 mb-8 space-y-6 animate-in zoom-in-95 duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Squadra</label>
                    <input 
                      type="text" 
                      required 
                      value={newTeamName} 
                      onChange={e => setNewTeamName(e.target.value)} 
                      placeholder="Es: Team Gold"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Titolo/Nome Gara</label>
                    <input 
                      type="text" 
                      value={newTeamCompetitionName} 
                      onChange={e => setNewTeamCompetitionName(e.target.value)} 
                      placeholder="Es: Campionato Regionale"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
                    <select 
                      value={newTeamDiscipline} 
                      onChange={e => setNewTeamDiscipline(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                    >
                      <option value="">Seleziona...</option>
                      <option value="Compak Sporting (CK)">Compak Sporting (CK)</option>
                      <option value="Sporting (SP)">Sporting (SP)</option>
                      <option value="English Sporting (ES)">English Sporting (ES)</option>
                      <option value="Club Cup (PC)">Club Cup (PC)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dimensione Squadra</label>
                    <div className="flex gap-2">
                      {[3, 6].map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => { setNewTeamSize(size as 3 | 6); setSelectedShooterIds([]); }}
                          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${newTeamSize === size ? 'bg-orange-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}
                        >
                          {size} Tiratori
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Seleziona {newTeamSize} Tiratori ({selectedShooterIds.length}/{newTeamSize})
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                    {shooters.map(shooter => (
                      <button
                        key={shooter.id}
                        type="button"
                        onClick={() => {
                          if (selectedShooterIds.includes(shooter.id)) {
                            setSelectedShooterIds(prev => prev.filter(id => id !== shooter.id));
                          } else if (selectedShooterIds.length < newTeamSize) {
                            setSelectedShooterIds(prev => [...prev, shooter.id]);
                          }
                        }}
                        className={`p-3 rounded-lg text-left text-xs font-bold transition-all border ${selectedShooterIds.includes(shooter.id) ? 'bg-orange-600/20 border-orange-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                      >
                        {shooter.surname} {shooter.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="submit" 
                    disabled={selectedShooterIds.length !== newTeamSize}
                    className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-orange-600/20"
                  >
                    {editingTeam ? 'SALVA MODIFICHE' : 'CREA SQUADRA'}
                  </button>
                  {editingTeam && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingTeam(null);
                        setNewTeamName('');
                        setNewTeamCompetitionName('');
                        setNewTeamDiscipline('');
                        setSelectedShooterIds([]);
                        setShowTeamForm(false);
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl transition-all"
                    >
                      ANNULLA
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Elenco Squadre Esistenti */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map(team => (
                <div key={team.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 relative group">
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => handleEditTeam(team)}
                      className="w-8 h-8 rounded-lg bg-orange-950/30 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white"
                    >
                      <i className="fas fa-edit text-xs"></i>
                    </button>
                    <button 
                      onClick={() => handleDeleteTeam(team.id)}
                      className="w-8 h-8 rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white"
                    >
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>
                  <div className="mb-3">
                    <span className="text-[9px] font-black bg-orange-600/20 text-orange-500 px-2 py-0.5 rounded uppercase mr-2">
                      {team.size} Tiratori
                    </span>
                    {(team.competition_name || team.discipline) && (
                      <span className="text-[9px] font-black bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded uppercase">
                        {team.discipline}
                      </span>
                    )}
                    <h4 className="text-lg font-black text-white mt-1">{team.name}</h4>
                    {team.competition_name && (
                      <p className="text-xs text-slate-400 font-medium">{team.competition_name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {team.members.map((m: any, idx: number) => {
                      // Trova le statistiche del tiratore per la disciplina della squadra
                      const shooterStats = teamStats.find(s => s.user_id === m.id && (!team.discipline || s.discipline === team.discipline));
                      const catQual = shooterStats ? (shooterStats.category || shooterStats.qualification || '') : '';
                      const avg = shooterStats ? Number(shooterStats.avg_score).toFixed(2) : '-';
                      
                      return (
                        <div key={idx} className="text-xs text-slate-400 flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-4 h-4 rounded-full bg-slate-800 text-[8px] flex items-center justify-center text-slate-500 font-bold shrink-0">{idx + 1}</span>
                            <span className="font-bold text-slate-300 truncate">{m.surname} {m.name}</span>
                            {catQual && (
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter shrink-0">({catQual})</span>
                            )}
                          </div>
                          <div className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded shrink-0">
                            Media: {avg}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {teams.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-600 italic text-sm">
                  Nessuna squadra creata.
                </div>
              )}
            </div>
          </div>

          {/* Dashboard Squadre (Tabella Statistiche) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-2">
              <i className="fas fa-chart-line text-orange-500"></i> Statistiche Individuali
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="py-3 px-4">Tiratore</th>
                    <th className="py-3 px-4">Società</th>
                    <th className="py-3 px-4">Cat./Qual.</th>
                    <th className="py-3 px-4">Disciplina</th>
                    <th className="py-3 px-4">Gare</th>
                    <th className="py-3 px-4 text-right">Media</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStats.map((s, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-4 text-sm text-white font-bold">{s.surname} {s.name}</td>
                      <td className="py-3 px-4 text-[10px] text-slate-400 font-bold uppercase">{s.society || '-'}</td>
                      <td className="py-3 px-4 text-[10px] text-slate-400 font-bold uppercase">
                        {s.category || '-'} / {s.qualification || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">{s.discipline || 'N/A'}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">{s.total_competitions}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-black text-orange-500">
                          {s.avg_score ? parseFloat(s.avg_score).toFixed(2) : '0.00'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'results' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-list-ol text-orange-500"></i> Tutti i Risultati
            </h2>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${showFilters ? 'bg-slate-800 text-slate-400' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
            >
              <i className="fas fa-filter"></i>
              {showFilters ? 'Nascondi Filtri' : 'Filtra Risultati'}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-8 p-4 bg-slate-950/50 rounded-2xl border border-slate-800 animate-in zoom-in-95 duration-300">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tiratore</label>
                <input 
                  type="text" 
                  value={filterShooter} 
                  onChange={handleFilterChange(setFilterShooter)} 
                  placeholder="Cerca nome..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società</label>
                <select 
                  value={filterSociety} 
                  onChange={handleFilterChange(setFilterSociety)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                >
                  <option value="">Tutte</option>
                  {filterOptions.societies.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
                <select 
                  value={filterDiscipline} 
                  onChange={handleFilterChange(setFilterDiscipline)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                >
                  <option value="">Tutte</option>
                  {filterOptions.disciplines.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Campo</label>
                <select 
                  value={filterLocation} 
                  onChange={handleFilterChange(setFilterLocation)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                >
                  <option value="">Tutti</option>
                  {filterOptions.locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Anno</label>
                <select 
                  value={filterYear} 
                  onChange={handleFilterChange(setFilterYear)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                >
                  <option value="">Tutti</option>
                  {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="sm:col-span-5 flex justify-end">
                <button 
                  onClick={() => { setFilterShooter(''); setFilterSociety(''); setFilterDiscipline(''); setFilterLocation(''); setFilterYear(''); setResultsPage(1); }}
                  className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400 transition-colors"
                >
                  Resetta Filtri
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Tiratore</th>
                  <th className="py-3 px-4">Società</th>
                  <th className="py-3 px-4">Gara</th>
                  <th className="py-3 px-4">Disciplina</th>
                  <th className="py-3 px-4">Campo</th>
                  <th className="py-3 px-4 text-right">Risultato</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((r, idx) => (
                  <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4 text-[10px] text-slate-500 font-bold">{r.date}</td>
                    <td className="py-3 px-4 text-xs text-white font-bold">{r.userSurname} {r.userName}</td>
                    <td className="py-3 px-4 text-[10px] text-slate-400 font-bold uppercase">{r.society || '-'}</td>
                    <td className="py-3 px-4 text-xs text-slate-300">{r.name}</td>
                    <td className="py-3 px-4 text-[10px] text-slate-400 uppercase font-black">{r.discipline}</td>
                    <td className="py-3 px-4 text-[10px] text-slate-500 uppercase">{r.location || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-black text-white">
                        {r.totalScore}/{r.totalTargets}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-800">
                <span className="text-xs text-slate-500">
                  Pagina <span className="text-white font-bold">{resultsPage}</span> di <span className="text-white font-bold">{totalPages}</span>
                  <span className="ml-2">({filteredResults.length} risultati)</span>
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setResultsPage(p => Math.max(1, p - 1))}
                    disabled={resultsPage === 1}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                  >
                    <i className="fas fa-chevron-left mr-1"></i> Precedente
                  </button>
                  <button 
                    onClick={() => setResultsPage(p => Math.min(totalPages, p + 1))}
                    disabled={resultsPage === totalPages}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                  >
                    Successiva <i className="fas fa-chevron-right ml-1"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-users-cog text-orange-500"></i> Gestione Utenti
            </h2>
            <button 
              onClick={() => { setShowUserForm(!showUserForm); setEditingUser(null); }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${showUserForm ? 'bg-slate-800 text-slate-400' : 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'}`}
            >
              <i className={`fas ${showUserForm ? 'fa-times' : 'fa-user-plus'}`}></i>
              {showUserForm ? 'Chiudi' : 'Nuovo Utente'}
            </button>
          </div>

          {error && <div className="bg-red-950/50 text-red-500 p-3 rounded-xl text-sm mb-4">{error}</div>}

          {showUserForm && (
            <form onSubmit={handleSubmit} className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 mb-8 animate-in zoom-in-95 duration-300">
              <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase">{editingUser ? 'Modifica Utente' : 'Nuovo Utente'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ruolo</label>
                  <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                    <option value="user">Tiratore</option>
                    <option value="society">Società</option>
                    <option value="admin">Amministratore</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cognome</label>
                  <input type="text" required value={surname} onChange={e => setSurname(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password {editingUser && '(lascia vuoto per non cambiare)'}</label>
                  <input type="password" required={!editingUser} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                
                {role !== 'society' && (
                  <>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
                      <select required={!qualification} value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                        <option value="">Seleziona...</option>
                        <option value="Eccellenza">Eccellenza</option>
                        <option value="1*">1*</option>
                        <option value="2*">2*</option>
                        <option value="3*">3*</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Qualifica</label>
                      <select required={!category} value={qualification} onChange={e => setQualification(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                        <option value="">Seleziona...</option>
                        <option value="Veterani">Veterani</option>
                        <option value="Master">Master</option>
                        <option value="Senior">Senior</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società</label>
                  {isNewSociety ? (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={society} 
                        onChange={e => setSociety(e.target.value)} 
                        placeholder="Inserisci nuova società"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                      />
                      <button type="button" onClick={() => setIsNewSociety(false)} className="px-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white"><i className="fas fa-times"></i></button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select 
                        value={society} 
                        onChange={e => setSociety(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                      >
                        <option value="">Seleziona...</option>
                        {filterOptions.societies.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button type="button" onClick={() => setIsNewSociety(true)} className="px-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white" title="Aggiungi nuova"><i className="fas fa-plus"></i></button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tessera Fitav</label>
                  <input type="text" value={fitavCard} onChange={e => setFitavCard(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-black py-2 px-6 rounded-xl transition-all active:scale-95 text-xs uppercase">
                  {editingUser ? 'Salva Modifiche' : 'Crea Utente'}
                </button>
                <button type="button" onClick={() => { setShowUserForm(false); setEditingUser(null); setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); }} className="bg-slate-800 hover:bg-slate-700 text-white font-black py-2 px-6 rounded-xl transition-all active:scale-95 text-xs uppercase">
                  Annulla
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Tessera Fitav</th>
                  <th className="py-3 px-4">Società</th>
                  <th className="py-3 px-4">Cat./Qual.</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Ruolo</th>
                  <th className="py-3 px-4 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4 text-sm text-white font-bold">{u.name} {u.surname}</td>
                    <td className="py-3 px-4 text-[10px] text-slate-400 font-bold uppercase">{u.fitav_card || '-'}</td>
                    <td className="py-3 px-4 text-[10px] text-slate-400 font-bold uppercase">{u.society || '-'}</td>
                    <td className="py-3 px-4 text-[10px] text-slate-400 font-bold uppercase">{u.category || '-'} / {u.qualification || '-'}</td>
                    <td className="py-3 px-4 text-sm text-slate-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${u.role === 'admin' ? 'bg-orange-500/20 text-orange-500' : u.role === 'society' ? 'bg-blue-500/20 text-blue-500' : 'bg-slate-800 text-slate-400'}`}>
                        {u.role === 'user' ? 'Tiratore' : u.role === 'society' ? 'Società' : 'Admin'}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex justify-end gap-2">
                      <button onClick={() => { editUser(u); setShowUserForm(true); }} className="w-8 h-8 rounded-lg bg-blue-900/30 text-blue-500 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"><i className="fas fa-edit text-xs"></i></button>
                      <button onClick={() => handleDelete(u.id)} disabled={u.email === 'snecaj@gmail.com'} className="w-8 h-8 rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all disabled:opacity-30"><i className="fas fa-trash-alt text-xs"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
