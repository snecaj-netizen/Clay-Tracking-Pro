import React, { useState, useEffect } from 'react';
import SocietySearch from './SocietySearch';

interface NotificationsManagerProps {
  token: string;
  userRole: string;
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
}

export default function NotificationsManager({ token, userRole, triggerConfirm }: NotificationsManagerProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [societies, setSocieties] = useState<any[]>([]);
  
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
    }
  }, [token, isAdmin]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-spinner fa-spin text-orange-500 text-2xl"></i>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Gestione Notifiche</h2>
        <div className="flex items-center gap-3">
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
              className={`bg-slate-900 border rounded-2xl p-4 transition-all hover:border-slate-700 ${isSelected ? 'ring-2 ring-orange-500 border-orange-500' : 'border-slate-800'} ${notif.read ? 'opacity-60' : 'border-l-4 border-l-orange-600'}`}
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
                    <div className="w-5 h-5 rounded border-2 border-slate-600 bg-slate-900/80 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all flex items-center justify-center backdrop-blur-sm">
                      <i className="fas fa-check text-white text-[10px] opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                    </div>
                  </label>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white">{notif.title}</h3>
                      {!notif.read && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">{notif.body}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          <i className="fas fa-user text-orange-500/50"></i>
                          Destinatario: <span className="text-slate-300">{notif.user_name} {notif.user_surname}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
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
                      className="w-8 h-8 rounded-lg bg-orange-600/10 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all"
                      title="Segna come letta"
                    >
                      <i className="fas fa-check text-[10px]"></i>
                    </button>
                  )}
                  <button 
                    onClick={() => deleteNotification(notif.id)}
                    className="w-8 h-8 rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"
                    title="Elimina"
                  >
                    <i className="fas fa-trash text-[10px]"></i>
                  </button>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
