import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { User, UserRole, SocietyEvent, Competition } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { supabase } from '../lib/supabase';

interface AdminContextType {
  // Auth & User Info
  currentUser: User | null;
  token: string;

  // Users
  users: any[];
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  allUsers: any[];
  setAllUsers: React.Dispatch<React.SetStateAction<any[]>>;
  totalUsers: number;
  usersPage: number;
  setUsersPage: React.Dispatch<React.SetStateAction<number>>;
  usersPerPage: number;
  setUsersPerPage: React.Dispatch<React.SetStateAction<number>>;
  userSearchTerm: string;
  setUserSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  filterRole: string;
  setFilterRole: React.Dispatch<React.SetStateAction<string>>;
  userFilterSociety: string;
  setUserFilterSociety: React.Dispatch<React.SetStateAction<string>>;
  fetchUsers: (signal?: AbortSignal, isBackground?: boolean) => Promise<void>;
  fetchAllUsers: (signal?: AbortSignal) => Promise<void>;

  // Teams
  teams: any[];
  setTeams: React.Dispatch<React.SetStateAction<any[]>>;
  teamStats: any[];
  setTeamStats: React.Dispatch<React.SetStateAction<any[]>>;
  fetchTeams: (signal?: AbortSignal, isBackground?: boolean) => Promise<void>;
  fetchTeamStats: (signal?: AbortSignal, isBackground?: boolean) => Promise<void>;

  // Societies
  societies: any[];
  setSocieties: React.Dispatch<React.SetStateAction<any[]>>;
  selectedSociety: any | null;
  setSelectedSociety: React.Dispatch<React.SetStateAction<any | null>>;
  societySearch: string;
  setSocietySearch: React.Dispatch<React.SetStateAction<string>>;
  societyRegionSearch: string;
  setSocietyRegionSearch: React.Dispatch<React.SetStateAction<string>>;
  societyViewMode: 'list' | 'map';
  setSocietyViewMode: React.Dispatch<React.SetStateAction<'list' | 'map'>>;
  fetchSocieties: (signal?: AbortSignal, isBackground?: boolean) => Promise<void>;

  // Events
  events: SocietyEvent[];
  setEvents: React.Dispatch<React.SetStateAction<SocietyEvent[]>>;
  fetchEvents: (signal?: AbortSignal) => Promise<void>;

  // Results
  allResults: any[];
  setAllResults: React.Dispatch<React.SetStateAction<any[]>>;
  totalResults: number;
  resultsPage: number;
  setResultsPage: React.Dispatch<React.SetStateAction<number>>;
  resultsPerPage: number;
  filterShooter: string;
  setFilterShooter: React.Dispatch<React.SetStateAction<string>>;
  filterSociety: string;
  setFilterSociety: React.Dispatch<React.SetStateAction<string>>;
  filterDiscipline: string;
  setFilterDiscipline: React.Dispatch<React.SetStateAction<string>>;
  filterLocation: string;
  setFilterLocation: React.Dispatch<React.SetStateAction<string>>;
  filterYear: string;
  setFilterYear: React.Dispatch<React.SetStateAction<string>>;
  filterMonth: string;
  setFilterMonth: React.Dispatch<React.SetStateAction<string>>;
  filterDate: string;
  setFilterDate: React.Dispatch<React.SetStateAction<string>>;
  filterCategory: string;
  setFilterCategory: React.Dispatch<React.SetStateAction<string>>;
  filterQualification: string;
  setFilterQualification: React.Dispatch<React.SetStateAction<string>>;
  fetchAllResults: (signal?: AbortSignal, isBackground?: boolean) => Promise<void>;

  // Global State
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  backgroundLoading: boolean;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  handleRetry: () => void;

