import React, { useState, useEffect, useRef } from 'react';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

interface NotificationBellProps {
  token: string;
}

export default function NotificationBell({ token }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchNotifications();
    checkSubscription();
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('Error checking push subscription:', err);
    }
  };

  const subscribeUser = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Il tuo browser non supporta le notifiche push.');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        alert('Permesso per le notifiche negato.');
        return;
      }

      const res = await fetch('/api/vapidPublicKey');
      if (!res.ok) throw new Error('Impossibile ottenere la VAPID key');
      const { publicKey } = await res.json();

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(subscription)
      });

      setIsSubscribed(true);
      alert('Notifiche attivate con successo!');
    } catch (err) {
      console.error('Error subscribing to push:', err);
      alert('Errore durante l\'attivazione delle notifiche.');
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-orange-500/50 transition-all relative"
      >
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-600 rounded-full text-[9px] font-black text-white flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="fixed top-[72px] left-4 right-4 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-80 sm:max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-tight">Notifiche</h3>
            {!isSubscribed && permission !== 'granted' && permission !== 'denied' && (
              <button 
                onClick={subscribeUser}
                className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400"
              >
                Attiva Push
              </button>
            )}
          </div>
          
          <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                Nessuna notifica
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => {
                    if (!notif.read) markAsRead(notif.id);
                    if (notif.url) window.location.href = notif.url;
                  }}
                  className={`p-4 border-b border-slate-800/50 cursor-pointer transition-colors ${notif.read ? 'opacity-50 hover:bg-slate-800/30' : 'bg-slate-800/20 hover:bg-slate-800/50'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-xs font-bold text-white">{notif.title}</h4>
                    {!notif.read && <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1"></span>}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{notif.body}</p>
                  <p className="text-[8px] text-slate-500 mt-2 uppercase tracking-widest">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
