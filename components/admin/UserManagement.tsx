import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import SocietySearch from '../SocietySearch';
import KPIDashboard from './KPIDashboard';
import { User, UserRole, DashboardStats } from '../../types';
import { useAdmin } from '../../contexts/AdminContext';
import { useUI } from '../../contexts/UIContext';

interface UserManagementProps {
  currentUser: any;
  token: string;
  onUserUpdate?: (user: any) => void;
}

// User Search Input Component
const UserSearchInput = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) => {
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
          title="Resetta ricerca"
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
            onClick={() => onToggleStatus(u.id, u.status)} 
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
          onClick={() => onEdit(u)} 
          disabled={currentUser?.role === 'society' && u.role === 'admin'}
          className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-30"
          title={currentUser?.role === 'society' && u.role === 'admin' ? "Non puoi modificare un Admin" : "Modifica"}
        >
          <i className="fas fa-edit text-sm sm:text-xs"></i>
        </button>
        <button 
          onClick={() => onDelete(u.id)} 
          disabled={u.email === 'snecaj@gmail.com' || currentUser?.role === 'society'} 
          className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg bg-red-600 text-white flex items-center justify-center hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 disabled:opacity-30"
          title={currentUser?.role === 'society' ? "Solo l'amministratore può eliminare gli utenti" : (u.email === 'snecaj@gmail.com' ? "Non puoi eliminare l'account principale" : "Elimina")}
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
  const {
    users, totalUsers, loading, backgroundLoading, error, setError, fetchUsers, fetchSocieties, societies,
    userSearchTerm, setUserSearchTerm, usersPage, setUsersPage, usersPerPage, setUsersPerPage, filterRole, setFilterRole,
    showDashboard, setShowDashboard, fetchedDashboardStats, dashboardStats, kpiFilter, setKpiFilter,
    showUserForm, setShowUserForm, editingUser, setEditingUser,
    name, setName, surname, setSurname, email, setEmail, password, setPassword,
    role, setRole, category, setCategory, qualification, setQualification,
    society, setSociety, shooterCode, setShooterCode, userAvatar, setUserAvatar,
    birthDate, setBirthDate, phone, setPhone,
    hideInternalFAB
  } = useAdmin();

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSortConfig, setUserSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (currentUser?.role === 'society' && showUserForm && !editingUser) {
      setSociety(currentUser.society || '');
    }
  }, [currentUser, showUserForm, editingUser]);

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
      if (onUserUpdate && editingUser && editingUser.id === currentUser.id) {
        onUserUpdate({
          ...currentUser,
          name, surname, email, role, category, qualification, society, shooter_code: shooterCode, avatar: userAvatar, birth_date: birthDate, phone
        });
      }
    } catch (err: any) {
      setError(err.message);
    }
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
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
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
    XLSX.utils.book_append_sheet(wb, ws, 'Utenti');
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
          'Importa Utenti',
          `Sei sicuro di voler importare ${importedUsers.length} utenti?`,
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
              
              if (!res.ok) throw new Error('Errore durante l\'importazione');
              
              const results = await res.json();
              fetchUsers();
              if (triggerToast) {
                triggerToast(`Importazione completata! Creati: ${results.created}, Aggiornati: ${results.updated}, Errori: ${results.errors}`, results.errors > 0 ? 'error' : 'success');
              }
            } catch (err) {
              console.error('Error importing users:', err);
              setError('Errore durante l\'importazione.');
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center justify-between sm:justify-start gap-4">
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <i className="fas fa-users-cog text-orange-500"></i> {currentUser?.role === 'society' ? 'Gestione Tiratori' : (currentUser?.role === 'admin' ? 'Gestione Utente' : 'Gestione Utenti')}
            {(loading || backgroundLoading) && <i className="fas fa-circle-notch fa-spin text-orange-500 text-xs ml-2"></i>}
          </h2>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            {totalUsers} {totalUsers === 1 ? 'Utente' : 'Utenti'}
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
        <KPIDashboard />
      )}

      {showUserForm && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1200] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 sm:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
              <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <i className={`fas ${editingUser ? 'fa-user-edit' : 'fa-user-plus'} text-orange-500`}></i> 
                {editingUser ? (currentUser?.role === 'society' ? 'Modifica Tiratore' : 'Modifica Utente') : (currentUser?.role === 'society' ? 'Nuovo Tiratore' : 'Nuovo Utente')}
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
                  disabled={currentUser?.role === 'society'}
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

          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm py-4 border-t border-slate-800 mt-8 flex justify-end gap-3 shrink-0 px-6 sm:px-8">
            <button type="button" onClick={() => { setShowUserForm(false); setEditingUser(null); setName(''); setSurname(''); setEmail(''); setPassword(''); setRole('user'); setCategory(''); setQualification(''); setShooterCode(''); setUserAvatar(''); setBirthDate(''); setPhone(''); }} className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-slate-800 text-white hover:bg-slate-700">
              Annulla
            </button>
            <button type="submit" form="admin-user-form" className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20">
              {editingUser ? 'Salva' : (currentUser?.role === 'society' ? 'Crea' : 'Crea')}
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
      , document.body)}
    </div>
  );
};

export default UserManagement;
