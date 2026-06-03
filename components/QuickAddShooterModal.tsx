import React, { useState } from 'react';
import SocietySearch from './SocietySearch';
import { createPortal } from 'react-dom';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';

interface QuickAddShooterModalProps {
  token: string;
  currentUser: any;
  societies: any[];
  onClose: () => void;
  onSuccess: (newUser: any) => void;
}

const QuickAddShooterModal: React.FC<QuickAddShooterModalProps> = ({ token, currentUser, societies, onClose, onSuccess }) => {
  const { triggerToast } = useUI();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [category, setCategory] = useState('Eccellenza');
  const [qualification, setQualification] = useState('');
  const [society, setSociety] = useState(currentUser?.role === 'society' ? currentUser.society : '');
  const [shooterCode, setShooterCode] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleShooterCodeChange = (val: string) => {
    const uppercaseVal = val.toUpperCase();
    setShooterCode(uppercaseVal);
    setPassword(uppercaseVal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!society) {
      if (triggerToast) triggerToast(t('society_required_error'), 'error');
      return;
    }

    // Validate FITAV card format: 3 letters + 2 numbers + 2 letters + 2 numbers
    const shooterCodeRegex = /^[A-Z]{3}\d{2}[A-Z]{2}\d{2}$/;
    if (shooterCode && !shooterCodeRegex.test(shooterCode)) {
      if (triggerToast) triggerToast(t('invalid_shooter_code_format'), 'error');
      return;
    }

    setLoading(true);

    const body = {
      name: name.trim(),
      surname: surname.trim(),
      email: email.trim(),
      role: 'user',
      category,
      qualification: qualification || undefined,
      society,
      shooter_code: shooterCode,
      password: password || shooterCode,
      birth_date: birthDate || undefined,
      phone: phone || undefined
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
        throw new Error(data.error || t('save_error_msg'));
      }

      const newUser = await res.json();
      if (triggerToast) triggerToast(t('registration_success'), 'success');
      onSuccess(newUser);
    } catch (err: any) {
      if (triggerToast) triggerToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1200] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="p-6 sm:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <i className="fas fa-user-plus text-orange-500"></i> {t('new_shooter_title')}
          </h3>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-lg border border-slate-700">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
          <form id="quick-add-shooter-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Row 1: Nome* - Cognome* */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('name_label')} *</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('surname_label')} *</label>
                <input type="text" required value={surname} onChange={e => setSurname(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
              </div>
            </div>

            {/* Row 2: Società* - Codice Tiratore* */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('society_label')} *</label>
                <SocietySearch 
                  value={society}
                  onChange={setSociety}
                  societies={societies}
                  placeholder={t('select_placeholder')}
                  disabled={currentUser?.role === 'society'}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('shooter_code_label')} *</label>
                <input 
                  type="text" 
                  required
                  value={shooterCode} 
                  onChange={e => handleShooterCodeChange(e.target.value)} 
                  pattern="[A-Z]{3}\d{2}[A-Z]{2}\d{2}"
                  title={t('shooter_code_format_title')}
                  placeholder={t('shooter_code_placeholder')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all uppercase" 
                />
              </div>
            </div>

            {/* Row 3: Categoria* (togli Nessuna dall'elenco a discesa) - Qualifica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('category_label')} *</label>
                <select required value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                  <option value="Eccellenza">Eccellenza</option>
                  <option value="Prima">Prima</option>
                  <option value="Seconda">Seconda</option>
                  <option value="Terza">Terza</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('qualification_label')}</label>
                <select value={qualification} onChange={e => setQualification(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                  <option value="">{t('none_label')}</option>
                  <option value="Lady">Lady</option>
                  <option value="Settore Giovanile">Settore Giovanile</option>
                  <option value="Junior">Junior</option>
                  <option value="Veterani">Veterani</option>
                  <option value="Master">Master</option>
                  <option value="Paralimpici">Paralimpici</option>
                </select>
              </div>
            </div>

            {/* Row 4: Email* - Password (non modificabile, default su Codice Tiratore) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('email_label')} *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('password_label')} (Non modificabile)</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} readOnly value={password} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 pr-10 text-slate-400 cursor-not-allowed outline-none transition-all" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 5: Data di Nascita - Telefono */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('birth_date_label')}</label>
                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('phone_label')}</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm py-4 border-t border-slate-800 mt-8 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-slate-800 text-white hover:bg-slate-700">
                {t('cancel_label')}
              </button>
              <button type="submit" form="quick-add-shooter-form" disabled={loading} className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20 disabled:opacity-50 flex items-center gap-2">
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                {t('save_shooter_label')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuickAddShooterModal;
