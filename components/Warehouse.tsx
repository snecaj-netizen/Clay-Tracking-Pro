
import React, { useState, useMemo, useRef } from 'react';
import { Cartridge } from '../types';

interface WarehouseProps {
  cartridges: Cartridge[];
  onSave: (cart: Cartridge) => void;
  onDelete: (id: string) => void;
  onUpdateAll: (carts: Cartridge[]) => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const Warehouse: React.FC<WarehouseProps> = ({ cartridges, onSave, onDelete, onUpdateAll, triggerConfirm }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCart, setEditingCart] = useState<Cartridge | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [producer, setProducer] = useState('');
  const [model, setModel] = useState('');
  const [leadNumber, setLeadNumber] = useState('7.5');
  const [quantity, setQuantity] = useState(250); // Current stock
  const [initialQuantity, setInitialQuantity] = useState(250); // Purchased amount
  const [cost, setCost] = useState(0);
  const [armory, setArmory] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [imageUrl, setImageUrl] = useState('');

  const stats = useMemo(() => {
    const filteredForStats = filterYear === 'ALL' 
      ? cartridges 
      : cartridges.filter(c => new Date(c.purchaseDate).getFullYear().toString() === filterYear);

    const totalQuantity = filteredForStats.reduce((acc, c) => acc + c.quantity, 0);
    const totalCost = filteredForStats.reduce((acc, c) => acc + c.cost, 0);
    const totalPurchased = filteredForStats.reduce((acc, c) => acc + (c.initialQuantity || c.quantity), 0);
    return { totalQuantity, totalCost, totalPurchased };
  }, [cartridges, filterYear]);

  const availableYears = useMemo(() => {
    const years = cartridges.map(c => new Date(c.purchaseDate).getFullYear().toString());
    return Array.from(new Set(years)).sort((a: string, b: string) => b.localeCompare(a));
  }, [cartridges]);

  const knownArmories = useMemo(() => {
    return Array.from(new Set(cartridges.map(c => c.armory).filter(Boolean))).sort();
  }, [cartridges]);

  const knownProducers = useMemo(() => {
    return Array.from(new Set(cartridges.map(c => c.producer).filter(Boolean))).sort();
  }, [cartridges]);

  const knownModels = useMemo(() => {
    return Array.from(new Set(cartridges.map(c => c.model).filter(Boolean))).sort();
  }, [cartridges]);

