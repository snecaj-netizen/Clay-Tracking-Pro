import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Settings from './Settings';
import EventsManager from './EventsManager';
import HallOfFame from './HallOfFame';
import SocietySearch from './SocietySearch';
import FitavScoreSheet from './FitavScoreSheet';
import { EventControlManager } from './EventControlManager';
import ShareCard from './ShareCard';
import FAQSection from './FAQSection';
import ExpandingFAB from './ExpandingFAB';
import UserManagement from './admin/UserManagement';
import ResultsManagement from './admin/ResultsManagement';
import SocietyManagement from './admin/SocietyManagement';
import TeamManagement from './admin/TeamManagement';
import { Competition, Cartridge, CartridgeType, AppData, User } from '../types';
import { AdminProvider, useAdmin } from '../contexts/AdminContext';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';
import { generatePortalFlyer } from '../lib/pdfUtils';

type Tab = 'users' | 'settings' | 'profile' | 'team' | 'results' | 'event-results' | 'societies' | 'events' | 'halloffame' | 'notifications' | 'event-control';

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
  onEditCompetition?: (comp?: Competition, userId?: number) => void;
  onDeleteCompetition?: (id: string) => Promise<boolean | void> | void;
  onNavigate?: (view: any, tab?: string) => void;
  initialTab?: Tab;
  initialSocietyName?: string;
  onCloseSocietyDetail?: () => void;
  onUserUpdate?: (user: any) => void;
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
  initialEventViewMode?: 'list' | 'calendar' | 'results' | 'managed';
  onToggleFAB?: (hide: boolean) => void;
}

// Admin Panel Refinement
const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  return (
    <AdminProvider 
      user={props.user} 
      token={props.token} 
      initialSocieties={props.societies} 
      initialTab={props.initialTab}
    >
      <AdminPanelInner {...props} />
    </AdminProvider>
  );
};

