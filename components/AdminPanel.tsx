import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as XLSX from 'xlsx';
import Settings from './Settings';
import EventsManager from './EventsManager';
import HallOfFame from './HallOfFame';
import SocietySearch from './SocietySearch';
import ShooterSearch from './ShooterSearch';
import ShareCard from './ShareCard';
import FAQSection from './FAQSection';
import { Competition, Cartridge, CartridgeType, AppData, Discipline, getSeriesLayout, User, UserRole } from '../types';

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

type Tab = 'users' | 'settings' | 'profile' | 'team' | 'results' | 'event-results' | 'societies' | 'events' | 'halloffame' | 'notifications';

interface AdminPanelProps {
  user: any;
  token: string;
  // Settings props
  competitions: Competition[];
  cartridges: Cartridge[];
  cartridgeTypes: CartridgeType[];
  societies?: any[];
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
  onEditCompetition?: (comp?: Competition, userId?: number) => void;
  onDeleteCompetition?: (id: string) => Promise<boolean | void> | void;
  initialTab?: Tab;
  initialSocietyName?: string;
  onCloseSocietyDetail?: () => void;
  onUserUpdate?: (user: any) => void;
  triggerToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  prefillTeam?: {
    competition_name: string;
    discipline: string;
    society: string;
    date: string;
    location: string;
    targets?: number;
  };
  onPrefillTeamUsed?: () => void;
  hideTabs?: boolean;
  onReplayTour?: () => void;
  appSettings?: any;
  onSettingsUpdate?: () => void;
}

