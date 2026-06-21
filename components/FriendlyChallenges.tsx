import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ShooterSearch from './ShooterSearch';
import SocietySearch from './SocietySearch';
import { useUI } from '../contexts/UIContext';

interface FriendlyChallengesProps {
  user: any;
  token: string;
  societies: any[];
}

interface ChallengingShooter {
  id?: number | string; // user id or random string
  name: string;
  category: string;
  qualification: string;
  scores: number[]; // e.g. [22] or empty
  hit_misses: number[][]; // target by target: 1 = hit, 0 = miss. Array of rounds, e.g. [ [1,0,1,1,...] ]
}

interface FriendlyChallenge {
  id: string;
  creator_id: number;
  name: string;
  discipline: string;
  location: string;
  group_by_category: boolean;
  shooters: ChallengingShooter[];
  status: 'ongoing' | 'completed';
  created_at: string;
}

const DISCIPLINES = [
  'Fossa Olimpica (FO)',
  'Compak Sporting (CK)',
  'Sporting (SP)',
  'Skeet (SK)',
  'Fossa Universale (FU)',
  'Elica (EL)',
  'Tiro Combinato (TC)'
];

const CATEGORIES = ['Eccellenza', 'Prima', 'Seconda', 'Terza', 'Skeet', 'Master', 'Veterani', 'Lady', 'Settore Giovanile', 'Nessuna / Tempo Libero'];

const getFriendlySeriesLayout = (disciplineStr: string) => {
  const norm = (disciplineStr || '').toUpperCase();
  if (norm.includes('(FO)') || norm.includes('FOSSA OLIMPICA')) {
    return { name: 'Pedana', groups: [5, 5, 5, 5, 5] };
  }
  if (norm.includes('(CK)') || norm.includes('COMPAK')) {
    return { name: 'Piazzola', groups: [5, 5, 5, 5, 5] };
  }
  if (norm.includes('(SP)') || norm.includes('SPORTING')) {
    return { name: 'Piazzola', groups: [9, 9, 7] };
  }
  if (norm.includes('(SK)') || norm.includes('SKEET')) {
    return { name: 'Stazione', groups: [3, 3, 3, 3, 3, 3, 3, 4] };
  }
  if (norm.includes('(FU)') || norm.includes('FOSSA UNIVERSALE')) {
    return { name: 'Pedana', groups: [5, 5, 5, 5, 5] };
  }
  if (norm.includes('(EL)') || norm.includes('ELICA')) {
    return { name: 'Serie', groups: [12, 13] }; // 25 targets partitioned as 12 and 13
  }
  if (norm.includes('(TC)') || norm.includes('TIRO COMBINATO')) {
    return { name: 'Pedana', groups: [5, 5, 5, 5] }; // TC can have 20 targets, but in our 25-matrix we can show [5,5,5,5,5] or similar
  }
  return { name: 'Pedana', groups: [5, 5, 5, 5, 5] };
};

