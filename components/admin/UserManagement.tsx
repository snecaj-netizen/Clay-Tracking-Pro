import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  onDelete,
  isSelected,
  onToggleSelect
}: { 
  user: any, 
  currentUser: any, 
  societies: any[], 
  onSelect: (u: any) => void, 
  onToggleStatus: (id: number, status: string) => void, 
  onEdit: (u: any) => void, 
  onDelete: (id: number) => void,
  isSelected: boolean,
  onToggleSelect: (id: number) => void
}) => {
  const { t } = useLanguage();
  
  return (
    <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
      <td className="py-3 px-4">
        <input 
          type="checkbox" 
          checked={isSelected} 
          disabled={u.email === 'snecaj@gmail.com'}
          onChange={() => onToggleSelect(u.id)}
          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-orange-600 focus:ring-orange-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        />
      </td>
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
    shotgunBrand, setShotgunBrand, shotgunModel, setShotgunModel, cartridgeBrand, setCartridgeBrand, cartridgeModel, setCartridgeModel,
    hideInternalFAB
  } = useAdmin();

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSortConfig, setUserSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<any | null>(null);
  const [validationRows, setValidationRows] = useState<any[] | null>(null);
  const [importFilterTab, setImportFilterTab] = useState<'all' | 'update' | 'create' | 'conflict'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const hasActiveFilters = filterRole !== '' || userSearchTerm !== '' || userFilterSociety !== '';

  useEffect(() => {
    if (role === 'society') {
      setSurname('');
      setIsInternational(false);
    }
  }, [role, setSurname, setIsInternational]);

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
      nationality, international_id: internationalId, original_club: originalClub, is_international: isInternational, email_verified: isEmailVerified,
      shotgun_brand: shotgunBrand, shotgun_model: shotgunModel, cartridge_brand: cartridgeBrand, cartridge_model: cartridgeModel
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

  const handleToggleSelectUser = useCallback((id: number) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleBulkDelete = (targetIds?: number[]) => {
    const idsToDelete = targetIds || selectedUserIds;
    if (idsToDelete.length === 0) return;

    triggerConfirm(
      t('delete') + ` ${idsToDelete.length} ` + t('users_label'),
      `Sei sicuro di voler cancellare definitivamente questi ${idsToDelete.length} utenti? Questa azione è irreversibile.`,
      async () => {
        try {
          const res = await fetch('/api/admin/users/bulk-delete', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ ids: idsToDelete })
          });

          if (!res.ok) throw new Error("Errore durante l'eliminazione di massa degli utenti");
          
          if (triggerToast) {
            triggerToast("Utenti eliminati con successo", "success");
          }
          setSelectedUserIds([]);
          fetchUsers();
          fetchSocieties();
        } catch (err: any) {
          setError(err.message);
        }
      },
      t('delete'),
      'danger'
    );
  };

  const handleDeleteAllFiltered = () => {
    const filteredUsersToDelete = sortedUsers.filter(u => u.email !== 'snecaj@gmail.com');
    if (filteredUsersToDelete.length === 0) return;

    const idsToDelete = filteredUsersToDelete.map(u => u.id);
    
    triggerConfirm(
      "Elimina Tutti i Filtrati",
      `Sei sicuro di voler cancellare definitivamente TUTTI i ${filteredUsersToDelete.length} tiratori attualmente corrispondenti ai filtri applicati? Questa operazione è irreversibile.`,
      async () => {
        try {
          const res = await fetch('/api/admin/users/bulk-delete', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ ids: idsToDelete })
          });

          if (!res.ok) throw new Error("Errore durante l'eliminazione degli utenti filtrati");
          
          if (triggerToast) {
            triggerToast("Tutti i tiratori filtrati sono stati eliminati", "success");
          }
          setSelectedUserIds([]);
          fetchUsers();
          fetchSocieties();
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
    setShotgunBrand(user.shotgun_brand || '');
    setShotgunModel(user.shotgun_model || '');
    setCartridgeBrand(user.cartridge_brand || '');
    setCartridgeModel(user.cartridge_model || '');
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

  const parseExcelDate = (val: any): string | null => {
    if (!val) return null;
    // If it's already a JS Date object
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return val.toISOString().split('T')[0];
    }
    // If it's a number (Excel date serial)
    if (typeof val === 'number') {
      const utcDate = new Date(Date.UTC(1899, 11, 30 + val));
      if (!isNaN(utcDate.getTime())) {
        return utcDate.toISOString().split('T')[0];
      }
    }
    // If it's a string, try parsing it
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      
      // Check if it fits common European formats: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
      const dmyRegex = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/;
      const dmyMatch = trimmed.match(dmyRegex);
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed in JS
        const year = parseInt(dmyMatch[3], 10);
        const customDate = new Date(year, month, day);
        if (!isNaN(customDate.getTime())) {
          const mm = String(month + 1).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          return `${year}-${mm}-${dd}`;
        }
      }
      
      // Generic fallback
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const yyyy = parsed.getFullYear();
        if (yyyy > 1900) {
          const mm = String(parsed.getMonth() + 1).padStart(2, '0');
          const dd = String(parsed.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }
    return null;
  };

  const getProposedChanges = (v: any) => {
    if (!v.existing) return [];
    const fields = [
      { key: 'name', label: 'Nome' },
      { key: 'surname', label: 'Cognome' },
      { key: 'category', label: 'Categoria' },
      { key: 'qualification', label: 'Qualifica' },
      { key: 'society', label: 'Società' },
      { key: 'birth_date', label: 'Data di Nascita', isDate: true },
      { key: 'phone', label: 'Telefono' },
      { key: 'email', label: 'Email', customUserVal: v.decisionEmail },
    ];

    const diffs: { label: string; oldVal: string; newVal: string }[] = [];

    fields.forEach(f => {
      let oldVal = v.existing[f.key] || '';
      let newVal = f.customUserVal !== undefined ? (f.customUserVal || '') : (v.user[f.key] || '');

      if (f.isDate) {
        if (oldVal) {
          try { oldVal = new Date(oldVal).toISOString().split('T')[0]; } catch (e) {}
        }
        if (newVal) {
          try { newVal = new Date(newVal).toISOString().split('T')[0]; } catch (e) {}
        }
      }

      const cleanOld = String(oldVal).trim();
      const cleanNew = String(newVal).trim();

      if (cleanNew && cleanNew !== cleanOld) {
        diffs.push({
          label: f.label,
          oldVal: cleanOld || 'Nessuno/a',
          newVal: cleanNew
        });
      }
    });

    return diffs;
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
          birth_date: parseExcelDate(row['Data di Nascita'] || row.birth_date),
          phone: row.Telefono || row.phone
        }));

        setIsImporting(true);
        try {
          const res = await fetch('/api/admin/users/import/validate', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ users: importedUsers })
          });
          
          if (!res.ok) throw new Error(t('import_error_msg'));
          const validationData = await res.json();
          
          const rowsWithChoices = validationData.map((v: any, index: number) => {
            let initialAction: 'create' | 'update' = 'create';
            let initialEmail = v.user.email;
            
            if (v.state === 'update') {
              initialAction = 'update';
            } else if (v.state === 'conflict_omonimia') {
              initialAction = 'create';
              if (v.user.email) {
                initialEmail = v.user.email;
              } else {
                const cleanName = (v.user.name || 'user').toLowerCase().replace(/\s+/g, '');
                const cleanSurname = (v.user.surname || 'surname').toLowerCase().replace(/\s+/g, '');
                initialEmail = `${cleanName}.${cleanSurname}@gmail.com`;
              }
            }
            
            return {
              ...v,
              decisionAction: initialAction,
              decisionEmail: initialEmail
            };
          });
          
          setValidationRows(rowsWithChoices);
        } catch (err) {
          console.error('Error validating users:', err);
          setError(t('import_error_msg'));
          if (triggerToast) {
            triggerToast(t('import_error_msg'), 'error');
          }
        } finally {
          setIsImporting(false);
        }
      } catch (err) {
        console.error('Error reading Excel file:', err);
        setError(t('excel_read_error'));
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const handleSaveImportedUsers = async () => {
    if (!validationRows) return;
    
    setIsImporting(true);
    try {
      const finalUsersPayload = validationRows.map((v: any) => ({
        action: v.decisionAction,
        existingUserId: v.decisionAction === 'update' ? v.existing?.id : undefined,
        data: {
          ...v.user,
          email: v.decisionEmail
        }
      }));

      const res = await fetch('/api/admin/users/import', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ users: finalUsersPayload })
      });
      
      if (!res.ok) throw new Error(t('import_error_msg'));
      
      const results = await res.json();
      fetchUsers();
      setValidationRows(null);
      setImportResults(results);
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
      console.error('Error saving imported users:', err);
      setError(t('import_error_msg'));
      if (triggerToast) {
        triggerToast(t('import_error_msg'), 'error');
      }
    } finally {
      setIsImporting(false);
    }
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

  const SHOTGUN_BRANDS = [
    'Benelli', 'Beretta', 'Browning', 'Caesar Guerini', 'Fabarm', 'Franchi',
    'Krieghoff', 'Marocchi', 'Perazzi', 'Rizzini', 'Sabatti', 'Zoli', 'Altro'
  ];

  const CARTRIDGE_BRANDS = [
    'Baschieri & Pellagri', 'Bornaghi', 'Cheddite', 'Clever', 'Fiocchi',
    'Nobel Sport', 'RC', 'Trust', 'Winchester', 'Altro'
  ];

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
                  {role === 'society' ? `${t('club_code_required')} *` : `${t('shooter_code')} *`}
                </label>
                <input 
                  type="text" 
                  required={role === 'user' || role === 'society'} 
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
              <div className={role === 'society' ? 'md:col-span-2' : ''}>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{role === 'society' ? t('society_name') : t('name')}</label>
                <input 
                  type="text" 
                  required 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  disabled={currentUser?.role === 'society' && !!editingUser}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all min-w-0 ${currentUser?.role === 'society' && !!editingUser ? 'opacity-50 cursor-not-allowed' : ''}`} 
                />
              </div>
              {role !== 'society' && (
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
              )}
            </div>

            {/* Equipment Row */}
            {role !== 'society' && (
              <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                  <i className="fas fa-crosshairs"></i> {t('equipment_label')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('shotgun_brand')}</label>
                    <select 
                      value={shotgunBrand} 
                      onChange={e => setShotgunBrand(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                    >
                      <option value="">{t('select_dot')}</option>
                      {SHOTGUN_BRANDS.map(brand => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('shotgun_model')}</label>
                    <input 
                      type="text" 
                      value={shotgunModel} 
                      onChange={e => setShotgunModel(e.target.value)} 
                      placeholder={t('shotgun_model_placeholder')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('cartridge_brand')}</label>
                    <select 
                      value={cartridgeBrand} 
                      onChange={e => setCartridgeBrand(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                    >
                      <option value="">{t('select_dot')}</option>
                      {CARTRIDGE_BRANDS.map(brand => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('cartridge_model')}</label>
                    <input 
                      type="text" 
                      value={cartridgeModel} 
                      onChange={e => setCartridgeModel(e.target.value)} 
                      placeholder={t('cartridge_model_placeholder')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" 
                    />
                  </div>
                </div>
              </div>
            )}
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
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                    <option value="">{t('select_dot')}</option>
                    <option value="Eccellenza">Eccellenza</option>
                    <option value="1*">1*</option>
                    <option value="2*">2*</option>
                    <option value="3*">3*</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('qualification')}</label>
                  <select value={qualification} onChange={e => setQualification(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
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
                {role !== 'society' ? (
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
                ) : (
                  <div className="hidden md:block"></div>
                )}
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('password_label')} {editingUser ? t('password_change_notice') : `(${t('optional') || 'Opzionale'})`}</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required={false} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 pr-10 text-white text-sm focus:border-orange-600 outline-none transition-all" />
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
              {editingUser ? t('save') : t('create_label')}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

      {/* Bulk actions and filters context indicator bar */}
      {(selectedUserIds.length > 0 || (hasActiveFilters && sortedUsers.length > 0)) && (
        <div className="mb-6 p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            {selectedUserIds.length > 0 ? (
              <span>Selezionati <strong>{selectedUserIds.length}</strong> tiratori. Puoi cancellarli tutti insieme o deselezionarli.</span>
            ) : (
              <span>Filtri attivi. Trovati <strong>{sortedUsers.length}</strong> tiratori corrispondenti. Puoi eliminarli in blocco.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
            {selectedUserIds.length > 0 && (
              <button 
                onClick={() => handleBulkDelete()}
                className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white border border-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-red-600/10"
              >
                <i className="fas fa-trash"></i> Elimina selezionati ({selectedUserIds.length})
              </button>
            )}
            {hasActiveFilters && sortedUsers.filter(u => u.email !== 'snecaj@gmail.com').length > 0 && (
              <button 
                onClick={handleDeleteAllFiltered}
                className="w-full sm:w-auto px-4 py-2.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 hover:border-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fas fa-user-minus"></i> Elimina filtrati ({sortedUsers.filter(u => u.email !== 'snecaj@gmail.com').length})
              </button>
            )}
            {selectedUserIds.length > 0 && (
              <button 
                onClick={() => setSelectedUserIds([])}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer text-center"
              >
                Annulla
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto scroll-shadows">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <th className="py-3 px-4 w-12 text-center">
                <input 
                  type="checkbox" 
                  checked={sortedUsers.length > 0 && sortedUsers.filter(u => u.email !== 'snecaj@gmail.com').every(u => selectedUserIds.includes(u.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const selectable = sortedUsers.filter(u => u.email !== 'snecaj@gmail.com').map(u => u.id);
                      setSelectedUserIds(prev => Array.from(new Set([...prev, ...selectable])));
                    } else {
                      const visibleIds = sortedUsers.map(u => u.id);
                      setSelectedUserIds(prev => prev.filter(id => !visibleIds.includes(id)));
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-850 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
              </th>
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
                isSelected={selectedUserIds.includes(u.id)}
                onToggleSelect={handleToggleSelectUser}
              />
            ))}
            {sortedUsers.length === 0 && (
              <tr>
                <td colSpan={currentUser?.role === 'society' ? 7 : 8} className="py-8 text-center text-slate-500 text-sm italic">
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

      {isImporting && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-4">
          <div className="relative flex flex-col items-center max-w-sm text-center">
            {/* Spinning custom circular animation */}
            <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-orange-500 animate-spin mb-6"></div>
            <h3 className="text-xl font-black text-white uppercase italic tracking-wider mb-2">
              Elaborazione in Corso
            </h3>
            <p className="text-slate-400 text-sm">
              Il sistema sta analizzando, creando e aggiornando i profili dei tiratori. Non chiudere questa pagina.
            </p>
          </div>
        </div>
      , document.body)}

      {importResults && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9990] flex items-center justify-center p-4" onClick={() => setImportResults(null)}>
          <div 
            className="bg-slate-950 border border-slate-800/80 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header with decorative visuals */}
            <div className="relative bg-slate-900 border-b border-slate-800/60 p-6 flex items-center justify-between overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-orange-600/10 rounded-full blur-3xl -mr-24 -mt-24"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-black text-white uppercase italic tracking-wider flex items-center gap-2">
                  <i className="fas fa-file-import text-orange-500"></i> Risultato Importazione
                </h3>
                <p className="text-xs text-slate-400 mt-1">Sintesi dell'elaborazione del file Excel</p>
              </div>
              <button 
                onClick={() => setImportResults(null)} 
                className="relative z-10 w-10 h-10 rounded-xl bg-slate-800 hover:bg-red-600/20 hover:text-red-500 text-slate-400 transition-all flex items-center justify-center shadow-md cursor-pointer"
              >
                <i className="fas fa-times text-md"></i>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50 text-center">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Nuovi Caricati</p>
                  <p className="text-2xl font-black text-white">{importResults.created}</p>
                </div>
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50 text-center">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Aggiornati</p>
                  <p className="text-2xl font-black text-white">{importResults.updated}</p>
                </div>
                <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50 text-center">
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Errori</p>
                  <p className="text-2xl font-black text-white">{importResults.errors}</p>
                </div>
              </div>

              {/* Updates Details Log */}
              {importResults.updatedDetails && importResults.updatedDetails.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <i className="fas fa-exchange-alt text-blue-500"></i> Dettaglio Utenti Aggiornati
                  </h4>
                  <div className="border border-slate-800 rounded-2xl divide-y divide-slate-800 max-h-72 overflow-y-auto bg-slate-900/10 shrink-0">
                    {importResults.updatedDetails.map((userDetail: any, idx: number) => (
                      <div key={idx} className="p-4 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="text-sm font-black text-white uppercase italic tracking-tight">
                            {userDetail.name} {userDetail.surname}
                          </p>
                          <span className="text-[10px] font-medium text-slate-500">
                            {userDetail.email}
                          </span>
                        </div>
                        <ul className="space-y-1 pl-3 border-l-2 border-orange-500/40">
                          {userDetail.changes.map((change: string, changeIdx: number) => (
                            <li key={changeIdx} className="text-xs text-slate-200 flex items-center gap-2 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                              <span>{change}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action button at bottom */}
            <div className="p-6 bg-slate-900/90 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setImportResults(null)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {validationRows && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9980] flex items-center justify-center p-4">
          <div 
            className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative"
          >
            {/* Header */}
            <div className="relative bg-slate-900 border-b border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between overflow-hidden gap-4">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-white uppercase italic tracking-wider flex items-center gap-2">
                  <i className="fas fa-user-check text-orange-500 animate-pulse"></i> Validazione Importazione Utenti
                </h3>
                <p className="text-xs text-slate-400 mt-1">Risolvi le omonime e decidi se integrare i profili o sdoppiarli prima del salvataggio finale</p>
              </div>
              <div className="relative z-10 shrink-0 flex items-center gap-3">
                <span className="bg-slate-800 border border-slate-700 text-xs text-slate-300 font-bold px-3 py-1.5 rounded-xl">
                  {validationRows.length} tiratori trovati nel file
                </span>
                <button 
                  onClick={() => setValidationRows(null)} 
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-red-600/20 hover:text-red-500 text-slate-400 transition-all flex items-center justify-center shadow-md cursor-pointer"
                >
                  <i className="fas fa-times text-md"></i>
                </button>
              </div>
            </div>

            {/* Tabs for quick filtering */}
            <div className="bg-slate-900/40 border-b border-slate-800/80 p-4 flex gap-3 overflow-x-auto shrink-0 justify-center">
              <button
                type="button"
                onClick={() => setImportFilterTab('all')}
                className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  importFilterTab === 'all'
                    ? 'border-slate-700 bg-slate-800 text-white shadow-lg'
                    : 'border-slate-800/60 bg-slate-950/40 text-slate-400 hover:border-slate-800 hover:text-slate-300'
                }`}
              >
                <span>Tutti</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                  importFilterTab === 'all' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {validationRows.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setImportFilterTab('update')}
                className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  importFilterTab === 'update'
                    ? 'border-blue-500/50 bg-blue-900/40 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                    : 'border-slate-800/60 bg-slate-950/40 text-slate-400 hover:border-blue-500/30 hover:text-blue-400/80'
                }`}
              >
                <i className="fas fa-sync-alt"></i>
                <span>Da Aggiornare</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                  importFilterTab === 'update' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {validationRows.filter((v: any) => v.decisionAction === 'update').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setImportFilterTab('create')}
                className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  importFilterTab === 'create'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                    : 'border-slate-800/60 bg-slate-950/40 text-slate-400 hover:border-emerald-500/30 hover:text-emerald-400/80'
                }`}
              >
                <i className="fas fa-plus"></i>
                <span>Nuovi</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                  importFilterTab === 'create' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {validationRows.filter((v: any) => v.decisionAction === 'create').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setImportFilterTab('conflict')}
                className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  importFilterTab === 'conflict'
                    ? 'border-orange-500/50 bg-orange-500/10 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                    : 'border-slate-800/60 bg-slate-950/40 text-slate-400 hover:border-orange-500/30 hover:text-orange-400/80'
                }`}
              >
                <i className="fas fa-exclamation-triangle"></i>
                <span>Conflitti</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                  importFilterTab === 'conflict' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {validationRows.filter((v: any) => v.state === 'conflict_omonimia').length}
                </span>
              </button>
            </div>

            {/* Scrollable validation list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {validationRows.map((v: any, index: number) => {
                const matchesFilter = 
                  importFilterTab === 'all' || 
                  (importFilterTab === 'update' && v.decisionAction === 'update') || 
                  (importFilterTab === 'create' && v.decisionAction === 'create') ||
                  (importFilterTab === 'conflict' && v.state === 'conflict_omonimia');

                if (!matchesFilter) return null;

                const isConflict = v.state === 'conflict_omonimia';
                const isUpdate = v.state === 'update';
                const isCreate = v.state === 'create';

                return (
                  <div 
                    key={index} 
                    className={`border rounded-2xl transition-all overflow-hidden ${
                      isConflict 
                        ? 'border-orange-500 bg-orange-500/[0.02] shadow-[0_0_20px_rgba(249,115,22,0.05)]' 
                        : isUpdate 
                          ? 'border-blue-500/40 bg-blue-500/[0.01]' 
                          : 'border-slate-800/80 bg-slate-950'
                    }`}
                  >
                    {/* State banner */}
                    <div className={`px-4 py-2 border-b flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest ${
                      isConflict 
                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' 
                        : isUpdate 
                          ? 'bg-blue-900/40 border-blue-500/50 text-blue-200' 
                          : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                    }`}>
                      <span className="flex items-center gap-2">
                        {isConflict && <i className="fas fa-exclamation-triangle"></i>}
                        {isUpdate && <i className="fas fa-user-edit"></i>}
                        {isCreate && <i className="fas fa-user-plus"></i>}
                        {isConflict ? 'Rilevato Conflitto (Possibile Omonimia)' : isUpdate ? 'Pianificato per Aggiornamento' : 'Nuovo Tiratore'}
                      </span>
                      <span className="opacity-70 text-[10px] lowercase italic font-normal">
                        {v.message || (isCreate ? 'Verrò creato come nuova scheda' : '')}
                      </span>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Main Data Split or Info Layout */}
                      {isConflict ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* File data (excel) */}
                          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
                            <h5 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-3">Da file caricato (Excel)</h5>
                            <div className="space-y-2">
                              <p className="text-sm font-black text-white italic">{v.user.name} {v.user.surname}</p>
                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                                <div><span className="text-slate-500">Codice:</span> <span className="font-mono uppercase">{v.user.shooter_code || 'Non inserito'}</span></div>
                                <div><span className="text-slate-500">Email:</span> <span>{v.user.email}</span></div>
                                <div><span className="text-slate-500">Società:</span> <span className="italic">{v.user.society || 'Nessuna'}</span></div>
                                <div><span className="text-slate-500">Qualifica:</span> <span>{v.user.qualification || 'Nessuna'}</span></div>
                              </div>
                            </div>
                          </div>

                          {/* Existing data (db) */}
                          <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-800/40 opacity-90">
                            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Esistente nel database</h5>
                            <div className="space-y-2">
                              <p className="text-sm font-black text-slate-300 italic">{v.existing?.name} {v.existing?.surname}</p>
                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 font-medium">
                                <div><span className="text-slate-600">Codice:</span> <span className="font-mono uppercase">{v.existing?.shooter_code || 'Non impostato'}</span></div>
                                <div><span className="text-slate-600">Email:</span> <span>{v.existing?.email}</span></div>
                                <div><span className="text-slate-600">Società:</span> <span className="italic">{v.existing?.society || 'Nessuna'}</span></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-black text-white italic">{v.user.name} {v.user.surname}</p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                              <span><i className="fas fa-envelope text-slate-600 mr-1"></i> {v.user.email}</span>
                              {v.user.shooter_code && <span><i className="fas fa-id-card text-slate-600 mr-1 font-mono"></i> <span className="uppercase">{v.user.shooter_code}</span></span>}
                              {v.user.society && <span><i className="fas fa-building text-slate-600 mr-1"></i> <span className="italic">{v.user.society}</span></span>}
                            </div>
                          </div>
                          {isUpdate && v.existing && (
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <span>Aggiornerà il profilo:</span>
                              <span className="font-bold text-slate-300 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
                                ID {v.existing.id} - {v.existing.name} {v.existing.surname}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {v.decisionAction === 'update' && v.existing && (() => {
                        const diffs = getProposedChanges(v);
                        if (diffs.length === 0) {
                          return (
                            <div className="bg-slate-900/10 border border-slate-800/40 rounded-xl p-3 text-xs text-slate-450 italic mt-2">
                              <i className="fas fa-info-circle text-slate-500 mr-2"></i>
                              Tutti i dati personali nel database coincidono con il file Excel. Nessuna modifica necessaria.
                            </div>
                          );
                        }
                        return (
                          <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-4 space-y-2 animate-in fade-in duration-300 mt-2">
                            <h6 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                              <i className="fas fa-exchange-alt"></i> Modifiche personali che verranno salvate:
                            </h6>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                              {diffs.map((d, dIdx) => (
                                <div key={dIdx} className="bg-slate-950/45 border border-slate-800/40 rounded-lg p-2.5 flex flex-col justify-between text-xs hover:border-blue-500/10 transition-colors">
                                  <span className="text-slate-500 font-extrabold uppercase text-[9px] tracking-wider mb-1">{d.label}</span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-slate-400 line-through truncate max-w-[120px]" title={d.oldVal}>{d.oldVal}</span>
                                    <i className="fas fa-arrow-right text-[10px] text-blue-500"></i>
                                    <span className="text-blue-400 font-bold truncate max-w-[150px]" title={d.newVal}>{d.newVal}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Interactive Choice (Only for Conflict & optionally Customizable) */}
                      {isConflict && (
                        <div className="border-t border-slate-800/60 pt-4 space-y-4">
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
                            Seleziona l'azione corretta da applicare:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Option 1: Update Existing Profile */}
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...validationRows];
                                copy[index].decisionAction = 'update';
                                copy[index].decisionEmail = v.user.email; // reset to original
                                setValidationRows(copy);
                              }}
                              className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${
                                v.decisionAction === 'update'
                                  ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)] text-white'
                                  : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:border-slate-700 hover:bg-slate-900/60'
                              }`}
                            >
                              <div className="mt-1">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${v.decisionAction === 'update' ? 'border-blue-500 text-blue-500' : 'border-slate-600'}`}>
                                  {v.decisionAction === 'update' && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                                </span>
                              </div>
                              <div>
                                <h6 className="text-xs font-black uppercase tracking-wider mb-1">Unisci ed Aggiorna Profilo</h6>
                                <p className="text-[10px] leading-relaxed text-slate-400">
                                  Integrazione sicura. Aggiorna i dati del tiratore esistente ({v.existing?.name} {v.existing?.surname}) con i dati caricati.
                                </p>
                              </div>
                            </button>

                            {/* Option 2: Create Separate profile */}
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...validationRows];
                                copy[index].decisionAction = 'create';
                                // Proponi default unico d'accesso
                                if (v.user.email) {
                                  copy[index].decisionEmail = v.user.email;
                                } else {
                                  const cleanName = (v.user.name || 'user').toLowerCase().replace(/\s+/g, '');
                                  const cleanSurname = (v.user.surname || 'surname').toLowerCase().replace(/\s+/g, '');
                                  copy[index].decisionEmail = `${cleanName}.${cleanSurname}@gmail.com`;
                                }
                                setValidationRows(copy);
                              }}
                              className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${
                                v.decisionAction === 'create'
                                  ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.15)] text-white'
                                  : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:border-slate-700 hover:bg-slate-900/60'
                              }`}
                            >
                              <div className="mt-1">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${v.decisionAction === 'create' ? 'border-orange-500 text-orange-500' : 'border-slate-600'}`}>
                                  {v.decisionAction === 'create' && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                                </span>
                              </div>
                              <div>
                                <h6 className="text-xs font-black uppercase tracking-wider mb-1">Registra come Nuovo Tiratore</h6>
                                <p className="text-[10px] leading-relaxed text-slate-400">
                                  Gestione Omonimia. Lascia intatto il tiratore esistente e crea una nuova ed indipendente scheda personale.
                                </p>
                              </div>
                            </button>
                          </div>

                          {/* Email Customization Field if 'create' is active for this row */}
                          {v.decisionAction === 'create' && (
                            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl space-y-2 animate-in slide-in-from-top-2 duration-200">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                <i className="fas fa-key text-orange-500 mr-1"></i> E-mail d'Accesso Unica del Nuovo Profilo (Omonimo)
                              </label>
                              <p className="text-[10px] text-slate-500">
                                Poiché l'e-mail deve essere univoca per ciascun tiratore, per consentire l'accesso separato a Pippo e Pippo2, abbiamo generato un indirizzo e-mail unico di login. Puoi modificarlo liberamente:
                              </p>
                              <input 
                                type="email"
                                required
                                value={v.decisionEmail}
                                onChange={(e) => {
                                  const copy = [...validationRows];
                                  copy[index].decisionEmail = e.target.value;
                                  setValidationRows(copy);
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-orange-500 focus:outline-none transition-all font-semibold"
                                placeholder="Inserisci un'email unica di login"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions Footer */}
            <div className="p-6 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button 
                onClick={() => setValidationRows(null)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-widest transition-all cursor-pointer text-center"
              >
                Annulla Importazione
              </button>
              <button 
                onClick={handleSaveImportedUsers}
                className="w-full sm:w-auto px-10 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fas fa-check-circle"></i> Conferma ed Elabora {validationRows.length} Utenti
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default UserManagement;
