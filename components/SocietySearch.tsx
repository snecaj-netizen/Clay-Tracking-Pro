import React, { useState, useEffect, useRef } from 'react';

interface SocietySearchProps {
  value: string | number;
  onChange: (value: string, id?: number) => void;
  societies: any[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  useId?: boolean;
}

const SocietySearch: React.FC<SocietySearchProps> = ({ 
  value, 
  onChange, 
  societies, 
  placeholder = "Cerca società o codice...", 
  className = "",
  required = false,
  disabled = false,
  useId = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (useId) {
      const soc = societies.find(s => s.id === value);
      setSearchTerm(soc ? `${soc.name}${soc.code ? ` (${soc.code})` : ''}` : '');
    } else {
      const soc = societies.find(s => s.name === value);
      setSearchTerm(soc ? `${soc.name}${soc.code ? ` (${soc.code})` : ''}` : (value as string));
    }
  }, [value, societies, useId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search term to current value if no selection was made
        if (useId) {
          const soc = societies.find(s => s.id === value);
          setSearchTerm(soc ? `${soc.name}${soc.code ? ` (${soc.code})` : ''}` : '');
        } else {
          const soc = societies.find(s => s.name === value);
          setSearchTerm(soc ? `${soc.name}${soc.code ? ` (${soc.code})` : ''}` : (value as string));
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [value, societies, useId]);

  const filteredSocieties = societies.filter(soc => {
    const term = searchTerm.toLowerCase();
    const name = soc.name?.toLowerCase() || '';
    const code = soc.code?.toLowerCase() || '';
    
    return name.includes(term) || code.includes(term);
  });

  const handleSelect = (soc: any) => {
    if (useId) {
      onChange(soc.id.toString(), soc.id);
    } else {
      onChange(soc.name, soc.id);
    }
    setSearchTerm(`${soc.name}${soc.code ? ` (${soc.code})` : ''}`);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          {searchTerm && !disabled && (
            <button 
              type="button" 
              className="pointer-events-auto text-slate-500 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setSearchTerm('');
                onChange('');
                setIsOpen(true);
              }}
            >
              <i className="fas fa-times"></i>
            </button>
          )}
          <i className="fas fa-search text-slate-500 text-xs"></i>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
          {filteredSocieties.length > 0 ? (
            filteredSocieties.map((soc) => (
              <button
                key={soc.id}
                type="button"
                className={`w-full text-left px-4 py-3 text-sm hover:bg-orange-600/20 hover:text-orange-500 transition-colors border-b border-slate-800 last:border-0 ${(useId ? value === soc.id : value === soc.name) ? 'bg-orange-600/10 text-orange-500 font-bold' : 'text-slate-300'}`}
                onClick={() => handleSelect(soc)}
              >
                <div className="flex items-center justify-between">
                  <span>{soc.name} {soc.code ? <span className="text-orange-500 font-bold ml-1">({soc.code})</span> : ''}</span>
                  {soc.city && <span className="text-[10px] opacity-50 uppercase">{soc.city}</span>}
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500 italic">
              Nessuna società trovata
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SocietySearch;
