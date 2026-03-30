import React, { useState, useEffect, useRef } from 'react';

interface ShooterSearchProps {
  value: any; // Can be string, number, or array of them
  onChange: (value: any, id?: number) => void;
  shooters: any[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  useId?: boolean;
  multiple?: boolean;
}

const ShooterSearch: React.FC<ShooterSearchProps> = ({ 
  value, 
  onChange, 
  shooters, 
  placeholder = "Cerca Tiratore...", 
  className = "",
  required = false,
  disabled = false,
  useId = false,
  multiple = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (multiple) {
      setSearchTerm('');
    } else if (useId) {
      const shooter = shooters.find(s => s.id === value || s.id === Number(value));
      setSearchTerm(shooter ? `${shooter.name} ${shooter.surname}` : '');
    } else {
      setSearchTerm(value as string || '');
    }
  }, [value, shooters, useId, multiple]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (!multiple) {
          if (useId) {
            const shooter = shooters.find(s => s.id === value || s.id === Number(value));
            setSearchTerm(shooter ? `${shooter.name} ${shooter.surname}` : '');
          } else {
            setSearchTerm(value as string || '');
          }
        } else {
          setSearchTerm('');
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [value, shooters, useId, multiple]);

  const filteredShooters = shooters.filter(s => {
    const searchStr = `${s.name} ${s.surname} ${s.email || ''} ${s.fitav_card || ''}`.toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    
    if (multiple && Array.isArray(value)) {
      return matchesSearch && !value.includes(useId ? s.id : `${s.name} ${s.surname}`);
    }
    return matchesSearch;
  });

  const handleSelect = (shooter: any) => {
    if (multiple) {
      const currentValue = Array.isArray(value) ? value : [];
      const newValue = [...currentValue, useId ? shooter.id : `${shooter.name} ${shooter.surname}`];
      onChange(newValue, shooter.id);
      setSearchTerm('');
    } else {
      if (useId) {
        onChange(shooter.id.toString(), shooter.id);
      } else {
        onChange(`${shooter.name} ${shooter.surname}`, shooter.id);
      }
      setSearchTerm(`${shooter.name} ${shooter.surname}`);
      setIsOpen(false);
    }
  };

  const removeSelected = (itemToRemove: any) => {
    if (multiple && Array.isArray(value)) {
      const newValue = value.filter(v => v !== itemToRemove);
      onChange(newValue);
    }
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div className="space-y-2">
        {multiple && Array.isArray(value) && value.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {value.map((v, idx) => {
              const shooter = useId ? shooters.find(s => s.id === v) : null;
              const label = shooter 
                ? `${shooter.name} ${shooter.surname}${shooter.category || shooter.qualification ? ` (${shooter.category || shooter.qualification})` : ''}` 
                : v;
              return (
                <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-600/20 text-orange-500 text-[10px] font-black uppercase tracking-widest border border-orange-500/30">
                  {label}
                  <button 
                    type="button" 
                    onClick={() => removeSelected(v)}
                    className="hover:text-white transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              );
            })}
          </div>
        )}
        
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => !disabled && setIsOpen(true)}
            placeholder={multiple && Array.isArray(value) && value.length > 0 ? "Aggiungi un altro..." : placeholder}
            required={required && (!multiple || (Array.isArray(value) && value.length === 0))}
            disabled={disabled}
            className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-600 outline-none transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
            {searchTerm && !disabled && (
              <button 
                type="button" 
                className="pointer-events-auto text-slate-500 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                  if (!multiple) onChange('');
                  setIsOpen(true);
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            )}
            <i className="fas fa-search text-slate-500 text-xs"></i>
          </div>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
          {filteredShooters.length > 0 ? (
            filteredShooters.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`w-full text-left px-4 py-3 text-sm hover:bg-orange-600/20 hover:text-orange-500 transition-colors border-b border-slate-800 last:border-0 ${(!multiple && (useId ? (value === s.id || Number(value) === s.id) : value === `${s.name} ${s.surname}`)) ? 'bg-orange-600/10 text-orange-500 font-bold' : 'text-slate-300'}`}
                onClick={() => handleSelect(s)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block font-bold">
                      {s.name} {s.surname}
                      {(s.category || s.qualification) && (
                        <span className="ml-2 text-[10px] font-black text-orange-500 uppercase tracking-tighter bg-orange-600/10 px-1.5 py-0.5 rounded">
                          {s.category || s.qualification}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.email && <span className="text-[10px] opacity-50">{s.email}</span>}
                      {s.fitav_card && <span className="text-[10px] text-orange-500/70 font-black uppercase tracking-tighter">#{s.fitav_card}</span>}
                    </div>
                  </div>
                  {s.role === 'admin' && <span className="text-[10px] bg-orange-600/20 text-orange-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Admin</span>}
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500 italic">
              Nessun tiratore trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShooterSearch;
