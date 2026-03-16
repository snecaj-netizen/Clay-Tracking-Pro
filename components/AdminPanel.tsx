import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Settings from './Settings';
import EventsManager from './EventsManager';
import HallOfFame from './HallOfFame';
import AdminNotifications from './AdminNotifications';
import { Competition, Cartridge, AppData, Discipline } from '../types';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Red icon for user's society
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Orange icon for other societies
const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map Resizer component to fix Leaflet "half-loaded" issue
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

type Tab = 'users' | 'settings' | 'profile' | 'team' | 'results' | 'societies' | 'events' | 'halloffame' | 'notifications';

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
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
  onEditCompetition?: (comp?: Competition) => void;
  onDeleteCompetition?: (id: string) => void;
  initialTab?: Tab;
  onUserUpdate?: (user: any) => void;
  prefillTeam?: {
    competition_name: string;
    discipline: string;
    society: string;
    date: string;
    location: string;
  };
  onPrefillTeamUsed?: () => void;
  hideTabs?: boolean;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  user: currentUser, token, competitions, cartridges, clientId, onClientIdChange, onImport,
  syncStatus, lastSync, isDriveConnected, onConnectDrive, onDisconnectDrive, onSaveDrive, onLoadDrive,
  triggerConfirm, onEditCompetition, onDeleteCompetition, initialTab, onUserUpdate, prefillTeam, onPrefillTeamUsed, hideTabs
}) => {
  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab || (currentUser?.role === 'admin' || currentUser?.role === 'society' ? 'results' : 'profile')
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (prefillTeam) {
      setActiveTab('team');
      setShowTeamForm(true);
      setNewTeamCompetitionName(prefillTeam.competition_name || '');
      setNewTeamDiscipline(prefillTeam.discipline || '');
      setNewTeamSociety(prefillTeam.society || '');
      setNewTeamLocation(prefillTeam.location || '');
      setNewTeamDate(prefillTeam.date || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (onPrefillTeamUsed) onPrefillTeamUsed();
    }
  }, [prefillTeam, onPrefillTeamUsed]);

  const [showUserForm, setShowUserForm] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userSortConfig, setUserSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [societies, setSocieties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  
  // Society Form State
  const [showSocietyForm, setShowSocietyForm] = useState(false);
  const [societyViewMode, setSocietyViewMode] = useState<'list' | 'map'>('list');
  const [editingSociety, setEditingSociety] = useState<any>(null);
  const [socName, setSocName] = useState('');
  const [socEmail, setSocEmail] = useState('');
  const [socAddress, setSocAddress] = useState('');
  const [socCity, setSocCity] = useState('');
  const [socRegion, setSocRegion] = useState('');
  const [socZip, setSocZip] = useState('');
  const [socPhone, setSocPhone] = useState('');
  const [socMobile, setSocMobile] = useState('');
  const [socWebsite, setSocWebsite] = useState('');
  const [socContactName, setSocContactName] = useState('');
  const [socLogo, setSocLogo] = useState('');
  const [socOpeningHours, setSocOpeningHours] = useState('');
  const [socGoogleMapsLink, setSocGoogleMapsLink] = useState('');
  const [socDisciplines, setSocDisciplines] = useState<string[]>([]);
  const [societySearch, setSocietySearch] = useState('');
  const [selectedSociety, setSelectedSociety] = useState<any>(null);
  
  // Team Creation State
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSize, setNewTeamSize] = useState<3 | 6>(3);
  const [newTeamCompetitionName, setNewTeamCompetitionName] = useState('');
  const [newTeamDiscipline, setNewTeamDiscipline] = useState('');
  const [newTeamSociety, setNewTeamSociety] = useState(currentUser?.role === 'society' ? currentUser?.society || '' : '');
  const [newTeamLocation, setNewTeamLocation] = useState('');
  const [newTeamDate, setNewTeamDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedShooterIds, setSelectedShooterIds] = useState<number[]>([]);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editingScore, setEditingScore] = useState<{teamId: number, userId: number, score: number} | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Results Filtering State
  const [showFilters, setShowFilters] = useState(false);
  const [filterShooter, setFilterShooter] = useState('');
  const [filterSociety, setFilterSociety] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [resultsPage, setResultsPage] = useState(1);
  const [selectedShooterResults, setSelectedShooterResults] = useState<any | null>(null);
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
      // Filter by society if one is selected
      if (newTeamSociety && s.society !== newTeamSociety) return;
      
      if (!unique.has(s.user_id)) {
        unique.set(s.user_id, { id: s.user_id, name: s.name, surname: s.surname, society: s.society });
      }
    });
    return Array.from(unique.values()) as { id: number, name: string, surname: string, society: string }[];
  }, [teamStats, newTeamSociety]);

  // Form state for Admin User Management
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('user');
  const [category, setCategory] = useState('');
  const [qualification, setQualification] = useState('');
  const [society, setSociety] = useState('');
  const [fitavCard, setFitavCard] = useState('');
  const [userAvatar, setUserAvatar] = useState('');

  // Profile state for current user
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileSurname, setProfileSurname] = useState(currentUser?.surname || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [profileCategory, setProfileCategory] = useState(currentUser?.category || '');
  const [profileQualification, setProfileQualification] = useState(currentUser?.qualification || '');
  const [profileSociety, setProfileSociety] = useState(currentUser?.society || '');
  const [profileFitavCard, setProfileFitavCard] = useState(currentUser?.fitav_card || '');
  const [profileAvatar, setProfileAvatar] = useState(currentUser?.avatar || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [statsFilterDiscipline, setStatsFilterDiscipline] = useState<string>('');

  const filteredTeamStats = useMemo(() => {
    if (!statsFilterDiscipline) return teamStats;
    return teamStats.filter(s => s.discipline === statsFilterDiscipline);
  }, [teamStats, statsFilterDiscipline]);

  const statsDisciplines = useMemo(() => {
    return Array.from(new Set(teamStats.map(s => s.discipline))).sort();
  }, [teamStats]);

  const dashboardStats = useMemo(() => {
    const onlineUsers = users.filter(u => u.is_logged_in);
    const onlineSocieties = new Set(onlineUsers.filter(u => u.society).map(u => u.society));
    
    const topUser = [...users]
      .filter(u => u.role === 'user' && (u.login_count || 0) > 0)
      .sort((a, b) => (b.login_count || 0) - (a.login_count || 0))[0];
      
    const socCounts: {[key: string]: number} = {};
    users.forEach(u => {
      if (u.society) {
        socCounts[u.society] = (socCounts[u.society] || 0) + (u.login_count || 0);
      }
    });
    
    const topSocEntry = Object.entries(socCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      onlineUsersCount: onlineUsers.length,
      onlineSocietiesCount: onlineSocieties.size,
      topUserName: topUser ? `${topUser.name} ${topUser.surname}` : '-',
      topUserLogins: topUser ? topUser.login_count : 0,
      topSocName: topSocEntry ? topSocEntry[0] : '-',
      topSocLogins: topSocEntry ? topSocEntry[1] : 0
    };
  }, [users]);

  const fetchSocieties = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/societies', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (!res.ok) throw new Error('Failed to fetch societies');
      const data = await res.json();
      setSocieties(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    }
  }, [token]);

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    }
  }, [currentUser?.role, token]);

  const fetchTeamStats = useCallback(async (signal?: AbortSignal) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    try {
      const res = await fetch('/api/admin/team-stats', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (!res.ok) throw new Error('Failed to fetch team stats');
      const data = await res.json();
      setTeamStats(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    }
  }, [currentUser?.role, token]);

  const fetchAllResults = useCallback(async (signal?: AbortSignal) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    try {
      const res = await fetch('/api/admin/all-results', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (!res.ok) throw new Error('Failed to fetch all results');
      const data = await res.json();
      setAllResults(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    }
  }, [currentUser?.role, token]);

  const fetchTeams = useCallback(async (signal?: AbortSignal) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    try {
      const res = await fetch('/api/teams', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (!res.ok) throw new Error('Failed to fetch teams');
      const data = await res.json();
      setTeams(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    }
  }, [currentUser?.role, token]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    const promises = [fetchSocieties(controller.signal)];
    if (currentUser?.role === 'admin' || currentUser?.role === 'society') {
      promises.push(
        fetchTeamStats(controller.signal), 
        fetchAllResults(controller.signal), 
        fetchTeams(controller.signal), 
        fetchUsers(controller.signal)
      );
    }
    Promise.all(promises).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [token, currentUser?.role, currentUser?.society, fetchSocieties, fetchTeamStats, fetchAllResults, fetchTeams, fetchUsers]);

  useEffect(() => {
    if (activeTab === 'users' && (currentUser?.role === 'admin' || currentUser?.role === 'society')) {
      const controller = new AbortController();
      const interval = setInterval(() => fetchUsers(controller.signal), 30000); // Refresh every 30 seconds
      return () => {
        clearInterval(interval);
        controller.abort();
      };
    }
  }, [activeTab, currentUser?.role, fetchUsers]);

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
          avatar: profileAvatar,
          password: profilePassword || undefined
        }),
      });

      if (!res.ok) throw new Error('Errore durante l\'aggiornamento del profilo');
      
      if (onUserUpdate) {
        onUserUpdate({
          ...currentUser,
          name: profileName,
          surname: profileSurname,
          email: profileEmail,
          category: profileCategory,
          qualification: profileQualification,
          society: profileSociety,
          fitav_card: profileFitavCard,
          avatar: profileAvatar
        });
      }
      
      setProfileSuccess('Profilo aggiornato con successo!');
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
          society: newTeamSociety,
          location: newTeamLocation,
          date: newTeamDate,
          memberIds: selectedShooterIds
        }),
      });

      if (!res.ok) throw new Error(`Errore durante ${editingTeam ? 'la modifica' : 'la creazione'} della squadra`);
      
      setNewTeamName('');
      setNewTeamCompetitionName('');
      setNewTeamDiscipline('');
      setNewTeamLocation('');
      setNewTeamDate(new Date().toISOString().split('T')[0]);
      if (currentUser?.role === 'society' && currentUser?.society) {
        setNewTeamSociety(currentUser.society);
      } else {
        setNewTeamSociety('');
      }
      setSelectedShooterIds([]);
      setShowTeamForm(false);
      setEditingTeam(null);
      fetchTeams();
      fetchTeamStats();
      fetchAllResults();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateScore = async (teamId: number, userId: number, score: number) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${userId}/score`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ score })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Errore durante l\'aggiornamento del punteggio');
      }
      
      fetchTeams();
      fetchTeamStats();
      fetchAllResults();
      setEditingScore(null);
      setProfileSuccess('Punteggio aggiornato con successo!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditTeam = (team: any) => {
    setEditingTeam(team);
    setNewTeamName(team.name || '');
    setNewTeamSize(team.size as 3 | 6 || 3);
    setNewTeamCompetitionName(team.competition_name || '');
    setNewTeamDiscipline(team.discipline || '');
    setNewTeamSociety(team.society || '');
    setNewTeamLocation(team.location || '');
    setNewTeamDate(team.date || new Date().toISOString().split('T')[0]);
    setSelectedShooterIds(team.members ? team.members.map((m: any) => m.id) : []);
    setShowTeamForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          if (res.ok) {
            fetchTeams();
            fetchTeamStats();
            fetchAllResults();
          }
          else throw new Error('Errore durante l\'eliminazione');
        } catch (err: any) {
          setError(err.message);
        }
      },
      'Elimina',
      'danger'
    );
  };

  const handleSendCompetitionToShooters = async (teamId: number) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/send-competition`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) throw new Error('Errore durante l\'invio della gara ai tiratori');
      
      const data = await res.json();
      setProfileSuccess(data.message || 'Gara inviata con successo ai tiratori!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveAndSendCompetition = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedShooterIds.length !== newTeamSize) {
      setError(`Devi selezionare esattamente ${newTeamSize} tiratori.`);
      return;
    }

    triggerConfirm(
      'Invia Gara ai Tiratori',
      'Questa operazione salverà la squadra e invierà automaticamente la gara a tutti i tiratori selezionati. Continuare?',
      async () => {
        try {
          // 1. Save the team first
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
              society: newTeamSociety,
              location: newTeamLocation,
              date: newTeamDate,
              memberIds: selectedShooterIds
            }),
          });

          if (!res.ok) throw new Error(`Errore durante il salvataggio della squadra`);
          const data = await res.json();
          const teamId = editingTeam ? editingTeam.id : data.id;

          // 2. Send the competition
          await handleSendCompetitionToShooters(teamId);
          
          // 3. Reset form
          setNewTeamName('');
          setNewTeamCompetitionName('');
          setNewTeamDiscipline('');
          setNewTeamLocation('');
          setNewTeamDate(new Date().toISOString().split('T')[0]);
          if (currentUser?.role === 'society' && currentUser?.society) {
            setNewTeamSociety(currentUser.society);
          } else {
            setNewTeamSociety('');
          }
          setSelectedShooterIds([]);
          setShowTeamForm(false);
          setEditingTeam(null);
          fetchTeams();
        } catch (err: any) {
          setError(err.message);
        }
      },
      'Invia',
      'primary'
    );
  };

  const handleSocietySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const endpoint = editingSociety ? `/api/admin/societies/${editingSociety.id}` : '/api/admin/societies';
    const method = editingSociety ? 'PUT' : 'POST';
    
    let lat = null;
    let lng = null;
    
    // Try to extract lat/lng from Google Maps link if provided
    if (socGoogleMapsLink) {
      const match = socGoogleMapsLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
      } else {
        const qMatch = socGoogleMapsLink.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (qMatch) {
          lat = parseFloat(qMatch[1]);
          lng = parseFloat(qMatch[2]);
        }
      }
    }
    
    // Geocode address if available and we don't have lat/lng yet
    if (!lat && !lng && socAddress && socCity) {
      try {
        const query = encodeURIComponent(`${socAddress}, ${socCity}, ${socRegion || ''}, Italy`);
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            lat = parseFloat(geoData[0].lat);
            lng = parseFloat(geoData[0].lon);
          }
        }
      } catch (e) {
        console.error("Geocoding failed", e);
      }
    }

    const body = { 
      name: socName, 
      email: socEmail, 
      address: socAddress, 
      city: socCity, 
      region: socRegion, 
      zip_code: socZip, 
      phone: socPhone, 
      mobile: socMobile, 
      website: socWebsite,
      contact_name: socContactName,
      logo: socLogo,
      opening_hours: socOpeningHours,
      google_maps_link: socGoogleMapsLink,
      disciplines: socDisciplines.join(','),
      lat: lat || (editingSociety ? editingSociety.lat : null),
      lng: lng || (editingSociety ? editingSociety.lng : null)
    };

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Errore durante il salvataggio della società');
      
      setEditingSociety(null);
      setSocName(''); setSocEmail(''); setSocAddress(''); setSocCity(''); setSocRegion(''); setSocZip(''); setSocPhone(''); setSocMobile(''); setSocWebsite(''); setSocOpeningHours(''); setSocGoogleMapsLink(''); setSocDisciplines([]); setSocContactName(''); setSocLogo('');
      setShowSocietyForm(false);
      fetchSocieties();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditSociety = (soc: any) => {
    setEditingSociety(soc);
    setSocName(soc.name || '');
    setSocEmail(soc.email || '');
    setSocAddress(soc.address || '');
    setSocCity(soc.city || '');
    setSocRegion(soc.region || '');
    setSocZip(soc.zip_code || '');
    setSocPhone(soc.phone || '');
    setSocMobile(soc.mobile || '');
    setSocWebsite(soc.website || '');
    setSocContactName(soc.contact_name || '');
    setSocLogo(soc.logo || '');
    setSocOpeningHours(soc.opening_hours || '');
    setSocGoogleMapsLink(soc.google_maps_link || '');
    setSocDisciplines(soc.disciplines ? soc.disciplines.split(',') : []);
    setShowSocietyForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSociety = (id: number) => {
    triggerConfirm(
      'Elimina Società',
      'Sei sicuro di voler eliminare questa società? L\'azione è irreversibile.',
      async () => {
        try {
          const res = await fetch(`/api/admin/societies/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Errore durante l\'eliminazione');
          fetchSocieties();
        } catch (err: any) {
          setError(err.message);
        }
      },
      'Elimina',
      'danger'
    );
  };

  const handleUserAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError('L\'immagine non può superare i 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const endpoint = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
    const method = editingUser ? 'PUT' : 'POST';
    const body = { name, surname, email, role, category, qualification, society, fitav_card: fitavCard, password: password || undefined, avatar: userAvatar || undefined };

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
      setShowUserForm(false);
      setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); setSociety(''); setFitavCard(''); setUserAvatar('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = (id: number) => {
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
      },
      'Elimina',
      'danger'
    );
  };

  const handleToggleStatus = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    const actionText = newStatus === 'suspended' ? 'Sospendi' : 'Riattiva';
    const confirmTitle = newStatus === 'suspended' ? 'Sospendi Utente' : 'Riattiva Utente';
    const confirmMessage = newStatus === 'suspended' 
      ? 'Sei sicuro di voler sospendere l\'accesso a questo utente? Riceverà una notifica al prossimo login.' 
      : 'Sei sicuro di voler riattivare l\'accesso a questo utente?';

    triggerConfirm(
      confirmTitle,
      confirmMessage,
      async () => {
        try {
          const res = await fetch(`/api/admin/users/${id}/status`, {
            method: 'PATCH',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) throw new Error('Errore durante il cambio di stato');
          fetchUsers();
        } catch (err: any) {
          setError(err.message);
        }
      },
      actionText,
      newStatus === 'suspended' ? 'danger' : 'primary'
    );
  };

  const editUser = (user: any) => {
    setEditingUser(user);
    setName(user.name || '');
    setSurname(user.surname || '');
    setEmail(user.email || '');
    setRole(user.role || 'user');
    setCategory(user.category || '');
    setQualification(user.qualification || '');
    setSociety(user.society || '');
    setFitavCard(user.fitav_card || '');
    setUserAvatar(user.avatar || '');
    setPassword('');
    setShowUserForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError('L\'immagine non può superare i 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSocietyLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError('L\'immagine non può superare i 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSocLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!userSearchTerm) return true;
    const search = userSearchTerm.toLowerCase();
    const fullName = `${u.name} ${u.surname}`.toLowerCase();
    return fullName.includes(search) || 
           (u.society && u.society.toLowerCase().includes(search)) || 
           (u.fitav_card && u.fitav_card.toLowerCase().includes(search));
  });

  const sortedUsers = React.useMemo(() => {
    let sortableUsers = [...filteredUsers];
    
    // Always prioritize logged in users first
    sortableUsers.sort((a, b) => {
      if (a.is_logged_in && !b.is_logged_in) return -1;
      if (!a.is_logged_in && b.is_logged_in) return 1;
      
      if (userSortConfig !== null) {
        let aValue = a[userSortConfig.key] || '';
        let bValue = b[userSortConfig.key] || '';
        
        if (userSortConfig.key === 'name') {
           aValue = `${a.name} ${a.surname}`.toLowerCase();
           bValue = `${b.name} ${b.surname}`.toLowerCase();
        } else {
           aValue = String(aValue).toLowerCase();
           bValue = String(bValue).toLowerCase();
        }

        if (aValue < bValue) {
          return userSortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return userSortConfig.direction === 'asc' ? 1 : -1;
        }
      }
      return 0;
    });
    
    return sortableUsers;
  }, [filteredUsers, userSortConfig]);

  const requestUserSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (userSortConfig && userSortConfig.key === key && userSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setUserSortConfig({ key, direction });
  };

  const hasActiveFilters = filterShooter !== '' || filterSociety !== '' || filterDiscipline !== '' || filterLocation !== '' || filterYear !== '';

  const resultsToDisplay = (currentUser?.role === 'admin' || currentUser?.role === 'society') ? allResults : competitions.map(c => ({
    ...c,
    userName: currentUser?.name || '',
    userSurname: currentUser?.surname || '',
    userId: currentUser?.id || ''
  }));

  const filteredResults = useMemo(() => {
    return resultsToDisplay
      .filter(r => r.totalScore > 0)
      .filter(r => {
        const shooterMatch = `${r.userName || ''} ${r.userSurname || ''}`.toLowerCase().includes(filterShooter.toLowerCase()) || 
                             `${r.userSurname || ''} ${r.userName || ''}`.toLowerCase().includes(filterShooter.toLowerCase());
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
        const dateA = a.date ? (new Date(a.date.split(/[-/]/).reverse().join('-')).getTime() || new Date(a.date).getTime()) : 0;
        const dateB = b.date ? (new Date(b.date.split(/[-/]/).reverse().join('-')).getTime() || new Date(b.date).getTime()) : 0;
        return dateB - dateA; // Sort by date descending
      });
  }, [resultsToDisplay, filterShooter, filterSociety, filterDiscipline, filterLocation, filterYear]);

  const groupedShooters = useMemo(() => {
    const groups = new Map();
    filteredResults.forEach(r => {
      const key = r.userId;
      if (!groups.has(key)) {
        groups.set(key, {
          userId: r.userId,
          userName: r.userName,
          userSurname: r.userSurname,
          society: r.society,
          category: r.category,
          qualification: r.qualification,
          results: []
        });
      }
      groups.get(key).results.push(r);
    });
    
    return Array.from(groups.values()).map(group => {
      const results = group.results;
      const totalCompetitions = results.length;
      const totalScore = results.reduce((acc: number, r: any) => acc + (r.totalScore || 0), 0);
      const totalTargets = results.reduce((acc: number, r: any) => acc + (r.totalTargets || 0), 0);
      const average = totalTargets > 0 ? (totalScore / totalTargets) * 25 : 0;
      const bestAverage = results.length > 0 ? Math.max(...results.map((r: any) => r.totalTargets > 0 ? (r.totalScore / r.totalTargets) * 25 : 0)) : 0;
      
      return {
        ...group,
        totalCompetitions,
        average,
        bestAverage
      };
    }).sort((a, b) => {
      const nameA = `${a.userSurname || ''} ${a.userName || ''}`.trim();
      const nameB = `${b.userSurname || ''} ${b.userName || ''}`.trim();
      return nameA.localeCompare(nameB);
    });
  }, [filteredResults]);

  if (loading && (activeTab === 'users' || activeTab === 'team' || activeTab === 'results')) return <div className="p-8 text-center text-slate-500"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  const totalPages = Math.ceil(groupedShooters.length / resultsPerPage);
  const paginatedShooters = groupedShooters.slice((resultsPage - 1) * resultsPerPage, resultsPage * resultsPerPage);
  const paginatedResults = filteredResults.slice((resultsPage - 1) * resultsPerPage, resultsPage * resultsPerPage);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setter(e.target.value);
    setResultsPage(1);
  };

  const filteredSocieties = societies
    .filter(soc => 
      soc.name.toLowerCase().includes(societySearch.toLowerCase()) ||
      (soc.city && soc.city.toLowerCase().includes(societySearch.toLowerCase())) ||
      (soc.region && soc.region.toLowerCase().includes(societySearch.toLowerCase()))
    )
    .sort((a, b) => {
      const mySoc = currentUser?.society?.trim().toLowerCase();
      if (mySoc) {
        const aName = a.name.trim().toLowerCase();
        const bName = b.name.trim().toLowerCase();
        if (aName === mySoc) return -1;
        if (bName === mySoc) return 1;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6">
      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] sm:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Tab Switcher - Mobile (Custom Elegant Dropdown) */}
      {!hideTabs && (
        <div className="sm:hidden sticky top-16 z-[46] bg-slate-950/90 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-slate-800 shadow-lg">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-full bg-slate-900 border border-slate-700 text-white py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-between shadow-inner active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center text-orange-500">
                <i className={`fas ${
                  activeTab === 'results' ? 'fa-history' :
                  activeTab === 'events' ? 'fa-calendar-alt' :
                  activeTab === 'halloffame' ? 'fa-trophy' :
                  activeTab === 'notifications' ? 'fa-bell' :
                  activeTab === 'team' ? 'fa-users-cog' :
                  activeTab === 'users' ? 'fa-users' :
                  activeTab === 'profile' ? 'fa-user' :
                  'fa-cog'
                }`}></i>
              </div>
              <span className="uppercase tracking-widest text-[10px] font-black">
                {activeTab === 'results' ? 'Risultati' :
                 activeTab === 'events' ? 'Gare' :
                 activeTab === 'halloffame' ? 'Hall of Fame' :
                 activeTab === 'notifications' ? 'Notifiche' :
                 activeTab === 'team' ? 'Squadre' :
                 activeTab === 'users' ? (currentUser?.role === 'society' ? 'Tiratori' : 'Utenti') :
                 activeTab === 'profile' ? 'Profilo' :
                 (currentUser?.role === 'admin' ? 'Avanzate' : 'Backup')}
              </span>
            </div>
            <i className={`fas fa-chevron-down text-xs transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-180' : ''}`}></i>
          </button>

          {isMobileMenuOpen && (
            <div className="absolute top-full left-4 right-4 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="p-2 grid grid-cols-1 gap-1">
                {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
                  <>
                    <button 
                      onClick={() => { setActiveTab('results'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'results' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      <i className="fas fa-history w-5 text-center"></i> Risultati
                    </button>
                    <button 
                      onClick={() => { setActiveTab('events'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'events' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      <i className="fas fa-calendar-alt w-5 text-center"></i> Gare
                    </button>
                    <button 
                      onClick={() => { setActiveTab('halloffame'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'halloffame' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      <i className="fas fa-trophy w-5 text-center"></i> Hall of Fame
                    </button>
                    {currentUser?.role === 'admin' && (
                      <button 
                        onClick={() => { setActiveTab('notifications'); setIsMobileMenuOpen(false); }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'notifications' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                      >
                        <i className="fas fa-bell w-5"></i>
                        Notifiche
                      </button>
                    )}
                    <button 
                      onClick={() => { setActiveTab('team'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'team' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      <i className="fas fa-users-cog w-5 text-center"></i> Squadre
                    </button>
                    <button 
                      onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      <i className="fas fa-users w-5 text-center"></i> {currentUser?.role === 'society' ? 'Tiratori' : 'Utenti'}
                    </button>
                  </>
                )}
                <button 
                  onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  <i className="fas fa-user w-5 text-center"></i> Profilo
                </button>
                <button 
                  onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  <i className="fas fa-cog w-5 text-center"></i> {currentUser?.role === 'admin' ? 'Avanzate' : 'Backup'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Switcher - Desktop */}
      {!hideTabs && (
        <div className="hidden sm:flex sticky top-[104px] z-40 bg-slate-900 p-1 rounded-2xl border border-slate-800 w-full shadow-xl flex-wrap">
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => setActiveTab('results')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-[10px] lg:text-xs font-black uppercase transition-all ${activeTab === 'results' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-history mr-1 lg:mr-2"></i> <span className="hidden md:inline">Risultati</span><span className="md:hidden">Ris.</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => setActiveTab('events')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-[10px] lg:text-xs font-black uppercase transition-all ${activeTab === 'events' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-calendar-alt mr-1 lg:mr-2"></i> <span className="hidden md:inline">Gare</span><span className="md:hidden">Gare</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => setActiveTab('halloffame')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-[10px] lg:text-xs font-black uppercase transition-all ${activeTab === 'halloffame' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-trophy mr-1 lg:mr-2"></i> <span className="hidden md:inline">Hall of Fame</span><span className="md:hidden">HoF</span>
              </button>
            )}
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('notifications')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-[10px] lg:text-xs font-black uppercase transition-all ${activeTab === 'notifications' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-bell mr-1 lg:mr-2"></i> <span className="hidden md:inline">Notifiche</span><span className="md:hidden">Not.</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => setActiveTab('team')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-[10px] lg:text-xs font-black uppercase transition-all ${activeTab === 'team' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-users-cog mr-1 lg:mr-2"></i> <span className="hidden md:inline">Squadre</span><span className="md:hidden">Sq.</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => setActiveTab('users')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-[10px] lg:text-xs font-black uppercase transition-all ${activeTab === 'users' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-users mr-1 lg:mr-2"></i> <span className="hidden md:inline">{currentUser?.role === 'society' ? 'Tiratori' : 'Utenti'}</span><span className="md:hidden">{currentUser?.role === 'society' ? 'Tir.' : 'Ut.'}</span>
              </button>
            )}
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-[10px] lg:text-xs font-black uppercase transition-all ${activeTab === 'profile' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <i className="fas fa-user mr-1 lg:mr-2"></i> <span className="hidden md:inline">Profilo</span><span className="md:hidden">Prof.</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-[10px] lg:text-xs font-black uppercase transition-all ${activeTab === 'settings' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <i className="fas fa-cog mr-1 lg:mr-2"></i> <span className="hidden md:inline">{currentUser?.role === 'admin' ? 'Avanzate' : 'Backup'}</span><span className="md:hidden">{currentUser?.role === 'admin' ? 'Av.' : 'Bk.'}</span>
            </button>
        </div>
      )}

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
      ) : activeTab === 'halloffame' ? (
        <HallOfFame 
          user={currentUser} 
          token={token} 
          triggerConfirm={triggerConfirm} 
        />
      ) : activeTab === 'notifications' ? (
        <AdminNotifications token={token} triggerConfirm={triggerConfirm} />
      ) : activeTab === 'profile' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-2">
            <i className="fas fa-user-circle text-orange-500"></i> Il Tuo Profilo
          </h2>

          {profileSuccess && <div className="bg-emerald-950/50 text-emerald-500 p-3 rounded-xl text-sm mb-4 border border-emerald-900/50">{profileSuccess}</div>}
          {error && <div className="bg-red-950/50 text-red-500 p-3 rounded-xl text-sm mb-4 border border-red-900/50">{error}</div>}

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center mb-2">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <i className="fas fa-user text-4xl text-slate-500"></i>
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                  <i className="fas fa-camera text-white text-xl"></i>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Foto Profilo (Max 2MB)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} disabled={currentUser?.role === 'society'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cognome</label>
                <input type="text" value={profileSurname} onChange={e => setProfileSurname(e.target.value)} disabled={currentUser?.role === 'society'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nuova Password (opzionale)</label>
                <div className="relative">
                  <input 
                    type={showProfilePassword ? "text" : "password"} 
                    value={profilePassword} 
                    onChange={e => setProfilePassword(e.target.value)} 
                    placeholder="Lascia vuoto per non cambiare" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowProfilePassword(!showProfilePassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <i className={`fas ${showProfilePassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società</label>
                <div className="relative">
                  <select 
                    value={profileSociety} 
                    onChange={e => setProfileSociety(e.target.value)} 
                    disabled={currentUser?.role === 'society'}
                    className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Seleziona...</option>
                    {societies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    {!societies.some(s => s.name === profileSociety) && profileSociety && <option value={profileSociety}>{profileSociety}</option>}
                  </select>
                  <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                </div>
              </div>
              {currentUser?.role !== 'society' && (
                <>
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
                </>
              )}
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
                onClick={() => {
                  setShowTeamForm(!showTeamForm);
                  if (!showTeamForm) window.scrollTo({ top: 0, behavior: 'smooth' });
                  if (!showTeamForm && currentUser?.role === 'society' && currentUser?.society) {
                    setNewTeamSociety(currentUser.society);
                  } else if (!showTeamForm) {
                    setNewTeamSociety('');
                  }
                }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${showTeamForm ? 'bg-slate-800 text-slate-400' : 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'}`}
              >
                <i className={`fas ${showTeamForm ? 'fa-times' : 'fa-plus'}`}></i>
                {showTeamForm ? 'Chiudi' : 'Nuova Squadra'}
              </button>
            </div>

            {showTeamForm && (
              <form onSubmit={handleCreateTeam} className="bg-slate-950/50 p-4 sm:p-6 rounded-2xl border border-slate-800 mb-8 space-y-4 sm:space-y-6 animate-in zoom-in-95 duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Squadra</label>
                    <input 
                      type="text" 
                      required 
                      value={newTeamName} 
                      onChange={e => setNewTeamName(e.target.value)} 
                      placeholder="Es: Team Gold"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società</label>
                    {currentUser?.role === 'society' ? (
                      <input 
                        type="text" 
                        readOnly 
                        value={newTeamSociety} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm opacity-50 cursor-not-allowed outline-none transition-all" 
                      />
                    ) : (
                      <select 
                        value={newTeamSociety} 
                        onChange={e => {
                          setNewTeamSociety(e.target.value);
                          setSelectedShooterIds([]);
                        }} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                      >
                        <option value="">Seleziona...</option>
                        {societies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
                    <select 
                      value={newTeamDiscipline} 
                      onChange={e => setNewTeamDiscipline(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                    >
                      <option value="">Seleziona...</option>
                      {Object.values(Discipline).filter(d => d !== Discipline.TRAINING).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Titolo/Nome Gara</label>
                    <input 
                      type="text" 
                      value={newTeamCompetitionName} 
                      onChange={e => setNewTeamCompetitionName(e.target.value)} 
                      placeholder="Es: Campionato Regionale"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Campo / TAV</label>
                    <input 
                      type="text" 
                      value={newTeamLocation} 
                      onChange={e => setNewTeamLocation(e.target.value)} 
                      placeholder="Es: TAV Roma"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Gara</label>
                    <input 
                      type="date" 
                      required 
                      value={newTeamDate} 
                      onChange={e => setNewTeamDate(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0" 
                    />
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
                    {shooters.map(shooter => {
                      const shooterStats = teamStats.find(s => s.user_id === shooter.id && (!newTeamDiscipline || s.discipline === newTeamDiscipline));
                      const avg = shooterStats ? Number(shooterStats.avg_score).toFixed(2) : '-';
                      const isSelected = selectedShooterIds.includes(shooter.id);
                      
                      return (
                        <button
                          key={shooter.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedShooterIds(prev => prev.filter(id => id !== shooter.id));
                            } else if (selectedShooterIds.length < newTeamSize) {
                              setSelectedShooterIds(prev => [...prev, shooter.id]);
                            }
                          }}
                          className={`p-3 rounded-lg text-left text-xs font-bold transition-all border flex flex-col gap-1 ${isSelected ? 'bg-orange-600/20 border-orange-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                        >
                          <span className="truncate">{shooter.surname} {shooter.name}</span>
                          <span className={`text-[9px] font-black uppercase ${isSelected ? 'text-orange-400' : 'text-slate-500'}`}>
                            Media {newTeamDiscipline || 'Tot'}: {avg}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-row gap-2">
                  <button 
                    type="submit" 
                    disabled={selectedShooterIds.length !== newTeamSize}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-black py-3 px-1 rounded-xl transition-all shadow-lg text-[9px] sm:text-xs uppercase whitespace-nowrap"
                  >
                    {editingTeam ? 'Salva' : 'Crea'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveAndSendCompetition}
                    disabled={selectedShooterIds.length !== newTeamSize}
                    className="flex-[1.5] bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black py-3 px-1 rounded-xl transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-1 text-[9px] sm:text-xs uppercase whitespace-nowrap"
                  >
                    <i className="fas fa-paper-plane text-[8px] hidden sm:block"></i>
                    Invia Gara
                  </button>
                  {editingTeam && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingTeam(null);
                        setNewTeamName('');
                        setNewTeamCompetitionName('');
                        setNewTeamDiscipline('');
                        setNewTeamLocation('');
                        setNewTeamDate(new Date().toISOString().split('T')[0]);
                        if (currentUser?.role === 'society' && currentUser?.society) {
                          setNewTeamSociety(currentUser.society);
                        } else {
                          setNewTeamSociety('');
                        }
                        setSelectedShooterIds([]);
                        setShowTeamForm(false);
                      }}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-400 font-black py-3 px-1 rounded-xl transition-all border border-slate-800 text-[9px] sm:text-xs uppercase whitespace-nowrap"
                    >
                      Annulla
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Elenco Squadre Esistenti */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map(team => (
                <div key={team.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3 group">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[8px] font-black bg-orange-600/20 text-orange-500 px-1.5 py-0.5 rounded uppercase">
                        {team.size} Tiratori
                      </span>
                      {team.discipline && (
                        <span className="text-[8px] font-black bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded uppercase">
                          {team.discipline}
                        </span>
                      )}
                      {team.society && (
                        <span className="text-[8px] font-black bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase">
                          {team.society}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <button 
                        onClick={() => handleEditTeam(team)}
                        className="w-7 h-7 rounded-lg bg-orange-600/10 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all"
                      >
                        <i className="fas fa-edit text-[10px]"></i>
                      </button>
                      <button 
                        onClick={() => handleDeleteTeam(team.id)}
                        className="w-7 h-7 rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white"
                      >
                        <i className="fas fa-trash-alt text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                  <div className="mb-2">
                    <h4 className="text-base font-black text-white leading-tight truncate">{team.name}</h4>
                    {team.competition_name && (
                      <p className="text-[10px] text-slate-500 font-medium truncate">{team.competition_name}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    {team.members.map((m: any, idx: number) => {
                      // Trova le statistiche del tiratore per la disciplina della squadra
                      const shooterStats = teamStats.find(s => s.user_id === m.id && (!team.discipline || s.discipline === team.discipline));
                      const catQual = shooterStats ? (shooterStats.category || shooterStats.qualification || '') : '';
                      const avg = shooterStats ? Number(shooterStats.avg_score).toFixed(2) : '-';
                      const isEditingThis = editingScore?.teamId === team.id && editingScore?.userId === m.id;
                      
                      return (
                        <div key={idx} className="text-xs text-slate-400 flex items-center justify-between bg-slate-900/50 p-2 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-all gap-3">
                          <div className="flex items-center gap-2 truncate flex-1">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center text-slate-500 font-bold shrink-0">{idx + 1}</span>
                            <div className="flex flex-col truncate">
                              <span className="font-black text-slate-100 truncate text-sm">{m.surname} {m.name}</span>
                              <div className="flex items-center gap-2">
                                {catQual && (
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter shrink-0">{catQual}</span>
                                )}
                                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest shrink-0">Avg: {avg}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-orange-600/30">
                                <input 
                                  type="number" 
                                  autoFocus
                                  value={editingScore.score}
                                  onChange={e => setEditingScore({...editingScore, score: parseInt(e.target.value) || 0})}
                                  className="w-10 bg-transparent text-white text-xs font-black outline-none text-center"
                                />
                                <button 
                                  onClick={() => handleUpdateScore(team.id, m.id, editingScore.score)}
                                  className="text-emerald-500 hover:text-emerald-400 p-1"
                                >
                                  <i className="fas fa-check text-[10px]"></i>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`text-base font-black ${m.score !== null ? 'text-white' : 'text-slate-700'}`}>
                                  {m.score !== null ? m.score : '--'}
                                </span>
                                {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
                                  <button 
                                    onClick={() => setEditingScore({ teamId: team.id, userId: m.id, score: m.score || 0 })}
                                    className="text-slate-600 hover:text-orange-500 transition-all p-1"
                                  >
                                    <i className="fas fa-pencil-alt text-[10px]"></i>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Totale Squadra */}
                    <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Totale Squadra</span>
                      <span className="text-lg font-black text-orange-500">
                        {team.members.reduce((acc: number, m: any) => acc + (m.score || 0), 0)}
                      </span>
                    </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <i className="fas fa-chart-line text-orange-500"></i> Statistiche Individuali
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filtra Disciplina:</label>
                <select 
                  value={statsFilterDiscipline} 
                  onChange={(e) => setStatsFilterDiscipline(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:border-orange-600 outline-none transition-all appearance-none"
                >
                  <option value="">Tutte</option>
                  {statsDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
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
                  {filteredTeamStats.map((s, idx) => (
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
      ) : activeTab === 'societies' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-building text-orange-500"></i> {currentUser?.role === 'society' ? 'Elenco Società' : 'Gestione Società (TAV)'}
            </h2>
            {currentUser?.role === 'admin' && !showSocietyForm && (
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const missing = societies.filter(s => !s.lat || !s.lng);
                    if (missing.length === 0) {
                      triggerConfirm(
                        'Coordinate Aggiornate',
                        'Tutte le società hanno già le coordinate.',
                        () => {},
                        'OK',
                        'primary'
                      );
                      return;
                    }
                    triggerConfirm(
                      'Aggiorna Coordinate',
                      `Vuoi aggiornare le coordinate per ${missing.length} società mancanti? Potrebbe richiedere qualche secondo.`,
                      async () => {
                        for (const soc of missing) {
                          if (soc.address && soc.city) {
                            try {
                              const query = encodeURIComponent(`${soc.address}, ${soc.city}, ${soc.region || ''}, Italy`);
                              const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
                              if (geoRes.ok) {
                                const geoData = await geoRes.json();
                                if (geoData && geoData.length > 0) {
                                  const lat = parseFloat(geoData[0].lat);
                                  const lng = parseFloat(geoData[0].lon);
                                  await fetch(`/api/admin/societies/${soc.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ ...soc, lat, lng })
                                  });
                                }
                              }
                              // Add a small delay to respect Nominatim rate limits (1 request per second)
                              await new Promise(resolve => setTimeout(resolve, 1100));
                            } catch (e) {
                              console.error("Geocoding failed for", soc.name, e);
                            }
                          }
                        }
                        fetchSocieties();
                      },
                      'Aggiorna',
                      'primary'
                    );
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-2 px-4 rounded-xl transition-all active:scale-95 text-xs uppercase flex items-center gap-2"
                >
                  <i className="fas fa-sync-alt"></i> Coord.
                </button>
                <button onClick={() => {
                  setEditingSociety(null);
                  setSocName(''); setSocEmail(''); setSocAddress(''); setSocCity(''); setSocRegion(''); setSocZip(''); setSocPhone(''); setSocMobile(''); setSocWebsite(''); setSocOpeningHours(''); setSocGoogleMapsLink(''); setSocDisciplines([]); setSocContactName(''); setSocLogo('');
                  setShowSocietyForm(true);
                }} className="bg-orange-600 hover:bg-orange-500 text-white font-black py-2 px-4 rounded-xl transition-all active:scale-95 text-xs uppercase flex items-center gap-2 shadow-lg shadow-orange-600/20">
                  <i className="fas fa-plus"></i> Nuova
                </button>
              </div>
            )}
          </div>

          {showSocietyForm && (
            <form onSubmit={handleSocietySubmit} className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 mb-8 animate-in zoom-in-95 duration-300 space-y-4">
              <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase">{editingSociety ? 'Modifica Società' : 'Nuova Società'}</h3>
              
              <div className="flex flex-col items-center mb-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-800 overflow-hidden flex items-center justify-center mb-2">
                    {socLogo ? (
                      <img src={socLogo} alt="Logo Società" className="w-full h-full object-cover" />
                    ) : (
                      <i className="fas fa-building text-4xl text-slate-500"></i>
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                    <i className="fas fa-camera text-white text-xl"></i>
                    <input type="file" accept="image/*" className="hidden" onChange={handleSocietyLogoChange} />
                  </label>
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logo Società (Max 2MB)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome TAV (Obbligatorio)</label>
                  <input type="text" required value={socName} onChange={e => setSocName(e.target.value)} disabled={currentUser?.role === 'society'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                  <input type="email" value={socEmail} onChange={e => setSocEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Sito Web</label>
                  <input type="url" value={socWebsite} onChange={e => setSocWebsite(e.target.value)} placeholder="https://..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Link Google Maps (Opzionale)</label>
                  <input type="url" value={socGoogleMapsLink} onChange={e => setSocGoogleMapsLink(e.target.value)} placeholder="https://goo.gl/maps/..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Contatto</label>
                  <input type="text" value={socContactName} onChange={e => setSocContactName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Indirizzo</label>
                  <input type="text" value={socAddress} onChange={e => setSocAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Città</label>
                    <input type="text" value={socCity} onChange={e => setSocCity(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Regione</label>
                    <input type="text" value={socRegion} onChange={e => setSocRegion(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CAP</label>
                    <input type="text" value={socZip} onChange={e => setSocZip(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefono Fisso</label>
                  <input type="tel" value={socPhone} onChange={e => setSocPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cellulare</label>
                  <input type="tel" value={socMobile} onChange={e => setSocMobile(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Giorni e Orari di Apertura</label>
                  <input type="text" value={socOpeningHours} onChange={e => setSocOpeningHours(e.target.value)} placeholder="Es: Lun-Ven 09:00-18:00, Sab-Dom 08:00-19:00" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Discipline Disponibili</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {Object.keys(Discipline).filter(k => k !== 'TRAINING').map(key => (
                      <label key={key} className={`flex flex-col items-center justify-center p-2 rounded-xl border cursor-pointer transition-all ${socDisciplines.includes(key) ? 'bg-orange-600/20 border-orange-600 text-orange-500' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={socDisciplines.includes(key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSocDisciplines([...socDisciplines, key]);
                            } else {
                              setSocDisciplines(socDisciplines.filter(d => d !== key));
                            }
                          }}
                        />
                        <span className="text-xs font-black">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-black py-2 px-6 rounded-xl transition-all active:scale-95 text-xs uppercase">
                  {editingSociety ? 'Salva Modifiche' : 'Crea Società'}
                </button>
                <button type="button" onClick={() => setShowSocietyForm(false)} className="bg-slate-800 hover:bg-slate-700 text-white font-black py-2 px-6 rounded-xl transition-all active:scale-95 text-xs uppercase">
                  Annulla
                </button>
              </div>
            </form>
          )}

          {/* Society Search and View Toggle */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
              <input 
                type="text" 
                placeholder="Cerca società per nome, città o regione..." 
                value={societySearch}
                onChange={(e) => setSocietySearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all"
              />
            </div>
            <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setSocietyViewMode('list')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${societyViewMode === 'list' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                <i className="fas fa-list mr-2"></i> Lista
              </button>
              <button
                onClick={() => setSocietyViewMode('map')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${societyViewMode === 'map' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                <i className="fas fa-map-marked-alt mr-2"></i> Mappa
              </button>
            </div>
          </div>

          {societyViewMode === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSocieties.map(soc => {
                const isMySoc = currentUser?.society?.trim().toLowerCase() === soc.name.trim().toLowerCase();
                return (
                  <div 
                    key={soc.id} 
                    onClick={() => setSelectedSociety(soc)}
                    className={`bg-slate-950/50 border ${isMySoc ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'border-slate-800'} rounded-2xl p-4 relative flex items-center gap-4 cursor-pointer hover:bg-slate-900/50 transition-all group shadow-sm hover:shadow-md`}
                  >
                  {soc.logo ? (
                    <img src={soc.logo} alt={soc.name} className="w-12 h-12 rounded-xl object-cover border border-slate-800 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-building text-xl text-slate-600"></i>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-white truncate group-hover:text-orange-500 transition-colors flex items-center gap-2">
                      {soc.name}
                      {currentUser?.role === 'admin' && soc.lat && soc.lng && (
                        <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" title="Coordinate registrate"></span>
                      )}
                    </h3>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                      {soc.city && <span className="truncate"><i className="fas fa-map-marker-alt mr-1"></i>{soc.city} {soc.region ? `(${soc.region})` : ''}</span>}
                      <span className="truncate"><i className="fas fa-envelope mr-1"></i>{soc.email}</span>
                    </div>
                    {soc.disciplines && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {soc.disciplines.split(',').slice(0, 5).map((d: string) => (
                          <span key={d} className="text-[8px] font-black text-orange-500/80 bg-orange-500/10 px-1 rounded uppercase">{d}</span>
                        ))}
                        {soc.disciplines.split(',').length > 5 && <span className="text-[8px] font-black text-slate-500">...</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(soc.google_maps_link || (soc.lat && soc.lng)) && (
                      <a 
                        href={soc.google_maps_link || `https://www.google.com/maps/dir/?api=1&destination=${soc.lat},${soc.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
                        title="Apri in Google Maps"
                      >
                        <i className="fas fa-directions"></i>
                      </a>
                    )}
                    <div className="text-slate-600 group-hover:text-orange-500 transition-colors ml-2">
                      <i className="fas fa-chevron-right"></i>
                    </div>
                  </div>
                </div>
              );
            })}
              {filteredSocieties.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-600 italic text-sm">
                  Nessuna società trovata.
                </div>
              )}
            </div>
          ) : (
            <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-slate-800 relative z-0">
              <MapContainer 
                center={[41.9028, 12.4964]} // Center on Rome
                zoom={6} 
                style={{ height: '100%', width: '100%' }}
                className="z-0"
              >
                <MapResizer />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredSocieties.filter(s => s.lat && s.lng).map(soc => {
                  const isMySoc = currentUser?.society?.trim().toLowerCase() === soc.name.trim().toLowerCase();
                  return (
                    <Marker 
                      key={soc.id} 
                      position={[parseFloat(soc.lat), parseFloat(soc.lng)]}
                      icon={isMySoc ? redIcon : orangeIcon}
                    >
                      <Popup className="custom-popup">
                      <div className="text-center">
                        <h3 className="font-black text-white">{soc.name}</h3>
                        <p className="text-xs text-slate-400 mt-1">{soc.city} {soc.region ? `(${soc.region})` : ''}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedSociety(soc); }}
                            className="text-xs font-bold text-orange-500 hover:underline"
                          >
                            Vedi Dettagli
                          </button>
                          {(soc.google_maps_link || (soc.lat && soc.lng)) && (
                            <a 
                              href={soc.google_maps_link || `https://www.google.com/maps/dir/?api=1&destination=${soc.lat},${soc.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-bold text-blue-400 hover:underline flex items-center gap-1"
                              title="Apri in Google Maps"
                            >
                              <i className="fas fa-directions"></i> Naviga
                            </a>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              </MapContainer>
              {filteredSocieties.filter(s => !s.lat || !s.lng).length > 0 && (
                <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-xl p-3 text-xs text-slate-400 text-center z-[400]">
                  <i className="fas fa-info-circle text-orange-500 mr-2"></i>
                  {filteredSocieties.filter(s => !s.lat || !s.lng).length} società non hanno coordinate e non sono visibili sulla mappa. Modificale per aggiornare la posizione.
                </div>
              )}
            </div>
          )}

          {selectedSociety && createPortal(
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedSociety(null)}>
              <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <div className="relative min-h-[160px] bg-slate-900 bg-gradient-to-br from-slate-900 to-slate-950 border-b border-slate-800 flex items-end p-4 sm:p-6 overflow-hidden">
                  {/* Decorative background elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -ml-16 -mb-16"></div>
                  
                  <button 
                    onClick={() => setSelectedSociety(null)} 
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg z-20"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                  
                  <div className="relative z-10 w-full pr-10 sm:pr-0">
                    <div className="flex items-end gap-4 translate-y-6">
                      {selectedSociety.logo ? (
                        <img src={selectedSociety.logo} alt={selectedSociety.name} className="w-24 h-24 rounded-2xl object-cover border-4 border-slate-950 bg-slate-900 shadow-xl" />
                      ) : (
                        <div className="w-24 h-24 rounded-2xl bg-slate-900 border-4 border-slate-950 flex items-center justify-center shadow-xl">
                          <i className="fas fa-building text-3xl text-slate-600"></i>
                        </div>
                      )}
                      <div className="mb-2">
                        <h2 className="text-xl sm:text-2xl font-black text-white leading-tight uppercase italic tracking-tighter break-words">{selectedSociety.name}</h2>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {selectedSociety.city && <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-2"><i className="fas fa-map-marker-alt text-orange-500"></i>{selectedSociety.city} {selectedSociety.region ? `(${selectedSociety.region})` : ''}</p>}
                          {(selectedSociety.google_maps_link || (selectedSociety.lat && selectedSociety.lng)) && (
                            <a 
                              href={selectedSociety.google_maps_link || `https://www.google.com/maps/dir/?api=1&destination=${selectedSociety.lat},${selectedSociety.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-black bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded-lg transition-colors flex items-center gap-1 uppercase tracking-wider"
                            >
                              <i className="fas fa-directions"></i> Naviga
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 pt-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                    {selectedSociety.contact_name && (
                      <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Referente</p>
                        <p className="text-sm font-bold text-white">{selectedSociety.contact_name}</p>
                      </div>
                    )}
                    {selectedSociety.email && (
                      <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Email</p>
                        <p className="text-sm font-bold text-white break-all">{selectedSociety.email}</p>
                      </div>
                    )}
                    {selectedSociety.phone && (
                      <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Telefono</p>
                        <p className="text-sm font-bold text-white">{selectedSociety.phone}</p>
                      </div>
                    )}
                    {selectedSociety.mobile && (
                      <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cellulare</p>
                        <p className="text-sm font-bold text-white">{selectedSociety.mobile}</p>
                      </div>
                    )}
                    {selectedSociety.address && (
                      <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Indirizzo Completo</p>
                        <p className="text-sm font-bold text-white">{selectedSociety.address}, {selectedSociety.zip_code} {selectedSociety.city} ({selectedSociety.region})</p>
                      </div>
                    )}
                    {selectedSociety.website && (
                      <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sito Web</p>
                        <a href={selectedSociety.website} target="_blank" rel="noreferrer" className="text-sm font-bold text-orange-500 hover:underline break-all">{selectedSociety.website}</a>
                      </div>
                    )}
                    {selectedSociety.google_maps_link && (
                      <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Link Google Maps</p>
                        <a href={selectedSociety.google_maps_link} target="_blank" rel="noreferrer" className="text-sm font-bold text-orange-500 hover:underline break-all flex items-center gap-2">
                          <i className="fas fa-map-marked-alt"></i> Apri Mappa
                        </a>
                      </div>
                    )}
                    {selectedSociety.opening_hours && (
                      <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Giorni e Orari di Apertura</p>
                        <p className="text-sm font-bold text-white">{selectedSociety.opening_hours}</p>
                      </div>
                    )}
                    {selectedSociety.disciplines && (
                      <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Discipline Disponibili</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSociety.disciplines.split(',').map((d: string) => (
                            <span key={d} className="px-2 py-1 rounded-lg bg-orange-600/20 text-orange-500 text-[10px] font-black border border-orange-600/30 uppercase tracking-wider">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-800">
                    {(currentUser?.role === 'admin' || (currentUser?.role === 'society' && currentUser?.society === selectedSociety.name)) && (
                      <button 
                        onClick={() => {
                          setSelectedSociety(null);
                          handleEditSociety(selectedSociety);
                        }} 
                        className="flex-1 py-4 rounded-2xl bg-slate-800 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700 shadow-lg"
                      >
                        <i className="fas fa-edit"></i> Modifica
                      </button>
                    )}
                    {currentUser?.role === 'admin' && (
                      <button 
                        onClick={() => {
                          setSelectedSociety(null);
                          handleDeleteSociety(selectedSociety.id);
                        }} 
                        className="flex-1 py-4 rounded-2xl bg-red-900/30 text-red-500 font-black text-xs uppercase tracking-widest hover:bg-red-900/50 transition-all flex items-center justify-center gap-2 border border-red-900/50 shadow-lg"
                      >
                        <i className="fas fa-trash-alt"></i> Elimina
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      ) : activeTab === 'events' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <EventsManager 
            user={currentUser} 
            token={token} 
            triggerConfirm={triggerConfirm} 
            societies={societies} 
            restrictToSociety={true}
            onCreateTeam={(ev) => {
              setActiveTab('team');
              setShowTeamForm(true);
              setNewTeamCompetitionName(ev.name || '');
              setNewTeamDiscipline(ev.discipline || '');
              setNewTeamSociety(ev.location || '');
              setNewTeamDate(ev.start_date ? ev.start_date.split('T')[0] : new Date().toISOString().split('T')[0]);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      ) : activeTab === 'results' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-list-ol text-orange-500"></i> Tutti i Risultati
            </h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-start sm:justify-end">
              {currentUser?.role === 'admin' && (
                <button 
                  onClick={() => onEditCompetition && onEditCompetition()}
                  className="px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20 shrink-0"
                >
                  <i className="fas fa-plus text-base"></i>
                  <span>Aggiungi Gara</span>
                </button>
              )}
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all flex items-center gap-1.5 shrink-0 border ${showFilters || hasActiveFilters ? 'bg-orange-600/10 border-orange-500/50 text-orange-500' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-orange-500 hover:border-slate-700'}`}
              >
                <i className={`fas ${showFilters ? 'fa-filter-slash' : 'fa-filter'} text-sm`}></i>
                <span>Filtri</span>
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                )}
              </button>
            </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mb-8">
            {paginatedShooters.map((shooter) => (
              <div 
                key={shooter.userId}
                onClick={() => setSelectedShooterResults(shooter)}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-4 hover:border-orange-500/50 transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-600/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-orange-600/10 transition-all"></div>
                
                <div className="flex items-center gap-3 mb-3 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-500 text-lg font-black shadow-inner shrink-0">
                    {(shooter.userName?.[0] || '')}{(shooter.userSurname?.[0] || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors truncate">
                      {shooter.userSurname || ''} {shooter.userName || ''}
                    </h3>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">
                        {shooter.society || 'Nessuna Società'}
                      </p>
                      {(shooter.category || shooter.qualification) && (
                        <p className="text-[9px] font-black text-orange-500/70 uppercase tracking-widest truncate">
                          • {shooter.category}{shooter.qualification ? ` / ${shooter.qualification}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-slate-700 group-hover:text-orange-500 transition-all shrink-0">
                    <i className="fas fa-chevron-right text-[10px]"></i>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-900 relative z-10">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Gare</p>
                    <p className="text-xs font-black text-white">{shooter.totalCompetitions}</p>
                  </div>
                  <div className="text-center border-x border-slate-900">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Media</p>
                    <p className="text-xs font-black text-orange-500">{shooter.average.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Best</p>
                    <p className="text-xs font-black text-white">{shooter.bestAverage.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {groupedShooters.length === 0 && (
            <div className="text-center py-20 bg-slate-950/30 rounded-3xl border border-dashed border-slate-800">
              <i className="fas fa-search text-4xl text-slate-800 mb-4"></i>
              <p className="text-slate-500 font-bold">Nessun tiratore trovato con i filtri selezionati</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <button 
                disabled={resultsPage === 1}
                onClick={() => setResultsPage(prev => prev - 1)}
                className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-black uppercase text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              >
                Precedente
              </button>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Pagina {resultsPage} di {totalPages}
              </span>
              <button 
                disabled={resultsPage === totalPages}
                onClick={() => setResultsPage(prev => prev + 1)}
                className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-black uppercase text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              >
                Successiva
              </button>
            </div>
          )}

          {selectedShooterResults && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedShooterResults(null)}>
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-orange-600/20">
                      {(selectedShooterResults.userName?.[0] || '')}{(selectedShooterResults.userSurname?.[0] || '')}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                        {selectedShooterResults.userSurname || ''} {selectedShooterResults.userName || ''}
                      </h2>
                      <p className="text-xs font-black text-orange-500 uppercase tracking-[0.2em] mt-1">
                        {selectedShooterResults.society || 'Nessuna Società'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedShooterResults(null)}
                    className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  {Object.entries(
                    (selectedShooterResults.results || [])
                      .filter((r: any) => {
                        if (currentUser?.role === 'society' && r.name?.toLowerCase().includes('allenamento')) return false;
                        return true;
                      })
                      .reduce((acc: any, r: any) => {
                        const disc = r.discipline || 'Altro';
                        if (!acc[disc]) acc[disc] = [];
                        acc[disc].push(r);
                        return acc;
                      }, {})
                  ).length === 0 ? (
                    <div className="text-center py-20">
                      <p className="text-slate-500 font-bold">Nessuna gara trovata per questo tiratore</p>
                    </div>
                  ) : (
                    Object.entries(
                      (selectedShooterResults.results || [])
                        .filter((r: any) => {
                          if (currentUser?.role === 'society' && r.name?.toLowerCase().includes('allenamento')) return false;
                          return true;
                        })
                        .reduce((acc: any, r: any) => {
                          const disc = r.discipline || 'Altro';
                          if (!acc[disc]) acc[disc] = [];
                          acc[disc].push(r);
                          return acc;
                        }, {})
                    ).map(([discipline, results]: [string, any]) => (
                      <div key={discipline} className="mb-12 last:mb-0">
                        <div className="flex items-center gap-4 mb-6">
                          <h3 className="text-sm font-black text-white uppercase tracking-[0.3em] whitespace-nowrap">
                            {discipline}
                          </h3>
                          <div className="h-[1px] flex-1 bg-gradient-to-r from-orange-500/50 to-transparent"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {results.map((r: any, idx: number) => (
                            <div key={idx} className="bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:border-orange-500/30 transition-all group relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-16 h-16 bg-orange-600/5 rounded-full -mr-8 -mt-8 blur-xl group-hover:bg-orange-600/10 transition-all"></div>
                              <div className="flex-1 relative z-10">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="px-2 py-1 rounded-lg bg-slate-900 text-[9px] font-black text-slate-400 uppercase tracking-widest border border-slate-800">
                                    {r.date}
                                  </span>
                                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1 truncate max-w-[150px]">
                                    <i className="fas fa-map-marker-alt text-orange-500/50"></i>
                                    {r.location || 'Campo N.D.'}
                                  </span>
                                </div>
                                <h4 className="text-sm font-black text-white group-hover:text-orange-500 transition-colors uppercase tracking-tight truncate">{r.name}</h4>
                              </div>
                              
                              <div className="flex items-center justify-between sm:justify-end gap-6 relative z-10">
                                <div className="text-right">
                                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Punteggio</p>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-white">{r.totalScore}</span>
                                    <span className="text-slate-600 font-black text-xs">/ {r.totalTargets}</span>
                                  </div>
                                </div>
                                
                                {currentUser?.role === 'admin' && (
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => onEditCompetition && onEditCompetition(r)}
                                      className="w-9 h-9 rounded-xl bg-orange-600/10 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all shadow-lg shadow-orange-600/5"
                                      title="Modifica"
                                    >
                                      <i className="fas fa-edit text-xs"></i>
                                    </button>
                                    <button 
                                      onClick={() => {
                                        triggerConfirm(
                                          'Elimina Gara',
                                          `Sei sicuro di voler eliminare la gara "${r.name}"?`,
                                          () => {
                                            if (onDeleteCompetition) {
                                              onDeleteCompetition(r.id);
                                              setAllResults(prev => prev.filter(res => res.id !== r.id));
                                              setSelectedShooterResults((prev: any) => ({
                                                ...prev,
                                                results: prev.results.filter((res: any) => res.id !== r.id)
                                              }));
                                            }
                                          },
                                          'Elimina',
                                          'danger'
                                        );
                                      }}
                                      className="w-9 h-9 rounded-xl bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-lg shadow-red-600/5"
                                      title="Elimina"
                                    >
                                      <i className="fas fa-trash-alt text-xs"></i>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-users-cog text-orange-500"></i> {currentUser?.role === 'society' ? 'Gestione Tiratori' : 'Gestione Utenti'}
            </h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                <input 
                  type="text" 
                  placeholder={currentUser?.role === 'society' ? "Cerca per nome, tessera..." : "Cerca per nome, società, tessera..."} 
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-slate-600"
                />
              </div>
              <button 
                onClick={() => { 
                  setShowUserForm(!showUserForm); 
                  setEditingUser(null); 
                  if (!showUserForm) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    if (currentUser?.role === 'society') {
                      setSociety(currentUser.society);
                      setRole('user');
                    }
                  }
                }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${showUserForm ? 'bg-slate-800 text-slate-400' : 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'}`}
              >
                <i className={`fas ${showUserForm ? 'fa-times' : 'fa-user-plus'}`}></i>
                {showUserForm ? 'Chiudi' : (currentUser?.role === 'society' ? 'Nuovo Tiratore' : 'Nuovo Utente')}
              </button>
            </div>
          </div>

          {error && <div className="bg-red-950/50 text-red-500 p-3 rounded-xl text-sm mb-4">{error}</div>}

          {/* User Management Dashboard */}
          {currentUser?.role === 'admin' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <i className="fas fa-user-check text-green-500 text-xs"></i>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Utenti Online</span>
                </div>
                <div className="text-2xl font-black text-white">{dashboardStats.onlineUsersCount}</div>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <i className="fas fa-building text-blue-500 text-xs"></i>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Società Online</span>
                </div>
                <div className="text-2xl font-black text-white">{dashboardStats.onlineSocietiesCount}</div>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <i className="fas fa-star text-orange-500 text-xs"></i>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tiratore più Attivo</span>
                </div>
                <div className="text-sm font-bold text-white truncate">
                  {dashboardStats.topUserName}
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                  {dashboardStats.topUserLogins} Accessi
                </div>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <i className="fas fa-trophy text-purple-500 text-xs"></i>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Società più Attiva</span>
                </div>
                <div className="text-sm font-bold text-white truncate">
                  {dashboardStats.topSocName}
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                  {dashboardStats.topSocLogins} Accessi Totali
                </div>
              </div>
            </div>
          )}

          {showUserForm && (
            <form onSubmit={handleSubmit} className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 mb-8 animate-in zoom-in-95 duration-300">
              <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase">{editingUser ? (currentUser?.role === 'society' ? 'Modifica Tiratore' : 'Modifica Utente') : (currentUser?.role === 'society' ? 'Nuovo Tiratore' : 'Nuovo Utente')}</h3>
              
              <div className="flex flex-col items-center mb-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-800 overflow-hidden flex items-center justify-center mb-2">
                    {userAvatar ? (
                      <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <i className="fas fa-user text-4xl text-slate-500"></i>
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                    <i className="fas fa-camera text-white text-xl"></i>
                    <input type="file" accept="image/*" className="hidden" onChange={handleUserAvatarChange} />
                  </label>
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Foto Profilo (Max 2MB)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ruolo</label>
                  <select 
                    value={role} 
                    onChange={e => setRole(e.target.value)} 
                    disabled={currentUser?.role === 'society'}
                    className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
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
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required={!editingUser} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 pr-10 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
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
                  <select 
                    value={society} 
                    onChange={e => setSociety(e.target.value)} 
                    disabled={currentUser?.role === 'society'}
                    className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Seleziona...</option>
                    {societies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tessera Fitav</label>
                  <input type="text" value={fitavCard} onChange={e => setFitavCard(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-black py-2 px-6 rounded-xl transition-all active:scale-95 text-xs uppercase">
                  {editingUser ? 'Salva Modifiche' : (currentUser?.role === 'society' ? 'Crea Tiratore' : 'Crea Utente')}
                </button>
                <button type="button" onClick={() => { setShowUserForm(false); setEditingUser(null); setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); setUserAvatar(''); }} className="bg-slate-800 hover:bg-slate-700 text-white font-black py-2 px-6 rounded-xl transition-all active:scale-95 text-xs uppercase">
                  Annulla
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('name')}>
                    Nome {userSortConfig?.key === 'name' ? (userSortConfig.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('fitav_card')}>
                    Tessera Fitav {userSortConfig?.key === 'fitav_card' ? (userSortConfig.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('society')}>
                    Società {userSortConfig?.key === 'society' ? (userSortConfig.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('category')}>
                    Cat./Qual. {userSortConfig?.key === 'category' ? (userSortConfig.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('email')}>
                    Email {userSortConfig?.key === 'email' ? (userSortConfig.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('role')}>
                    Ruolo {userSortConfig?.key === 'role' ? (userSortConfig.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  <th className="py-3 px-4 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map(u => (
                  <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4 text-sm text-white font-bold">
                      <div className="flex items-center gap-3">
                        <div 
                          className={`w-8 h-8 rounded-full bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center ${
                            u.is_logged_in 
                              ? 'border-2 border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
                              : 'border border-slate-700'
                          }`}
                          title={u.is_logged_in ? "Online" : undefined}
                        >
                          {u.avatar ? (
                            <img src={u.avatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <i className="fas fa-user text-slate-500 text-xs"></i>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{u.name} {u.surname}</span>
                        </div>
                      </div>
                    </td>
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
                      {currentUser?.role === 'admin' && (
                        <button 
                          onClick={() => handleToggleStatus(u.id, u.status)} 
                          disabled={u.email === 'snecaj@gmail.com'}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 ${
                            u.status === 'suspended' 
                              ? 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white' 
                              : 'bg-red-500/5 text-red-500/60 hover:bg-red-600 hover:text-white'
                          }`}
                          title={u.status === 'suspended' ? "Riattiva" : "Sospendi"}
                        >
                          <i className={`fas ${u.status === 'suspended' ? 'fa-user-check' : 'fa-user-slash'} text-xs`}></i>
                        </button>
                      )}
                      <button 
                        onClick={() => { editUser(u); setShowUserForm(true); }} 
                        disabled={currentUser?.role === 'society' && u.role === 'admin'}
                        className="w-8 h-8 rounded-lg bg-orange-600/10 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all disabled:opacity-30"
                        title={currentUser?.role === 'society' && u.role === 'admin' ? "Non puoi modificare un Admin" : "Modifica"}
                      >
                        <i className="fas fa-edit text-xs"></i>
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)} 
                        disabled={u.email === 'snecaj@gmail.com' || currentUser?.role === 'society'} 
                        className="w-8 h-8 rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all disabled:opacity-30"
                        title={currentUser?.role === 'society' ? "Solo l'amministratore può eliminare gli utenti" : (u.email === 'snecaj@gmail.com' ? "Non puoi eliminare l'account principale" : "Elimina")}
                      >
                        <i className="fas fa-trash-alt text-xs"></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 text-sm italic">
                      Nessun utente trovato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Floating Add Button for Societies */}
      {activeTab === 'societies' && currentUser?.role === 'admin' && (
        <button 
          onClick={() => {
            if (!showSocietyForm) {
              setEditingSociety(null);
              setSocName('');
              setSocEmail('');
              setSocAddress('');
              setSocCity('');
              setSocRegion('');
              setSocZip('');
              setSocPhone('');
              setSocMobile('');
              setSocWebsite('');
              setSocContactName('');
              setSocLogo('');
              setSocOpeningHours('');
              setSocGoogleMapsLink('');
            }
            setShowSocietyForm(!showSocietyForm);
            if (!showSocietyForm) window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`fixed bottom-8 right-8 w-16 h-16 ${showSocietyForm ? 'bg-orange-500 shadow-orange-500/40' : 'bg-orange-600 shadow-orange-600/40'} rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-all active:scale-95 z-40 floating-add-btn group`}
          title={showSocietyForm ? 'Chiudi' : 'Nuova Società'}
        >
          <i className={`fas ${showSocietyForm ? 'fa-times' : 'fa-plus'} text-2xl group-hover:rotate-90 transition-transform duration-300`}></i>
        </button>
      )}
    </div>
  );
};

export default AdminPanel;