const AdminPanelInner: React.FC<AdminPanelProps> = ({ 
  user: currentUser, token, competitions, cartridges, cartridgeTypes, clientId, onClientIdChange, onImport,
  syncStatus, lastSync, isDriveConnected, onConnectDrive, onDisconnectDrive, onSaveDrive, onLoadDrive,
  onEditCompetition, onDeleteCompetition, onNavigate, initialTab, initialSocietyName, onCloseSocietyDetail, onUserUpdate, prefillTeam, onPrefillTeamUsed, hideTabs, onReplayTour,
  appSettings, onSettingsUpdate, initialEventViewMode, onToggleFAB
}) => {
  const { triggerConfirm, triggerToast } = useUI();
  const { language, t } = useLanguage();
  const {
    activeTab, setActiveTab,
    users, allUsers, fetchUsers,
    teams, teamStats, fetchTeams,
    societies, selectedSociety, setSelectedSociety, fetchSocieties,
    events, fetchEvents,
    resultsPage, setResultsPage, resultsPerPage, filterShooter, setFilterShooter, filterSociety, setFilterSociety, filterDiscipline, setFilterDiscipline, filterLocation, setFilterLocation, filterYear, setFilterYear, fetchAllResults,
    loading, error, setError, handleRetry,
    showUserForm, setShowUserForm, editingUser, setEditingUser, showProfilePassword, setShowProfilePassword, profileSubTab, setProfileSubTab, showSocietyForm, setShowSocietyForm, editingSociety, setEditingSociety, selectedTeamForSheet, setSelectedTeamForSheet, selectedTeamSheetAction, setSelectedTeamSheetAction, showTeamForm, setShowTeamForm, shareData, setShareData,
    setRole, setCategory, setQualification, setSociety,
    setSocName, setSocCode, setSocEmail, setSocAddress, setSocCity, setSocRegion, setSocZip, setSocPhone, setSocMobile, setSocWebsite, setSocContactName, setSocLogo, setSocOpeningHours, setSocGoogleMapsLink,
    setNewTeamCompetitionName, setNewTeamDiscipline, setNewTeamSociety, setNewTeamLocation, setNewTeamDate, setNewTeamTargets,
    filterOptions, setFilterOptions, fetchFilterOptions,
    showDashboard, kpiFilter, dashboardStats,
    hideInternalFAB, setHideInternalFAB
  } = useAdmin();

  const copyPortalLink = () => {
    const portalUrl = window.location.origin + '/portal';
    navigator.clipboard.writeText(portalUrl).then(() => {
      triggerToast(t('portal_link_copied'), 'success');
    }).catch(err => {
      console.error('Copy failed', err);
    });
  };

  const handlePortalPreview = async () => {
    try {
      const portalUrl = "tinyurl.com/risultatilive";
      const societyName = currentUser?.society || 'Società';
      const doc = await generatePortalFlyer(societyName, portalUrl, language as 'it' | 'en');
      
      // Preview in new window
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
      
      triggerToast(t('pdf_generated_success'), 'success');
    } catch (error) {
      console.error('Error generating portal PDF:', error);
      triggerToast(t('pdf_generation_error'), 'error');
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, setActiveTab]);

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
  }, [prefillTeam, onPrefillTeamUsed, setActiveTab, setShowTeamForm, setNewTeamCompetitionName, setNewTeamDiscipline, setNewTeamSociety, setNewTeamLocation, setNewTeamDate, setNewTeamTargets]);

  const handleCloseSocietyDetailLocal = () => {
    setSelectedSociety(null);
    if (initialSocietyName && onCloseSocietyDetail) {
      onCloseSocietyDetail();
    }
  };

  useEffect(() => {
    const handleCloseAllMenus = () => {
      // No longer needed for mobile menu as it's scrollable tabs now
    };

    window.addEventListener('clay-tracker-close-menus', handleCloseAllMenus);
    return () => window.removeEventListener('clay-tracker-close-menus', handleCloseAllMenus);
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'society' && currentUser?.society) {
      setNewTeamSociety(currentUser.society);
    }
  }, [currentUser, setNewTeamSociety]);

  // Helper for automatic qualification
  const updateAutoQualification = (date: string, currentQual: string, setter: (val: string) => void) => {
    if (!date) return;
    const birthYear = new Date(date).getFullYear();
    if (isNaN(birthYear)) return;
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;

    if (age <= 20) setter('JUN');
    else if (age >= 21 && age <= 55) setter('MAN');
    else if (age >= 56 && age <= 65) setter('SEN');
    else if (age >= 66 && age <= 72) setter('VET');
    else if (age > 72) setter('MAS');
    else if (['JUN', 'SEN', 'VET', 'MAS', 'MAN'].includes(currentQual)) setter('');
  };

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
  const [profileNationality, setProfileNationality] = useState(currentUser?.nationality || '');
  const [profileInternationalId, setProfileInternationalId] = useState(currentUser?.international_id || '');
  const [profileOriginalClub, setProfileOriginalClub] = useState(currentUser?.original_club || '');
  const [profileEmailVerified, setProfileEmailVerified] = useState(!!currentUser?.email_verified);
  const [profilePassword, setProfilePassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfileSurname(currentUser.surname || '');
      setProfileEmail(currentUser.email || '');
      setProfileCategory(currentUser.category || '');
      setProfileQualification(currentUser.qualification || '');
      setProfileSociety(currentUser.society || '');
      setProfileShooterCode(currentUser.shooter_code || '');
      setProfileAvatar(currentUser.avatar || '');
      setProfileBirthDate(currentUser.birth_date || '');
      setProfilePhone(currentUser.phone || '');
      setProfileNationality(currentUser.nationality || '');
      setProfileInternationalId(currentUser.international_id || '');
      setProfileOriginalClub(currentUser.original_club || '');
      setProfileEmailVerified(!!currentUser.email_verified);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'society' && showUserForm && !editingUser) {
      setSociety(currentUser.society || '');
    }
  }, [currentUser, showUserForm, editingUser, setSociety]);

  const handleToggleFAB = useCallback((hide: boolean) => {
    setHideInternalFAB(hide);
    if (onToggleFAB) onToggleFAB(hide);
  }, [onToggleFAB, setHideInternalFAB]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProfileSuccess('');

    if (currentUser?.role === 'user' || currentUser?.role === 'admin') {
      const shooterCodeRegex = /^[A-Z]{3}\d{2}[A-Z]{2}\d{2}$/;
      if (profileShooterCode && !shooterCodeRegex.test(profileShooterCode)) {
        setError(t('invalid_code_format'));
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
          nationality: profileNationality || undefined,
          international_id: profileInternationalId || undefined,
          original_club: profileOriginalClub || undefined,
          email_verified: profileEmailVerified,
          password: profilePassword || undefined
        }),
      });

      if (!res.ok) throw new Error(t('profile_update_error'));
      
      // Refresh local user lists in AdminContext if we are an admin
      if (currentUser?.role === 'admin') {
        fetchUsers();
      }

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
          phone: profilePhone,
          nationality: profileNationality,
          international_id: profileInternationalId,
          original_club: profileOriginalClub,
          email_verified: profileEmailVerified
        });
      }
      
      setProfileSuccess(t('profile_success_msg'));
      setProfilePassword('');
    } catch (err: any) {
      setError(err.message);
    }
  };




  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError(t('image_too_large_error'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


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
      {/* Tab Switcher - Mobile (Scrollable Tabs) */}
      {!hideTabs && (
        <div className="sm:hidden sticky top-16 z-[1020] bg-slate-950/90 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-slate-700 shadow-lg overflow-x-auto no-scrollbar scroll-shadows">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 min-w-max">
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <div className="flex gap-1">
                <button 
                  onClick={handlePortalPreview}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-indigo-600/20 text-indigo-500 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white"
                >
                  <i className="fas fa-file-pdf"></i> {t('results_portal_preview')}
                </button>
                <button 
                  onClick={copyPortalLink}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white"
                  title={t('copy_portal_link')}
                >
                  <i className="fas fa-copy"></i>
                </button>
              </div>
            )}
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => { setActiveTab('event-control'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'event-control' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-tasks"></i> {t('activation')}
              </button>
            )}
            {(currentUser?.role === 'admin' || (currentUser?.role === 'society' && hasSocietaAccess)) && (
              <button 
                onClick={() => { onNavigate ? onNavigate('event-results') : setActiveTab('event-results'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'event-results' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-trophy"></i> {t('rankings')}
              </button>
            )}
            {(currentUser?.role === 'admin' || (currentUser?.role === 'society' && hasSocietaAccess)) && (
              <button 
                onClick={() => { setActiveTab('results'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'results' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-history"></i> {t('results')}
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => { setActiveTab('events'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'events' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-calendar-alt"></i> {currentUser?.role === 'society' ? t('managed_races') : t('events')}
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <>
                <button 
                  onClick={() => { setActiveTab('halloffame'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'halloffame' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                  <i className="fas fa-trophy"></i> {t('hall_of_fame')}
                </button>
                <button 
                  onClick={() => { setActiveTab('team'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'team' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                  <i className="fas fa-users-cog"></i> {t('squads')}
                </button>
                <button 
                  onClick={() => { setActiveTab('users'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                  <i className="fas fa-users"></i> {currentUser?.role === 'society' ? t('shooters') : t('users')}
                </button>
              </>
            )}
            <button 
              onClick={() => { setActiveTab('profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <i className="fas fa-user"></i> {t('profile')}
            </button>
            <button 
              onClick={() => { setActiveTab('settings'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <i className="fas fa-cog"></i> {currentUser?.role === 'admin' ? t('settings') : t('backup')}
            </button>
          </div>
        </div>
      )}

      {/* Tab Switcher - Desktop */}
      {!hideTabs && (
        <div className="hidden sm:flex sticky top-[104px] z-30 bg-slate-900 [.light-theme_&]:bg-white p-1 rounded-xl border border-slate-800 [.light-theme_&]:border-slate-200 w-full shadow-xl flex-wrap transition-colors">
             {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <div className="flex-1 min-w-[120px] flex gap-1">
                <button 
                  onClick={handlePortalPreview}
                  className="flex-1 py-3 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-indigo-600/20 text-indigo-500 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white flex items-center justify-center [.light-theme_&]:bg-indigo-50 [.light-theme_&]:text-indigo-600 [.light-theme_&]:border-indigo-100"
                >
                  <i className="fas fa-file-pdf mr-1 lg:mr-2"></i> <span className="hidden md:inline">{t('results_portal_preview')}</span><span className="md:hidden">{t('portal_short')}</span>
                </button>
                <button 
                  onClick={copyPortalLink}
                  className="px-3 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white flex items-center justify-center"
                  title={t('copy_portal_link')}
                >
                  <i className="fas fa-copy"></i>
                </button>
              </div>
            )}
            {(currentUser?.role === 'admin' || (currentUser?.role === 'society' && hasSocietaAccess)) && (
              <button 
                onClick={() => { onNavigate ? onNavigate('event-results') : setActiveTab('event-results'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'event-results' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-trophy mr-1 lg:mr-2"></i> <span className="hidden md:inline">{t('rankings')}</span><span className="md:hidden">{t('class_short')}</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || (currentUser?.role === 'society' && hasSocietaAccess)) && (
              <button 
                onClick={() => { setActiveTab('results'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'results' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-history mr-1 lg:mr-2"></i> <span className="hidden md:inline">{t('individual_results')}</span><span className="md:hidden">{t('ris_ind_short')}</span>
              </button>
            )}
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => { setActiveTab('event-control'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'event-control' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-tasks mr-1 lg:mr-2"></i> <span className="hidden md:inline">{t('activation')}</span><span className="md:hidden">{t('attiv_short')}</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => { setActiveTab('events'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'events' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-calendar-alt mr-1 lg:mr-2"></i> <span className="hidden md:inline">{currentUser?.role === 'society' ? t('managed_races') : (currentUser?.role === 'admin' ? t('managed_races') : t('events'))}</span><span className="md:hidden">{currentUser?.role === 'society' ? t('managed_races') : (currentUser?.role === 'admin' ? t('managed_races') : t('events'))}</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => { setActiveTab('halloffame'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'halloffame' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-trophy mr-1 lg:mr-2"></i> <span className="hidden md:inline">{t('hall_of_fame')}</span><span className="md:hidden">{t('hof_short')}</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => { setActiveTab('team'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'team' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-users-cog mr-1 lg:mr-2"></i> <span className="hidden md:inline">{t('squads')}</span><span className="md:hidden">{t('sq_short')}</span>
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
              <button 
                onClick={() => { setActiveTab('users'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex-1 min-w-[100px] py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                <i className="fas fa-users mr-1 lg:mr-2"></i> <span className="hidden md:inline">{currentUser?.role === 'society' ? t('your_shooters') : (currentUser?.role === 'admin' ? t('user_management_label') : t('users'))}</span><span className="md:hidden">{currentUser?.role === 'society' ? t('shooter_short') : (currentUser?.role === 'admin' ? t('gest_ut_short') : t('ut_short'))}</span>
              </button>
            )}
            <button 
              onClick={() => { setActiveTab('profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={`flex-1 min-w-[100px] py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <i className="fas fa-user mr-1 lg:mr-2"></i> <span className="hidden md:inline">{t('profile')}</span><span className="md:hidden">{t('prof_short')}</span>
            </button>
            <button 
              onClick={() => { setActiveTab('settings'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={`flex-1 min-w-[100px] py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              <i className="fas fa-cog mr-1 lg:mr-2"></i> <span className="hidden md:inline">{currentUser?.role === 'admin' ? t('settings') : t('backup')}</span><span className="md:hidden">{currentUser?.role === 'admin' ? t('imp_short') : t('bk_short')}</span>
            </button>
        </div>
      )}

      {activeTab === 'event-results' ? (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
          <EventsManager 
            user={currentUser} 
            token={token} 
            initialViewMode={initialEventViewMode || "results"}
            societies={societies}
            onToggleFAB={handleToggleFAB}
            isSubPage={true}
          />
        </div>
      ) : activeTab === 'settings' ? (
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
        />
      ) : activeTab === 'profile' ? (
        <div className="bg-slate-900 [.light-theme_&]:bg-white border border-slate-700 [.light-theme_&]:border-slate-200 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h2 className="text-xl font-black text-white [.light-theme_&]:text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-user-circle text-orange-500"></i> {currentUser?.role === 'society' ? t('club_profile') : t('profile')}
            </h2>

            {/* Sub-navigation */}
            <div className="flex bg-slate-950 [.light-theme_&]:bg-slate-50 p-1 rounded-2xl border border-slate-800 [.light-theme_&]:border-slate-200 flex-wrap transition-colors">
              <button
                onClick={() => setProfileSubTab('details')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs lg:text-sm font-black uppercase tracking-widest transition-all ${
                  profileSubTab === 'details' 
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {t('profile_data')}
              </button>
              <button
                onClick={() => setProfileSubTab('help')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs lg:text-sm font-black uppercase tracking-widest transition-all ${
                  profileSubTab === 'help' 
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {t('guide_faq')}
              </button>
            </div>
          </div>

          {profileSubTab === 'details' ? (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              {profileSuccess && <div className="bg-emerald-950/50 text-emerald-500 p-3 rounded-xl text-sm mb-4 border border-emerald-900/50">{t('profile_success')}</div>}
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
                    {t('retry')}
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
                    {t('profile_photo')} (Max 2MB)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentUser?.role === 'admin' && (
                    <div className="md:col-span-2 bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-orange-500/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${profileEmailVerified ? 'bg-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-800 text-slate-500'}`}>
                          <i className={`fas ${profileEmailVerified ? 'fa-check-circle' : 'fa-envelope-open'}`}></i>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">{t('email_verified')}</label>
                          <p className={`text-xs font-bold ${profileEmailVerified ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {profileEmailVerified ? t('verified') : t('not_verified')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProfileEmailVerified(!profileEmailVerified)}
                        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${profileEmailVerified ? 'bg-emerald-600 shadow-[0_0_10px_rgba(5,150,105,0.4)]' : 'bg-slate-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${profileEmailVerified ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('name')}</label>
                    <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} disabled={currentUser?.role !== 'admin'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0 ${currentUser?.role !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('surname')}</label>
                    <input type="text" value={profileSurname} onChange={e => setProfileSurname(e.target.value)} disabled={currentUser?.role !== 'admin'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0 ${currentUser?.role !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('email')}</label>
                    <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('birth_date')}</label>
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
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('phone')}</label>
                    <input type="tel" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('password_optional')}</label>
                    <div className="relative">
                      <input 
                        type={showProfilePassword ? "text" : "password"} 
                        value={profilePassword} 
                        onChange={e => setProfilePassword(e.target.value)} 
                        placeholder={t('password_placeholder')} 
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
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('club')}</label>
                    <SocietySearch 
                      value={profileSociety}
                      onChange={setProfileSociety}
                      societies={societies}
                      placeholder={t('select_dot')}
                      disabled={currentUser?.role !== 'admin'}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      {currentUser?.role === 'society' ? t('club_code') : t('shooter_code')}
                    </label>
                    <input 
                      type="text" 
                      required={currentUser?.role === 'society'} 
                      value={profileShooterCode} 
                      onChange={e => setProfileShooterCode(currentUser?.role !== 'society' ? e.target.value.toUpperCase() : e.target.value)} 
                      disabled={currentUser?.role !== 'admin'} 
                      pattern={currentUser?.role !== 'society' ? "[A-Z]{3}\\d{2}[A-Z]{2}\\d{2}" : undefined}
                      title={currentUser?.role !== 'society' ? t('shooter_code_format_title') : undefined}
                      placeholder={currentUser?.role !== 'society' ? t('shooter_code_placeholder') : ""}
                      className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''} ${currentUser?.role !== 'society' ? 'uppercase' : ''}`} 
                    />
                  </div>
                  {currentUser?.role !== 'society' && (
                    <>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('category')}</label>
                        <select value={profileCategory} onChange={e => setProfileCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                          <option value="">{t('select_dot')}</option>
                          <option value="Eccellenza">Eccellenza</option>
                          <option value="1*">1*</option>
                          <option value="2*">2*</option>
                          <option value="3*">3*</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('qualification')}</label>
                        <select value={profileQualification} onChange={e => setProfileQualification(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                          <option value="">{t('select_dot')}</option>
                          <option value="MAN">MAN (Man)</option>
                          <option value="LAD">LAD (Lady)</option>
                          <option value="JUN">JUN (Junior)</option>
                          <option value="SEN">SEN (Senior)</option>
                          <option value="VET">VET (Veteran)</option>
                          <option value="MAS">MAS (Master)</option>
                        </select>
                      </div>
                    </>
                  )}
                  {currentUser?.is_international && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800 pt-6 mt-2">
                       <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('nationality')}</label>
                        <input type="text" value={profileNationality} onChange={e => setProfileNationality(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('international_id')}</label>
                        <input type="text" value={profileInternationalId} onChange={e => setProfileInternationalId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('original_club')}</label>
                        <input type="text" value={profileOriginalClub} onChange={e => setProfileOriginalClub(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      </div>
                    </div>
                  )}
                </div>
                <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-black py-3 px-8 rounded-xl transition-all active:scale-95 text-xs uppercase shadow-lg shadow-orange-600/20">
                  {t('update_profile')}
                </button>
              </form>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Installation Guide Section */}
              <div className="mb-12">
                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                  <i className="fas fa-mobile-alt text-orange-500"></i> {t('install_guide_title')}
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  {t('install_guide_desc')}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500">
                        <i className="fab fa-apple text-lg"></i>
                      </div>
                      <h4 className="font-bold text-white">{t('safari_guide_title')}</h4>
                    </div>
                    <ul className="space-y-3 text-xs text-slate-400">
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                        <span>{language === 'it' 
                          ? <>Tocca il tasto <span className="text-white font-bold">Condividi</span> <i className="fas fa-share-square text-blue-400 mx-0.5"></i> in basso al centro.</> 
                          : <>Tap the <span className="text-white font-bold">Share</span> <i className="fas fa-share-square text-blue-400 mx-0.5"></i> button at the bottom center.</>}
                        </span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                        <span>{t('safari_step_2')}</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                        <span>{t('safari_step_3')}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-500">
                        <i className="fab fa-android text-lg"></i>
                      </div>
                      <h4 className="font-bold text-white">{t('chrome_guide_title')}</h4>
                    </div>
                    <ul className="space-y-3 text-xs text-slate-400">
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                        <span>{language === 'it' 
                          ? <>Tocca i <span className="text-white font-bold">tre puntini</span> <i className="fas fa-ellipsis-v text-green-400 mx-0.5"></i> in alto a destra.</> 
                          : <>Tap the <span className="text-white font-bold">three dots</span> <i className="fas fa-ellipsis-v text-green-400 mx-0.5"></i> in the top right corner.</>}
                        </span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                        <span>{t('chrome_step_2')}</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                        <span>{t('chrome_step_3')}</span>
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
        <TeamManagement 
          currentUser={currentUser}
          token={token}
          fetchAllResults={fetchAllResults}
        />
      ) : activeTab === 'societies' ? (
        <SocietyManagement 
          currentUser={currentUser}
          token={token}
        />
      ) : activeTab === 'event-control' ? (

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <EventControlManager 
            token={token} 
          />
        </div>
      ) : activeTab === 'events' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <EventsManager 
            user={currentUser} 
            token={token} 
            societies={societies} 
            restrictToSociety={true}
            isSubPage={true}
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
        <ResultsManagement 
          currentUser={currentUser}
          token={token}
          onEditCompetition={onEditCompetition}
          onDeleteCompetition={onDeleteCompetition}
        />
      ) : (
        <UserManagement 
          currentUser={currentUser}
          token={token}
          onUserUpdate={onUserUpdate}
        />
      )}
      {/* Floating Add Button for Competitions */}
      <ExpandingFAB 
        show={activeTab === 'results' && currentUser?.role === 'admin' && !hideInternalFAB}
        label={t('add_competition')}
        onClick={() => onEditCompetition && onEditCompetition()}
      />

      {/* Floating Add Button for Teams */}
      <ExpandingFAB 
        show={activeTab === 'team' && (currentUser?.role === 'admin' || currentUser?.role === 'society') && !hideInternalFAB}
        label={showTeamForm ? t('close_label') : t('new_team')}
        isClose={showTeamForm}
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
      />

      {/* Floating Add Button for Users */}
      <ExpandingFAB 
        show={activeTab === 'users' && (currentUser?.role === 'admin' || currentUser?.role === 'society') && !hideInternalFAB}
        label={showUserForm ? t('close_label') : (currentUser?.role === 'society' ? t('new_shooter') : t('new_user'))}
        isClose={showUserForm}
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
      />

      {/* Floating Add Button for Societies */}
      <ExpandingFAB 
        show={activeTab === 'societies' && currentUser?.role === 'admin' && !hideInternalFAB}
        label={showSocietyForm ? t('close_label') : t('new_club')}
        isClose={showSocietyForm}
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
      />
      {shareData && (
        <ShareCard 
          competition={shareData.comp} 
          societies={societies}
          user={shareData.user} 
          onClose={() => setShareData(null)} 
        />
      )}
      {selectedTeamForSheet && createPortal(
        <FitavScoreSheet 
          teams={[selectedTeamForSheet]}
          event={events.find(ev => String(ev.id) === String(selectedTeamForSheet.event_id))}
          onClose={() => {
            setSelectedTeamForSheet(null);
            setSelectedTeamSheetAction(null);
          }}
          hostingSociety={societies.find(s => s.name === events.find(ev => String(ev.id) === String(selectedTeamForSheet.event_id))?.location)}
          autoAction={selectedTeamSheetAction}
        />,
        document.body
      )}
    </div>
  );
};

export default AdminPanel;
