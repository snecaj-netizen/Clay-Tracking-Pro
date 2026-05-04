import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import ExpandingFAB from './ExpandingFAB';
import { Cartridge, CartridgeType } from '../types';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';

interface WarehouseProps {
  user: any;
  cartridges: Cartridge[];
  cartridgeTypes: CartridgeType[];
  onSave: (cart: Cartridge) => void;
  onDelete: (id: string) => void;
  onUpdateAll: (carts: Cartridge[]) => void;
  onSaveType: (type: CartridgeType) => void;
  onDeleteType: (id: string) => void;
}

const Warehouse: React.FC<WarehouseProps> = ({ 
  user,
  cartridges, 
  cartridgeTypes,
  onSave, 
  onDelete, 
  onUpdateAll, 
  onSaveType,
  onDeleteType
}) => {
  const { t, language } = useLanguage();
  const { triggerConfirm } = useUI();
  const [showForm, setShowForm] = useState(false);
  const [editingCart, setEditingCart] = useState<Cartridge | null>(null);
  const [editingType, setEditingType] = useState<CartridgeType | null>(null);
  const [expandedProducers, setExpandedProducers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'types' | 'inventory' | 'history'>('types');
  const [direction, setDirection] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tabsRef.current) {
      const activeTabElement = tabsRef.current.querySelector(`[data-tab="${activeTab}"]`);
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTab]);

  const availableTabs: ('types' | 'inventory' | 'history')[] = ['types', 'inventory', 'history'];

  const handleTabChange = (newTab: 'types' | 'inventory' | 'history') => {
    const currentIndex = availableTabs.indexOf(activeTab);
    const nextIndex = availableTabs.indexOf(newTab);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
    setShowForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPrevTab = () => {
    const currentIndex = availableTabs.indexOf(activeTab);
    if (currentIndex > 0) {
      handleTabChange(availableTabs[currentIndex - 1]);
    }
  };

  const goToNextTab = () => {
    const currentIndex = availableTabs.indexOf(activeTab);
    if (currentIndex < availableTabs.length - 1) {
      handleTabChange(availableTabs[currentIndex + 1]);
    }
  };

  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [updatingGroupId, setUpdatingGroupId] = useState<string | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingGroup, setAdjustingGroup] = useState<any>(null);
  const [adjustValue, setAdjustValue] = useState<string>('');
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
      cartridgeIds: string[],
      typeId?: string
    }> = {};

    cartridges.forEach(c => {
      const key = c.typeId || `${c.producer.toLowerCase().trim()}-${c.model.toLowerCase().trim()}-${c.leadNumber}-${c.grams || 0}`;
      if (!groups[key]) {
        const typeInfo = c.typeId ? cartridgeTypes.find(t => t.id === c.typeId) : null;
        groups[key] = {
          producer: typeInfo?.producer || c.producer,
          model: typeInfo?.model || c.model,
          leadNumber: typeInfo?.leadNumber || c.leadNumber,
          grams: typeInfo?.grams !== undefined ? typeInfo.grams : c.grams,
          total: 0,
          imageUrl: typeInfo?.imageUrl || c.imageUrl,
          cartridgeIds: [],
          typeId: c.typeId
        };
      }
      groups[key].total += c.quantity;
      groups[key].cartridgeIds.push(c.id);
      if (!groups[key].imageUrl && c.imageUrl) groups[key].imageUrl = c.imageUrl;
    });

    return Object.values(groups).sort((a, b) => a.producer.localeCompare(b.producer));
  }, [cartridges, cartridgeTypes]);

  const typesByProducer = useMemo(() => {
    const groups: Record<string, CartridgeType[]> = {};
    cartridgeTypes.forEach(t => {
      const p = t.producer.toUpperCase().trim();
      if (!groups[p]) groups[p] = [];
      groups[p].push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [cartridgeTypes]);

  const inventoryByProducer = useMemo(() => {
    const groups: Record<string, typeof groupedStock> = {};
    groupedStock.forEach(item => {
      const p = item.producer.toUpperCase().trim();
      if (!groups[p]) groups[p] = [];
      groups[p].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [groupedStock]);

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
      imageUrl: type.imageUrl,
      typeId: type.id
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

  const handleQuickAdjust = async (typeGroup: any, amount: number) => {
    const groupId = typeGroup.typeId || `${typeGroup.producer.toLowerCase().trim()}-${typeGroup.model.toLowerCase().trim()}-${typeGroup.leadNumber}-${typeGroup.grams || 0}`;
    setUpdatingGroupId(groupId);
    
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
    
    try {
      await onUpdateAll(newCartridges);
    } finally {
      setUpdatingGroupId(null);
    }
  };

  const handleSetExact = (typeGroup: any) => {
    setAdjustingGroup(typeGroup);
    setAdjustValue(typeGroup.total.toString());
    setShowAdjustModal(true);
  };

  const confirmSetExact = () => {
    if (!adjustingGroup) return;
    const parsed = parseInt(adjustValue);
    if (!isNaN(parsed) && parsed >= 0) {
      const diff = parsed - adjustingGroup.total;
      if (diff !== 0) {
        handleQuickAdjust(adjustingGroup, diff);
      }
    }
    setShowAdjustModal(false);
    setAdjustingGroup(null);
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

  const toggleProducer = (producer: string) => {
    setExpandedProducers(prev => 
      prev.includes(producer) 
        ? prev.filter(p => p !== producer) 
        : [...prev, producer]
    );
  };

  const startEdit = (c: Cartridge) => {
    const type = c.typeId 
      ? cartridgeTypes.find(t => t.id === c.typeId)
      : cartridgeTypes.find(t => 
          t.producer.toLowerCase() === c.producer.toLowerCase() && 
          t.model.toLowerCase() === c.model.toLowerCase() && 
          t.leadNumber === c.leadNumber &&
          t.grams === c.grams
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
      <div className="sticky top-[var(--header-top)] z-40 bg-slate-950/95 backdrop-blur-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 sm:py-3 space-y-2 sm:space-y-3 border-b border-slate-900/50 shadow-2xl transition-all duration-300">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-warehouse text-orange-600"></i>
            {t('warehouse')}
          </h2>
          <div className="flex gap-2">
            <div className="bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 border-l-orange-600">
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{t('stock_label')}</p>
              <p className="text-xs font-black text-white">{stats.totalQuantity} <span className="text-[8px] text-slate-500 uppercase">{t('pieces_short')}</span></p>
            </div>
            <div className="bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 border-l-blue-600">
              <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{t('boxes_label')}</p>
              <p className="text-xs font-black text-white">{(stats.totalQuantity / 25).toFixed(0)} <span className="text-[8px] text-slate-500 uppercase">{t('boxes_short')}</span></p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center group/tabs">
          <div ref={tabsRef} className="flex-1 flex bg-slate-900 p-1 rounded-xl gap-1 border border-slate-800 overflow-x-auto no-scrollbar scroll-shadows">
            {availableTabs.map((tab) => (
              <button 
                key={tab}
                data-tab={tab}
                onClick={() => handleTabChange(tab)} 
                className={`flex-1 min-w-[100px] py-2 rounded-lg text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-widest ${activeTab === tab ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
              >
                {tab === 'types' ? t('cartridge_types_tab') : tab === 'inventory' ? t('current_stock_tab') : t('purchase_history_tab')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {showForm && activeTab === 'types' && createPortal(
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1200] flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                  <div className="p-6 sm:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                      <i className="fas fa-tags text-orange-500"></i>
                      {editingType ? t('edit_cartridge_type') : t('new_cartridge_type')}
                    </h3>
                    <button 
                      onClick={resetTypeForm}
                      className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>

                  <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
                    <form id="type-form" onSubmit={handleTypeSubmit} className="space-y-6">
                      <div className="flex flex-col sm:flex-row gap-8">
                        <div className="w-full sm:w-1/3 space-y-3 text-center">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-left ml-1">{t('box_image')}</label>
                          <div 
                              onClick={() => typeFileInputRef.current?.click()}
                              className="aspect-square bg-slate-950 rounded-2xl border-2 border-dashed border-slate-800 hover:border-orange-500 transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden relative group shadow-inner"
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
                                  <i className="fas fa-box-open text-slate-700 text-4xl mb-3"></i>
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('upload_photo')}</p>
                                </div>
                              )}
                          </div>
                          <input type="file" ref={typeFileInputRef} onChange={(e) => handleImageUpload(e, true)} accept="image/*" className="hidden" />
                          <button 
                              type="button" 
                              onClick={() => searchOnGoogle(typeProducer, typeModel)}
                              className="text-[10px] font-black text-blue-500 uppercase hover:text-blue-400 tracking-widest mt-2"
                          >
                              <i className="fab fa-google mr-1"></i> {t('search_image')}
                          </button>
                        </div>

                        <div className="flex-1 grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('producer')}</label>
                            <input type="text" required value={typeProducer} onChange={e => setTypeProducer(e.target.value)} placeholder={t('producer_placeholder')} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('model')}</label>
                            <input type="text" required value={typeModel} onChange={e => setTypeModel(e.target.value)} placeholder={t('model_placeholder')} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('lead_label')}</label>
                              <input type="text" required value={typeLeadNumber} onChange={e => setTypeLeadNumber(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('grams_label')}</label>
                              <input type="number" required value={typeGrams} onChange={e => setTypeGrams(parseInt(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>

                  <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm p-6 sm:p-8 border-t border-slate-800 flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={resetTypeForm} className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-slate-800 text-white hover:bg-slate-700">{t('cancel')}</button>
                    <button type="submit" form="type-form" className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20">
                      {editingType ? t('save') : t('create')}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {showForm && activeTab === 'history' && createPortal(
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1200] flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                  <div className="p-6 sm:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                      <i className="fas fa-truck-loading text-orange-500"></i>
                      {editingCart ? t('edit_stock') : t('register_new_purchase')}
                    </h3>
                    <button 
                      onClick={resetForm}
                      className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>

                  <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
                    <form id="stock-form" onSubmit={handleStockSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="sm:col-span-2 space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('select_cartridge_type')}</label>
                          <select 
                            required 
                            value={selectedTypeId} 
                            onChange={e => setSelectedTypeId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
                          >
                            <option value="">{t('choose_type_placeholder')}</option>
                            {cartridgeTypes.map(ct => (
                              <option key={ct.id} value={ct.id}>{ct.producer} {ct.model} ({t('lead_label_short')} {ct.leadNumber})</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('purchased_pieces')}</label>
                            <input type="number" required value={initialQuantity} onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              setInitialQuantity(val);
                              if (!editingCart) setQuantity(val);
                            }} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('cost_label')} (€)</label>
                            <input type="number" step="0.01" required value={cost} onChange={e => setCost(parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                          </div>
                        </div>

                        {editingCart && (
                          <div className="sm:col-span-2 space-y-2 bg-orange-600/5 p-4 rounded-2xl border border-orange-600/20">
                            <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-1">{t('current_stock_edit_label')}</label>
                            <div className="flex items-center gap-4">
                              <input type="number" required value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} onFocus={(e) => e.target.value === '0' && (e.target.value = '')} className="flex-1 bg-slate-950 border-2 border-orange-600/30 rounded-xl px-4 py-3 text-white text-sm font-black focus:border-orange-600 outline-none transition-all" />
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-tight">
                                {t('originally')}: {editingCart.initialQuantity} <br/>
                                {t('remaining')}: {quantity}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('armory_label')}</label>
                          <input type="text" value={armory} onChange={e => setArmory(e.target.value)} list="armory-list" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                          <datalist id="armory-list">{knownArmories.map(a => <option key={a} value={a} />)}</datalist>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('purchase_date_label')}</label>
                          <input type="date" required value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                        </div>
                      </div>
                    </form>
                  </div>

                  <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm p-6 sm:p-8 border-t border-slate-800 flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={resetForm} className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-slate-800 text-white hover:bg-slate-700">{t('cancel')}</button>
                    <button type="submit" form="stock-form" className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20">
                      {editingCart ? t('update') : t('confirm')}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {activeTab === 'types' && (
              <div className="space-y-6">
                {cartridgeTypes.length === 0 ? (
                  <div className="text-center py-20 text-slate-600 border-2 border-dashed border-slate-700 rounded-3xl">
                    <i className="fas fa-tags text-4xl mb-3 opacity-20"></i>
                    <p className="text-sm font-medium">{t('no_cartridge_types')}</p>
                  </div>
                ) : (
                  typesByProducer.map(([producer, types]) => {
                    const isExpanded = expandedProducers.includes(producer);
                    return (
                      <div key={producer} className="space-y-3">
                        <button 
                          onClick={() => toggleProducer(producer)}
                          className="w-full flex items-center justify-between px-2 group"
                        >
                          <h3 className="text-sm font-black text-white group-hover:text-orange-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                            <span className={`w-1 h-4 rounded-full transition-colors ${isExpanded ? 'bg-orange-600' : 'bg-slate-700 group-hover:bg-orange-600/50'}`}></span>
                            {producer}
                          </h3>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-500 group-hover:text-orange-500 uppercase bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 transition-colors">
                              {types.length} {t('types_label')}
                            </span>
                            <i className={`fas fa-chevron-down text-[8px] text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                          </div>
                        </button>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-1 gap-3 pb-2">
                                {types.map(type => (
                                  <div key={type.id} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center justify-between group hover:border-slate-700 transition-all">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                                        {type.imageUrl ? <img src={type.imageUrl} alt={type.model} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className="fas fa-box text-slate-700 text-xs"></i></div>}
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-white text-sm leading-tight uppercase">{type.producer}</h4>
                                        <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">{type.model} • {t('lead_label')} {type.leadNumber} • {type.grams}g</p>
                                        {user?.role === 'admin' && type.createdByName && (
                                          <p className="text-[9px] text-slate-500 font-medium mt-0.5 italic">
                                            {t('uploaded_by')}: {type.createdByName} {type.createdBySurname}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      {(user?.role === 'admin' || type.createdBy === user?.id) && (
                                        <button 
                                          onClick={() => startEditType(type)} 
                                          className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-500 hover:text-orange-500 hover:border-slate-700 transition-all"
                                          title={t('edit')}
                                        >
                                          <i className="fas fa-edit text-xs"></i>
                                        </button>
                                      )}
                                      {user?.role === 'admin' && (
                                        <button 
                                          onClick={() => triggerConfirm(t('delete_type_title'), t('confirm_delete_type_desc'), () => onDeleteType(type.id), t('delete'), 'danger')} 
                                          className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-500 hover:text-red-500 hover:border-slate-700 transition-all"
                                          title={t('delete')}
                                        >
                                          <i className="fas fa-trash text-xs"></i>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="space-y-8">
                {groupedStock.length === 0 ? (
                  <div className="text-center py-20 text-slate-600 border-2 border-dashed border-slate-700 rounded-3xl">
                    <i className="fas fa-box-open text-4xl mb-3 opacity-20"></i>
                    <p className="text-sm font-medium">{t('warehouse_empty')}</p>
                  </div>
                ) : (
                  inventoryByProducer.map(([producer, items]) => {
                    const isExpanded = expandedProducers.includes(producer);
                    return (
                      <div key={producer} className="space-y-4">
                        <button 
                          onClick={() => toggleProducer(producer)}
                          className="w-full flex items-center justify-between px-2 group"
                        >
                          <h3 className="text-sm font-black text-white group-hover:text-orange-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                            <span className={`w-1 h-4 rounded-full transition-colors ${isExpanded ? 'bg-orange-600' : 'bg-slate-700 group-hover:bg-orange-600/50'}`}></span>
                            {producer}
                          </h3>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-500 group-hover:text-orange-500 uppercase bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 transition-colors">
                              {items.reduce((acc, curr) => acc + curr.total, 0)} {t('pieces_short')}
                            </span>
                            <i className={`fas fa-chevron-down text-[8px] text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                          </div>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-1 gap-4 pb-2">
                                {items.map(type => (
                                  <div key={type.typeId || `${type.producer}-${type.model}-${type.leadNumber}-${type.grams || 0}`} className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden group hover:border-orange-500/30 transition-all flex flex-col sm:flex-row sm:h-40">
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
                                          <div className="text-right relative">
                                            {updatingGroupId === (type.typeId || `${type.producer.toLowerCase().trim()}-${type.model.toLowerCase().trim()}-${type.leadNumber}-${type.grams || 0}`) ? (
                                              <div className="flex flex-col items-end">
                                                <i className="fas fa-circle-notch fa-spin text-orange-500 text-xl mb-1"></i>
                                                <span className="text-[7px] text-orange-500 font-black uppercase tracking-tighter">{t('updating_short')}...</span>
                                              </div>
                                            ) : (
                                              <>
                                                <span className="text-xl sm:text-2xl font-black text-white block leading-none">{type.total}</span>
                                                <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">{t('pieces_short')}</span>
                                              </>
                                            )}
                                          </div>
                                          <button 
                                            onClick={() => handleSetExact(type)} 
                                            disabled={updatingGroupId !== null}
                                            className="bg-slate-800 hover:bg-orange-600 text-slate-400 hover:text-white w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all border border-slate-700 active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={t('edit_exact_stock_title')}
                                          >
                                            <i className="fas fa-pencil-alt text-xs"></i>
                                          </button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-4 gap-1.5 mt-4 sm:mt-2">
                                        <button 
                                          onClick={() => handleQuickAdjust(type, -250)} 
                                          disabled={type.total < 250 || updatingGroupId !== null} 
                                          className="bg-slate-950 hover:bg-red-900/20 text-red-500 py-2 rounded-lg text-[9px] font-black border border-slate-800 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                          {updatingGroupId === (type.typeId || `${type.producer.toLowerCase().trim()}-${type.model.toLowerCase().trim()}-${type.leadNumber}-${type.grams || 0}`) ? <i className="fas fa-circle-notch fa-spin"></i> : '-250'}
                                        </button>
                                        <button 
                                          onClick={() => handleQuickAdjust(type, -25)} 
                                          disabled={type.total < 25 || updatingGroupId !== null} 
                                          className="bg-slate-950 hover:bg-red-900/20 text-red-500 py-2 rounded-lg text-[9px] font-black border border-slate-800 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                          {updatingGroupId === (type.typeId || `${type.producer.toLowerCase().trim()}-${type.model.toLowerCase().trim()}-${type.leadNumber}-${type.grams || 0}`) ? <i className="fas fa-circle-notch fa-spin"></i> : '-25'}
                                        </button>
                                        <button 
                                          onClick={() => handleQuickAdjust(type, 25)} 
                                          disabled={updatingGroupId !== null} 
                                          className="bg-slate-950 hover:bg-green-900/20 text-green-500 py-2 rounded-lg text-[9px] font-black border border-slate-800 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                          {updatingGroupId === (type.typeId || `${type.producer.toLowerCase().trim()}-${type.model.toLowerCase().trim()}-${type.leadNumber}-${type.grams || 0}`) ? <i className="fas fa-circle-notch fa-spin"></i> : '+25'}
                                        </button>
                                        <button 
                                          onClick={() => handleQuickAdjust(type, 250)} 
                                          disabled={updatingGroupId !== null} 
                                          className="bg-slate-950 hover:bg-green-900/20 text-green-500 py-2 rounded-lg text-[9px] font-black border border-slate-800 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                          {updatingGroupId === (type.typeId || `${type.producer.toLowerCase().trim()}-${type.model.toLowerCase().trim()}-${type.leadNumber}-${type.grams || 0}`) ? <i className="fas fa-circle-notch fa-spin"></i> : '+250'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                        <i className="fas fa-calendar-alt text-orange-500"></i>
                        {t('year_label')}
                      </label>
                      <div className="relative group">
                        <select 
                          value={filterYear} 
                          onChange={(e) => setFilterYear(e.target.value)} 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-orange-500 transition-all appearance-none cursor-pointer"
                        >
                          <option value="ALL">{t('all_years')}</option>
                          {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                          <i className="fas fa-chevron-down text-[10px]"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 sm:p-4 rounded-2xl mb-4 flex items-center justify-between">
                  <div className="flex gap-2 sm:gap-8 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] sm:text-[10px] text-emerald-500 font-black uppercase tracking-widest leading-tight mb-1">{t('total_investment')} {filterYear === 'ALL' ? t('total') : filterYear}</p>
                      <p className="text-sm sm:text-2xl font-black text-white break-words">€{stats.totalCost.toFixed(2)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] sm:text-[10px] text-blue-500 font-black uppercase tracking-widest leading-tight mb-1">{t('cartridges_purchased')} {filterYear === 'ALL' ? t('total') : filterYear}</p>
                      <p className="text-sm sm:text-2xl font-black text-white break-words">{stats.totalPurchased} <span className="text-[10px] sm:text-xs text-slate-500">{t('pieces_short')}</span></p>
                    </div>
                  </div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0 ml-2">
                    <i className="fas fa-euro-sign text-base sm:text-xl"></i>
                  </div>
                </div>
                {[...cartridges]
                  .filter(c => filterYear === 'ALL' || new Date(c.purchaseDate).getFullYear().toString() === filterYear)
                  .sort((a,b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
                  .map(c => {
                    const typeInfo = c.typeId ? cartridgeTypes.find(t => t.id === c.typeId) : null;
                    const displayProducer = typeInfo?.producer || c.producer;
                    const displayModel = typeInfo?.model || c.model;
                    const displayGrams = typeInfo?.grams !== undefined ? typeInfo.grams : c.grams;
                    const displayImageUrl = typeInfo?.imageUrl || c.imageUrl;

                    return (
                      <div key={c.id} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                            {displayImageUrl ? <img src={displayImageUrl} alt={displayModel} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className="fas fa-box text-slate-700 text-xs"></i></div>}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-xs leading-tight">{displayProducer} <span className="text-orange-500">{displayModel}</span> {displayGrams && <span className="text-slate-500">• {displayGrams}g</span>}</h4>
                            <p className="text-[9px] text-slate-600 font-bold uppercase">{new Date(c.purchaseDate).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US')} {c.armory && `• ${c.armory}`}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-xs font-black text-white">{c.initialQuantity || c.quantity} <span className="text-[9px] text-slate-500">{t('pieces_short')}</span></p>
                            <p className="text-[9px] text-blue-500 font-bold">€{c.cost.toFixed(2)}</p>
                          </div>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => startEdit(c)} 
                                className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-500 hover:text-orange-500 hover:border-slate-700 transition-all"
                                title={t('edit')}
                              >
                                <i className="fas fa-edit text-xs"></i>
                              </button>
                              <button 
                                onClick={() => triggerConfirm(t('delete_stock_title'), t('confirm_delete_stock_desc'), () => onDelete(c.id), t('delete'), 'danger')} 
                                className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-500 hover:text-red-500 hover:border-slate-700 transition-all"
                                title={t('delete')}
                              >
                                <i className="fas fa-trash text-xs"></i>
                              </button>
                            </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Add Button for Warehouse - Only on Types and History tabs */}
      {/* Custom Stock Adjustment Modal */}
      <AnimatePresence>
        {showAdjustModal && adjustingGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdjustModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <i className="fas fa-boxes-stacked"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">{t('adjust_stock')}</h3>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    {adjustingGroup.producer} {adjustingGroup.model}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                    {t('new_total_stock')}
                  </label>
                  <input 
                    type="number"
                    value={adjustValue}
                    onChange={(e) => setAdjustValue(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center text-2xl font-black text-white focus:border-orange-500 transition-all outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowAdjustModal(false)}
                    className="flex-1 py-3.5 rounded-2xl bg-slate-800 text-white font-black uppercase text-xs tracking-widest hover:bg-slate-700 transition-all"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    onClick={confirmSetExact}
                    className="flex-1 py-3.5 rounded-2xl bg-orange-600 text-white font-black uppercase text-xs tracking-widest hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20"
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ExpandingFAB 
        show={activeTab === 'types' || activeTab === 'history'}
        label={showForm ? t('close_label') : activeTab === 'types' ? t('new_type') : t('new_purchase')}
        isClose={showForm}
        onClick={() => {
          if (!showForm) window.scrollTo({ top: 0, behavior: 'smooth' });
          setShowForm(!showForm);
        }}
      />
    </div>
  );
};

export default Warehouse;