// User Search Input Component to avoid re-rendering the whole AdminPanel on every keystroke
const UserSearchInput = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  return (
    <div className="relative flex-1">
      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
      <input 
        type="text" 
        placeholder={placeholder} 
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-10 text-sm text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-slate-600 font-bold"
      />
      {localValue && (
        <button
          onClick={() => {
            setLocalValue('');
            onChange('');
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-full transition-all"
          title="Resetta ricerca"
        >
          <i className="fas fa-times-circle text-sm"></i>
        </button>
      )}
    </div>
  );
};

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  user: currentUser, token, competitions, cartridges, cartridgeTypes, societies: initialSocieties, clientId, onClientIdChange, onImport,
  syncStatus, lastSync, isDriveConnected, onConnectDrive, onDisconnectDrive, onSaveDrive, onLoadDrive,
  triggerConfirm, onEditCompetition, onDeleteCompetition, initialTab, initialSocietyName, onCloseSocietyDetail, onUserUpdate, triggerToast, prefillTeam, onPrefillTeamUsed, hideTabs, onReplayTour,
  appSettings, onSettingsUpdate
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
      setNewTeamTargets(prefillTeam.targets || 100);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (onPrefillTeamUsed) onPrefillTeamUsed();
    }
  }, [prefillTeam, onPrefillTeamUsed]);

  const handleCloseSocietyDetail = () => {
    setSelectedSociety(null);
    if (initialSocietyName && onCloseSocietyDetail) {
      onCloseSocietyDetail();
    }
  };

  const [showUserForm, setShowUserForm] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const [userSortConfig, setUserSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(25);
  const [totalUsers, setTotalUsers] = useState(0);
  const [filterRole, setFilterRole] = useState<string>('');

  const usersPageRef = React.useRef(usersPage);
  const usersPerPageRef = React.useRef(usersPerPage);
  const userSearchTermRef = React.useRef(userSearchTerm);
  const filterRoleRef = React.useRef(filterRole);

  useEffect(() => { usersPageRef.current = usersPage; }, [usersPage]);
  useEffect(() => { usersPerPageRef.current = usersPerPage; }, [usersPerPage]);
  useEffect(() => { userSearchTermRef.current = userSearchTerm; }, [userSearchTerm]);
  useEffect(() => { filterRoleRef.current = filterRole; }, [filterRole]);

  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [societies, setSocieties] = useState<any[]>(initialSocieties || []);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [profileSubTab, setProfileSubTab] = useState<'details' | 'help' | 'events'>('details');
  
  // Society Form State
  const [showSocietyForm, setShowSocietyForm] = useState(false);
  const [societyViewMode, setSocietyViewMode] = useState<'list' | 'map'>('list');
  const [editingSociety, setEditingSociety] = useState<any>(null);
  const [socName, setSocName] = useState('');
  const [socCode, setSocCode] = useState('');
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
  const [selectedSociety, setSelectedSociety] = useState<any>(() => {
    if (initialSocietyName && initialSocieties && initialSocieties.length > 0) {
      return initialSocieties.find(s => s.name === initialSocietyName) || null;
    }
    return null;
  });
  
  useEffect(() => {
    if (initialSocietyName && societies.length > 0) {
      const soc = societies.find(s => s.name === initialSocietyName);
      if (soc) {
        setSelectedSociety(soc);
        setActiveTab('societies');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [initialSocietyName, societies]);
  
  // Team Creation State
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSize, setNewTeamSize] = useState<3 | 6>(3);
  const [newTeamEventId, setNewTeamEventId] = useState<string | null>(null);
  const [newTeamCompetitionName, setNewTeamCompetitionName] = useState('');
  const [newTeamDiscipline, setNewTeamDiscipline] = useState('');
  const [newTeamSociety, setNewTeamSociety] = useState(currentUser?.role === 'society' ? currentUser?.society || '' : '');
  const [newTeamLocation, setNewTeamLocation] = useState('');
  const [newTeamDate, setNewTeamDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTeamTargets, setNewTeamTargets] = useState(100);
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

  useEffect(() => {
    if (currentUser?.role === 'society' && currentUser?.society) {
      setNewTeamSociety(currentUser.society);
    }
  }, [currentUser]);

  // Results Filtering State
  const [showFilters, setShowFilters] = useState(false);
  const [filterShooter, setFilterShooter] = useState('');
  const [filterSociety, setFilterSociety] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPerPage] = useState(20);
  const [totalResults, setTotalResults] = useState(0);
  const resultsPageRef = React.useRef(resultsPage);
  const resultsPerPageRef = React.useRef(resultsPerPage);
  
  const filterShooterRef = React.useRef(filterShooter);
  const filterSocietyRef = React.useRef(filterSociety);
  const filterDisciplineRef = React.useRef(filterDiscipline);
  const filterLocationRef = React.useRef(filterLocation);
  const filterYearRef = React.useRef(filterYear);

  useEffect(() => { resultsPageRef.current = resultsPage; }, [resultsPage]);
  useEffect(() => { resultsPerPageRef.current = resultsPerPage; }, [resultsPerPage]);
  useEffect(() => { filterShooterRef.current = filterShooter; }, [filterShooter]);
  useEffect(() => { filterSocietyRef.current = filterSociety; }, [filterSociety]);
  useEffect(() => { filterDisciplineRef.current = filterDiscipline; }, [filterDiscipline]);
  useEffect(() => { filterLocationRef.current = filterLocation; }, [filterLocation]);
  useEffect(() => { filterYearRef.current = filterYear; }, [filterYear]);

  const [selectedShooterResults, setSelectedShooterResults] = useState<any | null>(null);
  const [shareData, setShareData] = useState<{ comp: Competition, user: User } | null>(null);

  const [filterOptions, setFilterOptions] = useState<{
    disciplines: string[];
    locations: string[];
    years: string[];
  }>({
    disciplines: [],
    locations: [],
    years: []
  });

  // Helper for automatic qualification
  const updateAutoQualification = (date: string, currentQual: string, setter: (val: string) => void) => {
    if (!date) return;
    const birthYear = new Date(date).getFullYear();
    if (isNaN(birthYear)) return;
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;

    if (age <= 20) setter('Junior');
    else if (age >= 56 && age <= 65) setter('Senior');
    else if (age >= 66 && age <= 72) setter('Veterani');
    else if (age > 72) setter('Master');
    else if (['Junior', 'Senior', 'Veterani', 'Master'].includes(currentQual)) setter('');
  };

  const fetchFilterOptions = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/admin/filter-options', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (res.ok) {
        const data = await res.json();
        setFilterOptions(data);
      }
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'results') {
      fetchFilterOptions();
    }
  }, [activeTab, fetchFilterOptions]);

  const shooters = React.useMemo(() => {
    // Use the full users list to ensure all shooters are available, not just those with results
    const sourceUsers = allUsers.length > 0 ? allUsers : users;
    return sourceUsers
      .filter(u => !newTeamSociety || (u.society && u.society.trim().toLowerCase() === newTeamSociety.trim().toLowerCase()))
      .map(u => ({
        id: u.id,
        name: u.name,
        surname: u.surname,
        society: u.society,
        category: u.category,
        qualification: u.qualification,
        shooter_code: u.shooter_code,
        is_logged_in: u.is_logged_in
      }))
      .sort((a, b) => {
        if (a.is_logged_in && !b.is_logged_in) return -1;
        if (!a.is_logged_in && b.is_logged_in) return 1;
        return a.surname.localeCompare(b.surname);
      });
  }, [users, allUsers, newTeamSociety]);

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
  const [shooterCode, setShooterCode] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');

  // Profile state for current user
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileSurname, setProfileSurname] = useState(currentUser?.surname || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [profileCategory, setProfileCategory] = useState(currentUser?.category || '');
  const [profileQualification, setProfileQualification] = useState(currentUser?.qualification || '');
  const [profileSociety, setProfileSociety] = useState(currentUser?.society || '');
  const [profileShooterCode, setProfileShooterCode] = useState(currentUser?.shooter_code || '');
  const [profileAvatar, setProfileAvatar] = useState(currentUser?.avatar || '');
  const [profileBirthDate, setProfileBirthDate] = useState(currentUser?.birth_date || '');
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [statsFilterDiscipline, setStatsFilterDiscipline] = useState<string>('');
  const [kpiFilter, setKpiFilter] = useState('total');
  const [fetchedDashboardStats, setFetchedDashboardStats] = useState<any>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  const fetchDashboardStats = useCallback(async () => {
    if (currentUser?.role !== 'admin') return;
    try {
      const res = await fetch(`/api/admin/dashboard-stats?filter=${kpiFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFetchedDashboardStats(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  }, [kpiFilter, token, currentUser]);

  useEffect(() => {
    if (showDashboard) {
      fetchDashboardStats();
    }
  }, [fetchDashboardStats, showDashboard]);

  const filteredTeamStats = useMemo(() => {
    if (!statsFilterDiscipline) return teamStats;
    return teamStats.filter(s => s.discipline === statsFilterDiscipline);
  }, [teamStats, statsFilterDiscipline]);

  const statsDisciplines = useMemo(() => {
    return Array.from(new Set(teamStats.map(s => s.discipline))).sort();
  }, [teamStats]);

  const dashboardStats = useMemo(() => {
    const onlineUsers = users.filter(u => u.is_logged_in && u.role === 'user');
    const onlineSocieties = new Set(users.filter(u => u.is_logged_in && u.role === 'society' && u.society).map(u => u.society));
    
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

    // Activity-based stats (local calculation if needed)
    const userResultCounts: {[key: number]: number} = {};
    const userTargetCounts: {[key: number]: number} = {};
    allResults.forEach(r => {
      if (r.user_id) {
        userResultCounts[r.user_id] = (userResultCounts[r.user_id] || 0) + 1;
        userTargetCounts[r.user_id] = (userTargetCounts[r.user_id] || 0) + (r.totalTargets || 0);
      }
    });

    const topUserByResultsId = Object.entries(userResultCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const topUserByResults = users.find(u => u.id === Number(topUserByResultsId));

    const topUserByTargetsId = Object.entries(userTargetCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const topUserByTargets = users.find(u => u.id === Number(topUserByTargetsId));

    const socResultCounts: {[key: string]: number} = {};
    allResults.forEach(r => {
      if (r.society) {
        socResultCounts[r.society] = (socResultCounts[r.society] || 0) + 1;
      }
    });
    const topSocByResultsEntry = Object.entries(socResultCounts)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      onlineUsersCount: onlineUsers.length,
      onlineSocietiesCount: onlineSocieties.size,
      topUserName: topUser ? `${topUser.name} ${topUser.surname}` : '-',
      topUserLogins: topUser ? topUser.login_count : 0,
      topSocName: topSocEntry ? topSocEntry[0] : '-',
      topSocLogins: topSocEntry ? topSocEntry[1] : 0,
      // New fields
      topUserByResultsName: topUserByResults ? `${topUserByResults.name} ${topUserByResults.surname}` : '-',
      topUserResultsCount: topUserByResultsId ? userResultCounts[Number(topUserByResultsId)] : 0,
      topSocByResultsName: topSocByResultsEntry ? topSocByResultsEntry[0] : '-',
      topSocResultsCount: topSocByResultsEntry ? topSocByResultsEntry[1] : 0,
      topUserByTargetsName: topUserByTargets ? `${topUserByTargets.name} ${topUserByTargets.surname}` : '-',
      topUserTargetsTotal: topUserByTargetsId ? userTargetCounts[Number(topUserByTargetsId)] : 0
    };
  }, [users, allResults]);

  const fetchSocieties = useCallback(async (signal?: AbortSignal, isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch('/api/societies', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (res.status === 401 || res.status === 403) {
        setError('Sessione scaduta. Effettua nuovamente l\'accesso.');
        return;
      }
      if (!res.ok) throw new Error('Errore nel caricamento delle società');
      const data = await res.json();
      setSocieties(data);
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (isBackground && (err.message === 'Failed to fetch' || !navigator.onLine)) {
        console.warn('Background fetch failed:', err.message);
        return;
      }
      setError(err.message === 'Failed to fetch' ? 'Errore di connessione. Controlla la tua rete.' : err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [token]);

  const fetchEvents = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/events', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error(err);
    }
  }, [token]);

  const fetchUsers = useCallback(async (signal?: AbortSignal, isBackground = false) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    if (!isBackground) setLoading(true);
    else setBackgroundLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: usersPageRef.current.toString(),
        limit: usersPerPageRef.current.toString(),
        search: userSearchTermRef.current,
        role: filterRoleRef.current
      });
      
      const res = await fetch(`/api/admin/users?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (res.status === 401 || res.status === 403) {
        setError('Sessione scaduta. Effettua nuovamente l\'accesso.');
        return;
      }
      if (!res.ok) throw new Error('Errore nel caricamento degli utenti');
      const data = await res.json();
      
      if (data.users) {
        setUsers(data.users);
        setTotalUsers(data.total);
      } else {
        setUsers(data);
        setTotalUsers(data.length);
      }
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (isBackground && (err.message === 'Failed to fetch' || !navigator.onLine)) {
        console.warn('Background fetch failed:', err.message);
        return;
      }
      setError(err.message === 'Failed to fetch' ? 'Errore di connessione. Controlla la tua rete.' : err.message);
    } finally {
      if (!isBackground) setLoading(false);
      else setBackgroundLoading(false);
    }
  }, [currentUser?.role, token]);

  const fetchAllUsers = useCallback(async (signal?: AbortSignal) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    try {
      // Fetch a large number of users to ensure we have all shooters for team selection
      const res = await fetch(`/api/admin/users?limit=2000`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (!res.ok) throw new Error('Errore nel caricamento di tutti gli utenti');
      const data = await res.json();
      setAllUsers(data.users || data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Error fetching all users:', err);
    }
  }, [token, currentUser?.role]);

  const fetchTeamStats = useCallback(async (signal?: AbortSignal, isBackground = false) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    if (!isBackground) setLoading(true);
    else setBackgroundLoading(true);
    try {
      const res = await fetch('/api/admin/team-stats', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (res.status === 401 || res.status === 403) {
        setError('Sessione scaduta. Effettua nuovamente l\'accesso.');
        return;
      }
      if (!res.ok) throw new Error('Errore nel caricamento delle statistiche');
      const data = await res.json();
      setTeamStats(data);
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (isBackground && (err.message === 'Failed to fetch' || !navigator.onLine)) {
        console.warn('Background fetch failed:', err.message);
        return;
      }
      setError(err.message === 'Failed to fetch' ? 'Errore di connessione. Controlla la tua rete.' : err.message);
    } finally {
      if (!isBackground) setLoading(false);
      else setBackgroundLoading(false);
    }
  }, [currentUser?.role, token]);

  const fetchAllResults = useCallback(async (signal?: AbortSignal, isBackground = false) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    if (!isBackground) setLoading(true);
    else setBackgroundLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: resultsPageRef.current.toString(),
        limit: resultsPerPageRef.current.toString(),
        search: filterShooterRef.current,
        society: filterSocietyRef.current,
        discipline: filterDisciplineRef.current,
        location: filterLocationRef.current,
        year: filterYearRef.current
      });
      
      const res = await fetch(`/api/admin/all-results?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (res.status === 401 || res.status === 403) {
        setError('Sessione scaduta. Effettua nuovamente l\'accesso.');
        return;
      }
      if (!res.ok) throw new Error('Errore nel caricamento dei risultati');
      const data = await res.json();
      
      if (data.results) {
        setAllResults(data.results);
        setTotalResults(data.total);
      } else {
        setAllResults(data);
        setTotalResults(data.length);
      }
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (isBackground && (err.message === 'Failed to fetch' || !navigator.onLine)) {
        console.warn('Background fetch failed:', err.message);
        return;
      }
      setError(err.message === 'Failed to fetch' ? 'Errore di connessione. Controlla la tua rete.' : err.message);
    } finally {
      if (!isBackground) setLoading(false);
      else setBackgroundLoading(false);
    }
  }, [currentUser?.role, token]);

  const fetchTeams = useCallback(async (signal?: AbortSignal, isBackground = false) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch('/api/teams', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (res.status === 401 || res.status === 403) {
        setError('Sessione scaduta. Effettua nuovamente l\'accesso.');
        return;
      }
      if (!res.ok) throw new Error('Errore nel caricamento delle squadre');
      const data = await res.json();
      setTeams(data);
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (isBackground && (err.message === 'Failed to fetch' || !navigator.onLine)) {
        console.warn('Background fetch failed:', err.message);
        return;
      }
      setError(err.message === 'Failed to fetch' ? 'Errore di connessione. Controlla la tua rete.' : err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [currentUser?.role, token]);

  const handleRetry = useCallback(() => {
    setError('');
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
  }, [currentUser?.role, fetchSocieties, fetchTeamStats, fetchAllResults, fetchTeams, fetchUsers]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetchSocieties(controller.signal);
    return () => controller.abort();
  }, [token, fetchSocieties]);

  useEffect(() => {
    if (activeTab === 'team' && (currentUser?.role === 'admin' || currentUser?.role === 'society')) {
      const controller = new AbortController();
      fetchTeams(controller.signal);
      fetchEvents(controller.signal);
      return () => controller.abort();
    }
  }, [activeTab, currentUser?.role, fetchTeams, fetchEvents]);

  useEffect(() => {
    if (activeTab === 'results' && (currentUser?.role === 'admin' || currentUser?.role === 'society')) {
      const controller = new AbortController();
      fetchAllResults(controller.signal);
      return () => controller.abort();
    }
  }, [activeTab, currentUser?.role, fetchAllResults, resultsPage, resultsPerPage, filterShooter, filterSociety, filterDiscipline, filterLocation, filterYear]);

  useEffect(() => {
    if ((activeTab === 'results' || activeTab === 'team') && (currentUser?.role === 'admin' || currentUser?.role === 'society')) {
      const controller = new AbortController();
      fetchTeamStats(controller.signal, activeTab === 'results');
      return () => controller.abort();
    }
  }, [activeTab, currentUser?.role, fetchTeamStats]);

  useEffect(() => {
    if ((activeTab === 'users' || activeTab === 'team') && (currentUser?.role === 'admin' || currentUser?.role === 'society')) {
      const controller = new AbortController();
      fetchUsers(controller.signal);
      if (activeTab === 'team') {
        fetchAllUsers(controller.signal);
      }
      const interval = setInterval(() => {
        fetchUsers(controller.signal, true);
        if (activeTab === 'team') {
          fetchAllUsers(controller.signal);
        }
      }, 30000); // Refresh every 30 seconds
      return () => {
        clearInterval(interval);
        controller.abort();
      };
    }
  }, [activeTab, currentUser?.role, fetchUsers, fetchAllUsers, usersPage, usersPerPage, userSearchTerm, filterRole]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProfileSuccess('');

    if (currentUser?.role === 'user' || currentUser?.role === 'admin') {
      const shooterCodeRegex = /^[A-Z]{3}\d{2}[A-Z]{2}\d{2}$/;
      if (profileShooterCode && !shooterCodeRegex.test(profileShooterCode)) {
        setError('La Codice Tiratore deve avere il formato: 3 lettere, 2 numeri, 2 lettere, 2 numeri (es. ABC12DE34)');
        return;
      }
    }

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
          shooter_code: profileShooterCode,
          avatar: profileAvatar,
          birth_date: profileBirthDate || undefined,
          phone: profilePhone || undefined,
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
          shooter_code: profileShooterCode,
          avatar: profileAvatar,
          birth_date: profileBirthDate,
          phone: profilePhone
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
          event_id: newTeamEventId,
          discipline: newTeamDiscipline,
          society: newTeamSociety,
          location: newTeamLocation,
          date: newTeamDate,
          targets: newTeamTargets,
          memberIds: selectedShooterIds
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Errore durante ${editingTeam ? 'la modifica' : 'la creazione'} della squadra`);
      }
      
      setNewTeamName('');
      setNewTeamCompetitionName('');
      setNewTeamEventId(null);
      setNewTeamDiscipline('');
      setNewTeamLocation('');
      setNewTeamDate(new Date().toISOString().split('T')[0]);
      setNewTeamTargets(100);
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
    setNewTeamEventId(team.event_id || null);
    setNewTeamDiscipline(team.discipline || '');
    setNewTeamSociety(team.society || '');
    setNewTeamLocation(team.location || '');
    setNewTeamDate(team.date || new Date().toISOString().split('T')[0]);
    setNewTeamTargets(team.targets || 100);
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
              event_id: newTeamEventId,
              discipline: newTeamDiscipline,
              society: newTeamSociety,
              location: newTeamLocation,
              date: newTeamDate,
              targets: newTeamTargets,
              memberIds: selectedShooterIds
            }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || `Errore durante il salvataggio della squadra`);
          }
          const data = await res.json();
          const teamId = editingTeam ? editingTeam.id : data.id;

          // 2. Send the competition
          await handleSendCompetitionToShooters(teamId);
          
          // 3. Reset form
          setNewTeamName('');
          setNewTeamCompetitionName('');
          setNewTeamEventId(null);
          setNewTeamDiscipline('');
          setNewTeamLocation('');
          setNewTeamDate(new Date().toISOString().split('T')[0]);
          setNewTeamTargets(100);
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
      code: socCode,
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
      setSocName(''); setSocCode(''); setSocEmail(''); setSocAddress(''); setSocCity(''); setSocRegion(''); setSocZip(''); setSocPhone(''); setSocMobile(''); setSocWebsite(''); setSocOpeningHours(''); setSocGoogleMapsLink(''); setSocDisciplines([]); setSocContactName(''); setSocLogo('');
      setShowSocietyForm(false);
      fetchSocieties();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExportSocietiesExcel = () => {
    if (societies.length === 0) {
      setError('Nessuna società da esportare.');
      return;
    }

    const exportData = societies.map(s => ({
      'Nome TAV': s.name,
      'Email': s.email,
      'Indirizzo': s.address,
      'Città': s.city,
      'Regione': s.region,
      'CAP': s.zip_code,
      'Telefono': s.phone,
      'Cellulare': s.mobile,
      'Sito Web': s.website,
      'Contatto': s.contact_name,
      'Orari Apertura': s.opening_hours,
      'Link Google Maps': s.google_maps_link,
      'Discipline': s.disciplines
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Società');
    XLSX.writeFile(wb, 'esportazione_societa.xlsx');
  };

  const handleUpdateSocietiesCodesExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          setError('Il file Excel è vuoto.');
          return;
        }

        const updates: { id: string, data: any }[] = [];
        const notFound: string[] = [];

        data.forEach(row => {
          const name = row['Nome TAV'] || row['Nome'] || row['Società'];
          const code = row['Codice Società'] || row['Codice'] || row['Code'];

          if (name && code) {
            const society = societies.find(s => s.name.toLowerCase().trim() === String(name).toLowerCase().trim());
            if (society) {
              updates.push({
                id: society.id,
                data: {
                  ...society,
                  code: String(code).trim()
                }
              });
            } else {
              notFound.push(String(name));
            }
          }
        });

        if (updates.length === 0) {
          setError('Nessuna corrispondenza trovata tra i nomi nel file e le società esistenti.');
          return;
        }

        let message = `Trovate ${updates.length} società da aggiornare.`;
        if (notFound.length > 0) {
          message += `\nAttenzione: ${notFound.length} società non trovate nel sistema.`;
        }

        triggerConfirm(
          'Aggiorna Codici',
          `${message}\n\nSei sicuro di voler procedere con l'aggiornamento?`,
          async () => {
            setLoading(true);
            let successCount = 0;
            let errorCount = 0;
            
            try {
              for (const update of updates) {
                try {
                  const res = await fetch(`/api/admin/societies/${update.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(update.data)
                  });
                  if (res.ok) {
                    successCount++;
                  } else {
                    errorCount++;
                  }
                } catch (_) {
                  errorCount++;
                }
              }
              fetchSocieties();
              if (triggerToast) {
                triggerToast(`Aggiornamento completato!\nSocietà aggiornate: ${successCount}\nErrori: ${errorCount}`, errorCount > 0 ? 'error' : 'success');
              }
            } catch (err) {
              console.error('Error updating society codes:', err);
              setError('Errore durante l\'aggiornamento dei codici.');
            } finally {
              setLoading(false);
            }
          },
          'Aggiorna',
          'primary'
        );
      } catch (err) {
        console.error('Error parsing Excel:', err);
        setError('Errore durante la lettura del file Excel.');
      }
    };
    reader.readAsBinaryString(file);
    // Reset the input value so the same file can be selected again
    e.target.value = '';
  };

  const handleImportSocietiesExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          setError('Il file Excel è vuoto.');
          return;
        }

        const importedSocieties = data.map(row => ({
          name: row['Nome TAV'] || 'Società senza nome',
          email: row['Email'] || '',
          address: row['Indirizzo'] || '',
          city: row['Città'] || '',
          region: row['Regione'] || '',
          zip_code: row['CAP']?.toString() || '',
          phone: row['Telefono']?.toString() || '',
          mobile: row['Cellulare']?.toString() || '',
          website: row['Sito Web'] || '',
          contact_name: row['Contatto'] || '',
          opening_hours: row['Orari Apertura'] || '',
          google_maps_link: row['Link Google Maps'] || '',
          disciplines: row['Discipline'] || ''
        }));

        triggerConfirm(
          'Importa',
          `Sei sicuro di voler importare ${importedSocieties.length} società dal file Excel?`,
          async () => {
            setLoading(true);
            try {
              for (const soc of importedSocieties) {
                await fetch('/api/admin/societies', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify(soc)
                });
              }
              fetchSocieties();
              if (triggerToast) {
                triggerToast('Importazione completata con successo!', 'success');
              }
            } catch (err) {
              console.error('Error importing societies:', err);
              setError('Errore durante l\'importazione di alcune società.');
            } finally {
              setLoading(false);
            }
          },
          'Importa',
          'primary'
        );
      } catch (err) {
        console.error('Error reading Excel file:', err);
        setError('Errore nella lettura del file Excel.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const handleExportUsersExcel = () => {
    if (users.length === 0) {
      setError('Nessun utente da esportare.');
      return;
    }

    const exportData = users.map(u => ({
      'Nome': u.name,
      'Cognome': u.surname,
      'Email': u.email,
      'Ruolo': u.role,
      'Categoria': u.category,
      'Qualifica': u.qualification,
      'Società': u.society,
      'Codice Tiratore': u.shooter_code,
      'Data di Nascita': u.birth_date,
      'Telefono': u.phone
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Utenti');
    XLSX.writeFile(wb, 'esportazione_utenti.xlsx');
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        'Nome': 'Mario',
        'Cognome': 'Rossi',
        'Email': 'mario.rossi@example.com',
        'Ruolo': 'user',
        'Categoria': 'Eccellenza',
        'Qualifica': 'Skeet',
        'Società': 'TAV Roma',
        'Codice Società': 'RM01',
        'Codice Tiratore': '12345',
        'Data di Nascita': '1980-01-01',
        'Telefono': '3331234567'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modello Utenti");
    XLSX.writeFile(wb, "modello_import_utenti.xlsx");
  };

  const handleImportUsersExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          setError('Il file Excel è vuoto.');
          return;
        }

        const parseExcelDate = (dateVal: any) => {
          if (!dateVal) return undefined;
          if (dateVal instanceof Date) {
            const d = new Date(dateVal.getTime() - dateVal.getTimezoneOffset() * 60000);
            return d.toISOString().split('T')[0];
          }
          if (typeof dateVal === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal;
            const parts = dateVal.split(/[\/\-]/);
            if (parts.length === 3 && parts[2].length === 4) {
              return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          return undefined;
        };

        const importedUsers = data.map(row => ({
          name: row['Nome'] || 'Utente',
          surname: row['Cognome'] || 'Senza Cognome',
          email: row['Email'] || '',
          role: row['Ruolo'] || 'user',
          category: row['Categoria'] || '',
          qualification: row['Qualifica'] || '',
          society: row['Società'] || '',
          society_code: row['Codice Società']?.toString() || '',
          shooter_code: row['Codice Tiratore']?.toString() || '',
          birth_date: parseExcelDate(row['Data di Nascita']),
          phone: row['Telefono']?.toString() || '',
          password: row['Codice Tiratore']?.toString() || 'Password123!'
        }));

        triggerConfirm(
          'Importa',
          `Sei sicuro di voler importare/aggiornare ${importedUsers.length} utenti dal file Excel? Gli utenti esistenti verranno aggiornati.`,
          async () => {
            setLoading(true);
            try {
              const res = await fetch('/api/admin/users/import', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ users: importedUsers })
              });
              
              if (!res.ok) throw new Error('Errore durante l\'importazione');
              
              const results = await res.json();
              fetchUsers();
              if (triggerToast) {
                triggerToast(`Importazione completata! Creati: ${results.created}, Aggiornati: ${results.updated}, Errori: ${results.errors}`, results.errors > 0 ? 'error' : 'success');
              }
            } catch (err) {
              console.error('Error importing users:', err);
              setError('Errore durante l\'importazione.');
            } finally {
              setLoading(false);
            }
          },
          'Importa',
          'primary'
        );
      } catch (err) {
        console.error('Error reading Excel file:', err);
        setError('Errore nella lettura del file Excel.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const handleEditSociety = (soc: any) => {
    setEditingSociety(soc);
    setSocName(soc.name || '');
    setSocCode(soc.code || '');
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

    if (role === 'user') {
      const shooterCodeRegex = /^[A-Z]{3}\d{2}[A-Z]{2}\d{2}$/;
      if (shooterCode && !shooterCodeRegex.test(shooterCode)) {
        setError('La Codice Tiratore deve avere il formato: 3 lettere, 2 numeri, 2 lettere, 2 numeri (es. ABC12DE34)');
        return;
      }
    }

    const endpoint = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
    const method = editingUser ? 'PUT' : 'POST';
    const body = { name, surname, email, role, category, qualification, society, shooter_code: shooterCode, password: password || undefined, avatar: userAvatar || undefined, birth_date: birthDate || undefined, phone: phone || undefined };

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
      setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); setSociety(''); setShooterCode(''); setUserAvatar(''); setBirthDate(''); setPhone('');
      fetchUsers();
      if (role === 'society' || editingUser?.role === 'society') {
        fetchSocieties();
      }
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
          const userToDelete = users.find(u => u.id === id);
          const res = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Errore durante l\'eliminazione');
          fetchUsers();
          if (userToDelete?.role === 'society') {
            fetchSocieties();
          }
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
    setShooterCode(user.shooter_code || '');
    setUserAvatar(user.avatar || '');
    setBirthDate(user.birth_date || '');
    setPhone(user.phone || '');
    setPassword('');
    setShowUserForm(true);
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

  const sortedUsers = React.useMemo(() => {
    let sortableUsers = [...users];
    
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
  }, [users, userSortConfig]);

  const requestUserSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (userSortConfig && userSortConfig.key === key && userSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setUserSortConfig({ key, direction });
  };

  const hasActiveFilters = filterShooter !== '' || filterSociety !== '' || filterDiscipline !== '' || filterLocation !== '' || filterYear !== '';

  const isTabLoading = loading && (
    (activeTab === 'users' && users.length === 0) ||
    (activeTab === 'team' && teamStats.length === 0) ||
    (activeTab === 'results' && allResults.length === 0 && totalResults > 0)
  );

  if (isTabLoading) return <div className="p-8 text-center text-slate-500"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  const totalPages = Math.ceil(totalResults / resultsPerPage);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement> | string) => {
    const value = typeof e === 'string' ? e : e.target.value;
    setter(value);
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

  const resultsAccess = appSettings?.event_results_access || {};

  const hasSocietaAccess = currentUser?.role === 'admin' || (
    typeof resultsAccess.societa === 'boolean' ? resultsAccess.societa : (
      resultsAccess.societa?.enabled && (
        resultsAccess.societa.accessType === 'all' || 
        (resultsAccess.societa.accessType === 'specific' && resultsAccess.societa.allowedSocieties?.includes(currentUser?.society))
      )
    )
  );

  const hasTiratoriAccess = currentUser?.role === 'admin' || (
    typeof resultsAccess.tiratori === 'boolean' ? resultsAccess.tiratori : (
      resultsAccess.tiratori?.enabled && (
        resultsAccess.tiratori.accessType === 'all' || 
        (resultsAccess.tiratori.accessType === 'specific' && resultsAccess.tiratori.allowedSocieties?.includes(currentUser?.society))
      )
    )
  );

  return (
    <div className="space-y-6">
      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1010] sm:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Tab Switcher - Mobile (Custom Elegant Dropdown) */}
      {!hideTabs && (
        <div className="sm:hidden sticky top-16 z-[1020] bg-slate-950/90 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-slate-700 shadow-lg">
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
                {activeTab === 'results' ? 'Risultati Individuali' :
                 activeTab === 'events' ? 'Gare' :
                 activeTab === 'halloffame' ? 'Hall of Fame' :
                 activeTab === 'notifications' ? 'Notifiche' :
                 activeTab === 'team' ? 'Squadre' :
                 activeTab === 'users' ? (currentUser?.role === 'society' ? 'I tuoi Tiratori' : 'Utenti') :
                 activeTab === 'profile' ? 'Profilo' :
                 (currentUser?.role === 'admin' ? 'Avanzate' : 'Backup')}
              </span>
            </div>
            <i className={`fas fa-chevron-down text-xs transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-180' : ''}`}></i>
          </button>

          {isMobileMenuOpen && (
            <div className="absolute top-full left-4 right-4 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[1030]">
              <div className="p-2 grid grid-cols-1 gap-1">
                {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
                  <button 
                    onClick={() => { setActiveTab('results'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'results' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    <i className="fas fa-history w-5 text-center"></i> Risultati Individuali
                  </button>
                )}
                {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
                  <button 
                    onClick={() => { setActiveTab('events'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'events' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    <i className="fas fa-calendar-alt w-5 text-center"></i> {currentUser?.role === 'society' ? 'Le tue Gare' : 'Gare'}
                  </button>
                )}
                {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
                  <>
                    <button 
                      onClick={() => { setActiveTab('halloffame'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'halloffame' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      <i className="fas fa-trophy w-5 text-center"></i> Hall of Fame
                    </button>
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
                      <i className="fas fa-users w-5 text-center"></i> {currentUser?.role === 'society' ? 'I tuoi Tiratori' : 'Utenti'}
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
        <div className="hidden sm:flex sticky top-[104px] z-30 bg-slate-900 p-1 rounded-2xl border border-slate-700 w-full shadow-xl flex-wrap">
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => setActiveTab('results')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-xs lg:text-sm font-black uppercase transition-all ${activeTab === 'results' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-history mr-1 lg:mr-2"></i> <span className="hidden md:inline">Risultati Individuali</span><span className="md:hidden">Ris. Ind.</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => setActiveTab('events')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-xs lg:text-sm font-black uppercase transition-all ${activeTab === 'events' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-calendar-alt mr-1 lg:mr-2"></i> <span className="hidden md:inline">{currentUser?.role === 'society' ? 'Le tue Gare' : 'Gare'}</span><span className="md:hidden">{currentUser?.role === 'society' ? 'Le tue Gare' : 'Gare'}</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => setActiveTab('halloffame')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-xs lg:text-sm font-black uppercase transition-all ${activeTab === 'halloffame' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-trophy mr-1 lg:mr-2"></i> <span className="hidden md:inline">Hall of Fame</span><span className="md:hidden">HoF</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => setActiveTab('team')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-xs lg:text-sm font-black uppercase transition-all ${activeTab === 'team' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-users-cog mr-1 lg:mr-2"></i> <span className="hidden md:inline">Squadre</span><span className="md:hidden">Sq.</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => setActiveTab('users')}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-xs lg:text-sm font-black uppercase transition-all ${activeTab === 'users' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-users mr-1 lg:mr-2"></i> <span className="hidden md:inline">{currentUser?.role === 'society' ? 'I tuoi Tiratori' : 'Utenti'}</span><span className="md:hidden">{currentUser?.role === 'society' ? 'Tir.' : 'Ut.'}</span>
              </button>
            )}
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-xs lg:text-sm font-black uppercase transition-all ${activeTab === 'profile' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <i className="fas fa-user mr-1 lg:mr-2"></i> <span className="hidden md:inline">Profilo</span><span className="md:hidden">Prof.</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex-1 min-w-[100px] py-2 px-2 rounded-xl text-xs lg:text-sm font-black uppercase transition-all ${activeTab === 'settings' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
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
            cartridgeTypes={cartridgeTypes}
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
            appSettings={appSettings}
            onSettingsUpdate={onSettingsUpdate}
            societies={societies}
          />
        </div>
      ) : activeTab === 'halloffame' ? (
        <HallOfFame 
          user={currentUser} 
          token={token} 
          triggerConfirm={triggerConfirm} 
        />
      ) : activeTab === 'profile' ? (
        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-user-circle text-orange-500"></i> Il Tuo Profilo
            </h2>

            {/* Sub-navigation */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 flex-wrap">
              <button
                onClick={() => setProfileSubTab('details')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs lg:text-sm font-black uppercase tracking-widest transition-all ${
                  profileSubTab === 'details' 
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Dati Profilo
              </button>
              <button
                onClick={() => setProfileSubTab('help')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs lg:text-sm font-black uppercase tracking-widest transition-all ${
                  profileSubTab === 'help' 
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Guida & FAQ
              </button>
            </div>
          </div>

          {profileSubTab === 'details' ? (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              {profileSuccess && <div className="bg-emerald-950/50 text-emerald-500 p-3 rounded-xl text-sm mb-4 border border-emerald-900/50">{profileSuccess}</div>}
              {error && (
                <div className="bg-red-950/50 text-red-500 p-3 rounded-xl text-sm mb-4 border border-red-900/50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-exclamation-circle"></i>
                    <span>{error}</span>
                  </div>
                  <button 
                    onClick={handleRetry}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-black uppercase hover:bg-red-500 transition-colors shrink-0"
                  >
                    Riprova
                  </button>
                </div>
              )}

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
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Foto Profilo (Max 2MB)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome</label>
                    <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} disabled={currentUser?.role !== 'admin'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0 ${currentUser?.role !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cognome</label>
                    <input type="text" value={profileSurname} onChange={e => setProfileSurname(e.target.value)} disabled={currentUser?.role !== 'admin'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0 ${currentUser?.role !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                    <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data di Nascita</label>
                    <input 
                      type="date" 
                      value={profileBirthDate} 
                      onChange={e => {
                        setProfileBirthDate(e.target.value);
                        updateAutoQualification(e.target.value, profileQualification, setProfileQualification);
                      }} 
                      disabled={currentUser?.role === 'user'} 
                      className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0 ${currentUser?.role === 'user' ? 'opacity-50 cursor-not-allowed' : ''}`} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefono</label>
                    <input type="tel" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nuova Password (opzionale)</label>
                    <div className="relative">
                      <input 
                        type={showProfilePassword ? "text" : "password"} 
                        value={profilePassword} 
                        onChange={e => setProfilePassword(e.target.value)} 
                        placeholder="Lascia vuoto per non cambiare" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0" 
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
                    <SocietySearch 
                      value={profileSociety}
                      onChange={setProfileSociety}
                      societies={societies}
                      placeholder="Seleziona..."
                      disabled={currentUser?.role !== 'admin'}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      {currentUser?.role === 'society' ? 'Codice Società' : 'Codice Tiratore'}
                    </label>
                    <input 
                      type="text" 
                      required={currentUser?.role === 'society'} 
                      value={profileShooterCode} 
                      onChange={e => setProfileShooterCode(currentUser?.role !== 'society' ? e.target.value.toUpperCase() : e.target.value)} 
                      disabled={currentUser?.role !== 'admin'} 
                      pattern={currentUser?.role !== 'society' ? "[A-Z]{3}\\d{2}[A-Z]{2}\\d{2}" : undefined}
                      title={currentUser?.role !== 'society' ? "Formato richiesto: 3 lettere, 2 numeri, 2 lettere, 2 numeri (es. ABC12DE34)" : undefined}
                      placeholder={currentUser?.role !== 'society' ? "es. ABC12DE34" : ""}
                      className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''} ${currentUser?.role !== 'society' ? 'uppercase' : ''}`} 
                    />
                  </div>
                  {currentUser?.role !== 'society' && (
                    <>
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
                          <option value="Lady">Lady</option>
                          <option value="Junior">Junior</option>
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
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Installation Guide Section */}
              <div className="mb-12">
                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                  <i className="fas fa-mobile-alt text-orange-500"></i> Guida all'installazione
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  Clay Tracker Pro è una "Web App". Puoi installarla sul tuo telefono per usarla come una vera applicazione, senza dover passare dal browser ogni volta.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500">
                        <i className="fab fa-apple text-lg"></i>
                      </div>
                      <h4 className="font-bold text-white">iPhone / iPad (Safari)</h4>
                    </div>
                    <ul className="space-y-3 text-xs text-slate-400">
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                        <span>Tocca il tasto <span className="text-white font-bold">Condividi</span> <i className="fas fa-share-square text-blue-400 mx-0.5"></i> in basso al centro.</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                        <span>Scorri l'elenco e tocca <span className="text-white font-bold">"Aggiungi alla schermata Home"</span>.</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                        <span>Tocca <span className="text-white font-bold">"Aggiungi"</span> in alto a destra.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-500">
                        <i className="fab fa-android text-lg"></i>
                      </div>
                      <h4 className="font-bold text-white">Android (Chrome)</h4>
                    </div>
                    <ul className="space-y-3 text-xs text-slate-400">
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                        <span>Tocca i <span className="text-white font-bold">tre puntini</span> <i className="fas fa-ellipsis-v text-green-400 mx-0.5"></i> in alto a destra.</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                        <span>Seleziona <span className="text-white font-bold">"Installa applicazione"</span> o "Aggiungi a schermata Home".</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                        <span>Conferma cliccando su <span className="text-white font-bold">"Installa"</span>.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* FAQ Section */}
              <FAQSection role={currentUser?.role || 'user'} onReplayTour={onReplayTour} />
            </div>
          )}
        </div>
      ) : activeTab === 'team' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Gestione Squadre */}
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <i className="fas fa-users text-orange-500"></i> Gestione Squadre
              </h2>
            </div>

            {error && (
              <div className="bg-red-950/50 text-red-500 p-3 rounded-xl text-sm mb-4 border border-red-900/50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i>
                  <span>{error}</span>
                </div>
                <button 
                  onClick={() => setError('')}
                  className="text-red-500 hover:text-white transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}

            {showTeamForm && createPortal(
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                  <div className="p-6 sm:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                      <i className="fas fa-users text-orange-500"></i>
                      {editingTeam ? 'Modifica Squadra' : 'Nuova Squadra'}
                    </h3>
                    <button 
                      onClick={() => setShowTeamForm(false)}
                      className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>

                  <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto no-scrollbar">
                    <form onSubmit={handleCreateTeam} className="space-y-4 sm:space-y-6">
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
                      <SocietySearch 
                        value={newTeamSociety}
                        onChange={(val) => {
                          setNewTeamSociety(val);
                          setSelectedShooterIds([]);
                        }}
                        societies={societies}
                        placeholder="Seleziona..."
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
                    <select 
                      value={newTeamDiscipline} 
                      onChange={e => setNewTeamDiscipline(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm focus:border-orange-600 outline-none transition-all"
                    >
                      <option value="">Seleziona...</option>
                      {Object.values(Discipline).filter(d => d !== Discipline.TRAINING).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Titolo/Nome Gara</label>
                    <select 
                      value={newTeamEventId || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setNewTeamEventId(val || null);
                        
                        const selectedEvent = events.find(ev => String(ev.id) === val);
                        if (selectedEvent) {
                          setNewTeamCompetitionName(selectedEvent.name);
                          setNewTeamDiscipline(selectedEvent.discipline || '');
                          setNewTeamLocation(selectedEvent.location || '');
                          
                          // Format date for input type="date" (YYYY-MM-DD)
                          if (selectedEvent.start_date) {
                            try {
                              const d = new Date(selectedEvent.start_date);
                              if (!isNaN(d.getTime())) {
                                setNewTeamDate(d.toISOString().split('T')[0]);
                              }
                            } catch (err) {
                              console.error('Invalid date format:', selectedEvent.start_date);
                            }
                          }
                          
                          if (selectedEvent.targets) {
                            setNewTeamTargets(selectedEvent.targets);
                          }
                        } else {
                          setNewTeamCompetitionName('');
                          // Reset other fields if no event is selected
                          setNewTeamLocation('');
                          setNewTeamDiscipline('');
                        }
                      }} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm focus:border-orange-600 outline-none transition-all"
                    >
                      <option value="">Seleziona Gara...</option>
                      {events
                        .filter(ev => !newTeamDiscipline || ev.discipline === newTeamDiscipline)
                        .map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name} ({ev.location})</option>
                      ))}
                    </select>
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
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Totale Piattelli</label>
                    <input 
                      type="number" 
                      required 
                      value={newTeamTargets} 
                      onChange={e => setNewTeamTargets(parseInt(e.target.value))} 
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
                  <ShooterSearch 
                    value={selectedShooterIds}
                    onChange={(val) => {
                      if (Array.isArray(val)) {
                        if (val.length <= newTeamSize) {
                          setSelectedShooterIds(val);
                        } else {
                          if (triggerToast) {
                            triggerToast(`Puoi selezionare al massimo ${newTeamSize} tiratori.`, 'error');
                          }
                        }
                      }
                    }}
                    shooters={shooters}
                    useId={true}
                    multiple={true}
                    placeholder={`Cerca e aggiungi tiratori...`}
                  />
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
                        setNewTeamTargets(100);
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
            </div>
          </div>
        </div>,
        document.body
      )}

            {/* Elenco Squadre Esistenti */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map(team => (
                <div key={team.id} className="bg-slate-950/50 border border-slate-700 rounded-2xl p-3 group">
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
                          {societies.find(s => s.name === team.society)?.code && (
                            <span className="ml-1">({societies.find(s => s.name === team.society)?.code})</span>
                          )}
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
                    <h4 
                      onClick={() => handleEditTeam(team)}
                      className="text-base font-black text-white leading-tight truncate cursor-pointer hover:text-orange-500 transition-colors"
                    >
                      {team.name}
                    </h4>
                    {team.competition_name && (
                      <p 
                        onClick={() => handleEditTeam(team)}
                        className="text-[10px] text-slate-500 font-medium truncate cursor-pointer hover:text-orange-400 transition-colors"
                      >
                        {team.competition_name}
                      </p>
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
                                  value={editingScore?.score || 0}
                                  onChange={e => editingScore && setEditingScore({...editingScore, score: parseInt(e.target.value) || 0})}
                                  className="w-10 bg-transparent text-white text-xs font-black outline-none text-center"
                                />
                                <button 
                                  onClick={() => editingScore && handleUpdateScore(team.id, m.id, editingScore.score)}
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
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-xl">
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
                      <td className="py-3 px-4 text-[10px] text-slate-400 font-bold uppercase">
                        {s.society ? (
                          <>
                            {s.society}
                            {societies.find(soc => soc.name === s.society)?.code && (
                              <span className="text-orange-500 ml-1">({societies.find(soc => soc.name === s.society)?.code})</span>
                            )}
                          </>
                        ) : '-'}
                      </td>
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
        <div className="space-y-2">
          <div className="sticky top-16 sm:top-[104px] z-30 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-4 border-b border-slate-900/50 shadow-2xl transition-all">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <i className="fas fa-building text-orange-500"></i> {currentUser?.role === 'society' ? 'Elenco Società' : 'Gestione Società (TAV)'}
                </h2>
                {currentUser?.role === 'admin' && !showSocietyForm && (
                  <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                    <button 
                      onClick={handleExportSocietiesExcel}
                      className="px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 shrink-0"
                      title="Esporta"
                    >
                      <i className="fas fa-file-excel"></i>
                      <span>Esporta</span>
                    </button>
                    <label className="px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 cursor-pointer shrink-0" title="Aggiorna i codici delle società esistenti da un file Excel">
                      <i className="fas fa-sync-alt"></i>
                      <span>Aggiorna Codici</span>
                      <input type="file" accept=".xlsx, .xls" onChange={handleUpdateSocietiesCodesExcel} className="hidden" />
                    </label>
                    <label className="px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 cursor-pointer shrink-0">
                      <i className="fas fa-file-import"></i>
                      <span>Importa</span>
                      <input type="file" accept=".xlsx, .xls" onChange={handleImportSocietiesExcel} className="hidden" />
                    </label>
                  </div>
                )}
              </div>

              {!showSocietyForm && (
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    <input 
                      type="text" 
                      placeholder="Cerca società per nome, città o regione..." 
                      value={societySearch}
                      onChange={(e) => setSocietySearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-10 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all"
                    />
                    {societySearch && (
                      <button 
                        onClick={() => setSocietySearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                        title="Pulisci ricerca"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </div>
                  <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 shrink-0">
                    <button
                      onClick={() => setSocietyViewMode('list')}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${societyViewMode === 'list' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-800/50'}`}
                    >
                      <i className="fas fa-list mr-2"></i> Lista
                    </button>
                    <button
                      onClick={() => setSocietyViewMode('map')}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${societyViewMode === 'map' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-800/50'}`}
                    >
                      <i className="fas fa-map-marked-alt mr-2"></i> Mappa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4">
            {showSocietyForm && createPortal(
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                  <div className="p-6 sm:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                      <i className="fas fa-building text-orange-500"></i>
                      {editingSociety ? 'Modifica Società' : 'Nuova Società'}
                    </h3>
                    <button 
                      onClick={() => setShowSocietyForm(false)}
                      className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>

                  <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto no-scrollbar">
                    <form onSubmit={handleSocietySubmit} className="space-y-4 sm:space-y-6">
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
                        <div className="sm:col-span-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome TAV (Obbligatorio)</label>
                          <input type="text" required value={socName} onChange={e => setSocName(e.target.value)} disabled={currentUser?.role === 'society'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Codice Società (Obbligatorio)</label>
                          <input type="text" required value={socCode} onChange={e => setSocCode(e.target.value)} disabled={currentUser?.role === 'society'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`} />
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
                        <button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest shadow-lg shadow-orange-600/20">
                          {editingSociety ? 'Salva Modifiche' : 'Crea Società'}
                        </button>
                        <button type="button" onClick={() => setShowSocietyForm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest border border-slate-700">
                          Annulla
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>,
              document.body
            )}

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
                      {soc.name} {soc.code ? <span className="text-orange-500 font-bold ml-1">({soc.code})</span> : ''}
                      {currentUser?.role === 'admin' && (
                        <span 
                          className={`w-2 h-2 rounded-full ${soc.google_maps_link ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'}`} 
                          title={soc.google_maps_link ? "Link Google Maps presente" : "Link Google Maps mancante"}
                        ></span>
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
                        <h3 className="font-black text-white">{soc.name} {soc.code ? <span className="text-orange-500 font-bold ml-1">({soc.code})</span> : ''}</h3>
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
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100] flex items-center justify-center p-4" onClick={handleCloseSocietyDetail}>
              <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <div className="relative min-h-[160px] bg-slate-900 bg-gradient-to-br from-slate-900 to-slate-950 border-b border-slate-800 flex items-end p-4 sm:p-6 overflow-hidden">
                  {/* Decorative background elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -ml-16 -mb-16"></div>
                  
                  <button 
                    onClick={handleCloseSocietyDetail} 
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
                    {currentUser?.role === 'admin' && !selectedSociety.has_account && (
                      <button 
                        onClick={() => {
                          const soc = selectedSociety;
                          setSelectedSociety(null);
                          setActiveTab('users');
                          setShowUserForm(true);
                          setEditingUser(null);
                          setName(soc.name);
                          setSurname('TAV');
                          setEmail(soc.email || '');
                          setRole('society');
                          setSociety(soc.name);
                          setShooterCode(soc.code || '');
                          setPassword('');
                          setCategory('');
                          setQualification('');
                          setUserAvatar(soc.logo || '');
                          setBirthDate('');
                        }} 
                        className="w-full py-4 rounded-2xl bg-blue-600/20 text-blue-500 font-black text-xs uppercase tracking-widest hover:bg-blue-600/30 transition-all flex items-center justify-center gap-2 border border-blue-600/30 shadow-lg mb-2"
                      >
                        <i className="fas fa-user-plus"></i> Crea Account Società
                      </button>
                    )}
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
      </div>
      ) : activeTab === 'events' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <EventsManager 
            user={currentUser} 
            token={token} 
            triggerConfirm={triggerConfirm} 
            triggerToast={triggerToast}
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
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-start sm:justify-end overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border relative ${showFilters || hasActiveFilters ? 'bg-orange-600/10 border-orange-500/50 text-orange-500' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-orange-500 hover:border-slate-700'}`}
              >
                <i className={`fas ${showFilters ? 'fa-filter-slash' : 'fa-filter'}`}></i> Filtri
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                )}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-8 p-4 bg-slate-950/50 rounded-2xl border border-slate-800 animate-in zoom-in-95 duration-300">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tiratore</label>
                  <ShooterSearch 
                    value={filterShooter}
                    onChange={handleFilterChange(setFilterShooter)}
                    shooters={shooters}
                    placeholder="Tutti"
                  />
                </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società</label>
                <SocietySearch 
                  value={filterSociety}
                  onChange={handleFilterChange(setFilterSociety)}
                  societies={societies}
                  placeholder="Tutte"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
                <div className="relative group">
                  <select 
                    value={filterDiscipline} 
                    onChange={handleFilterChange(setFilterDiscipline)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                  >
                    <option value="">Tutte</option>
                    {filterOptions.disciplines.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <i className="fas fa-chevron-down text-[10px]"></i>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Campo</label>
                <div className="relative group">
                  <select 
                    value={filterLocation} 
                    onChange={handleFilterChange(setFilterLocation)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                  >
                    <option value="">Tutti</option>
                    {filterOptions.locations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <i className="fas fa-chevron-down text-[10px]"></i>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Anno</label>
                <div className="relative group">
                  <select 
                    value={filterYear} 
                    onChange={handleFilterChange(setFilterYear)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                  >
                    <option value="">Tutti</option>
                    {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <i className="fas fa-chevron-down text-[10px]"></i>
                  </div>
                </div>
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

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                  <th className="px-4 py-2 text-left">Tiratore</th>
                  <th className="px-4 py-2 text-left">Cat / Qual</th>
                  <th className="px-4 py-2 text-center">Gare</th>
                  <th className="px-4 py-2 text-center">Media Globale</th>
                  <th className="px-4 py-2 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {allResults.map((result) => {
                  const avg = result.totalTargets > 0 ? (result.totalScore / result.totalTargets) * 25 : 0;
                  
                  return (
                    <tr 
                      key={result.userId}
                      className="group bg-slate-950/40 hover:bg-slate-900/60 transition-all border border-slate-800/50 cursor-pointer"
                      onClick={async () => {
                        try {
                          const queryParams = new URLSearchParams({
                            search: filterShooter,
                            society: filterSociety,
                            discipline: filterDiscipline,
                            location: filterLocation,
                            year: filterYear
                          });
                          const res = await fetch(`/api/admin/shooter-results/${result.userId}?${queryParams.toString()}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setSelectedShooterResults({
                              userId: result.userId,
                              userName: result.userName,
                              userSurname: result.userSurname,
                              society: result.society,
                              category: result.category,
                              qualification: result.qualification,
                              shooter_code: result.shooter_code,
                              avatar: result.avatar,
                              results: data
                            });
                          }
                        } catch (err) {
                          console.error("Error fetching shooter results:", err);
                        }
                      }}
                    >
                      <td className="px-4 py-4 rounded-l-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-500 text-xs font-black">
                            {result.avatar ? (
                              <img src={result.avatar} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              `${result.userName?.[0] || ''}${result.userSurname?.[0] || ''}`
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors">
                              {result.userSurname} {result.userName}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                              {result.society || '-'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          {result.category || '-'} / {result.qualification || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-xs font-bold text-white">
                          {result.totalCompetitions}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="text-sm font-black text-orange-500">
                          {avg.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right rounded-r-2xl">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            e.currentTarget.parentElement?.parentElement?.click();
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-orange-500 hover:border-orange-500/50 transition-all flex items-center justify-center ml-auto"
                        >
                          <i className="fas fa-eye text-[10px]"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {allResults.length === 0 && (
            <div className="text-center py-20 bg-slate-950/30 rounded-3xl border border-dashed border-slate-800">
              <i className="fas fa-search text-4xl text-slate-800 mb-4"></i>
              <p className="text-slate-500 font-bold">Nessun risultato trovato con i filtri selezionati</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Pagina {resultsPage} di {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setResultsPage(prev => Math.max(1, prev - 1))}
                  disabled={resultsPage === 1}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (resultsPage <= 3) {
                      pageNum = i + 1;
                    } else if (resultsPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = resultsPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setResultsPage(pageNum)}
                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all border ${
                          resultsPage === pageNum 
                            ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20' 
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setResultsPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={resultsPage === totalPages}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          )}

          {selectedShooterResults && createPortal(
            <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedShooterResults(null)}>
              <div className="bg-slate-900 w-full h-full overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-orange-600/20">
                      {(selectedShooterResults.userName?.[0] || '')}{(selectedShooterResults.userSurname?.[0] || '')}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                        {selectedShooterResults.userSurname || ''} {selectedShooterResults.userName || ''}
                      </h2>
                      {selectedShooterResults.shooter_code && (
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em] mt-1">
                          {selectedShooterResults.shooter_code}
                        </p>
                      )}
                      <p className="text-xs font-black text-orange-500 uppercase tracking-[0.2em] mt-1">
                        {selectedShooterResults.society ? (
                          <>
                            {selectedShooterResults.society}
                            {societies.find(soc => soc.name === selectedShooterResults.society)?.code && (
                              <span className="ml-1">({societies.find(soc => soc.name === selectedShooterResults.society)?.code})</span>
                            )}
                          </>
                        ) : 'Nessuna Società'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedShooterResults(null)}
                      className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg"
                    >
                      <i className="fas fa-times text-lg"></i>
                    </button>
                  </div>
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
                          {results.map((r: any, idx: number) => {
                            const layoutObj = getSeriesLayout(r.discipline as Discipline);
                            const tps = layoutObj.layout.reduce((a, b) => a + b, 0);
                            const avg = r.totalTargets > 0 ? (r.totalScore / r.totalTargets) * tps : 0;
                            
                            return (
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
                                <h4 
                                  onClick={() => {
                                    if (onEditCompetition) {
                                      const mappedComp = {
                                        ...r,
                                        userId: r.user_id,
                                        userName: r.user_name,
                                        userSurname: r.user_surname,
                                        totalScore: r.totalscore,
                                        totalTargets: r.totaltargets,
                                        averagePerSeries: r.averageperseries,
                                        eventId: r.event_id,
                                        shootOff: r.shoot_off,
                                        endDate: r.enddate,
                                        detailedScores: typeof r.detailedscores === 'string' ? JSON.parse(r.detailedscores) : r.detailedscores,
                                        seriesImages: typeof r.seriesimages === 'string' ? JSON.parse(r.seriesimages) : r.seriesimages,
                                        usedCartridges: typeof r.usedcartridges === 'string' ? JSON.parse(r.usedcartridges) : r.usedcartridges,
                                        scores: typeof r.scores === 'string' ? JSON.parse(r.scores) : r.scores,
                                        weather: typeof r.weather === 'string' ? JSON.parse(r.weather) : r.weather,
                                        chokes: typeof r.chokes === 'string' ? JSON.parse(r.chokes) : r.chokes
                                      };
                                      onEditCompetition(mappedComp);
                                    }
                                  }}
                                  className="text-sm font-black text-white group-hover:text-orange-500 transition-colors uppercase tracking-tight truncate cursor-pointer"
                                >
                                  {r.name}
                                </h4>
                              </div>
                              
                              <div className="flex items-center justify-between sm:justify-end gap-6 relative z-10">
                                <div className="text-right">
                                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Media</p>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-orange-500">
                                      {avg.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Punteggio</p>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-white">{r.totalScore}</span>
                                    <span className="text-slate-600 font-black text-xs">/ {r.totalTargets}</span>
                                  </div>
                                </div>
                                
                                { currentUser?.role === 'admin' && (
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => {
                                        const userForShare: User = {
                                          id: selectedShooterResults.userId,
                                          name: selectedShooterResults.userName,
                                          surname: selectedShooterResults.userSurname,
                                          email: '',
                                          role: UserRole.SHOOTER,
                                          society: selectedShooterResults.society,
                                          category: selectedShooterResults.category,
                                          qualification: selectedShooterResults.qualification,
                                          avatar: selectedShooterResults.avatar
                                        };
                                        setShareData({ comp: r, user: userForShare });
                                      }}
                                      className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-500 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-lg shadow-blue-600/5"
                                      title="Condividi"
                                    >
                                      <i className="fas fa-share-alt text-xs"></i>
                                    </button>
                                    
                                    <button 
                                      onClick={() => {
                                        if (onEditCompetition) {
                                          const mappedComp = {
                                            ...r,
                                            userId: r.user_id,
                                            userName: r.user_name,
                                            userSurname: r.user_surname,
                                            totalScore: r.totalscore,
                                            totalTargets: r.totaltargets,
                                            averagePerSeries: r.averageperseries,
                                            eventId: r.event_id,
                                            shootOff: r.shoot_off,
                                            endDate: r.enddate,
                                            detailedScores: typeof r.detailedscores === 'string' ? JSON.parse(r.detailedscores) : r.detailedscores,
                                            seriesImages: typeof r.seriesimages === 'string' ? JSON.parse(r.seriesimages) : r.seriesimages,
                                            usedCartridges: typeof r.usedcartridges === 'string' ? JSON.parse(r.usedcartridges) : r.usedcartridges,
                                            scores: typeof r.scores === 'string' ? JSON.parse(r.scores) : r.scores,
                                            weather: typeof r.weather === 'string' ? JSON.parse(r.weather) : r.weather,
                                            chokes: typeof r.chokes === 'string' ? JSON.parse(r.chokes) : r.chokes
                                          };
                                          onEditCompetition(mappedComp);
                                        }
                                      }}
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
                                          async () => {
                                            if (onDeleteCompetition) {
                                              const success = await onDeleteCompetition(r.id);
                                              if (success !== false) {
                                                setAllResults(prev => prev.filter(res => res.id !== r.id));
                                                setSelectedShooterResults((prev: any) => ({
                                                  ...prev,
                                                  results: prev.results.filter((res: any) => res.id !== r.id)
                                                }));
                                              }
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
                            );
                          })}
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <i className="fas fa-users-cog text-orange-500"></i> {currentUser?.role === 'society' ? 'Gestione Tiratori' : 'Gestione Utenti'}
                {(loading || backgroundLoading) && <i className="fas fa-circle-notch fa-spin text-orange-500 text-xs ml-2"></i>}
              </h2>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                {totalUsers} {totalUsers === 1 ? 'Utente' : 'Utenti'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 lg:justify-end">
              {(currentUser?.role === 'admin' || currentUser?.role === 'society') && !showUserForm && (
                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                  {currentUser?.role === 'admin' && (
                    <>
                      <button 
                        onClick={() => setShowDashboard(!showDashboard)}
                        className={`w-11 h-11 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center sm:gap-2 border shrink-0 ${
                          showDashboard 
                            ? 'bg-orange-600/10 text-orange-500 border-orange-500/30' 
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border-slate-700'
                        }`}
                        title={showDashboard ? "Nascondi Dashboard" : "Mostra Dashboard"}
                      >
                        <i className={`fas ${showDashboard ? 'fa-chart-line' : 'fa-chart-bar'} text-lg sm:text-xs`}></i>
                        <span className="hidden sm:inline">Dashboard</span>
                      </button>
                      <button 
                        onClick={handleDownloadTemplate}
                        className="w-11 h-11 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center sm:gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 shrink-0"
                        title="Scarica Modello"
                      >
                        <i className="fas fa-file-download text-lg sm:text-xs"></i>
                        <span className="hidden sm:inline">Modello</span>
                      </button>
                      <button 
                        onClick={handleExportUsersExcel}
                        className="w-11 h-11 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center sm:gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 shrink-0"
                        title="Esporta"
                      >
                        <i className="fas fa-file-excel text-lg sm:text-xs"></i>
                        <span className="hidden sm:inline">Esporta</span>
                      </button>
                      <label className="w-11 h-11 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center sm:gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 cursor-pointer shrink-0">
                        <i className="fas fa-file-import text-lg sm:text-xs"></i>
                        <span className="hidden sm:inline">Importa</span>
                        <input type="file" accept=".xlsx, .xls" onChange={handleImportUsersExcel} className="hidden" />
                      </label>
                    </>
                  )}
                </div>
              )}
              <div className="relative flex-1 flex items-center gap-3">
                <UserSearchInput 
                  placeholder={currentUser?.role === 'society' ? "Cerca per nome, codice..." : "Cerca per nome, società, codice..."} 
                  value={userSearchTerm}
                  onChange={(val) => {
                    setUserSearchTerm(val);
                    setUsersPage(1);
                  }}
                />
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => {
                      setFilterRole(prev => prev === 'society' ? '' : 'society');
                      setUsersPage(1);
                    }}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border shrink-0 ${
                      filterRole === 'society' 
                        ? 'bg-orange-600 text-white border-orange-500' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                    title="Filtra per Ruolo Società"
                  >
                    <i className="fas fa-building"></i>
                    <span className="hidden sm:inline">Società</span>
                  </button>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={usersPerPage}
                    onChange={(e) => {
                      setUsersPerPage(Number(e.target.value));
                      setUsersPage(1);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 text-[10px] font-black text-slate-400 uppercase focus:outline-none focus:border-orange-500/50"
                  >
                    <option value={25}>25 / pag</option>
                    <option value={50}>50 / pag</option>
                    <option value={100}>100 / pag</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-950/50 text-red-500 p-3 rounded-xl text-sm mb-4 border border-red-900/50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <i className="fas fa-exclamation-circle"></i>
                <span>{error}</span>
              </div>
              <button 
                onClick={handleRetry}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-black uppercase hover:bg-red-500 transition-colors shrink-0"
              >
                Riprova
              </button>
            </div>
          )}

          {/* User Management Dashboard */}
          {currentUser?.role === 'admin' && showDashboard && (
            <div className="mb-8 animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600/20 flex items-center justify-center">
                    <i className="fas fa-chart-pie text-orange-500"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">KPI Dashboard</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Statistiche di utilizzo piattaforma</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1">
                    {[
                      { id: 'day', label: 'Giorno' },
                      { id: 'week', label: 'Settimana' },
                      { id: 'month', label: 'Mese' },
                      { id: 'year', label: 'Anno' },
                      { id: 'total', label: 'Totale' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setKpiFilter(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                          kpiFilter === f.id 
                            ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl flex items-center sm:block gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 sm:mb-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                      <i className="fas fa-user-check text-green-500 text-xs"></i>
                    </div>
                    <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">Utenti Online</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    {(fetchedDashboardStats || dashboardStats).onlineUsersCount}
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl flex items-center sm:block gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 sm:mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <i className="fas fa-building text-blue-500 text-xs"></i>
                    </div>
                    <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">Società Online</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    {(fetchedDashboardStats || dashboardStats).onlineSocietiesCount}
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <i className="fas fa-star text-orange-500 text-xs"></i>
                    </div>
                    <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">Top Tiratore (Accessi)</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {(fetchedDashboardStats || dashboardStats).topUserName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                    {(fetchedDashboardStats || dashboardStats).topUserLogins} Accessi
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <i className="fas fa-trophy text-purple-500 text-xs"></i>
                    </div>
                    <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">Top Società (Accessi)</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {(fetchedDashboardStats || dashboardStats).topSocName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                    {(fetchedDashboardStats || dashboardStats).topSocLogins} Accessi
                  </div>
                </div>
              </div>

              {/* Second row of KPIs for Activity */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3 sm:mt-4">
                <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <i className="fas fa-bullseye text-emerald-500 text-xs"></i>
                    </div>
                    <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">Top Tiratore (Gare)</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {(fetchedDashboardStats || dashboardStats).topUserByResultsName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                    {(fetchedDashboardStats || dashboardStats).topUserResultsCount} Gare Inserite
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <i className="fas fa-landmark text-indigo-500 text-xs"></i>
                    </div>
                    <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">Top Società (Gare)</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {(fetchedDashboardStats || dashboardStats).topSocByResultsName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                    {(fetchedDashboardStats || dashboardStats).topSocResultsCount} Gare Totali
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <i className="fas fa-chart-line text-amber-500 text-xs"></i>
                    </div>
                    <span className="hidden sm:inline text-[10px] font-black text-slate-500 uppercase tracking-widest">Volume Attività (Piattelli)</span>
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {(fetchedDashboardStats || dashboardStats).topUserByTargetsName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                    {(fetchedDashboardStats || dashboardStats).topUserTargetsTotal} Piattelli Sparati
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-3 sm:p-4 rounded-2xl flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Activity KPI</div>
                    <div className="text-[10px] text-slate-700 italic">Monitoraggio Attivo</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showUserForm && createPortal(
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <i className={`fas ${editingUser ? 'fa-user-edit' : 'fa-user-plus'} text-orange-500`}></i> 
                    {editingUser ? (currentUser?.role === 'society' ? 'Modifica Tiratore' : 'Modifica Utente') : (currentUser?.role === 'society' ? 'Nuovo Tiratore' : 'Nuovo Utente')}
                  </h3>
                  <button onClick={() => { setShowUserForm(false); setEditingUser(null); setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); setShooterCode(''); setUserAvatar(''); setBirthDate(''); setPhone(''); }} className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95 shadow-lg border border-slate-700">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                
                <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <form id="admin-user-form" onSubmit={handleSubmit} className="space-y-4">
                    
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

              <div className="space-y-4 mb-6">
                {/* Row 1: Ruolo, Società, Codice */}
                <div className={`grid grid-cols-1 ${currentUser?.role !== 'society' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
                  {currentUser?.role !== 'society' && (
                    <div>
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
                  )}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società</label>
                    <SocietySearch 
                      value={society}
                      onChange={setSociety}
                      societies={societies}
                      placeholder="Seleziona..."
                      disabled={currentUser?.role === 'society' && !!editingUser}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      {role === 'society' ? 'Codice Società (Obbligatorio)' : 'Codice Tiratore'}
                    </label>
                    <input 
                      type="text" 
                      required={role === 'society'} 
                      value={shooterCode} 
                      onChange={e => setShooterCode(role === 'user' ? e.target.value.toUpperCase() : e.target.value)} 
                      disabled={currentUser?.role === 'society' && !!editingUser}
                      pattern={role === 'user' ? "[A-Z]{3}\\d{2}[A-Z]{2}\\d{2}" : undefined}
                      title={role === 'user' ? "Formato richiesto: 3 lettere, 2 numeri, 2 lettere, 2 numeri (es. ABC12DE34)" : undefined}
                      placeholder={role === 'user' ? "es. ABC12DE34" : ""}
                      className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role === 'society' && !!editingUser ? 'opacity-50 cursor-not-allowed' : ''} ${role === 'user' ? 'uppercase' : ''}`} 
                    />
                  </div>
                </div>

                {/* Row 2: Nome, Cognome */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome</label>
                    <input 
                      type="text" 
                      required 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      disabled={currentUser?.role === 'society' && !!editingUser}
                      className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0 ${currentUser?.role === 'society' && !!editingUser ? 'opacity-50 cursor-not-allowed' : ''}`} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cognome</label>
                    <input 
                      type="text" 
                      required 
                      value={surname} 
                      onChange={e => setSurname(e.target.value)} 
                      disabled={currentUser?.role === 'society' && !!editingUser}
                      className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0 ${currentUser?.role === 'society' && !!editingUser ? 'opacity-50 cursor-not-allowed' : ''}`} 
                    />
                  </div>
                </div>

                {/* Row 3: Data di Nascita, Telefono */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data di Nascita</label>
                    <input 
                      type="date" 
                      value={birthDate} 
                      onChange={e => {
                        setBirthDate(e.target.value);
                        updateAutoQualification(e.target.value, qualification, setQualification);
                      }} 
                      disabled={currentUser?.role === 'society' && !!editingUser}
                      className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0 ${currentUser?.role === 'society' && !!editingUser ? 'opacity-50 cursor-not-allowed' : ''}`} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefono</label>
                    <input 
                      type="tel" 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)} 
                      disabled={currentUser?.role === 'society'}
                      className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0 ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`} 
                    />
                  </div>
                </div>

                {/* Row 4: Categoria, Qualifica */}
                {role !== 'society' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <option value="Lady">Lady</option>
                        <option value="Junior">Junior</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Row 5: Email, Password */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password {editingUser && '(lascia vuoto per non cambiare)'}</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required={!editingUser} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 pr-10 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
                  </form>
                </div>
                
                <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
                  <button type="button" onClick={() => { setShowUserForm(false); setEditingUser(null); setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); setShooterCode(''); setUserAvatar(''); setBirthDate(''); setPhone(''); }} className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                    Annulla
                  </button>
                  <button type="submit" form="admin-user-form" className="bg-orange-600 hover:bg-orange-500 text-white font-black py-3 px-6 rounded-xl transition-all active:scale-95 text-xs uppercase shadow-lg shadow-orange-900/20">
                    {editingUser ? 'Salva Modifiche' : (currentUser?.role === 'society' ? 'Crea Tiratore' : 'Crea Utente')}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('name')}>
                    Nome {userSortConfig?.key === 'name' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('shooter_code')}>
                    Codice Tiratore {userSortConfig?.key === 'shooter_code' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('society')}>
                    Società {userSortConfig?.key === 'society' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('category')}>
                    Cat./Qual. {userSortConfig?.key === 'category' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('email')}>
                    Email {userSortConfig?.key === 'email' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                  </th>
                  {currentUser?.role !== 'society' && (
                    <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('role')}>
                      Ruolo {userSortConfig?.key === 'role' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                    </th>
                  )}
                  <th className="py-3 px-4 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map(u => (
                  <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4 text-sm text-white font-bold">
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:text-orange-500 transition-colors"
                        onClick={() => setSelectedUser(u)}
                      >
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
                    <td className="py-3 px-4 text-[10px] text-slate-400 font-bold uppercase">{u.shooter_code || '-'}</td>
                    <td className="py-3 px-4 text-[10px] text-slate-400 font-bold uppercase">
                      {u.society ? (
                        <>
                          {u.society}
                          {societies.find(s => s.name === u.society)?.code && (
                            <span className="text-orange-500 ml-1">({societies.find(s => s.name === u.society)?.code})</span>
                          )}
                        </>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4 text-[10px] text-slate-400 font-bold uppercase">{u.category || '-'} / {u.qualification || '-'}</td>
                    <td className="py-3 px-4 text-sm text-slate-400">{u.email}</td>
                    {currentUser?.role !== 'society' && (
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${u.role === 'admin' ? 'bg-orange-500/20 text-orange-500' : u.role === 'society' ? 'bg-blue-500/20 text-blue-500' : 'bg-slate-800 text-slate-400'}`}>
                          {u.role === 'user' ? 'Tiratore' : u.role === 'society' ? 'Società' : 'Admin'}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 flex justify-end gap-3">
                      {currentUser?.role === 'admin' && (
                        <button 
                          onClick={() => handleToggleStatus(u.id, u.status)} 
                          disabled={u.email === 'snecaj@gmail.com'}
                          className={`w-11 h-11 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 ${
                            u.status === 'suspended' 
                              ? 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white' 
                              : 'bg-red-500/5 text-red-500/60 hover:bg-red-600 hover:text-white'
                          }`}
                          title={u.status === 'suspended' ? "Riattiva" : "Sospendi"}
                        >
                          <i className={`fas ${u.status === 'suspended' ? 'fa-user-check' : 'fa-user-slash'} text-sm sm:text-xs`}></i>
                        </button>
                      )}
                      <button 
                        onClick={() => { editUser(u); setShowUserForm(true); }} 
                        disabled={currentUser?.role === 'society' && u.role === 'admin'}
                        className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg bg-orange-600/10 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all disabled:opacity-30"
                        title={currentUser?.role === 'society' && u.role === 'admin' ? "Non puoi modificare un Admin" : "Modifica"}
                      >
                        <i className="fas fa-edit text-sm sm:text-xs"></i>
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)} 
                        disabled={u.email === 'snecaj@gmail.com' || currentUser?.role === 'society'} 
                        className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all disabled:opacity-30"
                        title={currentUser?.role === 'society' ? "Solo l'amministratore può eliminare gli utenti" : (u.email === 'snecaj@gmail.com' ? "Non puoi eliminare l'account principale" : "Elimina")}
                      >
                        <i className="fas fa-trash-alt text-sm sm:text-xs"></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {sortedUsers.length === 0 && (
                  <tr>
                    <td colSpan={currentUser?.role === 'society' ? 6 : 7} className="py-8 text-center text-slate-500 text-sm italic">
                      Nessun utente trovato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* User Pagination Controls */}
          {totalUsers > usersPerPage && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Pagina {usersPage} di {Math.ceil(totalUsers / usersPerPage)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUsersPage(prev => Math.max(1, prev - 1))}
                  disabled={usersPage === 1}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil(totalUsers / usersPerPage)) }, (_, i) => {
                    const totalPages = Math.ceil(totalUsers / usersPerPage);
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (usersPage <= 3) {
                      pageNum = i + 1;
                    } else if (usersPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = usersPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setUsersPage(pageNum)}
                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all border ${
                          usersPage === pageNum 
                            ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20' 
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setUsersPage(prev => Math.min(Math.ceil(totalUsers / usersPerPage), prev + 1))}
                  disabled={usersPage === Math.ceil(totalUsers / usersPerPage)}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          )}

          {selectedUser && createPortal(
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100] flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
              <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <div className="relative min-h-[160px] bg-slate-900 bg-gradient-to-br from-slate-900 to-slate-950 border-b border-slate-800 flex items-end p-4 sm:p-6 overflow-hidden">
                  {/* Decorative background elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -ml-16 -mb-16"></div>
                  
                  <button 
                    onClick={() => setSelectedUser(null)} 
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg z-20"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                  
                  <div className="relative z-10 w-full pr-10 sm:pr-0">
                    <div className="flex items-end gap-4 translate-y-6">
                      <div 
                        className={`w-24 h-24 rounded-2xl bg-slate-900 border-4 border-slate-950 flex items-center justify-center shadow-xl overflow-hidden ${
                          selectedUser.is_logged_in 
                            ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                            : ''
                        }`}
                      >
                        {selectedUser.avatar ? (
                          <img src={selectedUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <i className="fas fa-user text-3xl text-slate-600"></i>
                        )}
                      </div>
                      <div className="mb-2">
                        <h2 className="text-xl sm:text-2xl font-black text-white leading-tight uppercase italic tracking-tighter break-words">{selectedUser.name} {selectedUser.surname}</h2>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${selectedUser.role === 'admin' ? 'bg-orange-500/20 text-orange-500' : selectedUser.role === 'society' ? 'bg-blue-500/20 text-blue-500' : 'bg-slate-800 text-slate-400'}`}>
                            {selectedUser.role === 'user' ? 'Tiratore' : selectedUser.role === 'society' ? 'Società' : 'Admin'}
                          </span>
                          {selectedUser.is_logged_in && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-md uppercase bg-green-500/20 text-green-500 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 pt-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                    {selectedUser.email && (
                      <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Email</p>
                        <p className="text-sm font-bold text-white break-all">{selectedUser.email}</p>
                      </div>
                    )}
                    {selectedUser.phone && (
                      <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Telefono</p>
                        <p className="text-sm font-bold text-white">{selectedUser.phone}</p>
                      </div>
                    )}
                    {selectedUser.birth_date && (
                      <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Data di Nascita</p>
                        <p className="text-sm font-bold text-white">
                          {new Date(selectedUser.birth_date).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                    )}
                    {selectedUser.society && (
                      <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Società</p>
                        <p className="text-sm font-bold text-white flex items-center gap-2">
                          <i className="fas fa-building text-orange-500"></i>
                          {selectedUser.society}
                          {societies.find(s => s.name === selectedUser.society)?.code && (
                            <span className="text-slate-400">({societies.find(s => s.name === selectedUser.society)?.code})</span>
                          )}
                        </p>
                      </div>
                    )}
                    {selectedUser.shooter_code && (
                      <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                          {selectedUser.role === 'society' ? 'Codice Società' : 'Codice Tiratore'}
                        </p>
                        <p className="text-sm font-bold text-white uppercase">{selectedUser.shooter_code}</p>
                      </div>
                    )}
                    {selectedUser.category && (
                      <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Categoria</p>
                        <p className="text-sm font-bold text-white">{selectedUser.category}</p>
                      </div>
                    )}
                    {selectedUser.qualification && (
                      <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Qualifica</p>
                        <p className="text-sm font-bold text-white">{selectedUser.qualification}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-800">
                    {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
                      <button 
                        onClick={() => {
                          setSelectedUser(null);
                          editUser(selectedUser);
                          setShowUserForm(true);
                        }} 
                        disabled={currentUser?.role === 'society' && selectedUser.role === 'admin'}
                        className="flex-1 py-4 rounded-2xl bg-slate-800 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title={currentUser?.role === 'society' && selectedUser.role === 'admin' ? "Non puoi modificare un Admin" : "Modifica"}
                      >
                        <i className="fas fa-edit"></i> Modifica
                      </button>
                    )}
                    {currentUser?.role === 'admin' && (
                      <button 
                        onClick={() => {
                          setSelectedUser(null);
                          handleDelete(selectedUser.id);
                        }} 
                        disabled={selectedUser.email === 'snecaj@gmail.com' || currentUser?.role === 'society'}
                        className="flex-1 py-4 rounded-2xl bg-red-900/30 text-red-500 font-black text-xs uppercase tracking-widest hover:bg-red-900/50 transition-all flex items-center justify-center gap-2 border border-red-900/50 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title={currentUser?.role === 'society' ? "Solo l'amministratore può eliminare gli utenti" : (selectedUser.email === 'snecaj@gmail.com' ? "Non puoi eliminare l'account principale" : "Elimina")}
                      >
                        <i className="fas fa-trash-alt"></i> Elimina
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          , document.body)}
        </div>
      )}
      {/* Floating Add Button for Competitions */}
      {activeTab === 'results' && currentUser?.role === 'admin' && (
        <button 
          onClick={() => onEditCompetition && onEditCompetition()}
          className="fixed bottom-8 right-8 w-16 h-16 bg-orange-600 shadow-orange-600/40 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-all active:scale-95 z-40 floating-add-btn group"
          title="Aggiungi Gara"
        >
          <i className="fas fa-plus text-2xl group-hover:rotate-90 transition-transform duration-300"></i>
        </button>
      )}
      {/* Floating Add Button for Teams */}
      {activeTab === 'team' && (currentUser?.role === 'admin' || currentUser?.role === 'society') && (
        <button 
          onClick={() => {
            if (showTeamForm) {
              setShowTeamForm(false);
            } else {
              setShowTeamForm(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              if (currentUser?.role === 'society' && currentUser?.society) {
                setNewTeamSociety(currentUser.society);
              } else {
                setNewTeamSociety('');
              }
            }
          }}
          className={`fixed bottom-8 right-8 w-16 h-16 ${showTeamForm ? 'bg-orange-500 shadow-orange-500/40' : 'bg-orange-600 shadow-orange-600/40'} rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-all active:scale-95 z-40 floating-add-btn group`}
          title={showTeamForm ? 'Chiudi' : 'Nuova Squadra'}
        >
          <i className={`fas ${showTeamForm ? 'fa-times' : 'fa-plus'} text-2xl group-hover:rotate-90 transition-transform duration-300`}></i>
        </button>
      )}
      {/* Floating Add Button for Users */}
      {activeTab === 'users' && (currentUser?.role === 'admin' || currentUser?.role === 'society') && (
        <button 
          onClick={() => { 
            if (showUserForm) {
              setShowUserForm(false);
              setEditingUser(null);
            } else {
              setEditingUser(null);
              setShowUserForm(true);
              if (currentUser?.role === 'society') {
                setSociety(currentUser.society);
                setRole('user');
              }
            }
          }}
          className={`fixed bottom-8 right-8 w-16 h-16 ${showUserForm ? 'bg-orange-500 shadow-orange-500/40' : 'bg-orange-600 shadow-orange-600/40'} rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-all active:scale-95 z-40 floating-add-btn group`}
          title={showUserForm ? 'Chiudi' : (currentUser?.role === 'society' ? 'Nuovo Tiratore' : 'Nuovo Utente')}
        >
          <i className={`fas ${showUserForm ? 'fa-times' : 'fa-plus'} text-2xl group-hover:rotate-90 transition-transform duration-300`}></i>
        </button>
      )}
      {/* Floating Add Button for Societies */}
      {activeTab === 'societies' && currentUser?.role === 'admin' && (
        <button 
          onClick={() => {
            if (!showSocietyForm) {
              setEditingSociety(null);
              setSocName('');
              setSocCode('');
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
      {shareData && (
        <ShareCard 
          competition={shareData.comp} 
          societies={societies}
          user={shareData.user} 
          onClose={() => setShareData(null)} 
        />
      )}
    </div>
  );
};

export default AdminPanel;
