import React, { useState } from 'react';

interface AuthProps {
  onLogin: (token: string, user: any) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (isRecovering) {
      try {
        const res = await fetch('/api/auth/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Errore durante il recupero');
        setSuccessMsg('Se l\'email è registrata, riceverai una nuova password a breve.');
        setIsRecovering(false);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore di autenticazione');

      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-600/20">
            <i className="fas fa-crosshairs text-3xl text-white"></i>
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Clay Tracker Pro</h1>
          <p className="text-slate-500 text-sm mt-2">{isRecovering ? 'Recupera la tua password' : 'Accedi al tuo account'}</p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-900/50 text-red-500 p-3 rounded-xl text-sm mb-6 text-center">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-950/50 border border-green-900/50 text-green-500 p-3 rounded-xl text-sm mb-6 text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
          </div>
          
          {!isRecovering && (
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 mt-4 flex items-center justify-center gap-2">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className={`fas ${isRecovering ? 'fa-envelope' : 'fa-sign-in-alt'}`}></i>}
            {isRecovering ? 'INVIA PASSWORD' : 'ACCEDI'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => { setIsRecovering(!isRecovering); setError(''); setSuccessMsg(''); }} className="text-slate-400 hover:text-white text-xs transition-colors">
            {isRecovering ? 'Torna al Login' : 'Hai dimenticato la password? Recuperala'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
