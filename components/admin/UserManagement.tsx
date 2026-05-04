import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import SocietySearch from '../SocietySearch';
import KPIDashboard from './KPIDashboard';
import { User, UserRole, DashboardStats } from '../../types';
import { useAdmin } from '../../contexts/AdminContext';
import { useUI } from '../../contexts/UIContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface UserManagementProps {
  currentUser: any;
  token: string;
  onUserUpdate?: (user: any) => void;
}

// User Search Input Component
const UserSearchInput = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) => {
  const { t } = useLanguage();
  return (
    <div className="relative flex-1">
      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
      <input 
        type="text" 
        placeholder={placeholder} 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-10 text-sm text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-slate-600 font-bold"
      />
      {value && (
        <button
          onClick={() => {
            onChange('');
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-full transition-all"
          title={t('reset_search')}
        >
          <i className="fas fa-times-circle text-sm"></i>
        </button>
      )}
    </div>
  );
};

// User Row Component
const UserRow = React.memo(({ 
  user: u, 
  currentUser, 
  societies, 
  onSelect, 
  onToggleStatus, 
  onEdit, 
  onDelete 
}: { 
  user: any, 
  currentUser: any, 
  societies: any[], 
  onSelect: (u: any) => void, 
  onToggleStatus: (id: number, status: string) => void, 
  onEdit: (u: any) => void, 
  onDelete: (id: number) => void 
}) => {
  const { t } = useLanguage();
  
  return (
    <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
      <td className="py-3 px-4 text-sm text-white font-bold">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:text-orange-500 transition-colors"
          onClick={() => onSelect(u)}
        >
          <div 
            className={`w-8 h-8 rounded-full bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center ${
              u.is_logged_in 
                ? 'border-2 border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
                : 'border border-slate-700'
            }`}
            title={u.is_logged_in ? t('online') : undefined}
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
      <td className="py-3 px-4 text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <div 
            className={`w-2 h-2 rounded-full shrink-0 ${u.email_verified ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} 
            title={u.email_verified ? t('email_verified_label') : t('email_not_verified_label')}
          />
          <span className="truncate">{u.email}</span>
        </div>
      </td>
      {currentUser?.role !== 'society' && (
        <td className="py-3 px-4">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${u.role === 'admin' ? 'bg-orange-500/20 text-orange-500' : u.role === 'society' ? 'bg-blue-500/20 text-blue-500' : 'bg-slate-800 text-slate-400'}`}>
            {u.role === 'user' ? t('shooter') : u.role === 'society' ? t('club_label') : t('admin')}
          </span>
        </td>
      )}
      <td className="py-3 px-4 flex justify-end gap-3">
        {currentUser?.role === 'admin' && (
          <button 
            onClick={() => onToggleStatus(u.id, u.status)} 
            disabled={u.email === 'snecaj@gmail.com'}
            className={`w-11 h-11 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 ${
              u.status === 'suspended' 
                ? 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white' 
                : 'bg-red-500/5 text-red-500/60 hover:bg-red-600 hover:text-white'
            }`}
            title={u.status === 'suspended' ? t('reactivate') : t('suspend')}
          >
            <i className={`fas ${u.status === 'suspended' ? 'fa-user-check' : 'fa-user-slash'} text-sm sm:text-xs`}></i>
          </button>
        )}
        <button 
          onClick={() => onEdit(u)} 
          disabled={currentUser?.role === 'society' && u.role === 'admin'}
          className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-30"
          title={currentUser?.role === 'society' && u.role === 'admin' ? t('cannot_edit_admin') : t('edit')}
        >
          <i className="fas fa-edit text-sm sm:text-xs"></i>
        </button>
        <button 
          onClick={() => onDelete(u.id)} 
          disabled={u.email === 'snecaj@gmail.com' || currentUser?.role === 'society'} 
          className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg bg-red-600 text-white flex items-center justify-center hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 disabled:opacity-30"
          title={currentUser?.role === 'society' ? t('only_admin_can_delete') : (u.email === 'snecaj@gmail.com' ? t('cannot_delete_main_account') : t('delete'))}
        >
          <i className="fas fa-trash-alt text-sm sm:text-xs"></i>
        </button>
      </td>
    </tr>
  );
});