  // UI State
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  hideInternalFAB: boolean;
  setHideInternalFAB: React.Dispatch<React.SetStateAction<boolean>>;
  showUserForm: boolean;
  setShowUserForm: React.Dispatch<React.SetStateAction<boolean>>;
  editingUser: any | null;
  setEditingUser: React.Dispatch<React.SetStateAction<any | null>>;
  selectedUser: any | null;
  setSelectedUser: React.Dispatch<React.SetStateAction<any | null>>;
  showProfilePassword: boolean;
  setShowProfilePassword: React.Dispatch<React.SetStateAction<boolean>>;
  profileSubTab: 'details' | 'help' | 'events';
  setProfileSubTab: React.Dispatch<React.SetStateAction<'details' | 'help' | 'events'>>;
  showSocietyForm: boolean;
  setShowSocietyForm: React.Dispatch<React.SetStateAction<boolean>>;
  editingSociety: any | null;
  setEditingSociety: React.Dispatch<React.SetStateAction<any | null>>;
  selectedTeamForSheet: any | null;
  setSelectedTeamForSheet: React.Dispatch<React.SetStateAction<any | null>>;
  selectedTeamSheetAction: 'print' | 'download' | null;
  setSelectedTeamSheetAction: React.Dispatch<React.SetStateAction<'print' | 'download' | null>>;
  showTeamForm: boolean;
  setShowTeamForm: React.Dispatch<React.SetStateAction<boolean>>;
  editingTeam: any | null;
  setEditingTeam: React.Dispatch<React.SetStateAction<any | null>>;
  editingScore: { teamId: number, userId: number, score: number } | null;
  setEditingScore: React.Dispatch<React.SetStateAction<{ teamId: number, userId: number, score: number } | null>>;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  selectedShooterResults: any | null;
  setSelectedShooterResults: React.Dispatch<React.SetStateAction<any | null>>;
  shareData: { comp: Competition, user: User } | null;
  setShareData: React.Dispatch<React.SetStateAction<{ comp: Competition, user: User } | null>>;

  // Form Fields - Society
  socName: string; setSocName: React.Dispatch<React.SetStateAction<string>>;
  socCode: string; setSocCode: React.Dispatch<React.SetStateAction<string>>;
  socEmail: string; setSocEmail: React.Dispatch<React.SetStateAction<string>>;
  socAddress: string; setSocAddress: React.Dispatch<React.SetStateAction<string>>;
  socCity: string; setSocCity: React.Dispatch<React.SetStateAction<string>>;
  socRegion: string; setSocRegion: React.Dispatch<React.SetStateAction<string>>;
  socZip: string; setSocZip: React.Dispatch<React.SetStateAction<string>>;
  socPhone: string; setSocPhone: React.Dispatch<React.SetStateAction<string>>;
  socMobile: string; setSocMobile: React.Dispatch<React.SetStateAction<string>>;
  socWebsite: string; setSocWebsite: React.Dispatch<React.SetStateAction<string>>;
  socContactName: string; setSocContactName: React.Dispatch<React.SetStateAction<string>>;
  socLogo: string; setSocLogo: React.Dispatch<React.SetStateAction<string>>;
  socOpeningHours: string; setSocOpeningHours: React.Dispatch<React.SetStateAction<string>>;
  socGoogleMapsLink: string; setSocGoogleMapsLink: React.Dispatch<React.SetStateAction<string>>;
  socLat: string; setSocLat: React.Dispatch<React.SetStateAction<string>>;
  socLng: string; setSocLng: React.Dispatch<React.SetStateAction<string>>;
  socDisciplines: string[]; setSocDisciplines: React.Dispatch<React.SetStateAction<string[]>>;

  // Form Fields - Team
  newTeamName: string; setNewTeamName: React.Dispatch<React.SetStateAction<string>>;
  newTeamSize: 3 | 6; setNewTeamSize: React.Dispatch<React.SetStateAction<3 | 6>>;
  newTeamEventId: string | null; setNewTeamEventId: React.Dispatch<React.SetStateAction<string | null>>;
  newTeamCompetitionName: string; setNewTeamCompetitionName: React.Dispatch<React.SetStateAction<string>>;
  newTeamDiscipline: string; setNewTeamDiscipline: React.Dispatch<React.SetStateAction<string>>;
  newTeamSociety: string; setNewTeamSociety: React.Dispatch<React.SetStateAction<string>>;
  newTeamLocation: string; setNewTeamLocation: React.Dispatch<React.SetStateAction<string>>;
  newTeamDate: string; setNewTeamDate: React.Dispatch<React.SetStateAction<string>>;
  newTeamTargets: number; setNewTeamTargets: React.Dispatch<React.SetStateAction<number>>;
  selectedShooterIds: number[]; setSelectedShooterIds: React.Dispatch<React.SetStateAction<number[]>>;

