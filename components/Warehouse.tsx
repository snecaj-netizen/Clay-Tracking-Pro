import React, { useState, useMemo, useRef } from 'react';
import { Cartridge, CartridgeType } from '../types';

interface WarehouseProps {
  user: any;
  cartridges: Cartridge[];
  cartridgeTypes: CartridgeType[];
  onSave: (cart: Cartridge) => void;
  onDelete: (id: string) => void;
  onUpdateAll: (carts: Cartridge[]) => void;
  onSaveType: (type: CartridgeType) => void;
  onDeleteType: (id: string) => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
}

const Warehouse: React.FC<WarehouseProps> = ({ 
  user,
  cartridges, 
  cartridgeTypes,
  onSave, 
  onDelete, 
  onUpdateAll, 
  onSaveType,
  onDeleteType,
  triggerConfirm 
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCart, setEditingCart] = useState<Cartridge | null>(null);
  const [editingType, setEditingType] = useState<CartridgeType | null>(null);
  const [activeTab, setActiveTab] = useState<'types' | 'inventory' | 'history'>('types');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typeFileInputRef = useRef<HTMLInputElement>(null);

  // Cartridge Stock Form states
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [quantity, setQuantity] = useState(250); // Current stock
  const [initialQuantity, setInitialQuantity] = useState(250); // Purchased amount
  const [cost, setCost] = useState(0);
  const [armory, setArmory] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Cartridge Type Form states
  const [typeProducer, setTypeProducer] = useState('');
  const [typeModel, setTypeModel] = useState('');
  const [typeLeadNumber, setTypeLeadNumber] = useState('7.5');
  const [typeGrams, setTypeGrams] = useState<number>(28);
  const [typeImageUrl, setTypeImageUrl] = useState('');

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

  const groupedStock = useMemo(() => {
    const groups: Record<string, { 
      producer: string, 
      model: string, 
      leadNumber: string, 
      grams?: number,
      total: number,
      imageUrl?: string,
      cartridgeIds: string[]
    }> = {};

    cartridges.forEach(c => {
      const key = `${c.producer.toLowerCase().trim()}-${c.model.toLowerCase().trim()}-${c.leadNumber}-${c.grams || 0}`;
      if (!groups[key]) {
        groups[key] = {
          producer: c.producer,
          model: c.model,
          leadNumber: c.leadNumber,
          grams: c.grams,
          total: 0,
          imageUrl: c.imageUrl,
          cartridgeIds: []
        };
      }
      groups[key].total += c.quantity;
      groups[key].cartridgeIds.push(c.id);
      if (!groups[key].imageUrl && c.imageUrl) groups[key].imageUrl = c.imageUrl;
    });

    return Object.values(groups).sort((a, b) => a.producer.localeCompare(b.producer));
  }, [cartridges]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isType: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isType) {
          setTypeImageUrl(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const searchOnGoogle = (p: string, m: string) => {
    if (!p && !m) return;
    const query = encodeURIComponent(`${p} ${m} cartridge`);
    window.open(`https://www.google.com/search?q=${query}&tbm=isch`, '_blank');
  };

  const handleStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const type = cartridgeTypes.find(t => t.id === selectedTypeId);
    if (!type) return;

    const newCart: Cartridge = {
      id: editingCart?.id || crypto.randomUUID(),
      producer: type.producer,
      model: type.model,
      leadNumber: type.leadNumber,
      grams: type.grams,
      quantity,
      initialQuantity,
      cost,
      armory: armory.trim(),
      purchaseDate,
      imageUrl: type.imageUrl
    };
    onSave(newCart);
    resetForm();
  };

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newType: CartridgeType = {
      id: editingType?.id || crypto.randomUUID(),
      producer: typeProducer.trim(),
      model: typeModel.trim(),
      leadNumber: typeLeadNumber,
      grams: typeGrams,
      imageUrl: typeImageUrl
    };
    onSaveType(newType);
    resetTypeForm();
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
    setSelectedTypeId('');
    setQuantity(250);
    setInitialQuantity(250);
    setCost(0);
    setArmory('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setShowForm(false);
    setEditingCart(null);
  };

  const resetTypeForm = () => {
    setTypeProducer('');
    setTypeModel('');
    setTypeLeadNumber('7.5');
    setTypeGrams(28);
    setTypeImageUrl('');
    setShowForm(false);
    setEditingType(null);
  };

  const startEdit = (c: Cartridge) => {
    const type = cartridgeTypes.find(t => 
      t.producer.toLowerCase() === c.producer.toLowerCase() && 
      t.model.toLowerCase() === c.model.toLowerCase() && 
      t.leadNumber === c.leadNumber
    );
    setEditingCart(c);
    setSelectedTypeId(type?.id || '');
    setQuantity(c.quantity);
    setInitialQuantity(c.initialQuantity || c.quantity);
    setCost(c.cost);
    setArmory(c.armory || '');
    setPurchaseDate(c.purchaseDate);
    setShowForm(true);
    setActiveTab('history');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditType = (t: CartridgeType) => {
    setEditingType(t);
    setTypeProducer(t.producer);
    setTypeModel(t.model);
    setTypeLeadNumber(t.leadNumber);
    setTypeGrams(t.grams || 28);
    setTypeImageUrl(t.imageUrl || '');
    setShowForm(true);
    setActiveTab('types');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

        <div className="flex bg-slate-900 p-1 rounded-xl gap-1 border border-slate-800 overflow-x-auto no-scrollbar">
          <button onClick={() => { setActiveTab('types'); setShowForm(false); }} className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'types' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}>
            TIPI CARTUCCE
          </button>
          <button onClick={() => { setActiveTab('inventory'); setShowForm(false); }} className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'inventory' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}>
            GIACENZA ATTUALE
          </button>
          <button onClick={() => { setActiveTab('history'); setShowForm(false); }} className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-orange-500'}`}>
            STORICO CARICHI
          </button>
        </div>
      </div>

      <div className="pt-2">
        {showForm && activeTab === 'types' && (
          <form onSubmit={handleTypeSubmit} className="bg-slate-900 border-2 border-orange-600/30 p-6 rounded-3xl space-y-4 mb-6 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">
              {editingType ? 'Modifica Tipo Cartuccia' : 'Nuovo Tipo Cartuccia'}
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-full sm:w-1/3 space-y-2 text-center">
                 <label className="text-[10px] font-bold text-slate-500 uppercase block text-left">Immagine Scatola</label>
                 <div 
                    onClick={() => typeFileInputRef.current?.click()}
                    className="aspect-square bg-slate-800 rounded-2xl border-2 border-dashed border-slate-700 hover:border-orange-500 transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden relative group"
                 >
                    {typeImageUrl ? (
                      <>
                        <img src={typeImageUrl} alt="Cartridge" className="w-full h-full object-cover" />
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
                 <input type="file" ref={typeFileInputRef} onChange={(e) => handleImageUpload(e, true)} accept="image/*" className="hidden" />
                 <button 
                    type="button" 
                    onClick={() => searchOnGoogle(typeProducer, typeModel)}
                    className="text-[9px] font-black text-blue-500 uppercase hover:text-blue-400"
                 >
                    <i className="fab fa-google mr-1"></i> Cerca Immagine
                 </button>
              </div>

              <div className="flex-1 grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Produttore</label>
                  <input type="text" required value={typeProducer} onChange={e => setTypeProducer(e.target.value)} placeholder="Es: Baschieri" className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Modello</label>
                  <input type="text" required value={typeModel} onChange={e => setTypeModel(e.target.value)} placeholder="Es: F2 Mach" className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Piombo</label>
                    <input type="text" required value={typeLeadNumber} onChange={e => setTypeLeadNumber(e.target.value)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Grammi</label>
                    <input type="number" required value={typeGrams} onChange={e => setTypeGrams(parseInt(e.target.value) || 0)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={resetTypeForm} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl">Annulla</button>
              <button type="submit" className="flex-2 bg-orange-600 text-white font-black py-3 px-8 rounded-xl shadow-lg active:scale-95 transition-all uppercase">
                {editingType ? 'Aggiorna' : 'Salva'}
              </button>
            </div>
          </form>
        )}

        {showForm && activeTab === 'history' && (
          <form onSubmit={handleStockSubmit} className="bg-slate-900 border-2 border-orange-600/30 p-6 rounded-3xl space-y-4 mb-6 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">
              {editingCart ? 'Modifica Carico' : 'Registra Nuovo Acquisto'}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Seleziona Tipo Cartuccia</label>
                <select 
                  required 
                  value={selectedTypeId} 
                  onChange={e => setSelectedTypeId(e.target.value)}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm appearance-none"
                >
                  <option value="">Scegli un tipo...</option>
                  {cartridgeTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.producer} {t.model} (P. {t.leadNumber})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Pezzi Acquistati</label>
                  <input type="number" required value={initialQuantity} onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    setInitialQuantity(val);
                    if (!editingCart) setQuantity(val);
                  }} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Costo (€)</label>
                  <input type="number" step="0.01" required value={cost} onChange={e => setCost(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
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

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Armeria</label>
                <input type="text" value={armory} onChange={e => setArmory(e.target.value)} list="armory-list" className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
                <datalist id="armory-list">{knownArmories.map(a => <option key={a} value={a} />)}</datalist>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Data Acquisto</label>
                <input type="date" required value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-2 text-white text-sm" />
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

        {activeTab === 'types' && (
          <div className="grid grid-cols-1 gap-4">
            {cartridgeTypes.length === 0 ? (
              <div className="text-center py-20 text-slate-600 border-2 border-dashed border-slate-700 rounded-3xl">
                <i className="fas fa-tags text-4xl mb-3 opacity-20"></i>
                <p className="text-sm font-medium">Nessun tipo di cartuccia configurato.</p>
              </div>
            ) : (
              cartridgeTypes.map(type => (
                <div key={type.id} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                       {type.imageUrl ? <img src={type.imageUrl} alt={type.model} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className="fas fa-box text-slate-700 text-xs"></i></div>}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm leading-tight uppercase">{type.producer}</h4>
                      <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">{type.model} • Piombo {type.leadNumber} • {type.grams}g</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(user?.role === 'admin' || type.createdBy === user?.id) && (
                      <button onClick={() => startEditType(type)} className="w-8 h-8 rounded-lg bg-orange-600/10 text-orange-500 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all"><i className="fas fa-edit text-[10px]"></i></button>
                    )}
                    {user?.role === 'admin' && (
                      <button onClick={() => triggerConfirm('Elimina Tipo', 'Sei sicuro di voler eliminare questo tipo di cartuccia?', () => onDeleteType(type.id), 'Elimina', 'danger')} className="w-8 h-8 rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"><i className="fas fa-trash text-[10px]"></i></button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 gap-4">
            {groupedStock.length === 0 ? (
              <div className="text-center py-20 text-slate-600 border-2 border-dashed border-slate-700 rounded-3xl">
                <i className="fas fa-box-open text-4xl mb-3 opacity-20"></i>
                <p className="text-sm font-medium">Magazzino vuoto.</p>
              </div>
            ) : (
              groupedStock.map(type => (
                <div key={`${type.producer}-${type.model}-${type.leadNumber}-${type.grams || 0}`} className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden group hover:border-orange-500/30 transition-all flex flex-col sm:flex-row sm:h-40">
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
                        <p className="text-orange-500 font-bold text-xs uppercase tracking-wider truncate">{type.model} • {type.grams}g</p>
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
        )}

        {activeTab === 'history' && (
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
                    <h4 className="font-bold text-white text-xs leading-tight">{c.producer} <span className="text-orange-500">{c.model}</span> {c.grams && <span className="text-slate-500">• {c.grams}g</span>}</h4>
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
                    <button onClick={() => triggerConfirm('Elimina Cartucce', 'Sei sicuro di voler eliminare questo lotto di cartucce?', () => onDelete(c.id), 'Elimina', 'danger')} className="w-8 h-8 rounded-lg bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"><i className="fas fa-trash text-[10px]"></i></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button for Warehouse - Only on Types and History tabs */}
      {(activeTab === 'types' || activeTab === 'history') && (
        <button 
          onClick={() => {
            if (!showForm) window.scrollTo({ top: 0, behavior: 'smooth' });
            setShowForm(!showForm);
          }}
          className={`fixed bottom-8 right-8 w-16 h-16 ${showForm ? 'bg-orange-500 shadow-orange-500/40' : 'bg-orange-600 shadow-orange-600/40'} rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-all active:scale-95 z-40 floating-add-btn group`}
          title={showForm ? 'Chiudi' : activeTab === 'types' ? 'Nuovo Tipo' : 'Nuovo Carico'}
        >
          <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'} text-2xl group-hover:rotate-90 transition-transform duration-300`}></i>
        </button>
      )}
    </div>
  );
};

export default Warehouse;
