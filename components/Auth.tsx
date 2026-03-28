import React, { useState } from 'react';

interface AuthProps {
  onLogin: (token: string, user: any) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.message) {
          throw new Error(data.message);
        }
        throw new Error(data.error || 'Errore di autenticazione');
      }

      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setError("Contatta l'amministratore del sistema");
    setSuccessMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <img src="/icon.svg" alt="Clay Tracker Pro" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-lg shadow-orange-600/20" />
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Clay Tracker Pro</h1>
          <p className="text-slate-500 text-sm mt-2">Accedi al tuo account</p>
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
          
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:border-orange-600 outline-none transition-all" 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 mt-4 flex items-center justify-center gap-2">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sign-in-alt"></i>}
            ACCEDI
          </button>
        </form>

        <div className="mt-6 text-center">
          <button type="button" onClick={handleForgotPassword} className="text-slate-400 hover:text-white text-xs transition-colors">
            Hai dimenticato la password?
          </button>
          
          <div className="mt-8 pt-6 border-t border-slate-800/50">
            <p className="text-slate-400 text-xs leading-relaxed">
              Sei un tiratore e vuoi utilizzare l'App?<br/>
              <span className="text-orange-500 font-semibold mt-1 block">Chiedi alla tua Società le credenziali di accesso!</span>
            </p>
            <p className="text-slate-500 text-[10px] mt-4 italic">
              Tip: Puoi installare Clay Tracker Pro come un'app sul tuo telefono per un accesso più rapido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