  // Filter Options
  filterOptions: {
    disciplines: string[];
    locations: string[];
    years: string[];
  };
  setFilterOptions: React.Dispatch<React.SetStateAction<any>>;
  fetchFilterOptions: (signal?: AbortSignal) => Promise<void>;

  // Form Fields
  name: string; setName: React.Dispatch<React.SetStateAction<string>>;
  surname: string; setSurname: React.Dispatch<React.SetStateAction<string>>;
  email: string; setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string; setPassword: React.Dispatch<React.SetStateAction<string>>;
  role: string; setRole: React.Dispatch<React.SetStateAction<string>>;
  category: string; setCategory: React.Dispatch<React.SetStateAction<string>>;
  qualification: string; setQualification: React.Dispatch<React.SetStateAction<string>>;
  society: string; setSociety: React.Dispatch<React.SetStateAction<string>>;
  shooterCode: string; setShooterCode: React.Dispatch<React.SetStateAction<string>>;
  userAvatar: string; setUserAvatar: React.Dispatch<React.SetStateAction<string>>;
  birthDate: string; setBirthDate: React.Dispatch<React.SetStateAction<string>>;
  phone: string; setPhone: React.Dispatch<React.SetStateAction<string>>;
  nationality: string; setNationality: React.Dispatch<React.SetStateAction<string>>;
  internationalId: string; setInternationalId: React.Dispatch<React.SetStateAction<string>>;
  originalClub: string; setOriginalClub: React.Dispatch<React.SetStateAction<string>>;
  isInternational: boolean; setIsInternational: React.Dispatch<React.SetStateAction<boolean>>;
  isEmailVerified: boolean; setIsEmailVerified: React.Dispatch<React.SetStateAction<boolean>>;

