
import React from 'react';
import { createPortal } from 'react-dom';

interface SocietyDetailModalProps {
  society: any;
  onClose: () => void;
  currentUser?: any;
  onEdit?: (soc: any) => void;
  onDelete?: (id: number) => void;
  onCreateAccount?: (soc: any) => void;
}

const SocietyDetailModal: React.FC<SocietyDetailModalProps> = ({
  society,
  onClose,
  currentUser,
  onEdit,
  onDelete,
  onCreateAccount
}) => {
  if (!society) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <div className="relative min-h-[160px] bg-slate-900 bg-gradient-to-br from-slate-900 to-slate-950 border-b border-slate-800 flex items-end p-4 sm:p-6 overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -ml-16 -mb-16"></div>
          
          <button 
            onClick={onClose} 
            className="absolute top-3 right-3 sm:top-4 sm:right-4 w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg z-20"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
          
          <div className="relative z-10 w-full pr-10 sm:pr-0">
            <div className="flex items-end gap-4 translate-y-6">
              {society.logo ? (
                <img src={society.logo} alt={society.name} className="w-24 h-24 rounded-2xl object-cover border-4 border-slate-950 bg-slate-900 shadow-xl" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-slate-900 border-4 border-slate-950 flex items-center justify-center shadow-xl">
                  <i className="fas fa-building text-3xl text-slate-600"></i>
                </div>
              )}
              <div className="mb-2">
                <h2 className="text-xl sm:text-2xl font-black text-white leading-tight uppercase italic tracking-tighter break-words">{society.name}</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {society.city && <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-2"><i className="fas fa-map-marker-alt text-orange-500"></i>{society.city} {society.region ? `(${society.region})` : ''}</p>}
                  {(society.google_maps_link || (society.lat && society.lng)) && (
                    <a 
                      href={society.google_maps_link || `https://www.google.com/maps/dir/?api=1&destination=${society.lat},${society.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-black bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded-lg transition-colors flex items-center gap-1 uppercase tracking-wider"
                    >
                      <i className="fas fa-directions"></i> Naviga
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 pt-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            {society.contact_name && (
              <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Referente</p>
                <p className="text-sm font-bold text-white">{society.contact_name}</p>
              </div>
            )}
            {society.email && (
              <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Email</p>
                <p className="text-sm font-bold text-white break-all">{society.email}</p>
              </div>
            )}
            {society.phone && (
              <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Telefono</p>
                <p className="text-sm font-bold text-white">{society.phone}</p>
              </div>
            )}
            {society.mobile && (
              <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cellulare</p>
                <p className="text-sm font-bold text-white">{society.mobile}</p>
              </div>
            )}
            {society.address && (
              <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Indirizzo Completo</p>
                <p className="text-sm font-bold text-white">{society.address}, {society.zip_code} {society.city} ({society.region})</p>
              </div>
            )}
            {society.website && (
              <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sito Web</p>
                <a href={society.website} target="_blank" rel="noreferrer" className="text-sm font-bold text-orange-500 hover:underline break-all">{society.website}</a>
              </div>
            )}
            {society.google_maps_link && (
              <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Link Google Maps</p>
                <a href={society.google_maps_link} target="_blank" rel="noreferrer" className="text-sm font-bold text-orange-500 hover:underline break-all flex items-center gap-2">
                  <i className="fas fa-map-marked-alt"></i> Apri Mappa
                </a>
              </div>
            )}
            {society.opening_hours && (
              <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Giorni e Orari di Apertura</p>
                <p className="text-sm font-bold text-white">{society.opening_hours}</p>
              </div>
            )}
            {society.disciplines && (
              <div className="col-span-2 bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Discipline Disponibili</p>
                <div className="flex flex-wrap gap-2">
                  {society.disciplines.split(',').map((d: string) => (
                    <span key={d} className="px-2 py-1 rounded-lg bg-orange-600/20 text-orange-500 text-[10px] font-black border border-orange-600/30 uppercase tracking-wider">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {(onEdit || onDelete || onCreateAccount) && (
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm p-6 border-t border-slate-800 flex flex-wrap gap-3">
            {onCreateAccount && currentUser?.role === 'admin' && !society.has_account && (
              <button 
                onClick={() => onCreateAccount(society)} 
                className="w-full py-4 rounded-2xl bg-blue-600/20 text-blue-500 font-black text-xs uppercase tracking-widest hover:bg-blue-600/30 transition-all flex items-center justify-center gap-2 border border-blue-600/30 shadow-lg mb-2"
              >
                <i className="fas fa-user-plus"></i> Crea Account Società
              </button>
            )}
            {onEdit && (currentUser?.role === 'admin' || (currentUser?.role === 'society' && currentUser?.society === society.name)) && (
              <button 
                onClick={() => onEdit(society)} 
                className="flex-1 py-4 rounded-2xl bg-orange-600 text-white font-black text-xs uppercase tracking-widest hover:bg-orange-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
              >
                <i className="fas fa-edit"></i> Modifica
              </button>
            )}
            {onDelete && currentUser?.role === 'admin' && (
              <button 
                onClick={() => onDelete(society.id)} 
                className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
              >
                <i className="fas fa-trash-alt"></i> Elimina
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SocietyDetailModal;
