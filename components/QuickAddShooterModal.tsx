import React, { useState } from 'react';
import SocietySearch from './SocietySearch';

import { createPortal } from 'react-dom';

interface QuickAddShooterModalProps {
  token: string;
  currentUser: any;
  societies: any[];
  onClose: () => void;
  onSuccess: (newUser: any) => void;
  triggerToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const QuickAddShooterModal: React.FC<QuickAddShooterModalProps> = ({ token, currentUser, societies, onClose, onSuccess, triggerToast }) => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [category, setCategory] = useState('');
  const [qualification, setQualification] = useState('');
  const [society, setSociety] = useState(currentUser?.role === 'society' ? currentUser.society : '');
  const [shooterCode, setShooterCode] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate FITAV card format: 3 letters + 2 numbers + 2 letters + 2 numbers
    const shooterCodeRegex = /^[A-Z]{3}\d{2}[A-Z]{2}\d{2}$/;
    if (shooterCode && !shooterCodeRegex.test(shooterCode)) {
      if (triggerToast) triggerToast('La Codice Tiratore deve avere il formato: 3 lettere, 2 numeri, 2 lettere, 2 numeri (es. ABC12DE34)', 'error');
      return;
    }

    setLoading(true);

    const isSociety = currentUser?.role === 'society';
    const cleanName = name.trim().toLowerCase().replace(/[\s']/g, '');
    const cleanSurname = surname.trim().toLowerCase().replace(/[\s']/g, '');
    const finalEmail = isSociety ? `${cleanName}.${cleanSurname}@gmail.com` : email;
    const finalPassword = isSociety ? shooterCode : password;

    const body = {
      name,
      surname,
      email: finalEmail,
      role: 'user',
      category,
      qualification,
      society,
      shooter_code: shooterCode,
      password: finalPassword,
      birth_date: (!isSociety && birthDate) ? birthDate : undefined,
      phone: (!isSociety && phone) ? phone : undefined
    };

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Errore durante il salvataggio');
      }

      const newUser = await res.json();
      if (triggerToast) triggerToast('Tiratore aggiunto con successo!', 'success');
      onSuccess(newUser);
    } catch (err: any) {
      if (triggerToast) triggerToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <i className="fas fa-user-plus text-orange-500"></i> Nuovo Tiratore
          </h3>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95 shadow-lg border border-slate-700">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <form id="quick-add-shooter-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome *</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cognome *</label>
                <input type="text" required value={surname} onChange={e => setSurname(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
              </div>
            </div>

            {currentUser?.role !== 'society' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email *</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password *</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 pr-10 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Codice Tiratore *</label>
                <input 
                  type="text" 
                  required
                  value={shooterCode} 
                  onChange={e => setShooterCode(e.target.value.toUpperCase())} 
                  pattern="[A-Z]{3}\d{2}[A-Z]{2}\d{2}"
                  title="Formato richiesto: 3 lettere, 2 numeri, 2 lettere, 2 numeri (es. ABC12DE34)"
                  placeholder="es. ABC12DE34"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all uppercase" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                  <option value="">Nessuna</option>
                  <option value="Eccellenza">Eccellenza</option>
                  <option value="Prima">Prima</option>
                  <option value="Seconda">Seconda</option>
                  <option value="Terza">Terza</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Qualifica</label>
                <select value={qualification} onChange={e => setQualification(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none">
                  <option value="">Nessuna</option>
                  <option value="Lady">Lady</option>
                  <option value="Settore Giovanile">Settore Giovanile</option>
                  <option value="Junior">Junior</option>
                  <option value="Veterani">Veterani</option>
                  <option value="Master">Master</option>
                  <option value="Paralimpici">Paralimpici</option>
                </select>
              </div>
            </div>

            {currentUser?.role !== 'society' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data di Nascita</label>
                  <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefono</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
            Annulla
          </button>
          <button type="submit" form="quick-add-shooter-form" disabled={loading} className="px-6 py-3 rounded-xl bg-orange-600 text-white font-black text-xs uppercase tracking-widest hover:bg-orange-500 transition-all active:scale-95 shadow-lg shadow-orange-900/20 disabled:opacity-50 flex items-center gap-2">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
            Salva Tiratore
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuickAddShooterModal;