const UserManagement: React.FC<UserManagementProps> = ({ 
  currentUser, token, onUserUpdate
}) => {
  const { triggerConfirm, triggerToast } = useUI();
  const { t, language } = useLanguage();
  const {
    users, totalUsers, loading, backgroundLoading, error, setError, fetchUsers, fetchSocieties, societies,
    userSearchTerm, setUserSearchTerm, usersPage, setUsersPage, usersPerPage, setUsersPerPage, filterRole, setFilterRole,
    userFilterSociety, setUserFilterSociety,
    showDashboard, setShowDashboard, fetchedDashboardStats, dashboardStats, kpiFilter, setKpiFilter,
    showUserForm, setShowUserForm, editingUser, setEditingUser,
    name, setName, surname, setSurname, email, setEmail, password, setPassword,
    role, setRole, category, setCategory, qualification, setQualification,
    society, setSociety, shooterCode, setShooterCode, userAvatar, setUserAvatar,
    birthDate, setBirthDate, phone, setPhone,
    nationality, setNationality, internationalId, setInternationalId, originalClub, setOriginalClub, isInternational, setIsInternational, isEmailVerified, setIsEmailVerified,
    hideInternalFAB
  } = useAdmin();

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSortConfig, setUserSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filterRole !== '' || userSearchTerm !== '' || userFilterSociety !== '';

  useEffect(() => {
    if (currentUser?.role === 'society' && showUserForm && !editingUser) {
      setSociety(currentUser.society || '');
    }
  }, [currentUser, showUserForm, editingUser]);

  const handleUserAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError(t('image_too_large_error'));
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
        setError(t('shooter_code_format_desc'));
        return;
      }
    }

    const endpoint = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
    const method = editingUser ? 'PUT' : 'POST';
    const body = { 
      name, surname, email, role, category, qualification, society, shooter_code: shooterCode, 
      password: password || undefined, avatar: userAvatar || undefined, birth_date: birthDate || undefined, 
      phone: phone || undefined,
      nationality, international_id: internationalId, original_club: originalClub, is_international: isInternational, email_verified: isEmailVerified
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

      if (!res.ok) throw new Error(t('save_error_msg'));
      
      setEditingUser(null);
      setShowUserForm(false);
      setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); setSociety(''); setShooterCode(''); setUserAvatar(''); setBirthDate(''); setPhone('');
      setNationality(''); setInternationalId(''); setOriginalClub(''); setIsInternational(false); setIsEmailVerified(false);
      fetchUsers();
      if (onUserUpdate && editingUser && editingUser.id === currentUser.id) {
        onUserUpdate({
          ...currentUser,
          name, surname, email, role, category, qualification, society, shooter_code: shooterCode, avatar: userAvatar, birth_date: birthDate, phone,
          email_verified: isEmailVerified
        });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleStatus = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    const actionText = newStatus === 'suspended' ? t('suspend') : t('reactivate');
    const confirmTitle = newStatus === 'suspended' ? t('suspend_user') : t('reactivate_user');
    const confirmMessage = newStatus === 'suspended' 
      ? t('suspend_user_confirm') 
      : t('reactivate_user_confirm');

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
          if (!res.ok) throw new Error(t('error_occurred'));
          fetchUsers();
        } catch (err: any) {
          setError(err.message);
        }
      },
      actionText,
      newStatus === 'suspended' ? 'danger' : 'primary'
    );
  };

  const handleDelete = (id: number) => {
    triggerConfirm(
      t('delete_user_title'),
      t('delete_user_confirm'),
      async () => {
        try {
          const userToDelete = users.find(u => u.id === id);
          const res = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error(t('error_occurred'));
          fetchUsers();
          if (userToDelete?.role === 'society') {
            fetchSocieties();
          }
        } catch (err: any) {
          setError(err.message);
        }
      },
      t('delete'),
      'danger'
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
    setNationality(user.nationality || '');
    setInternationalId(user.international_id || '');
    setOriginalClub(user.original_club || '');
    setIsInternational(!!user.is_international);
    setIsEmailVerified(!!user.email_verified);
    setPassword('');
    setShowUserForm(true);
  };

  const sortedUsers = useMemo(() => {
    let sortableUsers = [...users];
    
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

  const handleRetry = () => {
    setError('');
    fetchUsers();
  };

  const handleDownloadTemplate = () => {
    const template = [
      ['Nome', 'Cognome', 'Email', 'Ruolo (user/society/admin)', 'Categoria', 'Qualifica', 'Società', 'Codice Tiratore', 'Data di Nascita (YYYY-MM-DD)', 'Telefono'],
      ['Mario', 'Rossi', 'mario.rossi@example.com', 'user', '1*', 'Senior', 'TAV Roma', 'ABC12DE34', '1980-05-15', '3331234567']
    ];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('template_label'));
    XLSX.writeFile(wb, 'template_utenti.xlsx');
  };

  const handleExportUsersExcel = () => {
    const exportData = users.map(u => ({
      Nome: u.name,
      Cognome: u.surname,
      Email: u.email,
      Ruolo: u.role,
      Categoria: u.category,
      Qualifica: u.qualification,
      Società: u.society,
      'Codice Tiratore': u.shooter_code,
      'Data di Nascita': u.birth_date,
      Telefono: u.phone,
      Stato: u.status
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('users'));
    XLSX.writeFile(wb, 'utenti_clay_tracker.xlsx');
  };

  const handleImportUsersExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const importedUsers = data.map((row: any) => ({
          name: row.Nome || row.name,
          surname: row.Cognome || row.surname,
          email: row.Email || row.email,
          role: row.Ruolo || row.role || 'user',
          category: row.Categoria || row.category,
          qualification: row.Qualifica || row.qualification,
          society: row.Società || row.society,
          shooter_code: row['Codice Tiratore'] || row.shooter_code,
          birth_date: row['Data di Nascita'] || row.birth_date,
          phone: row.Telefono || row.phone
        }));

        triggerConfirm(
          t('import'),
          t('import_users_confirm').replace('{{count}}', String(importedUsers.length)),
          async () => {
            try {
              const res = await fetch('/api/admin/users/import', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ users: importedUsers })
              });
              
              if (!res.ok) throw new Error(t('import_error_msg'));
              
              const results = await res.json();
              fetchUsers();
              if (triggerToast) {
                triggerToast(
                  t('import_completed')
                    .replace('{{created}}', String(results.created))
                    .replace('{{updated}}', String(results.updated))
                    .replace('{{errors}}', String(results.errors)), 
                  results.errors > 0 ? 'error' : 'success'
                );
              }
            } catch (err) {
              console.error('Error importing users:', err);
              setError(t('import_error_msg'));
            }
          },
          t('import'),
          'primary'
        );
      } catch (err) {
        console.error('Error reading Excel file:', err);
        setError(t('excel_read_error'));
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center justify-between sm:justify-start gap-4">
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <i className="fas fa-users-cog text-orange-500"></i> {currentUser?.role === 'society' ? t('shooter_management') : (currentUser?.role === 'admin' ? t('user_management_label') : t('users'))}
            {(loading || backgroundLoading) && <i className="fas fa-circle-notch fa-spin text-orange-500 text-xs ml-2"></i>}
          </h2>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            {totalUsers} {totalUsers === 1 ? t('user') : t('users')}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 lg:justify-end">
          {(currentUser?.role === 'admin' || currentUser?.role === 'society') && !showUserForm && (
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide scroll-shadows">
              {currentUser?.role === 'admin' && (
                <>
                  <button 
                    onClick={() => setShowDashboard(!showDashboard)}
                    className={`w-11 h-11 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center sm:gap-2 border shrink-0 ${
                      showDashboard 
                        ? 'bg-orange-600/10 text-orange-500 border-orange-500/30' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border-slate-700'
                    }`}
                    title={showDashboard ? t('close_label') : t('show_dashboard')}
                  >
                    <i className={`fas ${showDashboard ? 'fa-chart-line' : 'fa-chart-bar'} text-lg sm:text-xs`}></i>
                    <span className="hidden sm:inline">{t('dashboard_label')}</span>
                  </button>
                  <button 
                    onClick={handleDownloadTemplate}
                    className="w-11 h-11 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center sm:gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 shrink-0"
                    title={t('download_template')}
                  >
                    <i className="fas fa-file-download text-lg sm:text-xs"></i>
                    <span className="hidden sm:inline">{t('template_label')}</span>
                  </button>
                  <button 
                    onClick={handleExportUsersExcel}
                    className="w-11 h-11 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center sm:gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 shrink-0"
                    title={t('export_excel')}
                  >
                    <i className="fas fa-file-excel text-lg sm:text-xs"></i>
                    <span className="hidden sm:inline">{t('export')}</span>
                  </button>
                  <label className="w-11 h-11 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center sm:gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 cursor-pointer shrink-0">
                    <i className="fas fa-file-import text-lg sm:text-xs"></i>
                    <span className="hidden sm:inline">{t('import')}</span>
                    <input type="file" accept=".xlsx, .xls" onChange={handleImportUsersExcel} className="hidden" />
                  </label>
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`w-11 h-11 sm:w-auto sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center sm:gap-2 border shrink-0 ${
                showFilters || hasActiveFilters 
                  ? 'bg-orange-600/10 text-orange-500 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <i className={`fas fa-sliders-h ${showFilters ? 'rotate-180 text-orange-500' : ''} transition-transform`}></i>
              <span className="hidden sm:inline">{t('filters_label')}</span>
              {hasActiveFilters && !showFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 ml-1"></span>
              )}
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={usersPerPage}
                onChange={(e) => {
                  setUsersPerPage(Number(e.target.value));
                  setUsersPage(1);
                }}
                className="bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 text-[10px] font-black text-slate-400 uppercase focus:outline-none focus:border-orange-500/50"
              >
                <option value={25}>{t('entries_per_page').replace('{{count}}', '25')}</option>
                <option value={50}>{t('entries_per_page').replace('{{count}}', '50')}</option>
                <option value={100}>{t('entries_per_page').replace('{{count}}', '100')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {showFilters && !showUserForm && (
        <div className="mt-4 p-5 bg-slate-950/50 rounded-2xl border border-slate-800/80 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-300 mb-6">
          <div className={`grid grid-cols-1 ${currentUser?.role === 'admin' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
            {currentUser?.role === 'admin' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                  <i className="fas fa-user-tag text-orange-500"></i>
                  {t('filter_role')}
                </label>
                <select
                  value={filterRole}
                  onChange={(e) => {
                    setFilterRole(e.target.value);
                    setUsersPage(1);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-4 py-3 focus:border-orange-500 transition-colors appearance-none cursor-pointer font-bold"
                >
                  <option value="">{t('all_roles')}</option>
                  <option value="user">{t('shooter_role')}</option>
                  <option value="society">{t('society_role')}</option>
                  <option value="admin">{t('admin_role')}</option>
                </select>
              </div>
            )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                  <i className="fas fa-search text-orange-500"></i>
                  {t('search_user_placeholder')}
                </label>
                <UserSearchInput 
                  placeholder={t('search_user_placeholder')} 
                  value={userSearchTerm}
                  onChange={(val) => {
                    setUserSearchTerm(val);
                    setUsersPage(1);
                  }}
                />
              </div>

              {currentUser?.role === 'admin' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                    <i className="fas fa-building text-orange-500"></i>
                    {t('society')}
                  </label>
                  <SocietySearch 
                    value={userFilterSociety}
                    onChange={(val) => {
                      setUserFilterSociety(val);
                      setUsersPage(1);
                    }}
                    societies={societies}
                    placeholder={t('select_dot')}
                  />
                </div>
              )}

              <div className="flex items-end justify-end pt-2">
                <button 
                  onClick={() => {
                    setUserSearchTerm('');
                    setFilterRole('');
                    setUserFilterSociety('');
                    setUsersPage(1);
                  }}
                  className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400 transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-undo-alt"></i>
                  {t('reset_filters')}
                </button>
              </div>
          </div>
        </div>
      )}

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
        <KPIDashboard />
      )}

      {showUserForm && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1200] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 sm:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
              <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <i className={`fas ${editingUser ? 'fa-user-edit' : 'fa-user-plus'} text-orange-500`}></i> 
                {editingUser 
                  ? (currentUser?.role === 'society' ? t('edit_shooter_title') : t('edit_user_title')) 
                  : (currentUser?.role === 'society' ? t('new_shooter_title') : t('new_user_title'))}
              </h3>
              <button onClick={() => { setShowUserForm(false); setEditingUser(null); setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); setShooterCode(''); setUserAvatar(''); setBirthDate(''); setPhone(''); }} className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95 shadow-lg border border-slate-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
              <form id="admin-user-form" onSubmit={handleSubmit} className="space-y-6">
                
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
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('profile_photo')} (Max 2MB)</span>
          </div>

          <div className="space-y-4 mb-6">
            {/* Row 1: Ruolo, Società, Codice */}
            <div className={`grid grid-cols-1 ${currentUser?.role !== 'society' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
              {currentUser?.role !== 'society' && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('role')}</label>
                  <select 
                    value={role} 
                    onChange={e => setRole(e.target.value)} 
                    disabled={currentUser?.role === 'society'}
                    className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="user">{t('shooter')}</option>
                    <option value="society">{t('club_label')}</option>
                    <option value="admin">{t('admin')}</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('club')}</label>
                <SocietySearch 
                  value={society}
                  onChange={setSociety}
                  societies={societies}
                  placeholder={t('select_dot')}
                  disabled={currentUser?.role === 'society'}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  {role === 'society' ? t('club_code_required') : t('shooter_code')}
                </label>
                <input 
                  type="text" 
                  required={role === 'society'} 
                  value={shooterCode} 
                  onChange={e => setShooterCode(role === 'user' ? e.target.value.toUpperCase() : e.target.value)} 
                  disabled={currentUser?.role === 'society' && !!editingUser}
                  pattern={role === 'user' ? "[A-Z]{3}\\d{2}[A-Z]{2}\\d{2}" : undefined}
                  title={role === 'user' ? t('shooter_code_format_title') : undefined}
                  placeholder={role === 'user' ? t('shooter_code_placeholder') : ""}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role === 'society' && !!editingUser ? 'opacity-50 cursor-not-allowed' : ''} ${role === 'user' ? 'uppercase' : ''}`} 
                />
              </div>
            </div>

            {/* Row 2: Nome, Cognome */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('name')}</label>
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('surname')}</label>
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('birth_date')}</label>
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('phone')}</label>
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('category')}</label>
                  <select required={!qualification} value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                    <option value="">{t('select_dot')}</option>
                    <option value="Eccellenza">Eccellenza</option>
                    <option value="1*">1*</option>
                    <option value="2*">2*</option>
                    <option value="3*">3*</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('qualification')}</label>
                  <select required={!category} value={qualification} onChange={e => setQualification(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                    <option value="">{t('select_dot')}</option>
                    <option value="MAN">MAN (Man)</option>
                    <option value="LAD">LAD (Lady)</option>
                    <option value="JUN">JUN (Junior)</option>
                    <option value="SEN">SEN (Senior)</option>
                    <option value="VET">VET (Veteran)</option>
                    <option value="MAS">MAS (Master)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Row 4.5: International Toggle & Status (Admin Only) */}
            {currentUser?.role === 'admin' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{t('international_shooter_label')}</span>
                    <span className="text-[9px] text-slate-500 font-medium leading-none">{t('international_shooter_desc')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsInternational(!isInternational)}
                    className={`w-10 h-5 rounded-full transition-all relative ${isInternational ? 'bg-orange-600' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isInternational ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{t('verified_email_label_desc')}</span>
                    <span className="text-[9px] text-slate-500 font-medium leading-none">{t('verified_email_status_desc')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEmailVerified(!isEmailVerified)}
                    className={`w-10 h-5 rounded-full transition-all relative ${isEmailVerified ? 'bg-emerald-600' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isEmailVerified ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>
            )}

            {/* Row 4.6: International Fields (Conditional) */}
            {isInternational && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('nationality')}</label>
                  <input 
                    type="text" 
                    value={nationality} 
                    onChange={e => setNationality(e.target.value)} 
                    placeholder={t('nationality_placeholder')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('international_id_label')}</label>
                  <input 
                    type="text" 
                    value={internationalId} 
                    onChange={e => setInternationalId(e.target.value)} 
                    placeholder={t('international_id_placeholder')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('original_club_label')}</label>
                  <input 
                    type="text" 
                    value={originalClub} 
                    onChange={e => setOriginalClub(e.target.value)} 
                    placeholder={t('original_club_placeholder')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                  />
                </div>
              </div>
            )}

            {/* Row 5: Email, Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('email')}</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('password_label')} {editingUser && t('password_change_notice')}</label>
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

          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm py-4 border-t border-slate-800 mt-8 flex justify-end gap-3 shrink-0 px-6 sm:px-8">
            <button type="button" onClick={() => { setShowUserForm(false); setEditingUser(null); setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); setShooterCode(''); setUserAvatar(''); setBirthDate(''); setPhone(''); }} className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-slate-800 text-white hover:bg-slate-700">
              {t('cancel')}
            </button>
            <button type="submit" form="admin-user-form" className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20">
              {editingUser ? t('save') : t('create')}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

      <div className="overflow-x-auto scroll-shadows">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('name')}>
                {t('name')} {userSortConfig?.key === 'name' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('shooter_code')}>
                {t('shooter_code')} {userSortConfig?.key === 'shooter_code' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('society')}>
                {t('society_label')} {userSortConfig?.key === 'society' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('category')}>
                {t('cat_qual_short')} {userSortConfig?.key === 'category' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('email')}>
                {t('email')} {userSortConfig?.key === 'email' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
              </th>
              {currentUser?.role !== 'society' && (
                <th className="py-3 px-4 cursor-pointer hover:text-slate-300 transition-colors group" onClick={() => requestUserSort('role')}>
                  {t('role')} {userSortConfig?.key === 'role' ? (userSortConfig?.direction === 'asc' ? <i className="fas fa-sort-up ml-1 text-orange-500"></i> : <i className="fas fa-sort-down ml-1 text-orange-500"></i>) : <i className="fas fa-sort ml-1 opacity-0 group-hover:opacity-50"></i>}
                </th>
              )}
              <th className="py-3 px-4 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map(u => (
              <UserRow 
                key={u.id} 
                user={u} 
                currentUser={currentUser} 
                societies={societies}
                onSelect={setSelectedUser}
                onToggleStatus={handleToggleStatus}
                onEdit={editUser}
                onDelete={handleDelete}
              />
            ))}
            {sortedUsers.length === 0 && (
              <tr>
                <td colSpan={currentUser?.role === 'society' ? 6 : 7} className="py-8 text-center text-slate-500 text-sm italic">
                  {t('no_users_found')}
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
            {t('page_indicator').replace('{{page}}', String(usersPage)).replace('{{total}}', String(Math.ceil(totalUsers / usersPerPage)))}
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1200] flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
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
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('email')}</p>
                    <p className="text-sm font-bold text-white break-all">{selectedUser.email}</p>
                  </div>
                )}
                {selectedUser.phone && (
                  <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('phone')}</p>
                    <p className="text-sm font-bold text-white">{selectedUser.phone}</p>
                  </div>
                )}
                {selectedUser.birth_date && (
                  <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('birth_date')}</p>
                    <p className="text-sm font-bold text-white">
                      {new Date(selectedUser.birth_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US')}
                    </p>
                  </div>
                )}
                {selectedUser.society && (
                  <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('club')}</p>
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
                      {selectedUser.role === 'society' ? t('club_code') : t('shooter_code')}
                    </p>
                    <p className="text-sm font-bold text-white uppercase">{selectedUser.shooter_code}</p>
                  </div>
                )}
                {selectedUser.category && (
                  <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('category')}</p>
                    <p className="text-sm font-bold text-white">{selectedUser.category}</p>
                  </div>
                )}
                {selectedUser.qualification && (
                  <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('qualification')}</p>
                    <p className="text-sm font-bold text-white">{selectedUser.qualification}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm p-6 border-t border-slate-800 flex flex-wrap gap-3">
              {(currentUser?.role === 'admin' || currentUser?.role === 'society') && (
                <button 
                  onClick={() => {
                    setSelectedUser(null);
                    editUser(selectedUser);
                    setShowUserForm(true);
                  }} 
                  disabled={currentUser?.role === 'society' && selectedUser.role === 'admin'}
                  className="flex-1 py-4 rounded-2xl bg-slate-800 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title={currentUser?.role === 'society' && selectedUser.role === 'admin' ? t('cannot_edit_admin') : t('edit')}
                >
                  <i className="fas fa-edit"></i> {t('edit')}
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
                  title={currentUser?.role === 'society' ? t('only_admin_can_delete') : (selectedUser.email === 'snecaj@gmail.com' ? t('cannot_delete_main_account') : t('delete'))}
                >
                  <i className="fas fa-trash-alt"></i> {t('delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default UserManagement;
