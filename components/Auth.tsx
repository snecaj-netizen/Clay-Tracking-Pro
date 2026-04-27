import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haïti", "Holy See", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan",
  "Vanuatu", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
];

const FITASC_QUALS = [
  { id: 'MAN', label: 'MAN (Man)' },
  { id: 'LAD', label: 'LAD (Lady)' },
  { id: 'JUN', label: 'JUN (Junior)' },
  { id: 'SEN', label: 'SEN (Senior)' },
  { id: 'VET', label: 'VET (Veteran)' },
  { id: 'MAS', label: 'MAS (Master)' },
];

interface AuthProps {
  onLogin: (token: string, user: any) => void;
  isModal?: boolean;
  onClose?: () => void;
  onGoToPortal?: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, isModal, onClose, onGoToPortal }) => {
  const { language, t } = useLanguage();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration fields
  const [regData, setRegData] = useState({
    name: '',
    surname: '',
    email: '',
    password: '',
    confirmPassword: '',
    birth_date: '',
    phone: '',
    is_international: false,
    nationality: '',
    international_id: '',
    original_club: '',
    society: '',
    shooter_code: '',
    qualification: '',
    category: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError('');
    setSuccessMsg('');
  }, [authMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (authMode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        let data: any = {};
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch (e) {
          // If not JSON, use the raw text if short, otherwise use status
          if (text.length > 0 && text.length < 100) {
            throw new Error(text);
          }
          throw new Error(`Errore del server (${res.status}). Riprova più tardi.`);
        }

        if (!res.ok) {
          if ((res.status === 403 || res.status === 401) && (data as any).message) {
            setError((data as any).message);
            // Allow resending verification
            return;
          }
          throw new Error((data as any).error || (data as any).message || `Errore di autenticazione (${res.status})`);
        }

        onLogin(data.token, data.user);
      } else {
        // Registration
        if (regData.password !== regData.confirmPassword) {
          throw new Error(displayLang === 'it' ? 'Le password non coincidono.' : 'Passwords do not match.');
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(regData),
        });

        let data: any;
        try {
          data = await res.json();
        } catch (e) {
          throw new Error(displayLang === 'it' 
            ? `Errore del server (${res.status}). Riprova più tardi.` 
            : `Server error (${res.status}). Please try again later.`);
        }
        if (!res.ok) throw new Error(data.error || (displayLang === 'it' ? 'Errore durante la registrazione.' : 'Error during registration.'));

        setSuccessMsg(displayLang === 'it' 
          ? 'Registrazione completata! Ti abbiamo inviato un\'email di verifica. Controlla la tua casella di posta per attivare l\'account.' 
          : 'Registration completed! We have sent you a verification email. Check your inbox to activate your account.'
        );
        setAuthMode('login');
        setEmail(regData.email);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || regData.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore durante l\'invio.');
      setSuccessMsg(displayLang === 'it' ? 'Email di verifica reinviata!' : 'Verification email resent!');
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setError(language === 'it' ? "Contatta l'amministratore del sistema" : "Contact the system administrator");
    setSuccessMsg('');
  };

  const displayLang = (authMode === 'register' && regData.is_international) ? 'en' : language;

  const content = (
    <div className={`${isModal ? 'bg-slate-900 [.light-theme_&]:bg-white border border-slate-800 [.light-theme_&]:border-slate-200 rounded-3xl p-8 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-300 transition-colors' : 'bg-slate-900 [.light-theme_&]:bg-white border border-slate-800 [.light-theme_&]:border-slate-200 rounded-3xl p-8 w-full max-w-lg shadow-2xl transition-colors'} overflow-y-auto max-h-[90vh] no-scrollbar`} onClick={e => e.stopPropagation()}>
      {isModal && onClose && (
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-slate-950 [.light-theme_&]:bg-slate-50 border border-slate-800 [.light-theme_&]:border-slate-200 flex items-center justify-center text-slate-500 hover:text-white [.light-theme_&]:hover:text-slate-900 hover:border-slate-700 transition-all active:scale-95 z-10"
        >
          <i className="fas fa-times"></i>
        </button>
      )}
      
      <div className="text-center mb-8">
        <img src="/icon.svg" alt="Clay Performance" className="w-16 h-16 mx-auto mb-4 rounded-2xl shadow-lg shadow-orange-600/20" />
        <h1 className="text-2xl font-black text-white [.light-theme_&]:text-slate-900 uppercase tracking-tight">
          Clay <span className="text-orange-600">Performance</span>
        </h1>
        <p className="text-slate-500 [.light-theme_&]:text-slate-400 text-sm mt-2">
          {authMode === 'login' 
            ? (displayLang === 'it' ? 'Accedi al tuo account' : 'Sign in to your account')
            : (displayLang === 'it' ? 'Crea il tuo profilo' : 'Create your profile')}
        </p>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 text-red-500 p-4 rounded-xl text-sm mb-6 text-center animate-in slide-in-from-top-2">
          {error}
          {(error.toLowerCase().includes('verificata') || error.toLowerCase().includes('verificare')) && (
            <button 
              onClick={handleResendVerification}
              className="block mx-auto mt-2 text-orange-500 font-bold hover:underline"
            >
              {displayLang === 'it' ? 'Reinvia email di verifica' : 'Resend verification email'}
            </button>
          )}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-950/50 border border-green-900/50 text-green-500 p-4 rounded-xl text-sm mb-6 text-center animate-in slide-in-from-top-2">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {authMode === 'login' ? (
          <>
            <div>
              <label className="text-[10px] font-black text-slate-500 [.light-theme_&]:text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={displayLang === 'it' ? 'La tua email' : 'Your email'} className="w-full bg-slate-950 [.light-theme_&]:bg-slate-50 border border-slate-800 [.light-theme_&]:border-slate-200 rounded-xl px-4 py-3 text-white [.light-theme_&]:text-slate-900 text-sm focus:border-orange-600 outline-none transition-all" />
            </div>
            
            <div>
              <label className="text-[10px] font-black text-slate-500 [.light-theme_&]:text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full bg-slate-950 [.light-theme_&]:bg-slate-50 border border-slate-800 [.light-theme_&]:border-slate-200 rounded-xl px-4 py-3 pr-12 text-white [.light-theme_&]:text-slate-900 text-sm focus:border-orange-600 outline-none transition-all" 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 [.light-theme_&]:hover:text-slate-900 transition-colors"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 mt-4 flex items-center justify-center gap-2">
              {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sign-in-alt"></i>}
              {displayLang === 'it' ? 'ACCEDI' : 'SIGN IN'}
            </button>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-4">
              <div className="flex items-center gap-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                <div className="flex-1">
                  <h4 className="text-xs font-black text-white uppercase">{displayLang === 'it' ? 'Tiratore Internazionale?' : 'International Shooter?'}</h4>
                  <p className="text-[10px] text-slate-500">{displayLang === 'it' ? 'Se non risiedi in Italia e non hai codice FITAV' : 'If you don\'t live in Italy and don\'t have a FITAV code'}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setRegData({...regData, is_international: !regData.is_international})}
                  className={`w-12 h-6 rounded-full transition-all relative ${regData.is_international ? 'bg-orange-600' : 'bg-slate-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${regData.is_international ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'Nome' : 'First Name'}</label>
              <input type="text" required value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'Cognome' : 'Last Name'}</label>
              <input type="text" required value={regData.surname} onChange={e => setRegData({...regData, surname: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
            </div>
            
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
              <input type="email" required value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'Data di Nascita' : 'Birth Date'}</label>
              <input type="date" required value={regData.birth_date} onChange={e => setRegData({...regData, birth_date: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'Telefono' : 'Phone'}</label>
              <input type="tel" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
            </div>

            {regData.is_international ? (
              <>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'Nazionalità' : 'Nationality'}</label>
                  <select required value={regData.nationality} onChange={e => setRegData({...regData, nationality: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all no-scrollbar">
                    <option value="">{displayLang === 'it' ? 'Seleziona Paese' : 'Select Country'}</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'ID Internazionale (es. ISSF)' : 'International ID (e.g. ISSF)'}</label>
                  <input type="text" value={regData.international_id} onChange={e => setRegData({...regData, international_id: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'Club Originale' : 'Original Club'}</label>
                  <input type="text" value={regData.original_club} onChange={e => setRegData({...regData, original_club: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'Società' : 'Club'}</label>
                  <input type="text" value={regData.society} onChange={e => setRegData({...regData, society: e.target.value})} placeholder="Es: Tav Roma" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'Codice Tiratore (FITAV)' : 'Shooter Code (FITAV)'}</label>
                  <input type="text" value={regData.shooter_code} onChange={e => setRegData({...regData, shooter_code: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'Qualifica (FITASC)' : 'Qualification (FITASC)'}</label>
              <select required value={regData.qualification} onChange={e => setRegData({...regData, qualification: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all">
                <option value="">{displayLang === 'it' ? 'Seleziona Qualifica' : 'Select Qualification'}</option>
                {FITASC_QUALS.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <input type="password" required value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{displayLang === 'it' ? 'Conferma Password' : 'Confirm Password'}</label>
              <input type="password" required value={regData.confirmPassword} onChange={e => setRegData({...regData, confirmPassword: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
            </div>

            <div className="sm:col-span-2 mt-4">
              <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-user-plus"></i>}
                {displayLang === 'it' ? 'REGISTRATI' : 'REGISTER'}
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="mt-6 text-center space-y-4">
        {authMode === 'login' ? (
          <>
            <button type="button" onClick={() => setAuthMode('register')} className="text-orange-500 hover:text-orange-400 text-xs font-bold transition-colors">
              {displayLang === 'it' ? 'Non hai un account? Registrati ora' : 'Don\'t have an account? Register now'}
            </button>
            <div>
              <button type="button" onClick={handleForgotPassword} className="text-slate-400 hover:text-white text-xs transition-colors">
                {displayLang === 'it' ? 'Hai dimenticato la password?' : 'Forgot your password?'}
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setAuthMode('login')} className="text-slate-400 hover:text-white text-xs font-bold transition-colors">
            {displayLang === 'it' ? 'Hai già un account? Torna al login' : 'Already have an account? Back to login'}
          </button>
        )}
        
        <div className="pt-6 border-t border-slate-800/50">
          {!isModal && onGoToPortal && (
            <button 
              onClick={onGoToPortal}
              className="w-full mb-6 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
            >
              <i className="fas fa-external-link-alt text-orange-500"></i>
              {t('results_portal')}
            </button>
          )}
          
          {authMode === 'login' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-xs leading-relaxed">
                {displayLang === 'it' ? 'Sei un tiratore e vuoi utilizzare l\'App?' : 'Are you a shooter and want to use the App?'}<br/>
                <span className="text-orange-500 font-semibold mt-1 block">{displayLang === 'it' ? 'Chiedi alla tua Società le credenziali di accesso!' : 'Ask your Club for access credentials!'}</span>
              </p>
              <p className="text-slate-500 text-[10px] mt-4 italic">
                {displayLang === 'it' ? 'Tip: Puoi installare Clay Performance come un\'app sul tuo telefono per un accesso più rapido.' : 'Tip: You can install Clay Performance as an app on your phone for faster access.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div 
        className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/80 [.light-theme_&]:bg-white/80 backdrop-blur-sm animate-in fade-in duration-300 transition-colors" 
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 [.light-theme_&]:bg-slate-100 flex items-center justify-center p-4 transition-colors">
      {content}
    </div>
  );
};

export default Auth;