  const groupedStock = useMemo(() => {
    const groups: Record<string, { 
      producer: string, 
      model: string, 
      leadNumber: string, 
      total: number,
      imageUrl?: string,
      cartridgeIds: string[]
    }> = {};

    cartridges.forEach(c => {
      const key = `${c.producer.toLowerCase().trim()}-${c.model.toLowerCase().trim()}-${c.leadNumber}`;
      if (!groups[key]) {
        groups[key] = {
          producer: c.producer,
          model: c.model,
          leadNumber: c.leadNumber,
          total: 0,
          imageUrl: c.imageUrl,
          cartridgeIds: []
        };
      }
      groups[key].total += c.quantity;
      groups[key].cartridgeIds.push(c.id);
      // Aggiorna l'immagine se il gruppo non ne ha una ma questo record sì
      if (!groups[key].imageUrl && c.imageUrl) groups[key].imageUrl = c.imageUrl;
    });

    return Object.values(groups).sort((a, b) => a.producer.localeCompare(b.producer));
  }, [cartridges]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const searchOnGoogle = () => {
    if (!producer && !model) return;
    const query = encodeURIComponent(`${producer} ${model} cartridge`);
    window.open(`https://www.google.com/search?q=${query}&tbm=isch`, '_blank');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newCart: Cartridge = {
      id: editingCart?.id || crypto.randomUUID(),
      producer: producer.trim(),
      model: model.trim(),
      leadNumber,
      quantity,
      initialQuantity,
      cost,
      armory: armory.trim(),
      purchaseDate,
      imageUrl
    };
    onSave(newCart);
    resetForm();
  };

  const handleQuickAdjust = (typeGroup: any, amount: number) => {
    let remainingAmount = amount;
    const newCartridges = [...cartridges];

    if (amount > 0) {
      const lastId = typeGroup.cartridgeIds[typeGroup.cartridgeIds.length - 1];
      const idx = newCartridges.findIndex(c => c.id === lastId);
      if (idx !== -1) {
        newCartridges[idx] = { ...newCartridges[idx], quantity: newCartridges[idx].quantity + amount };
      }
    } else {
      const idsToUpdate = [...typeGroup.cartridgeIds].reverse();
      for (const id of idsToUpdate) {
        if (remainingAmount === 0) break;
        const idx = newCartridges.findIndex(c => c.id === id);
        if (idx !== -1) {
          const currentQty = newCartridges[idx].quantity;
          const subtract = Math.min(currentQty, Math.abs(remainingAmount));
          newCartridges[idx] = { ...newCartridges[idx], quantity: currentQty - subtract };
          remainingAmount += subtract;
        }
      }
    }
    onUpdateAll(newCartridges);
  };

  const handleSetExact = (typeGroup: any) => {
    const newVal = prompt(`Imposta giacenza totale per ${typeGroup.producer} ${typeGroup.model} (Piombo ${typeGroup.leadNumber}):`, typeGroup.total.toString());
    if (newVal !== null) {
      const parsed = parseInt(newVal);
      if (!isNaN(parsed)) {
        const diff = parsed - typeGroup.total;
        handleQuickAdjust(typeGroup, diff);
      }
    }
  };

  const resetForm = () => {
    setProducer('');
    setModel('');
    setLeadNumber('7.5');
    setQuantity(250);
    setInitialQuantity(250);
    setCost(0);
    setArmory('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setImageUrl('');
    setShowForm(false);
    setEditingCart(null);
  };

  const startEdit = (c: Cartridge) => {
    setEditingCart(c);
    setProducer(c.producer);
    setModel(c.model);
    setLeadNumber(c.leadNumber);
    setQuantity(c.quantity);
    setInitialQuantity(c.initialQuantity || c.quantity);
    setCost(c.cost);
    setArmory(c.armory || '');
    setPurchaseDate(c.purchaseDate);
    setImageUrl(c.imageUrl || '');
    setShowForm(true);
    setActiveTab('history');
  };

  return (
    <div className="space-y-4">
      {/* Sticky Header Section for Warehouse */}
      <div className="sticky top-16 sm:top-[104px] z-40 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-4 space-y-4 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-warehouse text-orange-600"></i>
            Magazzino
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 border-l-4 border-l-orange-600">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Stock Totale</p>
            <p className="text-xl font-black text-white">{stats.totalQuantity} <span className="text-[10px] text-slate-500 uppercase">Pz</span></p>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 border-l-4 border-l-blue-600">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Scatole</p>
            <p className="text-xl font-black text-white">{(stats.totalQuantity / 25).toFixed(0)} <span className="text-[10px] text-slate-500 uppercase">Pec</span></p>
          </div>
        </div>

        <div className="flex bg-slate-900 p-1 rounded-xl gap-1 border border-slate-800">
          <button onClick={() => setActiveTab('inventory')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'inventory' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
            GIACENZA ATTUALE
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
            STORICO CARICHI
          </button>
        </div>
      </div>

      <div className="pt-2">
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-slate-900 border-2 border-orange-600/30 p-6 rounded-3xl space-y-4 mb-6 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                {editingCart ? 'Modifica Carico' : 'Registra Nuovo Acquisto'}
              </h3>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-full sm:w-1/3 space-y-2 text-center">
                 <label className="text-[10px] font-bold text-slate-500 uppercase block text-left">Immagine Scatola</label>
                 <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square bg-slate-800 rounded-2xl border-2 border-dashed border-slate-700 hover:border-orange-500 transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden relative group"
                 >
                    {imageUrl ? (
                      <>
                        <img src={imageUrl} alt="Cartridge" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <i className="fas fa-camera text-white text-xl"></i>
                        </div>
                      </>
                    ) : (
                      <div className="p-4">
                        <i className="fas fa-box-open text-slate-600 text-3xl mb-2"></i>
                        <p className="text-[10px] text-slate-500 font-bold">Carica Foto</p>
                      </div>
                    )}
                 </div>
                 <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                 <button 
                    type="button" 
                    onClick={searchOnGoogle}
                    className="text-[9px] font-black text-blue-500 uppercase hover:text-blue-400"
                 >
                    <i className="fab fa-google mr-1"></i> Cerca Immagine
                 </button>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Produttore</label>
                  <input type="text" required value={producer} onChange={e => setProducer(e.target.value)} placeholder="Es: Baschieri" list="producer-list" className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                  <datalist id="producer-list">{knownProducers.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Modello</label>
                  <input type="text" required value={model} onChange={e => setModel(e.target.value)} placeholder="Es: F2 Mach" list="model-list" className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                  <datalist id="model-list">{knownModels.map(m => <option key={m} value={m} />)}</datalist>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Piombo</label>
                    <input type="text" required value={leadNumber} onChange={e => setLeadNumber(e.target.value)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Pezzi Acquistati</label>
                    <input type="number" required value={initialQuantity} onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      setInitialQuantity(val);
                      if (!editingCart) setQuantity(val);
                    }} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                  </div>
                </div>
                {editingCart && (
                  <div className="sm:col-span-2 space-y-1 bg-orange-600/5 p-3 rounded-xl border border-orange-600/20">
                    <label className="text-[10px] font-bold text-orange-500 uppercase">Giacenza Attuale (Modifica solo se necessario)</label>
                    <div className="flex items-center gap-4">
                      <input type="number" required value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="flex-1 bg-slate-900 border-2 border-orange-600/30 rounded-xl px-4 py-2 text-white text-sm font-black" />
                      <div className="text-[10px] text-slate-500 font-bold uppercase">
                        Originariamente: {editingCart.initialQuantity} <br/>
                        Rimanenti: {quantity}
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Costo (€)</label>
                    <input type="number" step="0.01" required value={cost} onChange={e => setCost(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Armeria</label>
                    <input type="text" value={armory} onChange={e => setArmory(e.target.value)} list="armory-list" className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                    <datalist id="armory-list">{knownArmories.map(a => <option key={a} value={a} />)}</datalist>
                  </div>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Data Acquisto</label>
                  <input type="date" required value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={resetForm} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl">Annulla</button>
              <button type="submit" className="flex-2 bg-orange-600 text-white font-black py-3 px-8 rounded-xl shadow-lg active:scale-95 transition-all uppercase">
                {editingCart ? 'Aggiorna' : 'Conferma'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'inventory' ? (
          <div className="grid grid-cols-1 gap-4">
            {groupedStock.length === 0 ? (
              <div className="text-center py-20 text-slate-600 border-2 border-dashed border-slate-900 rounded-3xl">
                <i className="fas fa-box-open text-4xl mb-3 opacity-20"></i>
                <p className="text-sm font-medium">Magazzino vuoto.</p>
              </div>
            ) : (
              groupedStock.map(type => (
                <div key={`${type.producer}-${type.model}-${type.leadNumber}`} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden group hover:border-orange-500/30 transition-all flex flex-col sm:flex-row sm:h-40">
                  <div className="w-full sm:w-28 h-24 sm:h-full bg-slate-800 relative overflow-hidden flex-shrink-0">
                    {type.imageUrl ? (
                      <img src={type.imageUrl} alt={type.model} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="fas fa-box text-slate-700 text-3xl"></i>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-orange-600 text-white w-8 h-8 rounded-lg flex flex-col items-center justify-center font-black text-[10px] shadow-lg">
                      {type.leadNumber}
                    </div>
                  </div>
                  
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-white font-black text-base sm:text-lg leading-tight uppercase truncate">{type.producer}</h4>
                        <p className="text-orange-500 font-bold text-xs uppercase tracking-wider truncate">{type.model}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-xl sm:text-2xl font-black text-white block leading-none">{type.total}</span>
                          <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Pezzi</span>
                        </div>
                        <button 
                          onClick={() => handleSetExact(type)} 
                          className="bg-slate-800 hover:bg-orange-600 text-slate-400 hover:text-white w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all border border-slate-700 active:scale-95 shrink-0"
                          title="Modifica giacenza esatta"
                        >
                          <i className="fas fa-pencil-alt text-xs"></i>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 mt-4 sm:mt-2">
                      <button onClick={() => handleQuickAdjust(type, -250)} disabled={type.total < 250} className="bg-slate-950 hover:bg-red-900/20 text-red-500 py-2 rounded-lg text-[9px] font-black border border-slate-800 disabled:opacity-20">-250</button>
                      <button onClick={() => handleQuickAdjust(type, -25)} disabled={type.total < 25} className="bg-slate-950 hover:bg-red-900/20 text-red-500 py-2 rounded-lg text-[9px] font-black border border-slate-800 disabled:opacity-20">-25</button>
                      <button onClick={() => handleQuickAdjust(type, 25)} className="bg-slate-950 hover:bg-green-900/20 text-green-500 py-2 rounded-lg text-[9px] font-black border border-slate-800">+25</button>
                      <button onClick={() => handleQuickAdjust(type, 250)} className="bg-slate-950 hover:bg-green-900/20 text-green-500 py-2 rounded-lg text-[9px] font-black border border-slate-800">+250</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex-1 min-w-[120px]">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Filtra per Anno</label>
                <select 
                  value={filterYear} 
                  onChange={(e) => setFilterYear(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-600 transition-all appearance-none"
                >
                  <option value="ALL">TUTTI GLI ANNI</option>
                  {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 sm:p-4 rounded-2xl mb-4 flex items-center justify-between">
              <div className="flex gap-2 sm:gap-8 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] sm:text-[10px] text-emerald-500 font-black uppercase tracking-widest leading-tight mb-1">Investimento {filterYear === 'ALL' ? 'Totale' : filterYear}</p>
                  <p className="text-sm sm:text-2xl font-black text-white break-words">€{stats.totalCost.toFixed(2)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] sm:text-[10px] text-blue-500 font-black uppercase tracking-widest leading-tight mb-1">Cartucce {filterYear === 'ALL' ? 'Acquistate' : filterYear}</p>
                  <p className="text-sm sm:text-2xl font-black text-white break-words">{stats.totalPurchased} <span className="text-[10px] sm:text-xs text-slate-500">Pz</span></p>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0 ml-2">
                <i className="fas fa-euro-sign text-base sm:text-xl"></i>
              </div>
            </div>
            {[...cartridges]
              .filter(c => filterYear === 'ALL' || new Date(c.purchaseDate).getFullYear().toString() === filterYear)
              .sort((a,b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
              .map(c => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                     {c.imageUrl ? <img src={c.imageUrl} alt={c.model} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className="fas fa-box text-slate-700 text-xs"></i></div>}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs leading-tight">{c.producer} <span className="text-orange-500">{c.model}</span></h4>
                    <p className="text-[9px] text-slate-600 font-bold uppercase">{new Date(c.purchaseDate).toLocaleDateString()} {c.armory && `• ${c.armory}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs font-black text-white">{c.initialQuantity || c.quantity} <span className="text-[9px] text-slate-500">Pz</span></p>
                    <p className="text-[9px] text-blue-500 font-bold">€{c.cost.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(c)} className="w-8 h-8 rounded-lg bg-orange-600/10 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all"><i className="fas fa-edit text-[10px]"></i></button>
                    <button onClick={() => { console.log('Delete button clicked for cartridge:', c.id); triggerConfirm('Elimina Cartucce', 'Sei sicuro di voler eliminare questo lotto di cartucce?', () => onDelete(c.id)); }} className="w-8 h-8 rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"><i className="fas fa-trash text-[10px]"></i></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button for Warehouse */}
      <button 
        onClick={() => setShowForm(!showForm)}
        className={`fixed bottom-8 right-8 w-16 h-16 ${showForm ? 'bg-orange-500 shadow-orange-500/40' : 'bg-orange-600 shadow-orange-600/40'} rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-all active:scale-95 z-50 floating-add-btn group`}
        title={showForm ? 'Chiudi' : 'Nuovo Carico'}
      >
        <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'} text-2xl group-hover:rotate-90 transition-transform duration-300`}></i>
      </button>
    </div>
  );
};

export default Warehouse;
