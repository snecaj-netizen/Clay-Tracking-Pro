import React, { useState, useEffect, useCallback } from 'react';
import { Discipline, Competition, CompetitionLevel, Cartridge, AppData } from './types';
import Dashboard from './components/Dashboard';
import CompetitionForm from './components/CompetitionForm';
import HistoryList from './components/HistoryList';
import Header from './components/Header';
import StatsCharts from './components/StatsCharts';
import GeminiCoach from './components/GeminiCoach';
import Settings from './components/Settings';
import Warehouse from './components/Warehouse';
import Auth from './components/Auth';
import AdminPanel from './components/AdminPanel';
import EventsManager from './components/EventsManager';
import ConfirmModal from './components/ConfirmModal';

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [cartridges, setCartridges] = useState<Cartridge[]>([]);
  const [societies, setSocieties] = useState<any[]>([]);
  const [view, setView] = useState<'dashboard' | 'new' | 'history' | 'warehouse' | 'settings' | 'admin' | 'events' | 'societies'>(
    user?.role === 'society' ? 'admin' : 'history'
  );
  const [previousView, setPreviousView] = useState<'dashboard' | 'new' | 'history' | 'warehouse' | 'settings' | 'admin' | 'events' | 'societies' | null>(null);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [prefillCompetition, setPrefillCompetition] = useState<Partial<Competition> | null>(null);
  const [prefillTeamData, setPrefillTeamData] = useState<{ competition_name: string, discipline: string, society: string, date: string, location: string } | null>(null);
  
  const [loading, setLoading] = useState(true);

  // Confirm Modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    variant?: 'danger' | 'primary';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => {
    console.log('Triggering confirm modal:', { title, message });
    setConfirmConfig({ isOpen: true, title, message, onConfirm, confirmText, variant });
  };

  // Fetch data from API
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [compsRes, cartsRes, socsRes] = await Promise.all([
        fetch('/api/competitions', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/cartridges', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/societies', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (compsRes.ok) setCompetitions(await compsRes.json());
      if (cartsRes.ok) setCartridges(await cartsRes.json());
      if (socsRes.ok) setSocieties(await socsRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [token, fetchData]);

  const handleLogin = (newToken: string, newUser: any) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setView(newUser.role === 'society' ? 'admin' : 'history');
  };

  const handleLogout = () => {
    triggerConfirm(
      'Logout',
      'Sei sicuro di voler uscire dall\'applicazione?',
      () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setUser(null);
        setCompetitions([]);
        setCartridges([]);
      },
      'Esci',
      'primary'
    );
  };

  const handleUserUpdate = (updatedUser: any) => {
    setUser(updatedUser);
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
  };

  const handleParticipateInEvent = (event: any) => {
    const newComp: Partial<Competition> = {
      name: event.name,
      location: event.location,
      date: event.start_date ? event.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: event.end_date ? event.end_date.split('T')[0] : undefined,
      discipline: event.discipline as Discipline,
      totalTargets: Number(event.targets) || 50,
      level: event.type === 'Regionale' ? CompetitionLevel.REGIONAL : 
             event.type === 'Nazionale' ? CompetitionLevel.NATIONAL : 
             event.type === 'Internazionale' ? CompetitionLevel.INTERNATIONAL : 
             CompetitionLevel.REGIONAL
    };
    setPrefillCompetition(newComp);
    setPreviousView(view);
    setView('new');
  };

  const handleCreateTeamFromEvent = (event: any) => {
    setPrefillTeamData({
      competition_name: event.name,
      discipline: event.discipline,
      society: user?.role === 'society' ? user.society : event.location,
      location: event.location,
      date: event.start_date ? event.start_date.split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setView('admin');
  };

  const saveCompetition = async (comp: Competition) => {
    const isEdit = !!editingCompetition;
    const method = isEdit ? 'PUT' : 'POST';
    const endpoint = isEdit ? `/api/competitions/${comp.id}` : '/api/competitions';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(comp)
      });
      if (res.ok) {
        if (comp.userId && comp.userId !== user?.id) {
          // If the admin created/edited a competition for another user, don't add it to their own list
          setCompetitions(prev => prev.filter(c => c.id !== comp.id));
        } else {
          setCompetitions(prev => !isEdit ? [comp, ...prev] : prev.map(c => c.id === comp.id ? comp : c));
        }
        setView(previousView || 'history');
        setPreviousView(null);
        setEditingCompetition(null);
      } else {
        const errorData = await res.json();
        console.error('Save error:', errorData);
        // Using a more robust way to show error if alert is blocked
        const errorMsg = `Errore nel salvataggio della gara: ${errorData.error || res.statusText}`;
        setConfirmConfig({
          isOpen: true,
          title: 'Errore',
          message: errorMsg,
          onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false }))
        });
      }
    } catch (err) {
      console.error('Error saving competition:', err);
      setConfirmConfig({
        isOpen: true,
        title: 'Errore di rete',
        message: 'Impossibile salvare la gara. Controlla la tua connessione.',
        onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  const deleteCompetition = async (id: string) => {
    console.log('Attempting to delete competition with ID:', id);
    try {
      const res = await fetch(`/api/competitions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Delete response status:', res.status);
      if (res.ok) {
        setCompetitions(prev => prev.filter(c => c.id !== id));
      } else {
        const errorData = await res.json();
        alert(`Errore nell'eliminazione: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error deleting competition:', err);
      alert('Errore di rete nell\'eliminazione.');
    }
  };

  const saveCartridge = async (cart: Cartridge) => {
    const isNew = !cartridges.find(c => c.id === cart.id);
    const method = isNew ? 'POST' : 'PUT';
    const endpoint = isNew ? '/api/cartridges' : `/api/cartridges/${cart.id}`;

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(cart)
      });
      if (res.ok) {
        setCartridges(prev => isNew ? [cart, ...prev] : prev.map(c => c.id === cart.id ? cart : c));
      } else {
        const errorData = await res.json();
        alert(`Errore nel salvataggio delle cartucce: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error saving cartridge:', err);
      alert('Errore di rete nel salvataggio delle cartucce.');
    }
  };

  const deleteCartridge = async (id: string) => {
    console.log('Attempting to delete cartridge with ID:', id);
    try {
      const res = await fetch(`/api/cartridges/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Delete response status:', res.status);
      if (res.ok) {
        setCartridges(prev => prev.filter(c => c.id !== id));
      } else {
        const errorData = await res.json();
        alert(`Errore nell'eliminazione: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error deleting cartridge:', err);
      alert('Errore di rete nell\'eliminazione.');
    }
  };

  const updateAllCartridges = async (carts: Cartridge[]) => {
    try {
      const res = await fetch('/api/cartridges/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(carts)
      });
      if (res.ok) {
        setCartridges(carts);
      } else {
        const errorData = await res.json();
        alert(`Errore nell'aggiornamento massivo: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error bulk updating cartridges:', err);
      alert('Errore di rete nell\'aggiornamento massivo.');
    }
  };

  const handleImport = async (data: any) => {
    triggerConfirm(
      'Importazione Dati',
      'Questa operazione importerà i dati e potrebbe sovrascrivere quelli esistenti con lo stesso ID. Continuare?',
      async () => {
        // Normalizzazione dati se il formato è diverso
        const normalizedData: AppData = {
          competitions: Array.isArray(data.competitions) ? data.competitions : (Array.isArray(data) ? data : []),
          cartridges: Array.isArray(data.cartridges) ? data.cartridges : []
        };

        try {
          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(normalizedData)
          });
          if (res.ok) {
            alert('Dati importati con successo!');
            fetchData(); // Ricarica tutto dal server
          } else {
            const errorData = await res.json();
            alert(`Errore durante l'importazione: ${errorData.error || res.statusText}`);
          }
        } catch (err) {
          console.error('Error importing data:', err);
          alert('Errore di rete durante l\'importazione.');
        }
      },
      'Importa',
      'danger'
    );
  };

  if (!token) {
    return <Auth onLogin={handleLogin} />;
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><i className="fas fa-spinner fa-spin text-4xl text-orange-600"></i></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col pb-24 sm:pb-8">
      <Header 
        currentView={view} 
        onNavigate={setView} 
        onLogout={handleLogout}
        user={user}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-32 pb-20 sm:pb-8 flex-1 w-full">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Dashboard competitions={competitions} user={user} onAddClick={() => { setPreviousView('dashboard'); setView('new'); }} />
            {competitions.length > 0 && <StatsCharts competitions={competitions} />}
            {competitions.length > 0 && <GeminiCoach competitions={competitions} />}
          </div>
        )}
        
        {view === 'new' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CompetitionForm 
              currentUser={user}
              onSubmit={saveCompetition} 
              onCancel={() => {
                setView(previousView || 'history');
                setPreviousView(null);
                setEditingCompetition(null);
                setPrefillCompetition(null);
              }}
              initialData={editingCompetition || undefined}
              prefillData={prefillCompetition || undefined}
              availableCartridges={cartridges}
              societies={societies}
              knownLocations={Array.from(new Set(competitions.map(c => c.location).filter(Boolean)))}
            />
          </div>
        )}
        
        {view === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <HistoryList 
              competitions={competitions} 
              onDelete={deleteCompetition}
              onEdit={(comp) => {
                setPreviousView('history');
                setEditingCompetition(comp);
                setView('new');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              triggerConfirm={triggerConfirm}
              user={user}
            />
          </div>
        )}

        {view === 'warehouse' && user?.role !== 'society' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Warehouse 
              cartridges={cartridges}
              onSave={saveCartridge}
              onDelete={deleteCartridge}
              onUpdateAll={updateAllCartridges}
              triggerConfirm={triggerConfirm}
            />
          </div>
        )}

        {view === 'events' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <EventsManager 
              user={user} 
              token={token} 
              triggerConfirm={triggerConfirm} 
              societies={societies} 
              onParticipate={handleParticipateInEvent}
              onCreateTeam={handleCreateTeamFromEvent}
            />
          </div>
        )}

        {view === 'societies' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AdminPanel 
              user={user}
              token={token}
              competitions={competitions}
              cartridges={cartridges}
              clientId=""
              onClientIdChange={() => {}}
              onImport={handleImport}
              isDriveConnected={false}
              onConnectDrive={() => {}}
              onDisconnectDrive={() => {}}
              onSaveDrive={() => {}}
              onLoadDrive={() => {}}
              syncStatus="idle"
              lastSync={null}
              triggerConfirm={triggerConfirm}
              onEditCompetition={(comp) => {
                setPreviousView('societies');
                setEditingCompetition(comp || null);
                setView('new');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onDeleteCompetition={deleteCompetition}
              initialTab="societies"
              onUserUpdate={handleUserUpdate}
            />
          </div>
        )}

        {view === 'admin' && (
          <div>
            <AdminPanel 
              user={user}
              token={token}
              competitions={competitions}
              cartridges={cartridges}
              clientId=""
              onClientIdChange={() => {}}
              onImport={handleImport}
              isDriveConnected={false}
              onConnectDrive={() => {}}
              onDisconnectDrive={() => {}}
              onSaveDrive={() => {}}
              onLoadDrive={() => {}}
              syncStatus="idle"
              lastSync={null}
              triggerConfirm={triggerConfirm}
              onEditCompetition={(comp) => {
                setPreviousView('admin');
                setEditingCompetition(comp || null);
                setView('new');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onDeleteCompetition={deleteCompetition}
              onUserUpdate={handleUserUpdate}
              prefillTeam={prefillTeamData || undefined}
              onPrefillTeamUsed={() => setPrefillTeamData(null)}
            />
          </div>
        )}
      </main>

      {/* Floating Add Button - Only on Dashboard/History/New Page and not for society role */}
      {(view === 'dashboard' || view === 'history' || view === 'new') && user?.role !== 'society' && (
        <button 
          onClick={() => { 
            if (view === 'new') {
              setView(previousView || 'history');
              setPreviousView(null);
              setEditingCompetition(null);
              setPrefillCompetition(null);
            } else {
              setPreviousView(view);
              setEditingCompetition(null); 
              setView('new'); 
            }
          }}
          className={`fixed bottom-8 right-8 w-16 h-16 ${view === 'new' ? 'bg-orange-500 shadow-orange-500/40' : 'bg-orange-600 shadow-orange-600/40'} rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-all active:scale-95 z-40 floating-add-btn group`}
          title={view === 'new' ? 'Chiudi' : 'Nuova Gara'}
        >
          <i className={`fas ${view === 'new' ? 'fa-times' : 'fa-plus'} text-2xl group-hover:rotate-90 transition-transform duration-300`}></i>
        </button>
      )}

      {/* Footer */}
      <footer className="w-full py-6 mt-auto border-t border-slate-800/50 bg-slate-950/30">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Stefano Necaj. Tutti i diritti riservati.
          </p>
        </div>
      </footer>

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
      />
    </div>
  );
};

export default App;