  // Dashboard
  showDashboard: boolean;
  setShowDashboard: React.Dispatch<React.SetStateAction<boolean>>;
  kpiFilter: string;
  setKpiFilter: React.Dispatch<React.SetStateAction<string>>;
  fetchedDashboardStats: any | null;
  dashboardStats: any;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{
  children: React.ReactNode;
  user: User | null;
  token: string;
  initialSocieties?: any[];
  initialTab?: string;
  triggerToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ children, user: currentUser, token, initialSocieties, initialTab, triggerToast }) => {
  const [activeTab, setActiveTab] = useState(initialTab || (currentUser?.role === 'admin' || currentUser?.role === 'society' ? 'results' : 'profile'));
  const [hideInternalFAB, setHideInternalFAB] = useState(false);
  
  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(25);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const debouncedUserSearchTerm = useDebounce(userSearchTerm, 500);
  const [filterRole, setFilterRole] = useState('');
  const [userFilterSociety, setUserFilterSociety] = useState('');

  const usersPageRef = useRef(usersPage);
  const usersPerPageRef = useRef(usersPerPage);
  const userSearchTermRef = useRef(userSearchTerm);
  const filterRoleRef = useRef(filterRole);
  const userFilterSocietyRef = useRef(userFilterSociety);

  useEffect(() => { usersPageRef.current = usersPage; }, [usersPage]);
  useEffect(() => { usersPerPageRef.current = usersPerPage; }, [usersPerPage]);
  useEffect(() => { userSearchTermRef.current = userSearchTerm; }, [userSearchTerm]);
  useEffect(() => { filterRoleRef.current = filterRole; }, [filterRole]);
  useEffect(() => { userFilterSocietyRef.current = userFilterSociety; }, [userFilterSociety]);

  // Teams State
  const [teams, setTeams] = useState<any[]>([]);
  const [teamStats, setTeamStats] = useState<any[]>([]);

  // Societies State
  const [societies, setSocieties] = useState<any[]>(initialSocieties || []);
  const [selectedSociety, setSelectedSociety] = useState<any | null>(null);
  const [societySearch, setSocietySearch] = useState('');
  const [societyRegionSearch, setSocietyRegionSearch] = useState('');
  const debouncedSocietySearch = useDebounce(societySearch, 500);
  const [societyViewMode, setSocietyViewMode] = useState<'list' | 'map'>('list');

  // Events State
  const [events, setEvents] = useState<SocietyEvent[]>([]);

  // Results State
  const [allResults, setAllResults] = useState<any[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPerPage] = useState(20);

  const [filterShooter, setFilterShooter] = useState('');
  const debouncedFilterShooter = useDebounce(filterShooter, 500);
  const [filterSociety, setFilterSociety] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterQualification, setFilterQualification] = useState('');

  // Global State
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState('');

  // UI State
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [profileSubTab, setProfileSubTab] = useState<'details' | 'help' | 'events'>('details');
  const [showSocietyForm, setShowSocietyForm] = useState(false);
  const [editingSociety, setEditingSociety] = useState<any | null>(null);
  const [selectedTeamForSheet, setSelectedTeamForSheet] = useState<any | null>(null);
  const [selectedTeamSheetAction, setSelectedTeamSheetAction] = useState<'print' | 'download' | null>(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [editingScore, setEditingScore] = useState<{ teamId: number, userId: number, score: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedShooterResults, setSelectedShooterResults] = useState<any | null>(null);
  const [shareData, setShareData] = useState<{ comp: Competition, user: User } | null>(null);

  // Form Fields - User
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [category, setCategory] = useState('');
  const [qualification, setQualification] = useState('');
  const [society, setSociety] = useState('');
  const [shooterCode, setShooterCode] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [nationality, setNationality] = useState('');
  const [internationalId, setInternationalId] = useState('');
  const [originalClub, setOriginalClub] = useState('');
  const [isInternational, setIsInternational] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // Form Fields - Society
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
  const [socLat, setSocLat] = useState('');
  const [socLng, setSocLng] = useState('');
  const [socDisciplines, setSocDisciplines] = useState<string[]>([]);

  // Form Fields - Team
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

  // Filter Options
  const [filterOptions, setFilterOptions] = useState<{
    disciplines: string[];
    locations: string[];
    years: string[];
  }>({
    disciplines: [],
    locations: [],
    years: []
  });

  // Dashboard
  const [showDashboard, setShowDashboard] = useState(false);
  const [kpiFilter, setKpiFilter] = useState('total');
  const [fetchedDashboardStats, setFetchedDashboardStats] = useState<any | null>(null);

  // Fetch Functions
  const fetchUsers = useCallback(async (signal?: AbortSignal, isBackground = false) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    if (!isBackground) setLoading(true);
    else setBackgroundLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: usersPageRef.current.toString(),
        limit: usersPerPageRef.current.toString(),
        search: userSearchTermRef.current,
        role: filterRoleRef.current,
        society: userFilterSocietyRef.current
      });
      
      if (filterRoleRef.current !== 'society') {
        queryParams.append('excludeRole', 'society');
      }
      
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
      setError(err.message === 'Failed to fetch' ? 'Errore di connessione. Controlla la tua rete.' : err.message);
    } finally {
      if (!isBackground) setLoading(false);
      else setBackgroundLoading(false);
    }
  }, [currentUser?.role, token]);

  const fetchAllUsers = useCallback(async (signal?: AbortSignal) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    try {
      const res = await fetch(`/api/admin/users?limit=2000&excludeRole=society`, {
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

  const fetchSocieties = useCallback(async (signal?: AbortSignal, isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch('/api/societies', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (!res.ok) throw new Error('Errore nel caricamento delle società');
      const data = await res.json();
      setSocieties(data);
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [token]);

  const fetchTeams = useCallback(async (signal?: AbortSignal, isBackground = false) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch('/api/teams', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (!res.ok) throw new Error('Errore nel caricamento delle squadre');
      const data = await res.json();
      setTeams(data);
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [currentUser?.role, token]);

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

  const fetchTeamStats = useCallback(async (signal?: AbortSignal, isBackground = false) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    if (!isBackground) setLoading(true);
    else setBackgroundLoading(true);
    try {
      const queryParams = new URLSearchParams({
        society: filterSociety,
        ...(activeTab === 'results' ? {
          search: filterShooter,
          discipline: filterDiscipline,
          location: filterLocation,
          year: filterYear
        } : {})
      });
      
      const res = await fetch(`/api/admin/team-stats?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (!res.ok) throw new Error('Errore nel caricamento delle statistiche');
      const data = await res.json();
      setTeamStats(data);
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    } finally {
      if (!isBackground) setLoading(false);
      else setBackgroundLoading(false);
    }
  }, [currentUser?.role, token, filterShooter, filterSociety, filterDiscipline, filterLocation, filterYear, activeTab]);

  const fetchAllResults = useCallback(async (signal?: AbortSignal, isBackground = false) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'society') return;
    if (!isBackground) setLoading(true);
    else setBackgroundLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: resultsPage.toString(),
        limit: resultsPerPage.toString(),
        search: filterShooter,
        society: filterSociety,
        discipline: filterDiscipline,
        location: filterLocation,
        year: filterYear
      });
      
      const res = await fetch(`/api/admin/all-results?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
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
      setError(err.message);
    } finally {
      if (!isBackground) setLoading(false);
      else setBackgroundLoading(false);
    }
  }, [currentUser?.role, token, resultsPage, resultsPerPage, filterShooter, filterSociety, filterDiscipline, filterLocation, filterYear]);

  const fetchFilterOptions = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/admin/filter-options', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (res.ok) {
        const data = await res.json();
        setFilterOptions({
          disciplines: Array.from(new Set(data.disciplines || [])),
          locations: Array.from(new Set(data.locations || [])),
          years: Array.from(new Set(data.years || []))
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error(err);
    }
  }, [token]);

  const handleRetry = useCallback(() => {
    setError('');
    const controller = new AbortController();
    setLoading(true);
    const promises = [fetchSocieties(controller.signal), fetchFilterOptions(controller.signal)];
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
  }, [currentUser?.role, fetchSocieties, fetchFilterOptions, fetchTeamStats, fetchAllResults, fetchTeams, fetchUsers]);

  const dashboardStats = React.useMemo(() => {
    const onlineUsers = users.filter(u => u.is_logged_in && u.role !== 'society');
    const onlineSocieties = new Set(users.filter(u => u.is_logged_in && u.role === 'society' && u.society).map(u => u.society));
    
    const userResultCounts: {[key: number]: number} = {};
    const userTargetCounts: {[key: number]: number} = {};
    allResults.forEach(r => {
      if (r.user_id && (r.totalScore || 0) > 0) {
        userResultCounts[r.user_id] = (userResultCounts[r.user_id] || 0) + 1;
        userTargetCounts[r.user_id] = (userTargetCounts[r.user_id] || 0) + (r.totalTargets || 0);
      }
    });

    const userTraffic: {[key: number]: number} = {};
    users.forEach(u => {
      if (u.role !== 'society') {
        userTraffic[u.id] = userResultCounts[u.id] || 0;
      }
    });

    const topUserByTrafficId = Object.entries(userTraffic).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topUserByTraffic = users.find(u => u.id === Number(topUserByTrafficId));

    const socTraffic: {[key: string]: number} = {};
    users.forEach(u => {
      if (u.society) {
        socTraffic[u.society] = (socTraffic[u.society] || 0) + (userResultCounts[u.id] || 0);
      }
    });
    const topSocByTrafficEntry = Object.entries(socTraffic).sort((a, b) => b[1] - a[1])[0];

    const topUserByResultsId = Object.entries(userResultCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topUserByResults = users.find(u => u.id === Number(topUserByResultsId));

    const topUserByTargetsId = Object.entries(userTargetCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topUserByTargets = users.find(u => u.id === Number(topUserByTargetsId));

    const socResultCounts: {[key: string]: number} = {};
    allResults.forEach(r => {
      if (r.society && (r.totalScore || 0) > 0) {
        socResultCounts[r.society] = (socResultCounts[r.society] || 0) + 1;
      }
    });
    const topSocByResultsEntry = Object.entries(socResultCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      onlineUsersCount: onlineUsers.length,
      onlineSocietiesCount: onlineSocieties.size,
      topUserName: topUserByTraffic ? `${topUserByTraffic.name} ${topUserByTraffic.surname}` : '-',
      topUserTraffic: topUserByTrafficId ? userTraffic[Number(topUserByTrafficId)] : 0,
      topSocName: topSocByTrafficEntry ? topSocByTrafficEntry[0] : '-',
      topSocTraffic: topSocByTrafficEntry ? topSocByTrafficEntry[1] : 0,
      topUserByResultsName: topUserByResults ? `${topUserByResults.name} ${topUserByResults.surname}` : '-',
      topUserResultsCount: topUserByResultsId ? userResultCounts[Number(topUserByResultsId)] : 0,
      topSocByResultsName: topSocByResultsEntry ? topSocByResultsEntry[0] : '-',
      topSocResultsCount: topSocByResultsEntry ? topSocByResultsEntry[1] : 0,
      topUserByTargetsName: topUserByTargets ? `${topUserByTargets.name} ${topUserByTargets.surname}` : '-',
      topUserTargetsTotal: topUserByTargetsId ? userTargetCounts[Number(topUserByTargetsId)] : 0
    };
  }, [users, allResults]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    
    const initFetch = async () => {
      setLoading(true);
      const promises = [
        fetchSocieties(controller.signal),
        fetchFilterOptions(controller.signal)
      ];
      
      if (currentUser?.role === 'admin' || currentUser?.role === 'society') {
        promises.push(
          fetchAllUsers(controller.signal),
          fetchTeams(controller.signal),
          fetchEvents(controller.signal)
        );
      }
      
      try {
        await Promise.all(promises);
      } catch (err) {
        console.error('Error during initial fetch:', err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    initFetch();
    return () => controller.abort();
  }, [token, currentUser?.role, fetchSocieties, fetchFilterOptions, fetchAllUsers, fetchTeams, fetchEvents]);

  // Supabase Realtime Subscriptions
  useEffect(() => {
    if (!supabase || !token || !currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'society')) return;

    const channels = [
      supabase.channel('users-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchUsers(undefined, true);
          fetchAllUsers();
        })
        .subscribe(),
      
      supabase.channel('competitions-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'competitions' }, () => {
          fetchAllResults(undefined, true);
          fetchTeamStats(undefined, true);
        })
        .subscribe(),

      supabase.channel('teams-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
          fetchTeams(undefined, true);
          fetchTeamStats(undefined, true);
        })
        .subscribe(),

      supabase.channel('societies-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'societies' }, () => {
          fetchSocieties(undefined, true);
        })
        .subscribe(),

      supabase.channel('events-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
          fetchEvents();
        })
        .subscribe()
    ];

    return () => {
      channels.forEach(channel => supabase?.removeChannel(channel));
    };
  }, [token, currentUser, fetchUsers, fetchAllUsers, fetchAllResults, fetchTeamStats, fetchTeams, fetchSocieties, fetchEvents, supabase]);

  // Trigger fetchUsers when debounced search term or other filters change
  useEffect(() => {
    if (token && (currentUser?.role === 'admin' || currentUser?.role === 'society')) {
      fetchUsers();
    }
  }, [debouncedUserSearchTerm, usersPage, usersPerPage, filterRole, userFilterSociety, fetchUsers, token, currentUser?.role]);

  // Trigger fetchAllResults when debounced shooter search or other filters change
  useEffect(() => {
    if (token && (currentUser?.role === 'admin' || currentUser?.role === 'society')) {
      fetchAllResults(undefined, true);
      fetchTeamStats(undefined, true);
    }
  }, [debouncedFilterShooter, filterSociety, filterDiscipline, filterLocation, filterYear, filterDate, filterMonth, filterCategory, filterQualification, resultsPage, fetchAllResults, fetchTeamStats, token, currentUser?.role]);

  const value = {
    currentUser, token,
    users, setUsers, allUsers, setAllUsers, totalUsers, usersPage, setUsersPage, usersPerPage, setUsersPerPage, userSearchTerm, setUserSearchTerm, filterRole, setFilterRole, userFilterSociety, setUserFilterSociety, fetchUsers, fetchAllUsers,
    teams, setTeams, teamStats, setTeamStats, fetchTeams, fetchTeamStats,
    societies, setSocieties, selectedSociety, setSelectedSociety, societySearch, setSocietySearch, societyRegionSearch, setSocietyRegionSearch, societyViewMode, setSocietyViewMode, fetchSocieties,
    events, setEvents, fetchEvents,
    allResults, setAllResults, totalResults, resultsPage, setResultsPage, resultsPerPage, filterShooter, setFilterShooter, filterSociety, setFilterSociety, filterDiscipline, setFilterDiscipline, filterLocation, setFilterLocation, filterYear, setFilterYear, filterMonth, setFilterMonth, filterDate, setFilterDate, filterCategory, setFilterCategory, filterQualification, setFilterQualification, fetchAllResults,
    loading, setLoading, backgroundLoading, error, setError, handleRetry,
    activeTab, setActiveTab, hideInternalFAB, setHideInternalFAB, showUserForm, setShowUserForm, editingUser, setEditingUser, selectedUser, setSelectedUser, showProfilePassword, setShowProfilePassword, profileSubTab, setProfileSubTab, showSocietyForm, setShowSocietyForm, editingSociety, setEditingSociety, selectedTeamForSheet, setSelectedTeamForSheet, selectedTeamSheetAction, setSelectedTeamSheetAction, showTeamForm, setShowTeamForm, editingTeam, setEditingTeam, editingScore, setEditingScore, showFilters, setShowFilters, selectedShooterResults, setSelectedShooterResults, shareData, setShareData,
    name, setName, surname, setSurname, email, setEmail, password, setPassword, role, setRole, category, setCategory, qualification, setQualification, society, setSociety, shooterCode, setShooterCode, userAvatar, setUserAvatar, birthDate, setBirthDate, phone, setPhone,
    nationality, setNationality, internationalId, setInternationalId, originalClub, setOriginalClub, isInternational, setIsInternational, isEmailVerified, setIsEmailVerified,
    socName, setSocName, socCode, setSocCode, socEmail, setSocEmail, socAddress, setSocAddress, socCity, setSocCity, socRegion, setSocRegion, socZip, setSocZip, socPhone, setSocPhone, socMobile, setSocMobile, socWebsite, setSocWebsite, socContactName, setSocContactName, socLogo, setSocLogo, socOpeningHours, setSocOpeningHours, socGoogleMapsLink, setSocGoogleMapsLink, socLat, setSocLat, socLng, setSocLng, socDisciplines, setSocDisciplines,
    newTeamName, setNewTeamName, newTeamSize, setNewTeamSize, newTeamEventId, setNewTeamEventId, newTeamCompetitionName, setNewTeamCompetitionName, newTeamDiscipline, setNewTeamDiscipline, newTeamSociety, setNewTeamSociety, newTeamLocation, setNewTeamLocation, newTeamDate, setNewTeamDate, newTeamTargets, setNewTeamTargets, selectedShooterIds, setSelectedShooterIds,
    filterOptions, setFilterOptions, fetchFilterOptions,
    showDashboard, setShowDashboard, kpiFilter, setKpiFilter, fetchedDashboardStats, dashboardStats
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
