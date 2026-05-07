import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Phone, Calendar, Target, Shield, Info } from 'lucide-react';
import { User, SocietyEvent, EventRegistration } from '../types';
import ShooterSearch from './ShooterSearch';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';

interface EventRegistrationModalProps {
  event: SocietyEvent;
  user: User;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: EventRegistration;
}

const SHOTGUN_BRANDS = [
  'Benelli', 'Beretta', 'Browning', 'Caesar Guerini', 'Fabarm', 'Franchi',
  'Krieghoff', 'Marocchi', 'Perazzi', 'Rizzini', 'Sabatti', 'Zoli', 'Altro'
];

const CARTRIDGE_BRANDS = [
  'Baschieri & Pellagri', 'Bornaghi', 'Cheddite', 'Clever', 'Fiocchi',
  'Nobel Sport', 'RC', 'Trust', 'Winchester', 'Altro'
];

export const EventRegistrationModal: React.FC<EventRegistrationModalProps> = ({
  event,
  user,
  onClose,
  onSuccess,
  initialData
}) => {
  const { triggerConfirm, triggerToast } = useUI();
  const { language, t } = useLanguage();
  const SESSIONS = [
    { value: 'morning', label: t('morning') },
    { value: 'afternoon', label: t('afternoon') }
  ];
  const isAdminOrSociety = user.role === 'admin' || user.role === 'society';
  const [formData, setFormData] = useState({
    user_id: initialData?.user_id || (isAdminOrSociety ? '' : user.id),
    registration_day: initialData?.registration_day || '',
    registration_type: initialData?.registration_type || t('cat_reg'),
    shotgun_brand: initialData?.shotgun_brand ? initialData.shotgun_brand : 'Beretta',
    shotgun_model: initialData?.shotgun_model || '',
    cartridge_brand: initialData?.cartridge_brand ? initialData.cartridge_brand : 'Fiocchi',
    cartridge_model: initialData?.cartridge_model || '',
    shooting_session: initialData?.shooting_session || 'morning',
    notes: initialData?.notes || '',
    phone: initialData?.phone || (isAdminOrSociety ? '' : (user.phone || ''))
  });

  // Keep formData in sync with initialData if it changes
  useEffect(() => {
    if (initialData) {
      console.log("EventRegistrationModal: Syncing initialData to formData", initialData);
      setFormData({
        user_id: initialData.user_id,
        registration_day: initialData.registration_day || '',
        registration_type: initialData.registration_type || t('cat_reg'),
        shotgun_brand: initialData.shotgun_brand ? initialData.shotgun_brand : 'Beretta',
        shotgun_model: initialData.shotgun_model || '',
        cartridge_brand: initialData.cartridge_brand ? initialData.cartridge_brand : 'Fiocchi',
        cartridge_model: initialData.cartridge_model || '',
        shooting_session: initialData.shooting_session || 'morning',
        notes: initialData.notes || '',
        phone: initialData.phone || user.phone || ''
      });
    }
  }, [initialData, user.phone, t]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDetail, setShowSuccessDetail] = useState(false);
  const [shooters, setShooters] = useState<any[]>([]);
  const [selectedShooter, setSelectedShooter] = useState<any>(() => {
    if (initialData) {
      console.log("EventRegistrationModal: Mapping initialData to selectedShooter", {
        user_id: initialData.user_id,
        first_name: initialData.first_name,
        last_name: initialData.last_name,
        shooter_code: initialData.shooter_code
      });
      return { 
        id: initialData.user_id, 
        name: initialData.first_name || (initialData.user_id === user.id ? user.name : ''), 
        surname: initialData.last_name || (initialData.user_id === user.id ? user.surname : ''),
        shooter_code: initialData.shooter_code || (initialData.user_id === user.id ? user.shooter_code : ''),
        society: initialData.society || (initialData.user_id === user.id ? user.society : ''),
        category: initialData.category || (initialData.user_id === user.id ? user.category : ''),
        qualification: initialData.qualification || (initialData.user_id === user.id ? user.qualification : '')
      };
    }
    return isAdminOrSociety ? null : user;
  });

  // UseEffect to update selectedShooter details if they are missing and we load the shooters list
  useEffect(() => {
    if (initialData && shooters.length > 0) {
      const fullShooter = shooters.find(s => s.id === initialData.user_id);
      if (fullShooter) {
        setSelectedShooter(prev => ({
          ...prev,
          name: fullShooter.name || prev.name,
          surname: fullShooter.surname || prev.surname,
          shooter_code: fullShooter.shooter_code || prev.shooter_code,
          society: fullShooter.society || prev.society,
          category: fullShooter.category || prev.category,
          qualification: fullShooter.qualification || prev.qualification
        }));
      }
    }
  }, [shooters, initialData]);

  useEffect(() => {
    if (user.role === 'admin' || user.role === 'society') {
      const fetchShooters = async () => {
        try {
          const usersUrl = `/api/admin/users?limit=10000&excludeRole=society${user.role === 'society' ? '&all=true' : ''}`;
          const res = await fetch(usersUrl, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          });
          if (res.ok) {
            const data = await res.json();
            const shootersData = data.users || data;
            setShooters(shootersData);
          }
        } catch (err) {
          console.error("Failed to fetch shooters", err);
        }
      };
      fetchShooters();
    }
  }, [user.role]);

  const getEventDays = () => {
    if (!event.start_date || !event.end_date) return [];
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    const days = [];
    let current = new Date(start);
    
    while (current <= end) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const eventDays = getEventDays();
  const isSingleDay = eventDays.length <= 1;

  useEffect(() => {
    if (!initialData && eventDays.length > 0) {
      if (isSingleDay) {
        setFormData(prev => ({ ...prev, registration_day: eventDays[0] }));
      } else if (!formData.registration_day) {
        setFormData(prev => ({ ...prev, registration_day: eventDays[0] }));
      }
    }
  }, [eventDays, isSingleDay, initialData, formData.registration_day]);

  const handleShooterSelect = (val: any, id?: number) => {
    const shooter = shooters.find(s => s.id === id);
    if (shooter) {
      setSelectedShooter(shooter);
      setFormData(prev => ({
        ...prev,
        user_id: shooter.id,
        phone: shooter.phone || ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.user_id) return;

    triggerConfirm(
      initialData ? (language === 'it' ? 'Conferma Modifica' : 'Confirm Edit') : t('confirm_reg'),
      language === 'it' 
        ? `Sei sicuro di voler ${initialData ? 'modificare l\'iscrizione' : 'iscrivere'} ${selectedShooter?.name} ${selectedShooter?.surname} alla gara "${event.name}"?`
        : `Are you sure you want to ${initialData ? 'edit the registration' : 'register'} ${selectedShooter?.name} ${selectedShooter?.surname} to the event "${event.name}"?`,
      async () => {
        setIsSubmitting(true);
        setError(null);

        try {
          const url = initialData 
            ? `/api/events/${event.id}/registrations/${initialData.id}`
            : `/api/events/${event.id}/register`;
          
          const method = initialData ? 'PUT' : 'POST';

          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify(formData)
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Errore durante l\'operazione');
          }

          if (!initialData) {
            setShowSuccessDetail(true);
          } else {
            triggerToast?.(language === 'it' ? 'Iscrizione aggiornata con successo!' : 'Registration updated successfully!', 'success');
            onSuccess();
            onClose();
          }
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsSubmitting(false);
        }
      },
      initialData ? 'Salva' : 'Iscriviti',
      'primary'
    );
  };

  if (showSuccessDetail) {
    return createPortal(
      <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-800 p-8 text-center"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <Save className="w-10 h-10 text-green-500" />
            </motion.div>
          </div>
          
          <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">{t('reg_confirmed')}</h3>
          <p className="text-slate-400 text-sm mb-8">{t('reg_success_msg')}</p>
          
          <div className="bg-slate-950/50 rounded-2xl border border-slate-800 p-6 mb-8 text-left space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">{t('event_label') || t('gara')}</label>
              <p className="text-white font-bold">{event.name}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">{t('shooter')}</label>
              <p className="text-white font-bold">{selectedShooter?.name} {selectedShooter?.surname}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">{t('day_label') || 'Giorno'}</label>
                <p className="text-white font-bold">{formData.registration_day}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">{t('session_label') || 'Sessione'}</label>
                <p className="text-white font-bold">{formData.shooting_session}</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => {
              onSuccess();
              onClose();
            }}
            className="w-full py-4 rounded-2xl bg-orange-600 text-white font-black uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20"
          >
            {t('close_and_continue')}
          </button>
        </motion.div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-800 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        <div className="p-6 sm:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none">{initialData ? t('edit_registration') : t('reg_title')}</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
              <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest">{event.name}</p>
              <span className="hidden sm:inline text-slate-700">•</span>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {new Date(event.start_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB')}
                {event.start_date !== event.end_date && ` - ${new Date(event.end_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB')}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg border border-slate-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
          <form id="registration-form" onSubmit={handleSubmit} className="space-y-6">
            {/* User Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
              {(user.role === 'admin' || user.role === 'society') ? (
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{t('select_shooter_label')} *</label>
                  <ShooterSearch 
                    value={selectedShooter?.id || ''}
                    onChange={handleShooterSelect}
                    shooters={shooters}
                    useId={true}
                    className="w-full"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('shooter')}</label>
                  <p className="font-bold text-white">{selectedShooter?.name} {selectedShooter?.surname}</p>
                </div>
              )}
              
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('shooter_code_label')} *</label>
                <p className="font-bold text-white">{selectedShooter?.shooter_code || '-'}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('societies')} *</label>
                <p className="font-bold text-white">{selectedShooter?.society || '-'}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('cat_qua')} *</label>
                <p className="font-bold text-white">{selectedShooter?.category || '-'} / {selectedShooter?.qualification || '-'}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Phone (Editable) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Phone className="w-3 h-3 text-orange-500" />
                  {t('phone')} *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t('enter_phone_placeholder')}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-orange-600 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Day Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-orange-500" />
                    {t('select_day')} *
                  </label>
                  {isSingleDay ? (
                    <div className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-slate-400 rounded-xl flex items-center justify-between cursor-not-allowed opacity-75">
                      <span className="font-bold">
                        {(() => {
                          const date = new Date(formData.registration_day);
                          if (isNaN(date.getTime())) return formData.registration_day;
                          const dayNum = String(date.getDate()).padStart(2, '0');
                          const monthNum = String(date.getMonth() + 1).padStart(2, '0');
                          const yearNum = date.getFullYear();
                          return `${dayNum}/${monthNum}/${yearNum}`;
                        })()}
                      </span>
                      <Shield className="w-3 h-3 text-slate-600" />
                    </div>
                  ) : (
                    <select
                      value={formData.registration_day}
                      required
                      onChange={e => setFormData({ ...formData, registration_day: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-orange-600 outline-none transition-all appearance-none"
                    >
                      <option value="" disabled>Seleziona Giorno</option>
                      {eventDays.map(day => {
                        const date = new Date(day);
                        const dayNum = String(date.getDate()).padStart(2, '0');
                        const monthNum = String(date.getMonth() + 1).padStart(2, '0');
                        return (
                          <option key={day} value={day}>{dayNum}/{monthNum}</option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {/* Registration Type */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Target className="w-3 h-3 text-orange-500" />
                    {t('registration_type_label')} *
                  </label>
                  <select
                    value={formData.registration_type}
                    required
                    onChange={e => setFormData({ ...formData, registration_type: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-orange-600 outline-none transition-all appearance-none"
                  >
                    <option value={t('cat_reg')}>{t('cat_reg')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Shotgun */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Shield className="w-3 h-3 text-orange-500" />
                    {language === 'it' ? 'Fucile' : 'Shotgun'} *
                  </label>
                  <select
                    value={formData.shotgun_brand}
                    required
                    onChange={e => setFormData({ ...formData, shotgun_brand: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-orange-600 outline-none transition-all appearance-none"
                  >
                    {SHOTGUN_BRANDS.map(brand => (
                      <option key={brand} value={brand}>{brand === 'Altro' ? (language === 'it' ? 'Altro' : 'Other') : brand}</option>
                    ))}
                  </select>
                  {formData.shotgun_brand === 'Altro' && (
                    <input
                      type="text"
                      required
                      placeholder={language === 'it' ? 'Specifica marca fucile' : 'Specify shotgun brand'}
                      value={formData.shotgun_model}
                      onChange={e => setFormData({ ...formData, shotgun_model: e.target.value })}
                      className="mt-2 w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-orange-600 outline-none transition-all"
                    />
                  )}
                </div>

                {/* Cartridge */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Info className="w-3 h-3 text-orange-500" />
                    {language === 'it' ? 'Cartuccia' : 'Cartridge'} *
                  </label>
                  <select
                    value={formData.cartridge_brand}
                    required
                    onChange={e => setFormData({ ...formData, cartridge_brand: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-orange-600 outline-none transition-all appearance-none"
                  >
                    {CARTRIDGE_BRANDS.map(brand => (
                      <option key={brand} value={brand}>{brand === 'Altro' ? (language === 'it' ? 'Altro' : 'Other') : brand}</option>
                    ))}
                  </select>
                  {formData.cartridge_brand === 'Altro' && (
                    <input
                      type="text"
                      required
                      placeholder={language === 'it' ? 'Specifica marca cartuccia' : 'Specify cartridge brand'}
                      value={formData.cartridge_model}
                      onChange={e => setFormData({ ...formData, cartridge_model: e.target.value })}
                      className="mt-2 w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-orange-600 outline-none transition-all"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Sessione di Tiro *</label>
                <div className="flex flex-wrap gap-2">
                  {SESSIONS.map(session => (
                    <button
                      key={session.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, shooting_session: session.value })}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                        formData.shooting_session === session.value
                          ? 'bg-orange-600 text-white border-orange-500 shadow-lg'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-orange-500/50'
                      }`}
                    >
                      {session.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{language === 'it' ? 'Note' : 'Notes'}</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={language === 'it' ? "Eventuali note o richieste particolari..." : "Any extra notes or requests..."}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl focus:border-orange-600 outline-none min-h-[100px] resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 text-red-500 border border-red-800 rounded-xl text-xs font-bold">
                {error}
              </div>
            )}

            <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm py-4 border-t border-slate-800 mt-8 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-slate-800 text-white hover:bg-slate-700"
              >
                {t('close')}
              </button>
              <button
                type="submit"
                form="registration-form"
                disabled={isSubmitting || !formData.user_id}
                className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {initialData ? (language === 'it' ? 'Salva Modifiche' : 'Save Changes') : t('confirm_reg')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );

};
