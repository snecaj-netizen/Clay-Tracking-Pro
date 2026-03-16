import React, { useState, useEffect } from 'react';

interface AdminNotificationsProps {
  token: string;
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
}

export default function AdminNotifications({ token, triggerConfirm }: AdminNotificationsProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching admin notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/notifications/${id}/read`, {
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
          const res = await fetch(`/api/admin/notifications/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setNotifications(prev => prev.filter(n => n.id !== id));
          }
        } catch (err) {
          console.error('Error deleting notification:', err);
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
        <span className="text-xs font-bold text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
          {notifications.length} Totali
        </span>
      </div>

      <div className="grid gap-3">
        {notifications.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
            <i className="fas fa-bell-slash text-slate-700 text-4xl mb-4"></i>
            <p className="text-slate-500 font-medium">Nessuna notifica presente nel sistema.</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div 
              key={notif.id}
              className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 transition-all hover:border-slate-700 ${notif.read ? 'opacity-60' : 'border-l-4 border-l-orange-600'}`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white">{notif.title}</h3>
                    {!notif.read && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{notif.body}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      <i className="fas fa-user text-orange-500/50"></i>
                      Destinatario: <span className="text-slate-300">{notif.user_name} {notif.user_surname}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      <i className="fas fa-calendar text-orange-500/50"></i>
                      {new Date(notif.created_at).toLocaleString()}
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
          ))
        )}
      </div>
    </div>
  );
}
