import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Discipline, Competition, CompetitionLevel, Cartridge, CartridgeType, AppData } from '@/types';
import Dashboard from '@/components/Dashboard';
import CompetitionForm from '@/components/CompetitionForm';
import HistoryList from '@/components/HistoryList';
import Header from '@/components/Header';
import Auth from '@/components/Auth';
import ConfirmModal from '@/components/ConfirmModal';
import Toast from '@/components/Toast';
import InstallPrompt from '@/components/InstallPrompt';
import OnboardingTour from '@/components/OnboardingTour';
import BottomNavigation from '@/components/BottomNavigation';
import UpdateNotification from '@/components/UpdateNotification';
import ExpandingFAB from '@/components/ExpandingFAB';
import { ConnectionStatus, handleNetworkError } from '@/components/ConnectionStatus';

import Warehouse from '@/components/Warehouse';
import AdminPanel from '@/components/AdminPanel';
import EventsManager from '@/components/EventsManager';
import AICoachPage from '@/components/AICoachPage';
import LeTueGarePage from '@/components/LeTueGarePage';
import GarePage from '@/components/GarePage';
import LaMiaSocietaPage from '@/components/LaMiaSocietaPage';
import AdminPageView from '@/components/AdminPageView';
import SocietyDetailModal from '@/components/SocietyDetailModal';
import NotificationsPage from '@/components/NotificationsPage';
import NotificationsManager from '@/components/NotificationsManager';
import PublicPortal from '@/components/PublicPortal';
import HomePage from '@/components/HomePage';

import { useUI } from '@/contexts/UIContext';
import { useLanguage } from '@/contexts/LanguageContext';

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-20">
    <i className="fas fa-circle-notch fa-spin text-orange-500 text-2xl"></i>
  </div>
);

