import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Save, Phone, Calendar, Target, Shield, Info } from 'lucide-react';
import { User, SocietyEvent } from '../types';
import ShooterSearch from './ShooterSearch';

interface EventRegistrationModalProps {
  event: SocietyEvent;
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

const SHOTGUN_BRANDS = [
  'Benelli', 'Beretta', 'Browning', 'Caesar Guerini', 'Fabarm', 'Franchi',
  'Krieghof', 'Marocchi', 'Perazzi', 'Rizzini', 'Sabatti', 'Zoli', 'Altro'
];

const CARTRIDGE_BRANDS = [
  'Baschieri&Pellagri', 'Bornaghi', 'Cheddite', 'Clever', 'Fiocchi',
  'Nobel Sport', 'RC', 'Trust', 'Winchester', 'Altro'
];

const SESSIONS = ['Mattina', 'Pomeriggio', 'Tutto il giorno'];

export const EventRegistrationModal: React.FC<EventRegistrationModalProps> = ({
  event,
  user,
  onClose,
  onSuccess
}) => {
  const isAdminOrSociety = user.role === 'admin' || user.role === 'society';
  const [formData, setFormData] = useState({
    user_id: isAdminOrSociety ? '' : user.id,
    registration_day: 'Giorno1',
    registration_type: 'Iscrizione per Categoria',
    shotgun_brand: 'Beretta',
    shotgun_model: '',
    cartridge_brand: 'Fiocchi',
    cartridge_model: '',
    shooting_session: 'Mattina',
    notes: '',
    phone: isAdminOrSociety ? '' : (user.phone || '')
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shooters, setShooters] = useState<any[]>([]);
  const [selectedShooter, setSelectedShooter] = useState<any>(isAdminOrSociety ? null : user);

  useEffect(() => {
    if (user.role === 'admin' || user.role === 'society') {
      const fetchShooters = async () => {
        try {
          const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          });
          if (res.ok) {
            const data = await res.json();
            setShooters(data);
          }
        } catch (err) {
          console.error("Failed to fetch shooters", err);
        }
      };
      fetchShooters();
    }
  }, [user.role]);

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
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${event.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante la registrazione');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Iscrizione Gara</h2>
            <p className="text-sm text-orange-600 font-medium">{event.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* User Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
            {(user.role === 'admin' || user.role === 'society') ? (
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Seleziona Tiratore</label>
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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tiratore</label>
                <p className="font-medium text-gray-900">{selectedShooter?.name} {selectedShooter?.surname}</p>
              </div>
            )}
            
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Codice Tiratore</label>
              <p className="font-medium text-gray-900">{selectedShooter?.shooter_code || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Società</label>
              <p className="font-medium text-gray-900">{selectedShooter?.society || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria / Qualifica</label>
              <p className="font-medium text-gray-900">{selectedShooter?.category || '-'} / {selectedShooter?.qualification || '-'}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Phone (Editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Phone className="w-4 h-4 text-orange-500" />
                Numero di Telefono
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Inserisci il tuo numero"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Day Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  Seleziona il giorno
                </label>
                <select
                  value={formData.registration_day}
                  onChange={e => setFormData({ ...formData, registration_day: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="Giorno1">Giorno 1</option>
                  <option value="Giorno2">Giorno 2</option>
                  <option value="Tutti i Giorni">Tutti i Giorni</option>
                </select>
              </div>

              {/* Registration Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-500" />
                  Tipologia Iscrizione
                </label>
                <select
                  value={formData.registration_type}
                  onChange={e => setFormData({ ...formData, registration_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="Iscrizione per Categoria">Iscrizione per Categoria</option>
                  <option value="Iscrizione per Qualifica">Iscrizione per Qualifica</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Shotgun */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-orange-500" />
                  Fucile
                </label>
                <select
                  value={formData.shotgun_brand}
                  onChange={e => setFormData({ ...formData, shotgun_brand: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {SHOTGUN_BRANDS.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                {formData.shotgun_brand === 'Altro' && (
                  <input
                    type="text"
                    required
                    placeholder="Specifica marca fucile"
                    value={formData.shotgun_model}
                    onChange={e => setFormData({ ...formData, shotgun_model: e.target.value })}
                    className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                )}
              </div>

              {/* Cartridge */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Info className="w-4 h-4 text-orange-500" />
                  Cartuccia
                </label>
                <select
                  value={formData.cartridge_brand}
                  onChange={e => setFormData({ ...formData, cartridge_brand: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {CARTRIDGE_BRANDS.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                {formData.cartridge_brand === 'Altro' && (
                  <input
                    type="text"
                    required
                    placeholder="Specifica marca cartuccia"
                    value={formData.cartridge_model}
                    onChange={e => setFormData({ ...formData, cartridge_model: e.target.value })}
                    className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                )}
              </div>
            </div>

            {/* Session */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sessione di Tiro</label>
              <div className="flex flex-wrap gap-2">
                {SESSIONS.map(session => (
                  <button
                    key={session}
                    type="button"
                    onClick={() => setFormData({ ...formData, shooting_session: session })}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      formData.shooting_session === session
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {session}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Eventuali note o richieste particolari..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none min-h-[100px]"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.user_id}
              className="flex-1 px-6 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Conferma Iscrizione
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