const FriendlyChallenges: React.FC<FriendlyChallengesProps> = ({ user, token, societies }) => {
  const { triggerToast, triggerConfirm } = useUI();
  const [challenges, setChallenges] = useState<FriendlyChallenge[]>([]);
  const [shootersList, setShootersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewState, setViewState] = useState<'list' | 'create' | 'shoot' | 'results'>('list');
  const [resultsRoundFilter, setResultsRoundFilter] = useState<number | 'global'>('global');

  // Active state
  const [selectedChallenge, setSelectedChallenge] = useState<FriendlyChallenge | null>(null);
  
  // Create state
  const [challengeName, setChallengeName] = useState('');
  const [discipline, setDiscipline] = useState('Fossa Olimpica (FO)');
  const [location, setLocation] = useState('');
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [selectedShooters, setSelectedShooters] = useState<ChallengingShooter[]>([]);
  
  // Custom manual manual shooter entry state
  const [searchShootersValue, setSearchShootersValue] = useState<any[]>([]);
  const [manualShooterName, setManualShooterName] = useState('');
  const [manualShooterCategory, setManualShooterCategory] = useState('Nessuna / Tempo Libero');

  // Real-time shooting state
  const [activeShooterIdx, setActiveShooterIdx] = useState(0);
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);
  const [activeTargetIdx, setActiveTargetIdx] = useState(0);
  const [manualInputVal, setManualInputVal] = useState<string | null>(null);

  // Load challenges and registered shooters
  const loadChallenges = async () => {
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch('/api/friendly-challenges', { headers });
      if (res.ok) {
        const data = await res.json();
        // Parse shooters standard JSON
        const parsed = data.map((c: any) => ({
          ...c,
          shooters: typeof c.shooters === 'string' ? JSON.parse(c.shooters) : c.shooters
        }));
        setChallenges(parsed);
      }
    } catch (err) {
      console.error('Error loading challenges:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadShootersList = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch('/api/shooters-list', { headers });
      if (res.ok) {
        const data = await res.json();
        setShootersList(data);
      }
    } catch (err) {
      console.error('Error loading shooters list:', err);
    }
  };

  useEffect(() => {
    loadChallenges();
    loadShootersList();
  }, [token]);

  // Sync creator as default selected shooter on mount
  useEffect(() => {
    if (user && selectedShooters.length === 0) {
      setSelectedShooters([
        {
          id: user.id,
          name: `${user.surname} ${user.name}`,
          category: user.category || user.qualification || 'Nessuna / Tempo Libero',
          qualification: user.qualification || '',
          scores: [0],
          hit_misses: [Array(25).fill(0)]
        }
      ]);
    }
  }, [user]);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeName.trim()) {
      triggerToast('Inserisci un nome per la sfida', 'info');
      return;
    }
    if (selectedShooters.length === 0) {
      triggerToast('Aggiungi almeno un tiratore', 'info');
      return;
    }

    const payload = {
      name: challengeName,
      discipline,
      location: location || 'Campo Privato',
      group_by_category: groupByCategory,
      shooters: selectedShooters.map(s => ({
        ...s,
        scores: [0],
        hit_misses: [Array(25).fill(-1)] // -1 is un-shot, 1 is hit, 0 is miss
      })),
      status: 'ongoing'
    };

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      const res = await fetch('/api/friendly-challenges', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        const newChallengeObj: FriendlyChallenge = {
          ...payload,
          id: result.id,
          creator_id: user.id,
          shooters: payload.shooters as any,
          status: 'ongoing',
          created_at: new Date().toISOString()
        };
        setSelectedChallenge(newChallengeObj);
        setActiveShooterIdx(0);
        setActiveTargetIdx(0);
        setViewState('shoot');
        triggerToast('Sfida creata con successo! Inizia a sparare 🎯', 'success');
        
        // Reset creating form state
        setChallengeName('');
        setLocation('');
        setGroupByCategory(false);
        setSearchShootersValue([]);
        // Keep only creator
        setSelectedShooters([
          {
            id: user.id,
            name: `${user.surname} ${user.name}`,
            category: user.category || user.qualification || 'Nessuna / Tempo Libero',
            qualification: user.qualification || '',
            scores: [0],
            hit_misses: [Array(25).fill(0)]
          }
        ]);
        loadChallenges();
      } else {
        triggerToast('Errore durante la creazione della sfida', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Errore nel network', 'error');
    }
  };

  const handleUpdateChallengeOnServer = async (updatedChallenge: FriendlyChallenge) => {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      await fetch(`/api/friendly-challenges/${updatedChallenge.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: updatedChallenge.name,
          discipline: updatedChallenge.discipline,
          location: updatedChallenge.location,
          group_by_category: updatedChallenge.group_by_category,
          shooters: updatedChallenge.shooters,
          status: updatedChallenge.status
        })
      });
    } catch (err) {
      console.error('Error auto-syncing challenge results:', err);
    }
  };

  const handleDeleteChallenge = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerConfirm(
      'Elimina Sfida',
      'Sei sicuro di voler eliminare questa sfida? Tutti i risultati andranno persi.',
      async () => {
        try {
          const headers = { 'Authorization': `Bearer ${token}` };
          const res = await fetch(`/api/friendly-challenges/${id}`, {
            method: 'DELETE',
            headers
          });
          if (res.ok) {
            triggerToast('Sfida eliminata con successo', 'success');
            loadChallenges();
          } else {
            triggerToast('Errore nell\'eliminazione della sfida', 'error');
          }
        } catch (err) {
          console.error(err);
          triggerToast('Errore di connessione', 'error');
        }
      }
    );
  };

  // Add registered shooter from selection
  const handleShooterSelectChange = (val: any) => {
    setSearchShootersValue(val);
    if (!Array.isArray(val)) return;

    // Convert values into ChallengingShooter format
    const newShooters = val.map(v => {
      // Find shooter in list
      const sObj = shootersList.find(s => s.id === v || `${s.surname} ${s.name}` === v);
      if (sObj) {
        return {
          id: sObj.id,
          name: `${sObj.surname} ${sObj.name}`,
          category: sObj.category || 'Nessuna / Tempo Libero',
          qualification: sObj.qualification || '',
          scores: [0],
          hit_misses: [Array(25).fill(0)]
        };
      }
      return null;
    }).filter(Boolean) as ChallengingShooter[];

    // Ensure we always have creator
    const hasCreator = newShooters.some(s => s.id === user.id);
    const creatorObj: ChallengingShooter = {
      id: user.id,
      name: `${user.surname} ${user.name}`,
      category: user.category || user.qualification || 'Nessuna / Tempo Libero',
      qualification: user.qualification || '',
      scores: [0],
      hit_misses: [Array(25).fill(0)]
    };

    setSelectedShooters(hasCreator ? newShooters : [creatorObj, ...newShooters]);
  };

  // Add custom manual shooter
  const handleAddManualShooter = () => {
    if (!manualShooterName.trim()) {
      triggerToast('Inserisci un nome valido', 'info');
      return;
    }
    const exists = selectedShooters.some(s => s.name.toLowerCase() === manualShooterName.trim().toLowerCase());
    if (exists) {
      triggerToast('Tiratore già aggiunto alla sfida', 'info');
      return;
    }

    const newShooter: ChallengingShooter = {
      id: 'manual_' + Math.random().toString(36).substr(2, 5),
      name: manualShooterName.trim(),
      category: manualShooterCategory,
      qualification: '',
      scores: [0],
      hit_misses: [Array(25).fill(0)]
    };

    setSelectedShooters([...selectedShooters, newShooter]);
    setManualShooterName('');
    triggerToast(`${manualShooterName} aggiunto!`, 'success');
  };

  const handleRemoveShooter = (index: number) => {
    if (selectedShooters[index].id === user.id) {
      triggerToast('Non puoi rimuovere te stesso dall\'elenco', 'info');
      return;
    }
    const filtered = selectedShooters.filter((_, i) => i !== index);
    setSelectedShooters(filtered);
  };

  // Add a new series (round) to the active challenge
  const handleAddNewRound = () => {
    if (!selectedChallenge) return;
    const challengeCopy = { ...selectedChallenge };
    
    challengeCopy.shooters.forEach(s => {
      if (!s.scores) s.scores = [];
      if (!s.hit_misses) s.hit_misses = [];
      
      s.scores.push(0);
      s.hit_misses.push(Array(25).fill(-1));
    });

    const newRoundIdx = challengeCopy.shooters[0].hit_misses.length - 1;
    setSelectedChallenge(challengeCopy);
    setActiveRoundIdx(newRoundIdx);
    setActiveShooterIdx(0);
    setActiveTargetIdx(0);
    
    handleUpdateChallengeOnServer(challengeCopy);
    triggerToast(`Nuova serie (${newRoundIdx + 1}) aggiunta! In bocca al lupo 🎯`, 'success');
  };

  // Handle a target shot hit/miss
  const handleTargetShot = (isHit: boolean) => {
    if (!selectedChallenge) return;

    const challengeCopy = { ...selectedChallenge };
    const shooter = challengeCopy.shooters[activeShooterIdx];
    
    // Ensure properly initialized round and target indices
    if (!shooter.hit_misses[activeRoundIdx]) {
      shooter.hit_misses[activeRoundIdx] = Array(25).fill(-1);
    }

    // Set score
    shooter.hit_misses[activeRoundIdx][activeTargetIdx] = isHit ? 1 : 0;
    
    // Recalculate total targets hit
    const hits = shooter.hit_misses[activeRoundIdx].filter(x => x === 1).length;
    shooter.scores[activeRoundIdx] = hits;

    setSelectedChallenge(challengeCopy);

    // Auto Advance logic
    if (activeTargetIdx < 24) {
      setActiveTargetIdx(activeTargetIdx + 1);
    } else {
      triggerToast(`Serie conclusa ! ${shooter.name} ha totalizzato ${hits} piattelli colpiti.`, 'success');
      // Loop back or cycle through shooters
      const totalShooters = challengeCopy.shooters.length;
      const nextIdx = (activeShooterIdx + 1) % totalShooters;
      setActiveShooterIdx(nextIdx);
      
      const nextShooter = challengeCopy.shooters[nextIdx];
      const unshotIdx = nextShooter.hit_misses[activeRoundIdx]?.findIndex(x => x === -1);
      const firstUnshot = unshotIdx !== undefined && unshotIdx !== -1 ? unshotIdx : 0;
      setActiveTargetIdx(firstUnshot);
    }

    // Auto Sync on Server Background
    handleUpdateChallengeOnServer(challengeCopy);
  };

  // Toggle target at specific slot manually
  const handleToggleTargetSlot = (shooterIdx: number, targetIdx: number) => {
    if (!selectedChallenge) return;

    const challengeCopy = { ...selectedChallenge };
    const shooter = challengeCopy.shooters[shooterIdx];
    
    if (!shooter.hit_misses[activeRoundIdx]) {
      shooter.hit_misses[activeRoundIdx] = Array(25).fill(-1);
    }

    const currentVal = shooter.hit_misses[activeRoundIdx][targetIdx];
    let newVal = -1;
    if (currentVal === -1) newVal = 1; // Unshot -> Hit
    else if (currentVal === 1) newVal = 0; // Hit -> Miss
    else newVal = -1; // Miss -> Unshot

    shooter.hit_misses[activeRoundIdx][targetIdx] = newVal;
    
    // Recalculate hits
    const hits = shooter.hit_misses[activeRoundIdx].filter(x => x === 1).length;
    shooter.scores[activeRoundIdx] = hits;

    setSelectedChallenge(challengeCopy);
    handleUpdateChallengeOnServer(challengeCopy);
  };

  // Handle manual input of score for the active round
  const handleManualScoreInput = (shooterIdx: number, val: number) => {
    if (!selectedChallenge) return;

    const challengeCopy = { ...selectedChallenge };
    const shooter = challengeCopy.shooters[shooterIdx];
    
    if (!shooter.hit_misses[activeRoundIdx]) {
      shooter.hit_misses[activeRoundIdx] = Array(25).fill(-1);
    }

    const clampedVal = Math.max(0, Math.min(25, val));
    const missesCount = 25 - clampedVal;

    // Fill the array: misses (0s) at the beginning, followed by hits (1s)
    const newRow = Array(25);
    for (let i = 0; i < 25; i++) {
      if (i < missesCount) {
        newRow[i] = 0;
      } else {
        newRow[i] = 1;
      }
    }

    shooter.hit_misses[activeRoundIdx] = newRow;
    shooter.scores[activeRoundIdx] = clampedVal;

    setSelectedChallenge(challengeCopy);
    handleUpdateChallengeOnServer(challengeCopy);
  };

  // End dynamic friendly match
  const handleFinishChallenge = () => {
    if (!selectedChallenge) return;
    
    triggerConfirm(
      'Concludi Sfida',
      'Hai terminato di inserire i risultati e vuoi stilare la classifica finale?',
      async () => {
        const challengeCopy = { ...selectedChallenge };
        challengeCopy.status = 'completed';
        
        try {
          const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          };
          const res = await fetch(`/api/friendly-challenges/${challengeCopy.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              status: 'completed',
              shooters: challengeCopy.shooters
            })
          });

          if (res.ok) {
            setSelectedChallenge(challengeCopy);
            setViewState('results');
            setResultsRoundFilter('global'); // default to global standings
            triggerToast('Sfida conclusa con successo! Classifica staccata 🏆', 'success');
            loadChallenges();
          } else {
            triggerToast('Errore nel salvare la fine della sfida', 'error');
          }
        } catch (err) {
          console.error(err);
          triggerToast('Errore di rete', 'error');
        }
      }
    );
  };

  // Sort and group standings with support for dynamic filtering
  const getSortedStandings = (roundIdx?: number | 'global') => {
    if (!selectedChallenge) return [];
    
    const filter = roundIdx ?? resultsRoundFilter;
    
    const list = selectedChallenge.shooters.map(s => {
      if (filter === 'global') {
        let totalHits = 0;
        let totalShot = 0;
        s.hit_misses.forEach(round => {
          totalHits += round.filter(x => x === 1).length;
          totalShot += round.filter(x => x !== -1).length;
        });
        return {
          ...s,
          totalHits,
          totalShot
        };
      } else {
        const rIdx = Number(filter);
        const hitCount = s.hit_misses[rIdx]?.filter(x => x === 1).length || 0;
        const totalShot = s.hit_misses[rIdx]?.filter(x => x !== -1).length || 0;
        return {
          ...s,
          totalHits: hitCount,
          totalShot: totalShot
        };
      }
    });

    // Sort descending by hits, then by name
    return list.sort((a, b) => {
      if (b.totalHits !== a.totalHits) return b.totalHits - a.totalHits;
      return a.name.localeCompare(b.name);
    });
  };

  const groupedStandings = (roundIdx?: number | 'global') => {
    const sorted = getSortedStandings(roundIdx);
    if (!selectedChallenge?.group_by_category) {
      return { 'Classifica Generale': sorted };
    }
    
    // Group by category
    const groups: Record<string, typeof sorted> = {};
    sorted.forEach(s => {
      const cat = s.category || 'Nessuna / Tempo Libero';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  };

  const visibleChallenges = challenges.filter(c => {
    if (user?.role === 'admin') return true;
    if (c.creator_id === user?.id) return true;
    return c.shooters?.some(s => {
      if (s.id === user?.id) return true;
      const sName = s.name.toLowerCase().trim();
      const uFullName1 = `${user?.surname || ''} ${user?.name || ''}`.toLowerCase().trim();
      const uFullName2 = `${user?.name || ''} ${user?.surname || ''}`.toLowerCase().trim();
      return sName === uFullName1 || sName === uFullName2;
    });
  });

  return (
    <div className="space-y-4">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <i className="fas fa-user-friends text-orange-500"></i>
            Sfide tra Amici
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tieni traccia in tempo reale delle sfide con i tuoi amici.
          </p>
        </div>
        {viewState === 'list' && (
          <button
            onClick={() => setViewState('create')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-black uppercase text-[10px] tracking-wider rounded-xl shadow-lg shadow-orange-950/20 hover:opacity-90 active:scale-95 transition"
          >
            <i className="fas fa-plus"></i>
            Crea Sfida
          </button>
        )}
        {viewState !== 'list' && (
          <button
            onClick={() => {
              if (viewState === 'shoot') {
                triggerConfirm(
                  'Abbandona Pedana',
                  'Vuoi tornare alle sfide? I risultati parziali sono salvati nel server.',
                  () => {
                    setViewState('list');
                  }
                );
              } else {
                setViewState('list');
              }
            }}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 font-bold text-xs rounded-xl transition"
          >
            <i className="fas fa-arrow-left"></i>
            Torna all'elenco
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* VIEW 1: CHALLENGES LIST */}
        {viewState === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-950 border border-slate-900 rounded-3xl space-y-3">
                <i className="fas fa-circle-notch fa-spin text-orange-500 text-2xl"></i>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Caricamento sfide...</p>
              </div>
            ) : visibleChallenges.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-950 border border-slate-900 rounded-3xl text-center space-y-4">
                <div className="w-14 h-14 bg-slate-900 border border-slate-800 flex items-center justify-center rounded-2xl text-slate-400">
                  <i className="fas fa-bullseye text-2xl text-slate-600"></i>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-300">Nessuna sfida registrata</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Crea la tua prima sfida tra amici per iniziare a registrare i piattelli in tempo reale.
                  </p>
                </div>
                <button
                  onClick={() => setViewState('create')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-orange-500 text-[10px] uppercase font-black tracking-wider rounded-xl transition"
                >
                  Nuova sfida in batteria
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleChallenges.map((c) => {
                  const isOngoing = c.status === 'ongoing';
                  const totalShooters = c.shooters?.length || 0;
                  const isCreator = c.creator_id === user.id;

                  // Find highest overall scoreboard hits (Totale generale)
                  const topShooter = c.shooters ? [...c.shooters].sort((x, y) => {
                    const hitsX = x.hit_misses?.reduce((sum, round) => sum + (round?.filter(j => j === 1).length || 0), 0) || 0;
                    const hitsY = y.hit_misses?.reduce((sum, round) => sum + (round?.filter(j => j === 1).length || 0), 0) || 0;
                    return hitsY - hitsX;
                  })[0] : null;

                  const topShooterHits = topShooter ? topShooter.hit_misses?.reduce((sum, round) => sum + (round?.filter(j => j === 1).length || 0), 0) || 0 : 0;

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedChallenge(c);
                        setActiveShooterIdx(0);
                        setActiveTargetIdx(0);
                        setViewState(isOngoing ? 'shoot' : 'results');
                      }}
                      className="p-5 bg-slate-950 border border-slate-900/80 hover:border-slate-800 rounded-2xl cursor-pointer hover:shadow-xl transition-all relative flex flex-col justify-between space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white hover:text-orange-500 transition line-clamp-1">{c.name}</span>
                            {isOngoing ? (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full border border-orange-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                                In corso
                              </span>
                            ) : (
                              <span className="inline-block text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                Conclusa 🏆
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>{c.discipline}</span>
                            <span className="text-slate-700">•</span>
                            <span>{c.location}</span>
                          </p>
                        </div>
                        {isCreator && (
                          <button
                            onClick={(e) => handleDeleteChallenge(c.id, e)}
                            className="p-2 text-slate-600 hover:text-red-500 transition rounded-lg hover:bg-red-500/10"
                            title="Elimina sfida"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        )}
                      </div>

                      <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-900/80 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Membri batteria</p>
                          <p className="font-extrabold text-slate-300">{totalShooters} Tiratori</p>
                        </div>
                        {topShooter && (
                          <div className="text-right space-y-0.5">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                              {isOngoing ? 'Miglior Punteggio' : 'Vincitore'}
                            </p>
                            <p className="font-extrabold text-orange-500">
                              {topShooter.name} ({topShooterHits} hits)
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <span>{new Date(c.created_at).toLocaleDateString('it-IT')}</span>
                        <div className="flex items-center gap-1.5 text-orange-500 font-extrabold">
                          <span>{isOngoing ? 'Entra in pedana' : 'Vedi Classifica'}</span>
                          <i className="fas fa-arrow-right text-[8px]"></i>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW 2: CREATE CHALLENGE */}
        {viewState === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-slate-950 border border-slate-900 rounded-3xl p-6 shadow-2xl relative"
          >
            <div className="border-b border-slate-900 pb-4 mb-5">
              <h4 className="text-sm font-black text-white uppercase tracking-wider">Nuova Batteria Sfida</h4>
              <p className="text-xs text-slate-500">Compila i dati e aggiungi i tiratori presenti in pedana.</p>
            </div>

            <form onSubmit={handleCreateChallenge} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome Sfida */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nome Sfida *</label>
                  <input
                    type="text"
                    required
                    value={challengeName}
                    onChange={(e) => setChallengeName(e.target.value)}
                    placeholder="Es: Sfida del Sabato, Trofeo del Prosciuttino, ..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-600 outline-none transition-all"
                  />
                </div>

                {/* Disciplina */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Disciplina</label>
                  <select
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-600 outline-none transition-all"
                  >
                    {DISCIPLINES.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Campo/TAV */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Campo da Tiro (TAV)</label>
                  <SocietySearch
                    value={location}
                    onChange={(val) => setLocation(val)}
                    societies={societies || []}
                    placeholder="Cerca o inserisci una Società TAV..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-orange-600 outline-none transition-all"
                  />
                </div>

                {/* Raggruppa per Categoria */}
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-900 mt-2">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-black text-slate-300">Raggruppa per Categoria</p>
                    <p className="text-[10px] text-slate-500">Organizza i podi e la finale in base alla categoria.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupByCategory}
                      onChange={(e) => setGroupByCategory(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>
              </div>

              {/* SEZIONE TIRATORI */}
              <div className="border-t border-slate-900 pt-5 space-y-4">
                <div>
                  <h5 className="text-xs font-black text-white uppercase tracking-wider">Tiratori in Batteria</h5>
                  <p className="text-[10px] text-slate-500">Inserisci i tesserati dell'app o aggiungi nomi a mano libera.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ricerca Tesserati Registrati */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cerca Tesserati Registrati</label>
                    <ShooterSearch
                      value={searchShootersValue}
                      onChange={handleShooterSelectChange}
                      shooters={shootersList}
                      multiple={true}
                      placeholder="Cerca amici registrati..."
                    />
                  </div>

                  {/* manual shooter manual addition */}
                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900/80 space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Aggiungi Terzo a Mano Libera</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={manualShooterName}
                        onChange={(e) => setManualShooterName(e.target.value)}
                        placeholder="Cognome Nome..."
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-orange-500"
                      />
                      <select
                        value={manualShooterCategory}
                        onChange={(e) => setManualShooterCategory(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-orange-500"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddManualShooter}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 text-orange-500 text-[9px] uppercase font-black tracking-widest border border-slate-800 hover:border-orange-500/20 rounded-lg transition"
                    >
                      <i className="fas fa-plus mr-1"></i> Aggiungi Tiratore Esterno
                    </button>
                  </div>
                </div>

                {/* Lista tiratori aggiunti */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500/80">Lista di Partenza: ({selectedShooters.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedShooters.map((s, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-xl border ${s.id === user.id ? 'bg-orange-650/10 border-orange-650/30' : 'bg-slate-900 border-slate-850'} text-xs font-bold text-slate-300`}
                      >
                        <div className="space-y-0.5">
                          <p className="text-white font-extrabold">{idx + 1}. {s.name}</p>
                          <p className="text-[9px] text-slate-500 uppercase font-black">{s.category}</p>
                        </div>
                        {s.id !== user.id && (
                          <button
                            type="button"
                            onClick={() => handleRemoveShooter(idx)}
                            className="p-1 px-2 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-lg transition"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottoni submit */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setViewState('list')}
                  className="px-4 py-2 text-slate-500 hover:text-white font-bold text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-[10px] uppercase font-black tracking-widest rounded-xl transition shadow-lg shadow-orange-950/20"
                >
                  Inizia Sfida ! 🚀
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* VIEW 3: LIVE SHOOTING SCORES */}
        {viewState === 'shoot' && selectedChallenge && (
          <motion.div
            key="shoot"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-5"
          >
            {/* Header sfida attiva */}
            <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                  Gara Attiva in Pedana
                </p>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">{selectedChallenge.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedChallenge.discipline} • {selectedChallenge.location}
                </p>
              </div>
              <button
                onClick={handleFinishChallenge}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition shadow-lg shadow-emerald-950/20"
              >
                <i className="fas fa-check mr-1.5"></i> Termina &amp; Classifica
              </button>
            </div>

            {/* Series selector tabs */}
            <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mr-2">Seleziona Serie:</span>
                {selectedChallenge.shooters[0]?.hit_misses.map((_, rIdx) => (
                  <button
                    key={rIdx}
                    onClick={() => {
                      setActiveRoundIdx(rIdx);
                      setActiveTargetIdx(0);
                    }}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition border ${activeRoundIdx === rIdx ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    Serie {rIdx + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={handleAddNewRound}
                className="w-full sm:w-auto px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-dashed border-slate-800 text-orange-500 font-black text-[10px] uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <i className="fas fa-plus"></i> Inserisci Nuova Serie
              </button>
            </div>

            {/* SELECTION OF ACTIVE SHOOTER IN THE SQUAD BATTERY */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* BATTERY ROSTER */}
              <div className="lg:col-span-1 bg-slate-950 border border-slate-900 rounded-3xl p-4 space-y-3">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-900 pb-2">Lista tiratori in pedana</h5>
                <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                  {selectedChallenge.shooters.map((s, idx) => {
                    const isActive = idx === activeShooterIdx;
                    const hits = s.hit_misses[activeRoundIdx]?.filter(x => x === 1).length || 0;
                    const totalShot = s.hit_misses[activeRoundIdx]?.filter(x => x !== -1).length || 0;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setActiveShooterIdx(idx);
                          // Select the first un-shot target slot
                          const unshot = s.hit_misses[activeRoundIdx]?.findIndex(x => x === -1);
                          setActiveTargetIdx(unshot !== -1 ? unshot : 0);
                        }}
                        className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all ${isActive ? 'bg-orange-600/10 border-orange-500 text-white font-black shadow-lg shadow-orange-950/10' : 'bg-slate-900/50 border-slate-900 hover:border-slate-800 text-slate-400 font-bold'}`}
                      >
                        <div className="space-y-0.5">
                          <p className={`text-xs ${isActive ? 'text-white font-black' : 'text-slate-300'}`}>
                            {idx + 1}. {s.name}
                          </p>
                          <p className="text-[9px] text-slate-500 uppercase font-black">{s.category}</p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="text-sm font-black text-orange-500">{hits} <span className="text-[10px] text-slate-500 font-bold">/ 25</span></p>
                          <p className="text-[8px] text-slate-500 uppercase font-bold">{totalShot} spari</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CURRENT ACTIVE SHOOTER CONTROLLER PANEL */}
              <div className="lg:col-span-2 bg-slate-950 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between space-y-6">
                
                {/* Active Info */}
                <div className="flex justify-between items-start border-b border-slate-900 pb-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Tiratore Attivo</span>
                    <h5 className="text-base font-black text-white uppercase">{selectedChallenge.shooters[activeShooterIdx].name}</h5>
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-0.5">
                      Categoria: <span className="text-orange-500">{selectedChallenge.shooters[activeShooterIdx].category}</span>
                    </p>
                  </div>
                  <div className="text-center bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-[9px] font-black text-slate-500 uppercase block mb-0.5">Punteggio</span>
                    {(() => {
                      const currentScore = selectedChallenge.shooters[activeShooterIdx].hit_misses[activeRoundIdx]?.filter(x => x === 1).length || 0;
                      return (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={manualInputVal !== null ? manualInputVal : currentScore}
                          onFocus={() => {
                            if (currentScore === 0) {
                              setManualInputVal('');
                            } else {
                              setManualInputVal(currentScore.toString());
                            }
                          }}
                          onChange={(e) => {
                            const valStr = e.target.value.replace(/[^0-9]/g, '');
                            setManualInputVal(valStr);
                            
                            if (valStr !== '') {
                              const valNum = parseInt(valStr, 10);
                              if (valNum >= 0 && valNum <= 25) {
                                handleManualScoreInput(activeShooterIdx, valNum);
                              }
                            } else {
                              handleManualScoreInput(activeShooterIdx, 0);
                            }
                          }}
                          onBlur={() => {
                            setManualInputVal(null);
                          }}
                          onClick={(e) => {
                            (e.target as HTMLInputElement).select();
                          }}
                          className="w-16 text-center bg-slate-950 border border-slate-800 rounded-lg text-lg font-black text-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* VISUAL ROUND MATRIX OF 25 TARGETS */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tabellone Piattelli Serie ({activeRoundIdx + 1}° Serie)</p>
                    <p className="text-[10px] font-extrabold text-slate-400 italic">Clicca per cambiare manualmente</p>
                  </div>
                  
                  {/* Partitioned grid by disciplines layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(() => {
                      const layoutInfo = getFriendlySeriesLayout(selectedChallenge.discipline);
                      let currentOffset = 0;
                      const targetGroupsList = layoutInfo.groups.map((size, groupIdx) => {
                        const groupTargets = Array.from({ length: size }).map((_, localIdx) => {
                          const globalIdx = currentOffset + localIdx;
                          return globalIdx;
                        }).filter(gIdx => gIdx < 25);
                        currentOffset += size;
                        return {
                          label: `${layoutInfo.name} ${groupIdx + 1}`,
                          targets: groupTargets
                        };
                      });

                      return targetGroupsList.map((group, groupIdx) => (
                        <div key={groupIdx} className="bg-slate-900/40 p-3 rounded-2xl border border-slate-900/80 space-y-2">
                          <p className="text-[9px] font-black uppercase text-orange-500 tracking-widest">
                            {group.label}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.targets.map((idx) => {
                              const state = selectedChallenge.shooters[activeShooterIdx].hit_misses[activeRoundIdx]?.[idx] ?? -1;
                              const isTargetActive = idx === activeTargetIdx;

                              let bgClass = 'bg-slate-900/60 border-slate-800 text-slate-500';
                              if (state === 1) bgClass = 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-950/25';
                              if (state === 0) bgClass = 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-950/25';

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setActiveTargetIdx(idx);
                                    handleToggleTargetSlot(activeShooterIdx, idx);
                                  }}
                                  className={`w-9 h-9 border rounded-xl flex flex-col items-center justify-center text-[10px] font-black transition relative ${bgClass} ${isTargetActive ? 'ring-2 ring-orange-500 scale-105' : ''}`}
                                >
                                  <span>{idx + 1}</span>
                                  <span className="text-[6px] tracking-tight hover:opacity-100 opacity-90 block">
                                    {state === 1 ? 'COLP' : state === 0 ? 'ZERO' : '-'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* ENTRY CONTROL BUTTONS */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Registra Piattello Instantaneo (Tempo Reale)</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* HIT BUTTON */}
                    <button
                      onClick={() => handleTargetShot(true)}
                      className="py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black uppercase tracking-wider rounded-2xl transition shadow-lg shadow-emerald-950/20 flex flex-col items-center justify-center space-y-1"
                    >
                      <i className="fas fa-check-circle text-lg"></i>
                      <span>Colpito (Verde)</span>
                    </button>

                    {/* MISS BUTTON */}
                    <button
                      onClick={() => handleTargetShot(false)}
                      className="py-4 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black uppercase tracking-wider rounded-2xl transition shadow-lg shadow-red-950/20 flex flex-col items-center justify-center space-y-1"
                    >
                      <i className="fas fa-times-circle text-lg"></i>
                      <span>Zero (Rosso)</span>
                    </button>
                  </div>
                </div>

                {/* CYCLING BTNS */}
                <div className="flex items-center justify-between border-t border-slate-900 pt-4 text-xs font-bold">
                  <button
                    onClick={() => {
                      const totalShooters = selectedChallenge.shooters.length;
                      const nextIdx = (activeShooterIdx - 1 + totalShooters) % totalShooters;
                      setActiveShooterIdx(nextIdx);
                      
                      const targetShooter = selectedChallenge.shooters[nextIdx];
                      const unshotIdx = targetShooter.hit_misses[activeRoundIdx]?.findIndex(x => x === -1);
                      const firstUnshot = unshotIdx !== undefined && unshotIdx !== -1 ? unshotIdx : 0;
                      setActiveTargetIdx(firstUnshot);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white rounded-xl transition text-slate-300"
                  >
                    <i className="fas fa-chevron-left text-[10px]"></i>
                    Precedente Tiratore
                  </button>

                  <button
                    onClick={() => {
                      const totalShooters = selectedChallenge.shooters.length;
                      const nextIdx = (activeShooterIdx + 1) % totalShooters;
                      setActiveShooterIdx(nextIdx);
                      
                      const targetShooter = selectedChallenge.shooters[nextIdx];
                      const unshotIdx = targetShooter.hit_misses[activeRoundIdx]?.findIndex(x => x === -1);
                      const firstUnshot = unshotIdx !== undefined && unshotIdx !== -1 ? unshotIdx : 0;
                      setActiveTargetIdx(firstUnshot);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white rounded-xl transition text-slate-300"
                  >
                    Prossimo Tiratore
                    <i className="fas fa-chevron-right text-[10px]"></i>
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* VIEW 4: LES RESULTS / STANDING PODIUM */}
        {viewState === 'results' && selectedChallenge && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* Header / Info bar */}
            <div className="bg-slate-950 border border-slate-900 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-emerald-500 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  Partita Conclusa 🏆
                </span>
                <h4 className="text-base font-black text-white uppercase tracking-wider">{selectedChallenge.name}</h4>
                <p className="text-xs text-slate-500 flex items-center gap-3">
                  <span>{selectedChallenge.discipline}</span>
                  <span>•</span>
                  <span>{selectedChallenge.location}</span>
                  <span>•</span>
                  <span>{new Date(selectedChallenge.created_at).toLocaleDateString('it-IT')}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  triggerConfirm(
                    'Riapri Sfida',
                    'Sei sicuro di voler riaprire questa sfida per correggere dei punteggi?',
                    () => {
                      const copy = { ...selectedChallenge, status: 'ongoing' as const };
                      setSelectedChallenge(copy);
                      setViewState('shoot');
                      handleUpdateChallengeOnServer(copy);
                    }
                  );
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-orange-500 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition"
              >
                Riapri Sfida 🔄
              </button>
            </div>

            {/* CLASSCLASSIFICA */}
            <div className="bg-slate-950 border border-slate-900 rounded-3xl p-6 space-y-6">
              
              {/* Filter round results selection */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/30 p-4 rounded-2xl border border-slate-900">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Visualizza Classifica:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setResultsRoundFilter('global')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition border ${resultsRoundFilter === 'global' ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-white'}`}
                  >
                    Totale Generale
                  </button>
                  {selectedChallenge.shooters[0]?.hit_misses.map((_, rIdx) => (
                    <button
                      key={rIdx}
                      onClick={() => setResultsRoundFilter(rIdx)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition border ${resultsRoundFilter === rIdx ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-white'}`}
                    >
                      Serie {rIdx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Podium graphic for generic classification */}
              {!selectedChallenge.group_by_category && (
                <div className="flex flex-row justify-center items-end gap-1.5 sm:gap-4 py-8 border-b border-slate-900">
                  
                  {/* 2nd Place */}
                  {getSortedStandings()[1] && (
                    <div className="flex flex-col items-center order-1 scale-85 sm:scale-95 origin-bottom">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-slate-400 bg-slate-900 flex items-center justify-center text-slate-300 font-extrabold text-sm sm:text-lg shadow-xl shadow-slate-950/50">
                        🥈
                      </div>
                      <p className="mt-2 text-[10px] sm:text-xs font-black text-white text-center truncate max-w-[80px] sm:max-w-[120px]">{getSortedStandings()[1].name}</p>
                      <p className="text-[9px] sm:text-[10px] font-extrabold text-orange-500">{getSortedStandings()[1].totalHits} hits</p>
                      <div className="w-20 sm:w-24 h-20 sm:h-28 bg-gradient-to-t from-slate-900 to-slate-800/60 mt-2 rounded-t-xl border border-slate-700 flex items-center justify-center">
                        <span className="text-slate-200 font-black text-[10px] sm:text-sm">2° Posto</span>
                      </div>
                    </div>
                  )}

                  {/* 1st Place */}
                  {getSortedStandings()[0] && (
                    <div className="flex flex-col items-center order-2 origin-bottom">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-amber-500 bg-slate-900 flex items-center justify-center text-amber-500 font-extrabold text-xl sm:text-2xl shadow-2xl shadow-orange-950/25 animate-bounce">
                        👑
                      </div>
                      <p className="mt-2 text-xs sm:text-sm font-black text-white text-center truncate max-w-[100px] sm:max-w-[140px]">{getSortedStandings()[0].name}</p>
                      <p className="text-[10px] sm:text-xs font-black text-orange-500">{getSortedStandings()[0].totalHits} hits</p>
                      <div className="w-24 sm:w-28 h-28 sm:h-36 bg-gradient-to-t from-slate-900 to-amber-950/30 border border-amber-500/40 mt-2 rounded-t-xl flex items-center justify-center relative">
                        <span className="text-amber-400 font-black text-[11px] sm:text-sm">Vincitore 🏆</span>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {getSortedStandings()[2] && (
                    <div className="flex flex-col items-center order-3 scale-75 sm:scale-90 origin-bottom">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-amber-700 bg-slate-905 flex items-center justify-center text-amber-600 font-extrabold text-xs sm:text-sm shadow-xl shadow-slate-950/40">
                        🥉
                      </div>
                      <p className="mt-2 text-[10px] sm:text-xs font-black text-white text-center truncate max-w-[70px] sm:max-w-[110px]">{getSortedStandings()[2].name}</p>
                      <p className="text-[9px] sm:text-[10px] font-extrabold text-orange-500">{getSortedStandings()[2].totalHits} hits</p>
                      <div className="w-20 sm:w-24 h-14 sm:h-20 bg-gradient-to-t from-slate-900 to-amber-900/30 mt-2 rounded-t-xl border border-amber-700/30 flex items-center justify-center">
                        <span className="text-amber-500 font-black text-[9px] sm:text-xs">3° Posto</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DETAILED GROUP TABLE LISTINGS */}
              <div className="space-y-6">
                {Object.entries(groupedStandings()).map(([groupName, list]) => (
                  <div key={groupName} className="space-y-3">
                    <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
                      <h5 className="text-xs font-black text-white uppercase tracking-wider">{groupName}</h5>
                      <span className="text-[10px] font-extrabold text-slate-500">({list.length} Tiratori)</span>
                    </div>

                    <div className="bg-slate-900/50 rounded-2xl border border-slate-900/80 overflow-hidden">
                      <div className="grid grid-cols-12 bg-slate-950/50 p-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-850">
                        <div className="col-span-1 text-center">Pos</div>
                        <div className="col-span-4">Tiratore</div>
                        <div className="col-span-2">Categoria</div>
                        <div className="col-span-3 text-center">Punteggio</div>
                        <div className="col-span-2 text-right">Percentuale</div>
                      </div>

                      <div className="divide-y divide-slate-850">
                        {list.map((s, idx) => {
                          const percentage = s.totalShot > 0 ? ((s.totalHits / s.totalShot) * 100).toFixed(0) : '0';
                          return (
                            <div key={idx} className="grid grid-cols-12 items-center p-3 text-xs font-bold text-slate-300">
                              <div className="col-span-1 text-center">
                                {idx === 0 ? (
                                  <span className="text-base">🥇</span>
                                ) : idx === 1 ? (
                                  <span className="text-base">🥈</span>
                                ) : idx === 2 ? (
                                  <span className="text-base">🥉</span>
                                ) : (
                                  `${idx + 1}°`
                                )}
                              </div>
                              <div className="col-span-4">
                                <p className="text-white font-extrabold">{s.name}</p>
                              </div>
                              <div className="col-span-2">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-800/40 px-2 py-0.5 rounded border border-slate-800">
                                  {s.category}
                                </span>
                              </div>
                              <div className="col-span-3 text-center">
                                <span className="text-sm font-black text-orange-500">{s.totalHits}</span>
                                <span className="text-slate-500"> / {s.totalShot} in totale</span>
                              </div>
                              <div className="col-span-2 text-right font-black text-slate-400">
                                {percentage}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FriendlyChallenges;