const App: React.FC = () => {
  const { 
    triggerConfirm, triggerToast, 
    confirmConfig, setConfirmConfig, 
    toastConfig, setToastConfig 
  } = useUI();
  const { t, language, setLanguage } = useLanguage();
  
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  useEffect(() => {
    // Automatically set language to English for international users on mount/refresh
    // We want to force it if they haven't explicitly chosen Italian recently
    if (user?.is_international) {
      const savedLang = localStorage.getItem('app_language');
      if (savedLang !== 'en' && savedLang !== 'it') {
        setLanguage('en');
      } else if (language === 'it' && !savedLang) {
        setLanguage('en');
      }
    }
  }, [user?.is_international, language, setLanguage]);
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [cartridges, setCartridges] = useState<Cartridge[]>([]);
  const [cartridgeTypes, setCartridgeTypes] = useState<CartridgeType[]>([]);
  const [societies, setSocieties] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  const getInitialView = () => {
    const path = window.location.pathname.toLowerCase().replace(/\/$/, "");
    const hash = window.location.hash.toLowerCase();
    
    // Check if we are on a portal-related path or search results
    if (path === '/portal' || path === '/public-portal' || path === '/risultati' || hash === '#portal' || hash === '#risultati' || path.endsWith('/portal')) {
      return 'public-portal';
    }
    
    // If not logged in, always default to the public portal as the landing page
    if (!token) {
      return 'public-portal';
    }
    
    return 'home';
  };

  const [view, setView] = useState<'home' | 'le-tue-gare' | 'warehouse' | 'gare' | 'la-mia-societa' | 'societies' | 'new' | 'settings' | 'profile' | 'notifications' | 'ai-coach' | 'dashboard' | 'history' | 'admin' | 'event-results' | 'admin-events' | 'admin-control' | 'public-portal'>(
    getInitialView()
  );
  const [historyStack, setHistoryStack] = useState<{view: string, tab?: string}[]>([{ view: token ? 'home' : 'public-portal' }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [previousView, setPreviousView] = useState<'home' | 'le-tue-gare' | 'gare' | 'la-mia-societa' | 'warehouse' | 'societies' | 'new' | 'settings' | 'profile' | 'notifications' | 'ai-coach' | 'dashboard' | 'history' | 'admin' | 'event-results' | 'admin-events' | 'admin-control' | 'public-portal' | null>(null);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [prefillCompetition, setPrefillCompetition] = useState<Partial<Competition> | null>(null);
  const [prefillTeamData, setPrefillTeamData] = useState<{ competition_name: string, discipline: string, society: string, date: string, location: string, targets?: number } | null>(null);
  const [initialEventId, setInitialEventId] = useState<string | null>(null);
  const [initialAdminTab, setInitialAdminTab] = useState<string | null>(user?.role === 'society' ? 'results' : null);
  const [initialViewMode, setInitialViewMode] = useState<string | null>(null);
  const [initialSocietyName, setInitialSocietyName] = useState<string | null>(null);
  const [globalSelectedSociety, setGlobalSelectedSociety] = useState<any | null>(null);
  const [initialEventViewMode, setInitialEventViewMode] = useState<'list' | 'calendar' | 'results' | 'managed' | null>(null);
  const [appSettings, setAppSettings] = useState<any>({});
  const [isSavingComp, setIsSavingComp] = useState(false);
  const [hideGlobalFAB, setHideGlobalFAB] = useState(false);
  const [gareActiveTab, setGareActiveTab] = useState<string>('eventi');
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);
  
  const fetchUserProfile = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    try {
      const res = await fetch('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (res.ok) {
        const userData = await res.json();
        // Only update if something changed to avoid unnecessary re-renders
        const currentUserStr = JSON.stringify(user);
        const newUserStr = JSON.stringify(userData);
        if (currentUserStr !== newUserStr) {
          setUser(userData);
          localStorage.setItem('auth_user', newUserStr);
        }
      }
    } catch (err) {
      // Ignore errors
    }
  }, [token, user]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setAppSettings(data);
      }
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        console.error('Error fetching settings:', err);
      }
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (user && !localStorage.getItem(`tour_completed_${user.id}`)) {
      setShowTour(true);
    }
  }, [user]);

  const handleCloseTour = () => {
    if (user) {
      localStorage.setItem(`tour_completed_${user.id}`, 'true');
    }
    setShowTour(false);
  };

  const [leTueGareTab, setLeTueGareTab] = useState('history');
  const [gareCreateEvent, setGareCreateEvent] = useState<number>(0);
  
  // Handle deep links from notifications and browser history
    const isFirstMount = React.useRef(true);
    useEffect(() => {
      // Initialize browser history state if it doesn't exist
      if (!window.history.state || window.history.state.index === undefined) {
        window.history.replaceState({ view, tab: null, index: 0 }, '', window.location.pathname + window.location.search);
      }
  
      const handleNavigation = (event?: PopStateEvent) => {
        // If triggered by popstate (browser back/forward), use the state object
        if (event && event.state && event.state.view) {
          let { view: newView, tab, index } = event.state;
          
          if (newView === 'le-tue-gare' && user?.role === 'society') {
            newView = 'gare';
          }
  
          if (newView === 'la-mia-societa' && tab) {
            setInitialAdminTab(tab);
          } else if (newView === 'la-mia-societa' && user?.role === 'society') {
            setInitialAdminTab('users');
          } else if (newView === 'admin-events') {
            setInitialAdminTab('event-results');
            setInitialEventViewMode('managed');
          } else if (newView === 'admin-control') {
            setInitialAdminTab('event-control');
          } else {
            setInitialAdminTab(null);
            setInitialEventViewMode(null);
          }
  
          if (newView === 'gare' && tab) {
            setInitialViewMode(tab);
          } else {
            setInitialViewMode(null);
          }
          
          if (newView !== 'societies' && newView !== 'la-mia-societa') {
            setInitialSocietyName(null);
          }
          
          setPreviousView(null);
          if (newView === 'le-tue-gare' && tab) {
            setLeTueGareTab(tab);
          }
  
          setView(newView);
          
          // Sync internal index for desktop buttons
          if (index !== undefined) {
            setHistoryIndex(index);
          }
          return;
        }
  
        // Fallback for deep links (initial load or external links)
        // CRITICAL: only run if we are not in a transient state like 'new' 
        // and only on first mount or if it's a real navigation event (which it's not here as event is undefined)
        if (view === 'new' || view === 'profile' || view === 'settings') return;

        const path = window.location.pathname;
        const searchParams = new URLSearchParams(window.location.search);
        
        if (path === '/le-tue-gare') {
          setView('le-tue-gare');
        } else if (path === '/home') {
          setView('home');
        } else if (path === '/portal' || path === '/public-portal') {
          setView('public-portal');
        } else if (path === '/admin/events') {
          setView('admin-events');
        } else if (path === '/admin/control') {
          setView('admin-control');
        } else if (path === '/gare') {
          setView('gare');
          const id = searchParams.get('id');
          if (id) {
            setInitialEventId(id);
          }
        } else if (path === '/la-mia-societa') {
          setView('la-mia-societa');
          const tab = searchParams.get('tab');
          if (tab) {
            setInitialAdminTab(tab);
          }
        } else if (path === '/profile') {
          setView('profile');
        } else if (path === '/settings') {
          setView('settings');
        } else if (path === '/notifications') {
          setView('notifications');
        } else if (path.toLowerCase().includes('/portal') || path.toLowerCase().includes('/risultati')) {
          setView('public-portal');
        }
      };
  
      if (isFirstMount.current) {
        handleNavigation();
        isFirstMount.current = false;
      }
      
      window.addEventListener('popstate', handleNavigation);
      return () => window.removeEventListener('popstate', handleNavigation);
    }, [user, view]);

  // Fetch data from API
  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    setError(null);
    try {
      // Refresh user profile asynchronously
      fetchUserProfile(signal);

      const [compsRes, cartsRes, socsRes, cartTypesRes, eventsRes] = await Promise.all([
        fetch('/api/competitions', { headers: { 'Authorization': `Bearer ${token}` }, signal }),
        fetch('/api/cartridges', { headers: { 'Authorization': `Bearer ${token}` }, signal }),
        fetch('/api/societies', { headers: { 'Authorization': `Bearer ${token}` }, signal }),
        fetch('/api/cartridge-types', { headers: { 'Authorization': `Bearer ${token}` }, signal }),
        fetch('/api/events', { headers: { 'Authorization': `Bearer ${token}` }, signal })
      ]);

      if (compsRes.status === 401 || compsRes.status === 403) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setUser(null);
        return;
      }

      const [comps, carts, socs, types, evts] = await Promise.all([
        compsRes.ok ? compsRes.json() : Promise.resolve([]),
        cartsRes.ok ? cartsRes.json() : Promise.resolve([]),
        socsRes.ok ? socsRes.json() : Promise.resolve([]),
        cartTypesRes.ok ? cartTypesRes.json() : Promise.resolve([]),
        eventsRes.ok ? eventsRes.json() : Promise.resolve([])
      ]);

      setCompetitions(comps);
      setCartridges(carts);
      setSocieties(socs);
      setCartridgeTypes(types);
      setEvents(evts);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      handleNetworkError(err, triggerToast);
      setError(t('connection_error'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    if (token) {
      fetchData(controller.signal);
      
      // Auto-refresh main data every 2 minutes for general sync
      const intervalId = setInterval(() => {
        fetchData();
      }, 120000);

      return () => {
        controller.abort();
        clearInterval(intervalId);
      };
    } else {
      setLoading(false);
    }
  }, [token, fetchData]);

  useEffect(() => {
    if (view === 'le-tue-gare' && user?.role === 'society') {
      setView('la-mia-societa');
      setInitialAdminTab('results');
    }
  }, [view, user]);

  const handleLogin = (newToken: string, newUser: any) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    
    // Automatically set language to English for international users
    if (newUser.is_international) {
      setLanguage('en');
    }

    if (newUser.role === 'society') {
      setView('home');
      window.history.pushState({ view: 'home' }, '', '/home');
    } else {
      setView('home');
      window.history.pushState({ view: 'home' }, '', '/home');
    }
  };

  const handleLogout = () => {
    triggerConfirm(
      t('logout'),
      t('confirm_logout'),
      () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setUser(null);
        setCompetitions([]);
        setCartridges([]);
      },
      t('logout'),
      'primary'
    );
  };

  useEffect(() => {
    const handleLogoutEvent = () => {
      handleLogout();
    };
    window.addEventListener('clay-tracker-logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('clay-tracker-logout', handleLogoutEvent);
    };
  }, [handleLogout]);

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
             CompetitionLevel.REGIONAL,
      cost: event.cost ? parseFloat(event.cost) : 0,
      notes: event.notes || ''
    };
    setEditingCompetition(null);
    setPrefillCompetition(newComp);
    setPreviousView(view);
    setView('new');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateTeamFromEvent = (event: any) => {
    setPrefillTeamData({
      competition_name: event.name,
      discipline: event.discipline,
      society: user?.role === 'society' ? user.society : event.location,
      location: event.location,
      date: event.start_date ? event.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
      targets: Number(event.targets) || 100
    });
    setView('la-mia-societa');
    setInitialAdminTab('team');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const saveCompetition = async (comp: Competition) => {
    if (isSavingComp) return;
    setIsSavingComp(true);
    
    // If we have an ID, it's an update, regardless of editingCompetition state
    const isEdit = (!!editingCompetition && !!editingCompetition.id) || (!!comp.id && comp.id !== '');
    const method = isEdit ? 'PUT' : 'POST';
    const compId = (isEdit && editingCompetition?.id) ? editingCompetition.id : (comp.id || generateUUID());
    const endpoint = isEdit ? `/api/competitions/${compId}` : '/api/competitions';
    
    // Ensure the competition object has the correct ID
    const compToSave = { ...comp, id: compId };

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(compToSave)
      });
      if (res.ok) {
        // If the admin created/edited a competition for another user, don't add it to their own list
        if (compToSave.userId && compToSave.userId !== user?.id && user?.role !== 'admin') {
          setCompetitions(prev => prev.filter(c => c.id !== compToSave.id));
        } else {
          setCompetitions(prev => !isEdit ? [compToSave, ...prev] : prev.map(c => c.id === compToSave.id ? compToSave : c));
        }
        
        // Show success toast
        triggerToast(isEdit ? t('comp_updated') : t('comp_saved'), 'success');
        
        // Only close the form and redirect if we were actually in the 'new' view or editing
        if (view === 'new' || editingCompetition) {
          setView(previousView || 'history');
          setPreviousView(null);
          setEditingCompetition(null);
          setPrefillCompetition(null);
        }
      } else {
        const errorData = await res.json();
        console.error('Save error:', errorData);
        // Using a more robust way to show error if alert is blocked
        const errorMsg = `${t('save_error')}: ${errorData.error || res.statusText}`;
        setConfirmConfig({
          isOpen: true,
          title: t('error'),
          message: errorMsg,
          onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false }))
        });
      }
    } catch (err) {
      console.error('Error saving competition:', err);
      setConfirmConfig({
        isOpen: true,
        title: t('network_error'),
        message: t('save_error_desc'),
        onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setIsSavingComp(false);
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
        return true;
      } else {
        const errorData = await res.json();
        alert(`${t('delete_error')}: ${errorData.error || res.statusText}`);
        return false;
      }
    } catch (err) {
      console.error('Error deleting competition:', err);
      alert(t('delete_network_error'));
      return false;
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
        alert(`${t('cartridge_save_error')}: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error saving cartridge:', err);
      alert(t('cartridge_save_network_error'));
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
        alert(`${t('delete_error')}: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error deleting cartridge:', err);
      alert(t('delete_network_error'));
    }
  };

  const saveCartridgeType = async (type: CartridgeType) => {
    try {
      const res = await fetch('/api/cartridge-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(type)
      });
      if (res.ok) {
        fetchData(); // Re-fetch to get the canonical list from server
      }
    } catch (err) {
      console.error('Error saving cartridge type:', err);
    }
  };

  const deleteCartridgeType = async (id: string) => {
    try {
      const res = await fetch(`/api/cartridge-types/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
        triggerToast(t('type_deleted'));
      } else {
        const data = await res.json();
        triggerToast(data.error || t('delete_error'), 'error');
      }
    } catch (err) {
      console.error('Error deleting cartridge type:', err);
      triggerToast(t('delete_network_error'), 'error');
    }
  };

  const updateAllCartridges = async (carts: Cartridge[]) => {
    const previousCarts = [...cartridges];
    setCartridges(carts); // Optimistic update
    
    try {
      const res = await fetch('/api/cartridges/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(carts)
      });
      if (!res.ok) {
        setCartridges(previousCarts); // Rollback on error
        const errorData = await res.json();
        alert(`${t('bulk_update_error')}: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      setCartridges(previousCarts); // Rollback on network error
      console.error('Error bulk updating cartridges:', err);
      alert(t('bulk_update_network_error'));
    }
  };

  const handleImport = async (data: any) => {
    triggerConfirm(
      t('import'),
      t('confirm_import'),
      async () => {
        // Normalizzazione dati se il formato è diverso
        const normalizedData: AppData = {
          competitions: Array.isArray(data.competitions) ? data.competitions : (Array.isArray(data) ? data : []),
          cartridges: Array.isArray(data.cartridges) ? data.cartridges : [],
          cartridgeTypes: Array.isArray(data.cartridgeTypes) ? data.cartridgeTypes : []
        };

        try {
          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(normalizedData)
          });
          if (res.ok) {
            alert(t('import_success'));
            fetchData(); // Ricarica tutto dal server
          } else {
            const errorData = await res.json();
            alert(`${t('import_error')}: ${errorData.error || res.statusText}`);
          }
        } catch (err) {
          console.error('Error importing data:', err);
          alert(t('bulk_update_network_error'));
        }
      },
      t('import'),
      'danger'
    );
  };

  const handleNavigate = (newView: any, tab?: string, eventId?: string) => {
    // Restrict history for society
    if (newView === 'le-tue-gare' && user?.role === 'society') {
      newView = 'gare';
    }

    if (newView === 'profile' && user?.role === 'society') {
      newView = 'la-mia-societa';
      tab = 'profile';
    }

    if (newView === 'la-mia-societa' && tab) {
      setInitialAdminTab(tab);
    } else if (newView === 'la-mia-societa' && user?.role === 'society') {
      setInitialAdminTab('results');
    } else if (newView === 'admin-events') {
      setInitialAdminTab('event-results');
      setInitialEventViewMode('managed');
    } else if (newView === 'admin-control') {
      setInitialAdminTab('event-control');
    } else {
      setInitialAdminTab(null);
      setInitialEventViewMode(null);
    }

    if (newView === 'gare' && tab) {
      setInitialViewMode(tab);
    } else {
      setInitialViewMode(null);
    }

    if (newView === 'gare') {
      setGareCreateEvent(0);
    }
    
    if (eventId) {
      setInitialEventId(eventId);
    } else if (newView !== 'gare' && newView !== 'admin-events') {
      setInitialEventId(null);
    }
    
    if (newView !== 'societies' && newView !== 'admin') {
      setInitialSocietyName(null);
    }
    
    setPreviousView(null);
    setView(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (newView === 'le-tue-gare' && tab) {
      setLeTueGareTab(tab);
    }

    const newIndex = historyIndex + 1;
    
    // Update browser history
    let newUrl = '/';
    if (newView === 'home') newUrl = '/home';
    if (newView === 'le-tue-gare') newUrl = '/le-tue-gare';
    if (newView === 'admin-events') newUrl = '/admin/events';
    if (newView === 'admin-control') newUrl = '/admin/control';
    if (newView === 'gare') newUrl = tab ? `/gare?tab=${tab}` : '/gare';
    if (newView === 'la-mia-societa') newUrl = tab ? `/la-mia-societa?tab=${tab}` : '/la-mia-societa';
    if (newView === 'public-portal') newUrl = '/portal';
    if (newView === 'profile') newUrl = '/profile';
    if (newView === 'settings') newUrl = '/settings';
    if (newView === 'notifications') newUrl = '/notifications';
    
    window.history.pushState({ view: newView, tab, index: newIndex }, '', newUrl);

    setHistoryStack(prev => {
      const newStack = prev.slice(0, newIndex);
      newStack.push({ view: newView, tab });
      return newStack;
    });
    setHistoryIndex(newIndex);
  };

  const handleGoBack = () => {
    if (historyIndex > 0) {
      window.history.back();
    }
  };

  const handleGoForward = () => {
    if (historyIndex < historyStack.length - 1) {
      window.history.forward();
    }
  };

  const handleSocietyClick = (name: string) => {
    const soc = societies.find(s => s.name === name);
    if (soc) {
      setGlobalSelectedSociety(soc);
    } else {
      // Fallback to old behavior if society not found in list (shouldn't happen)
      setInitialSocietyName(name);
      setPreviousView(view);
      setView('societies');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCloseSocietyDetail = () => {
    if (previousView) {
      setView(previousView);
      setPreviousView(null);
    } else {
      setView('le-tue-gare');
    }
    setInitialSocietyName(null);
  };

  // Allow seeing the public portal without a token
  // Only show the full login screen if we're not on the public portal and the user isn't logged in
  if (!token && view !== 'public-portal') {
    return <Auth onLogin={handleLogin} onGoToPortal={() => setView('public-portal')} />;
  }

  if (loading && view !== 'public-portal') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        {error ? (
          <>
            <div className="text-red-500 text-sm font-bold">{error}</div>
            <button 
              onClick={() => { setLoading(true); fetchData(); }}
              className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-orange-600/20"
            >
              {t('retry')}
            </button>
          </>
        ) : (
          <i className="fas fa-spinner fa-spin text-4xl text-orange-600"></i>
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50 flex flex-col ${view === 'ai-coach' || view === 'home' ? 'pb-0' : 'pb-24 sm:pb-8'}`}>
      <ConnectionStatus />
      {view !== 'home' && (
        <Header 
          currentView={view} 
          onNavigate={handleNavigate} 
          onLogout={handleLogout}
          user={user}
          appSettings={appSettings}
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < historyStack.length - 1}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onLoginClick={() => setShowLoginModal(true)}
          onRefreshUser={fetchUserProfile}
        />
      )}

      {user && !user.email_verified && view !== 'public-portal' && view !== 'home' && (
        <div className="fixed top-16 left-0 right-0 z-50 px-4 py-2 bg-orange-600 shadow-xl border-b border-orange-500/30 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-500">
          <i className="fas fa-exclamation-circle text-white text-sm animate-pulse"></i>
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">
            {t('email_not_verified_label')}
          </span>
          <button 
            onClick={() => {
              if (user.role === 'society') {
                handleNavigate('la-mia-societa', 'profile');
              } else {
                handleNavigate('profile');
              }
              window.dispatchEvent(new CustomEvent('clay-tracker-open-profile'));
            }}
            className="px-3 py-1 bg-white text-orange-600 rounded-lg text-[10px] font-black uppercase shadow-lg shadow-black/10 hover:bg-orange-50 transition-colors"
          >
            {t('verify_label')}
          </button>
        </div>
      )}

      {showLoginModal && (
        <Auth 
          isModal 
          onClose={() => setShowLoginModal(false)} 
          onLogin={(token, user) => {
            handleLogin(token, user);
            setShowLoginModal(false);
          }} 
          onGoToPortal={() => {
            setView('public-portal');
            setShowLoginModal(false);
          }}
        />
      )}
           <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${view === 'home' ? 'pt-0 pb-0' : 'pt-16 pb-24 sm:pb-8'} flex-1 w-full`}>
        <Suspense fallback={<LoadingFallback />}>
          {view === 'home' && (
            <HomePage 
              user={user} 
              onNavigate={handleNavigate} 
            />
          )}
          {view === 'le-tue-gare' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <LeTueGarePage 
                user={user}
                token={token || ''}
                competitions={competitions}
                events={events}
                societies={societies}
                cartridges={cartridges}
                onDeleteCompetition={deleteCompetition}
                onEditCompetition={(comp) => {
                  setPreviousView('le-tue-gare');
                  setEditingCompetition(comp);
                  setView('new');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onUpdateCompetition={saveCompetition}
                onSocietyClick={handleSocietyClick}
                onNavigate={handleNavigate}
                onTabChange={setLeTueGareTab}
              />
            </div>
          )}
          
          {view === 'new' && (
            <CompetitionForm 
              currentUser={user}
              onSubmit={saveCompetition} 
              isSaving={isSavingComp}
              onCancel={() => {
                setView(previousView || 'le-tue-gare');
                setPreviousView(null);
                setEditingCompetition(null);
                setPrefillCompetition(null);
              }}
              initialData={editingCompetition || undefined}
              prefillData={prefillCompetition || undefined}
              availableCartridges={cartridges}
              cartridgeTypes={cartridgeTypes}
              onNavigateToWarehouse={() => setView('warehouse')}
              societies={societies}
              knownLocations={Array.from(new Set(competitions.map(c => c.location).filter(Boolean)))}
            />
          )}
          
          {view === 'warehouse' && user?.role !== 'society' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Warehouse 
                user={user}
                cartridges={cartridges}
                cartridgeTypes={cartridgeTypes}
                onSave={saveCartridge}
                onDelete={deleteCartridge}
                onUpdateAll={updateAllCartridges}
                onSaveType={saveCartridgeType}
                onDeleteType={deleteCartridgeType}
              />
            </div>
          )}

          {view === 'gare' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <GarePage 
                user={user}
                token={token || ''}
                societies={societies}
                events={events}
                onParticipate={handleParticipateInEvent}
                onCreateTeam={handleCreateTeamFromEvent}
                initialEventId={initialEventId}
                onInitialEventHandled={() => setInitialEventId(null)}
                initialViewMode={initialViewMode}
                onInitialViewModeHandled={() => setInitialViewMode(null)}
                appSettings={appSettings}
                onCreateEventTrigger={gareCreateEvent}
                onToggleFAB={setHideGlobalFAB}
                onTabChange={setGareActiveTab}
                onSocietyClick={handleSocietyClick}
              />
            </div>
          )}

          {view === 'la-mia-societa' && (user?.role === 'admin' || user?.role === 'society') && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <LaMiaSocietaPage 
                user={user}
                token={token || ''}
                competitions={competitions}
                cartridges={cartridges}
                cartridgeTypes={cartridgeTypes}
                societies={societies}
                onEditCompetition={(comp) => {
                  setPreviousView('la-mia-societa');
                  setEditingCompetition(comp || null);
                  setView('new');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDeleteCompetition={deleteCompetition}
                handleImport={handleImport}
                handleCloseSocietyDetail={handleCloseSocietyDetail}
                handleUserUpdate={handleUserUpdate}
                setShowTour={() => setShowTour(true)}
                appSettings={appSettings}
                fetchSettings={fetchSettings}
                initialTab={initialAdminTab as any}
                onToggleFAB={setHideGlobalFAB}
              />
            </div>
          )}

          {view === 'societies' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AdminPanel 
                user={user} 
                token={token || ''} 
                initialTab="societies" 
                initialSocietyName={initialSocietyName}
                onCloseSocietyDetail={handleCloseSocietyDetail}
                competitions={competitions}
                cartridges={cartridges}
                cartridgeTypes={cartridgeTypes}
                societies={societies}
                clientId=""
                onClientIdChange={() => {}}
                onImport={handleImport}
                syncStatus="idle"
                lastSync={null}
                isDriveConnected={false}
                onConnectDrive={() => {}}
                onDisconnectDrive={() => {}}
                onSaveDrive={() => {}}
                onLoadDrive={() => {}}
                hideTabs={true}
              />
            </div>
          )}

          {view === 'admin' && user?.role === 'admin' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AdminPanel 
                user={user} 
                token={token || ''} 
                initialTab={(initialAdminTab as any) || 'users'} 
                initialSocietyName={initialSocietyName}
                competitions={competitions}
                cartridges={cartridges}
                cartridgeTypes={cartridgeTypes}
                societies={societies}
                clientId=""
                onClientIdChange={() => {}}
                onImport={handleImport}
                syncStatus="idle"
                lastSync={null}
                isDriveConnected={false}
                onConnectDrive={() => {}}
                onDisconnectDrive={() => {}}
                onSaveDrive={() => {}}
                onLoadDrive={() => {}}
              />
            </div>
          )}

          {view === 'admin-events' && (user?.role === 'admin' || user?.role === 'society') && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AdminPageView 
                user={user} 
                token={token || ''} 
                competitions={competitions}
                cartridges={cartridges}
                cartridgeTypes={cartridgeTypes}
                societies={societies}
                onEditCompetition={(comp) => {
                  setPreviousView('admin-events');
                  setEditingCompetition(comp || null);
                  setView('new');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDeleteCompetition={deleteCompetition}
                handleImport={handleImport}
                handleCloseSocietyDetail={handleCloseSocietyDetail}
                handleUserUpdate={handleUserUpdate}
                setShowTour={() => setShowTour(true)}
                appSettings={appSettings}
                fetchSettings={fetchSettings}
                title={user?.role === 'society' ? t('managed_view_title') : t('managed_view')}
                icon="fa-calendar-alt"
                initialTab="event-results"
                initialEventViewMode="managed"
                kpi1={{ label: t('competitions_label'), value: competitions.length, color: 'border-l-orange-600' }}
                onToggleFAB={setHideGlobalFAB}
              />
            </div>
          )}

          {view === 'admin-control' && user?.role === 'admin' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AdminPageView 
                user={user} 
                token={token || ''} 
                competitions={competitions}
                cartridges={cartridges}
                cartridgeTypes={cartridgeTypes}
                societies={societies}
                onEditCompetition={(comp) => {
                  setPreviousView('admin-control');
                  setEditingCompetition(comp || null);
                  setView('new');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDeleteCompetition={deleteCompetition}
                handleImport={handleImport}
                handleCloseSocietyDetail={handleCloseSocietyDetail}
                handleUserUpdate={handleUserUpdate}
                setShowTour={() => setShowTour(true)}
                appSettings={appSettings}
                fetchSettings={fetchSettings}
                title={t('race_activation')}
                icon="fa-tasks"
                initialTab="event-control"
                kpi1={{ label: t('competitions_label'), value: competitions.length, color: 'border-l-orange-600' }}
              />
            </div>
          )}

          {view === 'ai-coach' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
              <AICoachPage 
                user={user} 
                competitions={competitions} 
                cartridges={cartridges}
              />
            </div>
          )}

          {view === 'public-portal' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
              <PublicPortal token={token || undefined} />
            </div>
          )}

          {view === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Dashboard 
                competitions={competitions} 
                societies={societies}
                events={events}
                onAddClick={() => setView('new')}
                onCoachClick={() => setView('ai-coach')}
                onNavigate={handleNavigate}
                user={user}
              />
            </div>
          )}

          {view === 'history' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <HistoryList 
                competitions={competitions} 
                societies={societies}
                onDelete={deleteCompetition}
                onEdit={(comp) => {
                  setPreviousView('history');
                  setEditingCompetition(comp);
                  setView('new');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          )}

          {view === 'profile' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AdminPageView 
                user={user}
                token={token || ''}
                competitions={competitions}
                cartridges={cartridges}
                cartridgeTypes={cartridgeTypes}
                societies={societies}
                onEditCompetition={(comp) => {
                  setPreviousView('profile');
                  setEditingCompetition(comp || null);
                  setView('new');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDeleteCompetition={deleteCompetition}
                handleImport={handleImport}
                handleCloseSocietyDetail={handleCloseSocietyDetail}
                handleUserUpdate={handleUserUpdate}
                setShowTour={() => setShowTour(true)}
                appSettings={appSettings}
                fetchSettings={fetchSettings}
                title={t('your_profile')}
                icon="fa-user-circle"
                initialTab="profile"
              />
            </div>
          )}

          {view === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AdminPageView 
                user={user}
                token={token || ''}
                competitions={competitions}
                cartridges={cartridges}
                cartridgeTypes={cartridgeTypes}
                societies={societies}
                onEditCompetition={(comp) => {
                  setPreviousView('settings');
                  setEditingCompetition(comp || null);
                  setView('new');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDeleteCompetition={deleteCompetition}
                handleImport={handleImport}
                handleCloseSocietyDetail={handleCloseSocietyDetail}
                handleUserUpdate={handleUserUpdate}
                setShowTour={() => setShowTour(true)}
                appSettings={appSettings}
                fetchSettings={fetchSettings}
                title={t('settings')}
                icon="fa-cog"
                initialTab="settings"
              />
            </div>
          )}

          {view === 'notifications' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <NotificationsPage 
                token={token || ''} 
                userRole={user?.role} 
              />
            </div>
          )}
        </Suspense>
      </main>

      {/* Floating Add Button - Only on Dashboard/History/New Page and not for society role */}
      <ExpandingFAB 
        show={!hideGlobalFAB && (
          view === 'dashboard' || 
          (view === 'le-tue-gare' && leTueGareTab === 'history') || 
          view === 'new' || 
          (view === 'gare' && gareActiveTab === 'eventi' && user?.role === 'admin') ||
          (view === 'gare' && gareActiveTab === 'le-tue-gare' && user?.role === 'society')
        )}
        label={view === 'new' ? t('close_label') : (view === 'gare' && (gareActiveTab === 'gestione' || gareActiveTab === 'eventi' || gareActiveTab === 'le-tue-gare') ? t('new_event') : t('new_competition'))}
        isClose={view === 'new'}
        onClick={() => { 
          if (view === 'new') {
            setView(previousView || 'history');
            setPreviousView(null);
            setEditingCompetition(null);
            setPrefillCompetition(null);
          } else if (view === 'gare') {
            if (gareActiveTab === 'gestione' || (gareActiveTab === 'eventi' && user?.role === 'admin') || (gareActiveTab === 'le-tue-gare' && user?.role === 'society')) {
              setGareCreateEvent(prev => prev + 1);
            } else {
              setPreviousView(view);
              setEditingCompetition(null); 
              setView('new'); 
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          } else {
            setPreviousView(view);
            setEditingCompetition(null); 
            setView('new'); 
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />

      {/* Footer */}
      {view !== 'ai-coach' && (
        <footer className="w-full py-6 mt-auto border-t border-slate-800/50 bg-slate-950/30">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-[10px] font-black text-slate-500 tracking-widest">
              {t('copyright_notice').replace('{year}', new Date().getFullYear().toString())}
            </p>
          </div>
        </footer>
      )}

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
      />

      <Toast 
        isOpen={toastConfig.isOpen}
        message={toastConfig.message}
        type={toastConfig.type}
        onClose={() => setToastConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <InstallPrompt />
      {showTour && user && (
        <OnboardingTour role={user.role} onClose={handleCloseTour} />
      )}
      
      {/* Bottom Navigation for Mobile */}
      {user && view !== 'home' && view !== 'public-portal' && (
        <BottomNavigation 
          currentView={view} 
          onNavigate={handleNavigate} 
          user={user}
          appSettings={appSettings}
        />
      )}
      
      {globalSelectedSociety && (
        <SocietyDetailModal 
          society={globalSelectedSociety}
          onClose={() => setGlobalSelectedSociety(null)}
          currentUser={user}
        />
      )}
      
      <UpdateNotification />
    </div>
  );
};

export default App;
