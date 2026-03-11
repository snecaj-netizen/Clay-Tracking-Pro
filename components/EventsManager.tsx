import React, { useState, useEffect } from 'react';
import { SocietyEvent, Discipline } from '../types';

interface EventsManagerProps {
  user: any;
  token: string;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  societies: any[];
}

const EventsManager: React.FC<EventsManagerProps> = ({ user, token, triggerConfirm, societies }) => {
  const [events, setEvents] = useState<SocietyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SocietyEvent | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('Regionale');
  const [visibility, setVisibility] = useState('Gara di Società');
  const [discipline, setDiscipline] = useState<Discipline>(Discipline.CK);
  const [location, setLocation] = useState(user?.role === 'society' ? user.society : '');
  const [targets, setTargets] = useState<number>(50);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [posterUrl, setPosterUrl] = useState('');

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [token]);

  const handleEdit = (ev: SocietyEvent) => {
    setEditingEvent(ev);
    setName(ev.name);
    setType(ev.type);
    setVisibility(ev.visibility);
    setDiscipline(ev.discipline as Discipline);
    setLocation(ev.location);
    setTargets(ev.targets);
    setStartDate(ev.start_date);
    setEndDate(ev.end_date);
    setCost(ev.cost || '');
    setNotes(ev.notes || '');
    setPosterUrl(ev.poster_url || '');
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingEvent(null);
    setName('');
    setType('Regionale');
    setVisibility('Gara di Società');
    setDiscipline(Discipline.CK);
    setLocation(user?.role === 'society' ? user.society : '');
    setTargets(50);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setCost('');
    setNotes('');
    setPosterUrl('');
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const eventData = {
      id: editingEvent ? editingEvent.id : crypto.randomUUID(),
      name,
      type,
      visibility,
      discipline,
      location,
      targets,
      start_date: startDate,
      end_date: endDate,
      cost,
      notes,
      poster_url: posterUrl
    };

    try {
      const res = await fetch(editingEvent ? `/api/events/${editingEvent.id}` : '/api/events', {
        method: editingEvent ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
      });

      if (res.ok) {
        fetchEvents();
        resetForm();
      } else {
        const errorData = await res.json();
        alert(`Errore: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error saving event:', err);
      alert('Errore di rete nel salvataggio.');
    }
  };

  const handleDelete = (id: string) => {
    triggerConfirm(
      'Elimina Evento',
      'Sei sicuro di voler eliminare questo evento?',
      async () => {
        try {
          const res = await fetch(`/api/events/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setEvents(events.filter(e => e.id !== id));
          } else {
            const errorData = await res.json();
            alert(`Errore: ${errorData.error || res.statusText}`);
          }
        } catch (err) {
          console.error('Error deleting event:', err);
        }
      }
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Il file è troppo grande. Dimensione massima: 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPosterUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
          <i className="fas fa-calendar-alt text-orange-500"></i> Gestione Eventi
        </h2>
        {!showForm && (user?.role === 'admin' || user?.role === 'society') && (
          <button 
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-500"
          >
            <i className="fas fa-plus"></i> Nuovo Evento
          </button>
        )}
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white uppercase tracking-widest">{editingEvent ? 'Modifica Evento' : 'Nuovo Evento'}</h3>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-white">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Titolo / Nome Gara *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipologia *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                <option value="Regionale">Regionale</option>
                <option value="Nazionale">Nazionale</option>
                <option value="Internazionale">Internazionale</option>
                <option value="Allenamento">Allenamento</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Visibilità *</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                <option value="Gara di Società">Gara di Società (Solo propri tiratori)</option>
                <option value="Pubblica">Gara Pubblica (Tutti)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Disciplina *</label>
              <select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                {Object.values(Discipline).filter(d => d !== Discipline.TRAINING).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Campo / TAV *</label>
              {user?.role === 'admin' ? (
                <select value={location} onChange={(e) => setLocation(e.target.value)} required className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                  <option value="">Seleziona Società</option>
                  {societies.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={location} disabled className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed" />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Piattelli Gara *</label>
              <input type="number" required min="25" step="25" value={targets} onChange={(e) => setTargets(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Data Inizio *</label>
              <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" style={{ colorScheme: 'dark' }} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Data Fine *</label>
              <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" style={{ colorScheme: 'dark' }} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Costo (€)</label>
              <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Locandina / Programma</label>
              <div className="flex items-center gap-4">
                <label className="flex-1 cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-4 py-3 text-center transition-all">
                  <span className="text-sm font-bold text-white"><i className="fas fa-upload mr-2"></i> Carica File (Max 5MB)</span>
                  <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                </label>
                {posterUrl && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 flex items-center justify-center bg-slate-800">
                    {posterUrl.startsWith('data:application/pdf') ? (
                      <i className="fas fa-file-pdf text-2xl text-red-500"></i>
                    ) : (
                      <img src={posterUrl} alt="Locandina" className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Note</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all resize-none"></textarea>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-slate-800">
            <button type="button" onClick={resetForm} className="px-6 py-3 rounded-xl text-xs font-black uppercase transition-all bg-slate-800 text-white hover:bg-slate-700">
              Annulla
            </button>
            <button type="submit" className="px-6 py-3 rounded-xl text-xs font-black uppercase transition-all bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20">
              {editingEvent ? 'Aggiorna' : 'Salva'}
            </button>
          </div>
        </form>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Gara</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo/Visibilità</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Luogo</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 italic text-sm">
                    Nessun evento trovato.
                  </td>
                </tr>
              ) : (
                events.map(ev => (
                  <tr key={ev.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-bold text-white">{ev.name}</div>
                      <div className="text-xs text-slate-400">{ev.discipline} - {ev.targets} piattelli</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-white">{ev.type}</div>
                      <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${ev.visibility === 'Pubblica' ? 'bg-emerald-950 text-emerald-400' : 'bg-blue-950 text-blue-400'}`}>
                        {ev.visibility}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-300">{ev.location}</td>
                    <td className="py-4 px-4 text-sm text-slate-300">
                      {new Date(ev.start_date).toLocaleDateString('it-IT')}
                      {ev.start_date !== ev.end_date && ` - ${new Date(ev.end_date).toLocaleDateString('it-IT')}`}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        {ev.poster_url && (
                          <a 
                            href={ev.poster_url} 
                            download={`Locandina_${ev.name.replace(/\s+/g, '_')}`}
                            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all"
                            title="Scarica Locandina"
                          >
                            <i className="fas fa-download text-xs"></i>
                          </a>
                        )}
                        {(user?.role === 'admin' || (user?.role === 'society' && ev.location === user.society)) && (
                          <>
                            <button onClick={() => handleEdit(ev)} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all">
                              <i className="fas fa-edit text-xs"></i>
                            </button>
                            <button onClick={() => handleDelete(ev.id)} className="w-8 h-8 rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all">
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EventsManager;
