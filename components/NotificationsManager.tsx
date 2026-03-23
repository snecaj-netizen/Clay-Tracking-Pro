import React, { useState, useEffect } from 'react';
import SocietySearch from './SocietySearch';
import ShooterSearch from './ShooterSearch';

interface NotificationsManagerProps {
  token: string;
  userRole: string;
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
}

export default function NotificationsManager({ token, userRole, triggerConfirm }: NotificationsManagerProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [societies, setSocieties] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'control'>('list');
  
  // Control Panel States
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [mutedEntities, setMutedEntities] = useState<{id: string, name: string, type: 'society' | 'shooter'}[]>([]);
  const [templates, setTemplates] = useState({
    new_competition: "Nuova gara pubblicata: {competition_name} presso {society_name}!",
    score_update: "Risultati aggiornati per {competition_name}. Controlla la tua posizione!",
    new_challenge: "{shooter_name} ti ha sfidato! Accetta la sfida nel tuo profilo.",
    challenge_completed: "Sfida completata! {winner_name} ha vinto contro {loser_name}!",
    competition_reminder: "Com'è andata oggi a {competition_name}? Inserisci il risultato per vedere come cambia la tua media!"
  });
  const [rateLimit, setRateLimit] = useState(5); // max per day
  const [showMuteForm, setShowMuteForm] = useState(false);
  const [muteId, setMuteId] = useState('');
  const [muteType, setMuteType] = useState<'society' | 'shooter'>('society');
  
  // Admin Specific Settings
  const [blockOtherUsersNotifications, setBlockOtherUsersNotifications] = useState(false);
  const [adminCompactMode, setAdminCompactMode] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('all_shooters');
  const [targetId, setTargetId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [showSendForm, setShowSendForm] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchNotifications();
    if (isAdmin) {
      fetchSocieties();
      fetchUsers();
      fetchSettings();
    }
  }, [token, isAdmin]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/notification-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalEnabled(data.global_enabled);
        setRateLimit(data.rate_limit);
        if (data.templates) setTemplates(data.templates);
        if (data.muted_entities) setMutedEntities(data.muted_entities);
        setAdminNotificationsEnabled(data.admin_notifications_enabled);
        setBlockOtherUsersNotifications(!data.admin_notifications_enabled);
        setAdminCompactMode(data.admin_compact_mode);
      }
    } catch (err) {
      console.error('Error fetching notification settings:', err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/admin/notification-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          global_enabled: globalEnabled,
          rate_limit: rateLimit,
          templates,
          muted_entities: mutedEntities,
          admin_notifications_enabled: !blockOtherUsersNotifications,
          admin_compact_mode: adminCompactMode
        })
      });

      if (res.ok) {
        alert('Impostazioni salvate con successo!');
      } else {
        const data = await res.json();
        alert(data.error || 'Errore durante il salvataggio delle impostazioni');
      }
    } catch (err) {
      console.error('Error saving notification settings:', err);
      alert('Errore di rete durante il salvataggio');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.filter((u: any) => u.role !== 'society'));
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchSocieties = async () => {
    try {
      const res = await fetch('/api/societies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSocieties(data);
      }
    } catch (err) {
      console.error('Error fetching societies:', err);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body || !isAdmin) return;

    setSending(true);
    try {
      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          body,
          targetType,
          targetId,
          scheduledAt: scheduledAt || null
        })
      });

      if (res.ok) {
        setTitle('');
        setBody('');
        setScheduledAt('');
        setShowSendForm(false);
        fetchNotifications();
      } else {
        const data = await res.json();
        alert(data.error || 'Errore durante l\'invio della notifica');
      }
    } catch (err) {
      console.error('Error sending notification:', err);
      alert('Errore di rete durante l\'invio');
    } finally {
      setSending(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const endpoint = isAdmin ? '/api/admin/notifications' : '/api/notifications';
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      const endpoint = isAdmin ? `/api/admin/notifications/${id}/read` : `/api/notifications/${id}/read`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const deleteNotification = async (id: number) => {
    triggerConfirm(
      'Elimina Notifica',
      'Sei sicuro di voler eliminare questa notifica?',
      async () => {
        try {
          const endpoint = isAdmin ? `/api/admin/notifications/${id}` : `/api/notifications/${id}`;
          const res = await fetch(endpoint, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setNotifications(prev => prev.filter(n => n.id !== id));
            setSelectedNotifications(prev => prev.filter(nId => nId !== id));
          }
        } catch (err) {
          console.error('Error deleting notification:', err);
        }
      },
      'Elimina',
      'danger'
    );
  };

  const handleBulkDelete = () => {
    if (selectedNotifications.length === 0) return;
    triggerConfirm(
      'Elimina Notifiche',
      `Sei sicuro di voler eliminare ${selectedNotifications.length} notifiche selezionate?`,
      async () => {
        setLoading(true);
        try {
          const endpoint = isAdmin ? '/api/admin/notifications/bulk-delete' : '/api/notifications/bulk-delete';
          await fetch(endpoint, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: selectedNotifications })
          });
          await fetchNotifications();
          setSelectedNotifications([]);
        } catch (err) {
          console.error('Error deleting notifications:', err);
          alert('Errore durante l\'eliminazione delle notifiche.');
        } finally {
          setLoading(false);
        }
      },
      'Elimina',
      'danger'
    );
  };

  const handleAddMute = () => {
    if (!muteId) return;
    const name = muteType === 'society' 
      ? societies.find(s => s.id === muteId)?.name || `Società #${muteId}`
      : `Tiratore #${muteId}`;
    
    setMutedEntities([...mutedEntities, { id: muteId, name, type: muteType }]);
    setMuteId('');
    setShowMuteForm(false);
  };

  const removeMute = (id: string) => {
    setMutedEntities(mutedEntities.filter(e => e.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-spinner fa-spin text-orange-500 text-2xl"></i>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/20">
              <i className="fas fa-bell text-white"></i>
            </div>
            Gestione Notifiche
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 ml-1">
            {isAdmin ? 'Configura e monitora il sistema di avvisi' : 'I tuoi aggiornamenti e avvisi in tempo reale'}
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button 
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <i className="fas fa-list mr-2"></i> Lista
            </button>
            <button 
              onClick={() => setActiveTab('control')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'control' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <i className="fas fa-cog mr-2"></i> Pannello Controllo
            </button>
          </div>
        )}
      </div>

      {activeTab === 'list' ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              {isAdmin && (
                <button 
                  onClick={() => setShowSendForm(!showSendForm)}
                  className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-orange-600/20"
                >
                  <i className={`fas ${showSendForm ? 'fa-times' : 'fa-paper-plane'}`}></i>
                  {showSendForm ? 'Annulla' : 'Invia Notifica'}
                </button>
              )}
              <span className="text-xs font-bold text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                {notifications.length} Totali
              </span>
            </div>
          </div>

          {isAdmin && showSendForm && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
              <form onSubmit={handleSendNotification} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Titolo</label>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Inserisci il titolo..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Destinatari</label>
                    <select 
                      value={targetType}
                      onChange={(e) => setTargetType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                    >
                      <option value="all_shooters">Tutti i tiratori</option>
                      <option value="all_societies">Tutte le società</option>
                      <option value="specific_society">Una società specifica</option>
                      <option value="shooters_of_society">Tiratori di una società specifica</option>
                    </select>
                  </div>
                </div>

                {(targetType === 'specific_society' || targetType === 'shooters_of_society') && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seleziona Società</label>
                    <SocietySearch 
                      value={targetId}
                      onChange={setTargetId}
                      societies={societies}
                      placeholder="Scegli una società..."
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Messaggio</label>
                  <textarea 
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Scrivi qui il contenuto della notifica..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-h-[100px] resize-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Programmazione (Opzionale)</label>
                    <input 
                      type="datetime-local" 
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all"
                    />
                    <p className="text-[9px] text-slate-500 italic ml-1">Lascia vuoto per inviare subito.</p>
                  </div>
                  <div className="flex items-end">
                    <button 
                      type="submit"
                      disabled={sending}
                      className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase py-4 rounded-xl transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2"
                    >
                      {sending ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : (
                        <i className="fas fa-paper-plane"></i>
                      )}
                      {scheduledAt ? 'Programma Notifica' : 'Invia Ora'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="grid gap-3">
            {notifications.length > 0 && (
              <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer group px-2">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={selectedNotifications.length === notifications.length && notifications.length > 0}
                      onChange={() => {
                        if (selectedNotifications.length === notifications.length) {
                          setSelectedNotifications([]);
                        } else {
                          setSelectedNotifications(notifications.map(n => n.id));
                        }
                      }}
                    />
                    <div className="w-5 h-5 rounded border-2 border-slate-600 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all flex items-center justify-center">
                      <i className="fas fa-check text-white text-[10px] opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">
                    Seleziona Tutte
                  </span>
                </label>

                {selectedNotifications.length > 0 && (
                  <button 
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                  >
                    <i className="fas fa-trash-alt"></i>
                    Elimina Selezionate ({selectedNotifications.length})
                  </button>
                )}
              </div>
            )}

            {notifications.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
                <i className="fas fa-bell-slash text-slate-700 text-4xl mb-4"></i>
                <p className="text-slate-500 font-medium">Nessuna notifica presente nel sistema.</p>
              </div>
            ) : (
              notifications.map(notif => {
                const isSelected = selectedNotifications.includes(notif.id);
                return (
                <div 
                  key={notif.id}
                  className={`bg-slate-900 border rounded-2xl transition-all hover:border-slate-700 ${isSelected ? 'ring-2 ring-orange-500 border-orange-500' : 'border-slate-800'} ${notif.read ? 'opacity-60' : 'border-l-4 border-l-orange-600'} ${adminCompactMode && isAdmin ? 'p-2' : 'p-4'}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <label className="relative flex items-center justify-center cursor-pointer mt-1">
                        <input 
                          type="checkbox" 
                          className="peer sr-only"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedNotifications([...selectedNotifications, notif.id]);
                            } else {
                              setSelectedNotifications(selectedNotifications.filter(id => id !== notif.id));
                            }
                          }}
                        />
                        <div className={`rounded border-2 border-slate-600 bg-slate-900/80 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all flex items-center justify-center backdrop-blur-sm ${adminCompactMode && isAdmin ? 'w-4 h-4' : 'w-5 h-5'}`}>
                          <i className={`fas fa-check text-white opacity-0 peer-checked:opacity-100 transition-opacity ${adminCompactMode && isAdmin ? 'text-[8px]' : 'text-[10px]'}`}></i>
                        </div>
                      </label>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-bold text-white ${adminCompactMode && isAdmin ? 'text-xs' : 'text-sm'}`}>{notif.title}</h3>
                          {!notif.read && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                        </div>
                        {!adminCompactMode || !isAdmin ? (
                          <p className="text-xs text-slate-400 leading-relaxed mb-3">{notif.body}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          {isAdmin && (
                            <div className={`flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-widest ${adminCompactMode ? 'text-[8px]' : 'text-[10px]'}`}>
                              <i className="fas fa-user text-orange-500/50"></i>
                              Destinatario: <span className="text-slate-300">{notif.user_name} {notif.user_surname}</span>
                            </div>
                          )}
                          <div className={`flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-widest ${adminCompactMode ? 'text-[8px]' : 'text-[10px]'}`}>
                            <i className="fas fa-calendar text-orange-500/50"></i>
                            {new Date(notif.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!notif.read && (
                        <button 
                          onClick={() => markAsRead(notif.id)}
                          className={`rounded-lg bg-orange-600/10 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all ${adminCompactMode && isAdmin ? 'w-6 h-6' : 'w-8 h-8'}`}
                          title="Segna come letta"
                        >
                          <i className={`fas fa-check ${adminCompactMode && isAdmin ? 'text-[8px]' : 'text-[10px]'}`}></i>
                        </button>
                      )}
                      <button 
                        onClick={() => deleteNotification(notif.id)}
                        className={`rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all ${adminCompactMode && isAdmin ? 'w-6 h-6' : 'w-8 h-8'}`}
                        title="Elimina"
                      >
                        <i className={`fas fa-trash ${adminCompactMode && isAdmin ? 'text-[8px]' : 'text-[10px]'}`}></i>
                      </button>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          {/* Global Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Stato Globale</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Attiva o disattiva l'intero sistema di notifiche</p>
              </div>
              <button 
                onClick={() => setGlobalEnabled(!globalEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none self-start sm:self-auto ${globalEnabled ? 'bg-orange-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${globalEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Limite Giornaliero per Utente</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={rateLimit}
                    onChange={(e) => setRateLimit(parseInt(e.target.value))}
                    className="flex-1 accent-orange-600"
                  />
                  <span className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-bold text-orange-500 w-12 text-center">
                    {rateLimit}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 italic">Evita lo spam limitando le notifiche automatiche giornaliere.</p>
              </div>
            </div>
          </div>

          {/* Admin Specific Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6">
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">Impostazioni Personali Admin</h3>
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">Blocca Notifiche Altri Utenti</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Se attivo, visualizzerai e riceverai solo le notifiche che ti riguardano direttamente</p>
                </div>
                <button 
                  onClick={() => setBlockOtherUsersNotifications(!blockOtherUsersNotifications)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none self-start sm:self-auto ${blockOtherUsersNotifications ? 'bg-red-600' : 'bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${blockOtherUsersNotifications ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">Modalità Compatta</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Visualizzazione densa della lista notifiche (solo admin)</p>
                </div>
                <button 
                  onClick={() => setAdminCompactMode(!adminCompactMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none self-start sm:self-auto ${adminCompactMode ? 'bg-orange-600' : 'bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${adminCompactMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Template Management */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">Template Notifiche</h3>
            <div className="space-y-4">
              {Object.entries(templates).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <textarea 
                    value={value}
                    onChange={(e) => setTemplates({...templates, [key]: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all min-h-[60px] resize-none"
                  />
                </div>
              ))}
              <div className="p-3 bg-orange-600/5 border border-orange-600/20 rounded-xl">
                <p className="text-[9px] text-orange-500/80 font-bold uppercase tracking-widest mb-1">Segnaposto Disponibili:</p>
                <p className="text-[9px] text-slate-500 italic">
                  {'{competition_name}'}, {'{society_name}'}, {'{shooter_name}'}, {'{winner_name}'}, {'{loser_name}'}
                </p>
              </div>
            </div>
          </div>

          {/* Muted Entities */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Sospensioni (Mute)</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Società o Tiratori che non riceveranno/invieranno notifiche</p>
              </div>
              <button 
                onClick={() => setShowMuteForm(!showMuteForm)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all self-start sm:self-auto"
              >
                {showMuteForm ? 'Chiudi' : 'Aggiungi'}
              </button>
            </div>

            {showMuteForm && (
              <div className="mb-6 p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo</label>
                    <select 
                      value={muteType}
                      onChange={(e) => setMuteType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none appearance-none"
                    >
                      <option value="society">Società</option>
                      <option value="shooter">Tiratore</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ID Entità</label>
                    <div className="flex gap-2">
                      {muteType === 'society' ? (
                        <SocietySearch 
                          value={muteId}
                          onChange={setMuteId}
                          societies={societies}
                          placeholder="Cerca società..."
                          className="flex-1"
                        />
                      ) : (
                        <ShooterSearch 
                          value={muteId}
                          onChange={setMuteId}
                          shooters={users}
                          placeholder="Cerca tiratore..."
                          className="flex-1"
                          useId
                        />
                      )}
                      <button 
                        onClick={handleAddMute}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-4 rounded-xl transition-all h-[46px] mt-auto"
                      >
                        <i className="fas fa-plus"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {mutedEntities.length === 0 ? (
                <p className="text-xs text-slate-600 italic text-center py-4">Nessuna sospensione attiva.</p>
              ) : (
                mutedEntities.map((entity) => (
                  <div key={entity.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${entity.type === 'society' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        <i className={`fas ${entity.type === 'society' ? 'fa-building' : 'fa-user'}`}></i>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{entity.name}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{entity.type} ID: {entity.id}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeMute(entity.id)}
                      className="text-slate-500 hover:text-red-500 transition-colors p-2"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button 
              onClick={handleSaveSettings}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase px-8 py-4 rounded-2xl transition-all shadow-lg shadow-orange-600/20 active:scale-95"
            >
              Salva Configurazione
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
