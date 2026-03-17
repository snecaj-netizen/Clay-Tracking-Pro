
import React, { useState, useEffect, useMemo } from 'react';
import { Discipline, Competition, CompetitionLevel, Cartridge, UsedCartridge, WeatherInfo, getSeriesLayout } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import SocietySearch from './SocietySearch';

interface CompetitionFormProps {
  initialData?: Competition;
  prefillData?: Partial<Competition>;
  knownLocations?: string[];
  availableCartridges: Cartridge[];
  societies: any[];
  currentUser: any;
  onSubmit: (comp: Competition) => void;
  onCancel: () => void;
}

const WEATHER_OPTIONS = [
  { label: 'Soleggiato', icon: 'fa-sun', color: 'text-yellow-400' },
  { label: 'Nuvoloso', icon: 'fa-cloud', color: 'text-slate-400' },
  { label: 'Pioggia', icon: 'fa-cloud-showers-heavy', color: 'text-blue-400' },
  { label: 'Vento', icon: 'fa-wind', color: 'text-teal-400' },
  { label: 'Neve', icon: 'fa-snowflake', color: 'text-blue-200' },
  { label: 'Temporale', icon: 'fa-bolt', color: 'text-purple-400' },
];

const CompetitionForm: React.FC<CompetitionFormProps> = ({ initialData, prefillData, knownLocations = [], availableCartridges = [], societies = [], currentUser, onSubmit, onCancel }) => {
  const data = initialData || prefillData;
  const [name, setName] = useState(data?.name || '');
  const [location, setLocation] = useState(data?.location || '');
  const [discipline, setDiscipline] = useState<Discipline>(data?.discipline === Discipline.TRAINING ? Discipline.CK : (data?.discipline || Discipline.CK));
  const [totalTargets, setTotalTargets] = useState<number>(data?.totalTargets || 50);
  const [level, setLevel] = useState<CompetitionLevel>(data?.level || CompetitionLevel.REGIONAL);
  const [eventType, setEventType] = useState<'Gara' | 'Allenamento'>(
    (data?.level === CompetitionLevel.TRAINING || data?.discipline === Discipline.TRAINING) ? 'Allenamento' : 'Gara'
  );
  const [scores, setScores] = useState<number[]>(data?.scores || [25, 25]);
  const [detailedScores, setDetailedScores] = useState<boolean[][]>(data?.detailedScores || []);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number>(data?.userId || currentUser?.id);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data.filter(u => u.role !== 'society'));
        }
      })
      .catch(err => console.error('Error fetching users:', err));
    }
  }, [currentUser]);
  const [seriesImages, setSeriesImages] = useState<string[]>(data?.seriesImages || []);
  const [expandedSeries, setExpandedSeries] = useState<number | null>(null);
  const [position, setPosition] = useState<number | undefined>(data?.position);
  const [cost, setCost] = useState<number>(data?.cost || 0);
  const [costPerSeries, setCostPerSeries] = useState<number>(() => {
    if (data?.cost && data?.scores?.length && (data?.level === CompetitionLevel.TRAINING || data?.discipline === Discipline.TRAINING)) {
      return Number((data.cost / data.scores.length).toFixed(2));
    }
    return 0;
  });
  const [win, setWin] = useState<number>(data?.win || 0);
  const [notes, setNotes] = useState(data?.notes || '');
  const [date, setDate] = useState(data?.date || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(data?.endDate || '');
  const [chokes, setChokes] = useState(data?.chokes || { firstBarrel: '1*', secondBarrel: '1*' });
  const [usedCartridges, setUsedCartridges] = useState<UsedCartridge[]>(data?.usedCartridges || []);
  
  // Weather states
  const [weatherTemp, setWeatherTemp] = useState<number | undefined>(data?.weather?.temp);
  const [weatherIcon, setWeatherIcon] = useState<string | undefined>(data?.weather?.icon);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);

  const isTraining = eventType === 'Allenamento';
  const isMultiDayEligible = totalTargets >= 200;

  const groupedCartridges = useMemo(() => {
    const groups: Record<string, { 
      id: string, 
      producer: string, 
      model: string, 
      leadNumber: string, 
      imageUrl?: string,
      totalQuantity: number 
    }> = {};

    availableCartridges.forEach(cart => {
      const key = `${cart.producer.toLowerCase().trim()}-${cart.model.toLowerCase().trim()}-${cart.leadNumber}`;
      if (!groups[key]) {
        groups[key] = {
          id: cart.id,
          producer: cart.producer,
          model: cart.model,
          leadNumber: cart.leadNumber,
          imageUrl: cart.imageUrl,
          totalQuantity: 0
        };
      }
      groups[key].totalQuantity += cart.quantity;
      if (!groups[key].imageUrl && cart.imageUrl) groups[key].imageUrl = cart.imageUrl;
    });

    return Object.values(groups).sort((a, b) => a.producer.localeCompare(b.producer));
  }, [availableCartridges]);

  useEffect(() => {
    if (isTraining) {
      setLevel(CompetitionLevel.TRAINING);
      if (name === '') setName('Sessione di Allenamento');
    } else {
      if (level === CompetitionLevel.TRAINING) setLevel(CompetitionLevel.REGIONAL);
      
      // Update scores length based on totalTargets
      const seriesLayoutObj = getSeriesLayout(discipline);
      const targetsPerSeries = seriesLayoutObj.layout.reduce((a, b) => a + b, 0);
      const numSeries = Math.ceil(totalTargets / targetsPerSeries);

      if (scores.length !== numSeries) {
        setScores(prev => {
          const newScores = Array(numSeries).fill(targetsPerSeries);
          for (let i = 0; i < Math.min(prev.length, numSeries); i++) {
            newScores[i] = prev[i];
          }
          return newScores;
        });
        setDetailedScores(prev => {
          const newDetailed = Array(numSeries).fill([]);
          for (let i = 0; i < Math.min(prev.length, numSeries); i++) {
            newDetailed[i] = prev[i] || [];
          }
          return newDetailed;
        });
      }
    }
  }, [eventType, totalTargets, discipline]);

  const fetchWeatherWithAI = async () => {
    let currentLocation = location;
    if (!currentLocation) {
      const userLocation = prompt("Inserisci il luogo (es. Roma, Milano, TAV Concaverde) per recuperare il meteo:");
      if (!userLocation || !userLocation.trim()) {
        alert("Luogo necessario per recuperare il meteo.");
        return;
      }
      currentLocation = userLocation.trim();
      setLocation(currentLocation);
    }

    if (!date) {
      alert("Inserisci prima la data per recuperare il meteo.");
      return;
    }

    setIsFetchingWeather(true);
    try {
      let apiKey = '';
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const res = await fetch('/api/gemini-key', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            apiKey = data.key;
          }
        }
      } catch (e) {
        console.error("Failed to fetch API key from server", e);
      }

      if (!apiKey) {
        const rawKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
        apiKey = typeof rawKey === 'string' ? rawKey.trim() : rawKey;
      } else {
        apiKey = apiKey.trim();
      }
      
      if (!apiKey || apiKey === 'undefined') throw new Error("API Key missing");

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: `Qual era (o sarà) il meteo a ${currentLocation} il giorno ${date}? 
                   Fornisci i dati in formato JSON: temp (numero intero Celsius) e 
                   condition (una tra: 'sole', 'nuvole', 'pioggia', 'vento', 'neve', 'temporale').`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              temp: { type: Type.INTEGER, description: "Temperatura in gradi Celsius" },
              condition: { type: Type.STRING, description: "Condizione meteo semplificata" }
            },
            required: ["temp", "condition"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      const data = JSON.parse(text);
      setWeatherTemp(data.temp);
      
      const mappedIcon = WEATHER_OPTIONS.find(o => 
        data.condition.toLowerCase().includes(o.label.toLowerCase()) || 
        o.label.toLowerCase().includes(data.condition.toLowerCase())
      )?.icon || 'fa-cloud';
      
      setWeatherIcon(mappedIcon);
    } catch (error) {
      console.error("Error fetching weather:", error);
      alert("Impossibile recuperare il meteo automaticamente.");
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const handleScoreChange = (index: number, value: string) => {
    const num = parseInt(value) || 0;
    const clamped = Math.min(25, Math.max(0, num));
    const newScores = [...scores];
    newScores[index] = clamped;
    setScores(newScores);
    
    // If detailed score exists, we might want to clear it or adjust it, but for now let's just clear it if they manually change the number
    if (detailedScores[index] && detailedScores[index].length > 0) {
      setDetailedScores(prev => {
        const newDetailed = [...prev];
        newDetailed[index] = [];
        return newDetailed;
      });
    }
  };

  const toggleDetailedView = (idx: number) => {
    if (expandedSeries === idx) {
      setExpandedSeries(null);
    } else {
      setExpandedSeries(idx);
      if (!detailedScores[idx] || detailedScores[idx].length === 0) {
        const currentScore = scores[idx] || 0;
        const newSeries = Array(25).fill(false);
        for (let i = 0; i < currentScore; i++) {
          newSeries[i] = true;
        }
        setDetailedScores(prev => {
          const newDetailed = [...prev];
          newDetailed[idx] = newSeries;
          return newDetailed;
        });
      }
    }
  };

  const handleDetailedScoreChange = (seriesIndex: number, targetIndex: number) => {
    setDetailedScores(prev => {
      const newDetailed = [...prev];
      const newSeries = [...(newDetailed[seriesIndex] || Array(25).fill(false))];
      newSeries[targetIndex] = !newSeries[targetIndex];
      newDetailed[seriesIndex] = newSeries;
      
      const newScores = [...scores];
      newScores[seriesIndex] = newSeries.filter(Boolean).length;
      setScores(newScores);
      
      return newDetailed;
    });
  };

  const handleImageUpload = (seriesIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSeriesImages(prev => {
          const newImages = [...prev];
          newImages[seriesIndex] = reader.result as string;
          return newImages;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (seriesIndex: number) => {
    setSeriesImages(prev => {
      const newImages = [...prev];
      newImages[seriesIndex] = '';
      return newImages;
    });
  };

  const toggleCartridge = (group: any) => {
    setUsedCartridges(prev => {
      const exists = prev.find(uc => 
        uc.producer === group.producer && 
        uc.model === group.model && 
        uc.leadNumber === group.leadNumber
      );
      if (exists) {
        return prev.filter(uc => !(uc.producer === group.producer && uc.model === group.model && uc.leadNumber === group.leadNumber));
      } else {
        return [...prev, { cartridgeId: group.id, producer: group.producer, model: group.model, leadNumber: group.leadNumber, imageUrl: group.imageUrl }];
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const completedSeriesCount = scores.filter(s => s > 0).length || 1;
    const averagePerSeries = totalScore / completedSeriesCount;
    
    const newComp: Competition = {
      id: initialData?.id || crypto.randomUUID(),
      userId: selectedUserId,
      name: name.trim() || (isTraining ? 'Allenamento' : 'Gara senza nome'),
      location: location.trim() || 'Luogo non specificato',
      date,
      endDate: isMultiDayEligible && endDate ? endDate : undefined,
      discipline,
      totalTargets: isTraining ? scores.length * 25 : totalTargets,
      level,
      scores,
      detailedScores,
      seriesImages,
      totalScore,
      averagePerSeries,
      position: isTraining ? undefined : position,
      cost: isTraining ? costPerSeries * scores.length : cost,
      win,
      notes,
      chokes,
      usedCartridges,
      weather: weatherTemp !== undefined ? { temp: weatherTemp, icon: weatherIcon } : undefined
    };
    onSubmit(newComp);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">{initialData ? 'Modifica' : 'Nuova'} {isTraining ? 'Sessione' : 'Gara'}</h2>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {currentUser?.role === 'admin' && (
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tiratore</label>
            <div className="relative">
              <select 
                value={selectedUserId || ''} 
                onChange={(e) => setSelectedUserId(parseInt(e.target.value))} 
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} {u.surname}</option>
                ))}
              </select>
              <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
            </div>
          </div>
        )}
        <div className="md:col-span-2 space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Titolo / Nome</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo Evento</label>
          <div className="relative">
            <select value={eventType} onChange={(e) => setEventType(e.target.value as 'Gara' | 'Allenamento')} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
              <option value="Gara">Gara</option>
              <option value="Allenamento">Allenamento</option>
            </select>
            <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
        </div>

        {!isTraining && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipologia</label>
            <div className="relative">
              <select value={level} onChange={(e) => setLevel(e.target.value as CompetitionLevel)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
                <option value={CompetitionLevel.REGIONAL}>Regionale</option>
                <option value={CompetitionLevel.NATIONAL}>Nazionale</option>
                <option value={CompetitionLevel.INTERNATIONAL}>Internazionale</option>
              </select>
              <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Disciplina</label>
          <div className="relative">
            <select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all appearance-none">
              {Object.values(Discipline).filter(d => d !== Discipline.TRAINING).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Campo / TAV</label>
          <SocietySearch 
            value={location}
            onChange={setLocation}
            societies={societies}
            placeholder="Seleziona Campo / TAV..."
            required
          />
          <p className="text-[10px] text-slate-500 italic">Se il campo non è in elenco, chiedi all'amministratore di aggiungerlo.</p>
        </div>

        {isTraining ? (
          <div className="md:col-span-2 space-y-4 bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Numero Serie</label>
              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded">
                TOTALE: {scores.reduce((a, b) => a + b, 0)} PIATTELLI
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => scores.length > 1 && setScores(scores.slice(0, -1))} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-black text-xl">-</button>
              <div className="flex-[2] text-center text-3xl font-black text-white">{scores.length}</div>
              <button type="button" onClick={() => {
                const layoutObj = getSeriesLayout(discipline);
                const tps = layoutObj.layout.reduce((a, b) => a + b, 0);
                if (scores.length < 12) setScores([...scores, tps]);
              }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-black text-xl">+</button>
            </div>
          </div>
        ) : (
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Piattelli Gara</label>
            <div className="flex flex-wrap gap-4">
              {(discipline === Discipline.EL ? [12, 24, 36] : 
                discipline === Discipline.DT ? [150] :
                discipline === Discipline.SK_ISSF ? [75, 125] :
                [25, 50, 100, 200]).map(val => (
                <button key={val} type="button" onClick={() => setTotalTargets(val)} className={`flex-1 min-w-[60px] py-3 rounded-xl font-bold transition-all ${totalTargets === val ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 border-2 border-slate-700'}`}>{val}</button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:col-span-2">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{isMultiDayEligible ? 'Giorno 1 (Inizio)' : 'Data'}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
          </div>
          {isMultiDayEligible && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Giorno 2 (Fine)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
            </div>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
            Meteo
            <button 
              type="button" 
              onClick={fetchWeatherWithAI} 
              disabled={isFetchingWeather}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-orange-500 border border-orange-500/20 disabled:opacity-50"
            >
              {isFetchingWeather ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-magic mr-1"></i>} 
              RECUPERA CON AI
            </button>
          </label>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative w-full sm:w-1/3">
              <input 
                type="number" 
                placeholder="Temp °C" 
                value={weatherTemp ?? ''} 
                onChange={(e) => setWeatherTemp(e.target.value ? parseInt(e.target.value) : undefined)} 
                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" 
              />
            </div>
            <div className="w-full sm:w-2/3 grid grid-cols-3 gap-2">
              {WEATHER_OPTIONS.map(opt => (
                <button
                  key={opt.icon}
                  type="button"
                  onClick={() => setWeatherIcon(opt.icon)}
                  className={`w-full h-12 rounded-xl border-2 flex items-center justify-center transition-all ${weatherIcon === opt.icon ? 'bg-orange-600 border-orange-500 shadow-lg scale-105' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                  title={opt.label}
                >
                  <i className={`fas ${opt.icon} ${weatherIcon === opt.icon ? 'text-white' : opt.color}`}></i>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 bg-slate-950/40 p-6 rounded-2xl border border-slate-800/50">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Strozzatura Utilizzata</label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prima Canna</label>
            <div className="relative">
              <select 
                value={chokes.firstBarrel} 
                onChange={(e) => setChokes(prev => ({ ...prev, firstBarrel: e.target.value }))}
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white focus:border-orange-600 outline-none transition-all appearance-none text-sm"
              >
                {['1*', '2*', '3*', '4*', '5*'].map(val => <option key={val} value={val}>{val}</option>)}
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs"></i>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Seconda Canna</label>
            <div className="relative">
              <select 
                value={chokes.secondBarrel} 
                onChange={(e) => setChokes(prev => ({ ...prev, secondBarrel: e.target.value }))}
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white focus:border-orange-600 outline-none transition-all appearance-none text-sm"
              >
                {['1*', '2*', '3*', '4*', '5*'].map(val => <option key={val} value={val}>{val}</option>)}
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 bg-slate-950/40 p-6 rounded-2xl border border-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Cartucce Utilizzate</label>
          {usedCartridges.length > 0 && <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 uppercase">{usedCartridges.length} Selezionate</span>}
        </div>
        {groupedCartridges.length === 0 ? (
          <div className="bg-slate-900/50 p-4 rounded-xl border border-dashed border-slate-800 text-center"><p className="text-xs text-slate-600 italic">Nessuna cartuccia in magazzino.</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {groupedCartridges.map(group => {
              const selected = usedCartridges.some(uc => uc.producer === group.producer && uc.model === group.model && uc.leadNumber === group.leadNumber);
              return (
                <button key={`${group.producer}-${group.model}-${group.leadNumber}`} type="button" onClick={() => toggleCartridge(group)} className={`px-3 py-2.5 rounded-xl text-left transition-all border-2 flex items-center gap-3 ${selected ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                  <div className="w-10 h-10 rounded-lg bg-slate-900 overflow-hidden flex-shrink-0 border border-slate-700">
                    {group.imageUrl ? <img src={group.imageUrl} alt={group.model} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-[10px]">{group.leadNumber}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold truncate ${selected ? 'text-white' : 'text-slate-200'}`}>{group.producer} {group.model}</p>
                    <p className={`text-[9px] font-medium ${selected ? 'text-orange-200' : 'text-slate-500'}`}>Piombo: {group.leadNumber}</p>
                  </div>
                  {selected && <i className="fas fa-check-circle text-white text-xs"></i>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {isTraining ? (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Costo per Serie (€)</label>
            <input type="number" step="0.01" value={costPerSeries} onChange={(e) => setCostPerSeries(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
            <p className="text-[10px] text-slate-400 font-medium mt-1">Totale: € {(costPerSeries * scores.length).toFixed(2)}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Costo (€)</label>
            <input type="number" step="0.01" value={cost} onChange={(e) => setCost(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
          </div>
        )}
        {!isTraining && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vincita (€)</label>
            <input type="number" step="0.01" value={win} onChange={(e) => setWin(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
          </div>
        )}
        {!isTraining && date <= new Date().toISOString().split('T')[0] && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Posizionamento</label>
            <input type="number" placeholder="Es: 1" value={position || ''} onChange={(e) => setPosition(e.target.value ? parseInt(e.target.value) : undefined)} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none transition-all" />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Punteggi</label><div className="h-[1px] flex-1 bg-slate-800"></div></div>
        <div className="flex flex-col gap-4">
          {scores.map((score, idx) => {
            const seriesLayout = getSeriesLayout(discipline);
            return (
            <div key={idx} className="bg-slate-950/30 border border-slate-800 rounded-2xl p-4 space-y-3 transition-all">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-slate-500 uppercase">Serie {idx + 1}</span>
                <div className="flex items-center gap-3">
                  <input type="number" min="0" max="25" value={score} onChange={(e) => handleScoreChange(idx, e.target.value)} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className={`w-20 bg-slate-800 border-2 ${isTraining ? 'border-blue-900/30' : 'border-slate-700'} rounded-xl px-2 py-2 text-center text-xl font-black text-white focus:border-orange-600 outline-none transition-all`} />
                  <button type="button" onClick={() => toggleDetailedView(idx)} className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all ${expandedSeries === idx ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`} title="Dettaglio Piattelli">
                    <i className="fas fa-list-ul"></i>
                  </button>
                </div>
              </div>
              
              {expandedSeries === idx && detailedScores[idx] && (
                <div className="pt-4 border-t border-slate-800/50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex flex-col gap-3">
                    {seriesLayout.layout.map((targetCount, pedanaIdx) => {
                      const startIndex = seriesLayout.layout.slice(0, pedanaIdx).reduce((a, b) => a + b, 0);
                      return (
                      <div key={pedanaIdx} className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-500 w-12 uppercase tracking-widest">{seriesLayout.label} {pedanaIdx + 1}</span>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: targetCount }).map((_, targetOffset) => {
                            const targetIdx = startIndex + targetOffset;
                            const isHit = detailedScores[idx][targetIdx];
                            return (
                              <button
                                key={targetIdx}
                                type="button"
                                onClick={() => handleDetailedScoreChange(idx, targetIdx)}
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 transition-all active:scale-90 ${isHit ? 'bg-[#a3e635] border-[#65a30d] shadow-[0_0_10px_rgba(163,230,53,0.2)]' : 'bg-[#ef4444] border-[#b91c1c] shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}
                                title={`Piattello ${targetIdx + 1}: ${isHit ? 'Colpito' : 'Mancato'}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )})}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-slate-800/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Foto Lavagna</span>
                      {seriesImages[idx] && (
                        <button type="button" onClick={() => removeImage(idx)} className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1">
                          <i className="fas fa-trash-alt"></i> Rimuovi
                        </button>
                      )}
                    </div>
                    
                    {seriesImages[idx] ? (
                      <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 aspect-video">
                        <img src={seriesImages[idx]} alt={`Lavagna Serie ${idx + 1}`} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:bg-slate-800/50 hover:border-orange-500/50 transition-all group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <i className="fas fa-camera text-slate-500 group-hover:text-orange-500 text-xl mb-2 transition-colors"></i>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-400">Scatta o Carica Foto</p>
                        </div>
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(idx, e)} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          )})}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Note</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-600 outline-none h-24 resize-none" />
      </div>

      <div className="flex gap-4 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 bg-slate-800 text-white font-bold py-4 rounded-xl">Annulla</button>
        <button type="submit" className={`flex-[2] ${isTraining ? 'bg-blue-600' : 'bg-orange-600'} text-white font-black py-4 rounded-xl shadow-xl active:scale-95 transition-all`}>
          {initialData ? 'AGGIORNA' : 'SALVA'}
        </button>
      </div>
    </form>
  );
};

export default CompetitionForm;
