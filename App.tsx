import React, { useState, useEffect, useCallback } from 'react';
import { Discipline, Competition, Cartridge, AppData } from './types';
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
import ConfirmModal from './components/ConfirmModal';

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('auth_user') || 'null'));
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [cartridges, setCartridges] = useState<Cartridge[]>([]);
  const [societies, setSocieties] = useState<any[]>([]);
  const [view, setView] = useState<'dashboard' | 'new' | 'history' | 'warehouse' | 'settings' | 'admin'>(
    user?.role === 'society' ? 'admin' : 'history'
  );
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  
  const [loading, setLoading] = useState(true);

  // Confirm Modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    console.log('Triggering confirm modal:', { title, message });
    setConfirmConfig({ isOpen: true, title, message, onConfirm });
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
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
    setCompetitions([]);
    setCartridges([]);
  };

  const saveCompetition = async (comp: Competition) => {
    const isNew = !competitions.find(c => c.id === comp.id);
    const method = isNew ? 'POST' : 'PUT';
    const endpoint = isNew ? '/api/competitions' : `/api/competitions/${comp.id}`;

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(comp)
      });
      if (res.ok) {
        setCompetitions(prev => isNew ? [comp, ...prev] : prev.map(c => c.id === comp.id ? comp : c));
        setView('history');
        setEditingCompetition(null);
      } else {
        const errorData = await res.json();
        alert(`Errore nel salvataggio della gara: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error saving competition:', err);
      alert('Errore di rete nel salvataggio della gara.');
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
      }
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
            <Dashboard competitions={competitions} user={user} />
            {competitions.length > 0 && <StatsCharts competitions={competitions} />}
            {competitions.length > 0 && <GeminiCoach competitions={competitions} />}
          </div>
        )}
        
        {view === 'new' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CompetitionForm 
              onSubmit={saveCompetition} 
              onCancel={() => {
                setView('history');
                setEditingCompetition(null);
              }}
              initialData={editingCompetition || undefined}
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
                setEditingCompetition(comp);
                setView('new');
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
              onUpdateAll={(carts) => {
                carts.forEach(c => saveCartridge(c));
              }}
              triggerConfirm={triggerConfirm}
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
            />
          </div>
        )}
      </main>

      {/* Floating Add Button - Only on History Page and not for society role */}
      {view === 'history' && user?.role !== 'society' && (
        <button 
          onClick={() => { setEditingCompetition(null); setView('new'); }}
          className="fixed bottom-8 right-8 w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-orange-600/40 hover:bg-orange-500 hover:scale-110 transition-all active:scale-95 z-50 floating-add-btn group"
        >
          <i className="fas fa-plus text-2xl group-hover:rotate-90 transition-transform duration-300"></i>
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
      />
    </div>
  );
};

export default App;
