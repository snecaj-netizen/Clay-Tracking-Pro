
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { Competition, User } from '../types';

interface ShareCardProps {
  competition: Competition;
  societies: any[];
  user: User;
  onClose: () => void;
  isPerfectSeries?: boolean;
  seriesIndex?: number;
}

const ShareCard: React.FC<ShareCardProps> = ({ competition, societies, user, onClose, isPerfectSeries, seriesIndex: _seriesIndex }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleShare = async (mode: 'share' | 'download' = 'share') => {
    if (!cardRef.current) return;
    setIsGenerating(true);

    try {
      // Salva lo stile originale per ripristinarlo dopo la cattura
      const originalWidth = cardRef.current.style.width;
      const originalMinWidth = cardRef.current.style.minWidth;
      
      // Forza la larghezza a 480px per la cattura per garantire coerenza nell'immagine generata
      cardRef.current.style.width = '480px';
      cardRef.current.style.minWidth = '480px';
      cardRef.current.style.overflow = 'visible';

      // Piccola attesa per il rendering con le nuove dimensioni
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 4, // Aumentato per una risoluzione ancora migliore
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        width: 480,
        windowWidth: 480,
      });

      // Ripristina lo stile originale
      cardRef.current.style.width = originalWidth;
      cardRef.current.style.minWidth = originalMinWidth;
      cardRef.current.style.overflow = '';

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to generate image');

      const fileName = `risultato-${competition.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (mode === 'share' && navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Il mio risultato su Clay Performance',
          text: isPerfectSeries 
            ? `Ho fatto 25/25! 🎯 Guarda il mio risultato su Clay Performance.` 
            : `Ho completato la gara ${competition.name} con un punteggio di ${competition.totalScore}/${competition.totalTargets}! 🎯`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        if (mode === 'share') {
          alert('Condivisione non supportata su questo browser. L\'immagine è stata scaricata.');
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      alert('Si è verificato un errore durante la generazione dell\'immagine.');
    } finally {
      setIsGenerating(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1300] flex items-start justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md animate-in slide-in-from-top-10 duration-300 py-8">
        {/* Card Container */}
        <div className="mb-6 overflow-hidden rounded-[2.5rem] shadow-2xl bg-white mx-auto w-full max-w-[480px]">
          <div 
            ref={cardRef}
            className="bg-white relative flex flex-col items-center justify-start w-full"
            style={{ 
              padding: '40px 24px 64px 24px', // Aumentato il padding inferiore per sicurezza
              boxSizing: 'border-box', 
              textAlign: 'center',
              backgroundColor: '#ffffff',
              minHeight: '580px'
            }}
          >
            {/* Decorative Background Element */}
            <div className="absolute top-0 left-0 w-full h-32 bg-slate-50/50 -z-10 rounded-b-[3rem]"></div>

            {/* Header */}
            <div className="mb-10 flex flex-col items-center">
              <div className="flex items-center justify-center gap-4 mb-3">
                <div className="relative">
                  {/* Decorative Circles */}
                  <div className="absolute inset-0 -m-2 border-2 border-orange-600/10 rounded-2xl animate-pulse"></div>
                  <div className="absolute inset-0 -m-4 border border-orange-600/5 rounded-[1.5rem]"></div>
                  <div className="absolute inset-0 -m-6 border border-orange-600/5 rounded-[2rem]"></div>
                  
                  <div className="bg-orange-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-600/30 relative z-10">
                    <i className="fas fa-bullseye text-white text-3xl"></i>
                  </div>
                </div>
                <span className="text-2xl font-black tracking-tighter text-slate-900 pb-1">
                  Clay <span className="text-orange-600">Performance</span>
                </span>
              </div>
              <div className="h-1.5 w-16 bg-orange-600/20 rounded-full"></div>
            </div>

            {/* User Section */}
            <div className="mb-8 flex flex-col items-center relative w-full">
              {/* Medal Badge - Centered relative to avatar */}
              {competition.position && competition.position >= 1 && competition.position <= 3 && (
                <div 
                  className="absolute z-20 flex flex-col items-center"
                  style={{ 
                    top: '-10px', 
                    right: 'calc(50% - 75px)',
                  }}
                >
                  <div style={{
                    backgroundColor: competition.position === 1 ? '#fbbf24' : competition.position === 2 ? '#94a3b8' : '#b45309',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                    border: '4px solid white'
                  }}>
                    <i className={`fas fa-medal text-white ${competition.position === 1 ? 'text-2xl' : 'text-xl'}`}></i>
                  </div>
                  <div style={{ 
                    marginTop: '-10px',
                    backgroundColor: 'white', 
                    color: competition.position === 1 ? '#b45309' : competition.position === 2 ? '#475569' : '#78350f',
                    fontSize: '10px',
                    fontWeight: '900',
                    padding: '4px 10px 5px 10px',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    whiteSpace: 'nowrap',
                    border: '1px solid rgba(0,0,0,0.05)',
                    lineHeight: '1.2'
                  }}>
                    {competition.position === 1 ? '1° POSTO' : competition.position === 2 ? '2° POSTO' : '3° POSTO'}
                    {competition.ranking_preference === 'categoria' ? ' CAT.' : competition.ranking_preference === 'qualifica' ? ' QUAL.' : ''}
                  </div>
                </div>
              )}

              <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden mb-4 shadow-2xl bg-slate-50 ring-8 ring-slate-50/50">
                {user.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 text-5xl">
                    <i className="fas fa-user"></i>
                  </div>
                )}
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-tight pb-1">
                {user.name} {user.surname}
              </h2>
              <div className="text-[10px] font-black text-orange-600 uppercase tracking-[0.5em] mt-2 bg-orange-50 px-3 py-1.5 rounded-full leading-normal">
                Tiratore {user.category ? `• ${user.category}` : ''}
              </div>
            </div>

            {/* Score Section */}
            <div className="w-full bg-slate-900 rounded-[2.5rem] p-10 mb-10 shadow-2xl relative overflow-hidden">
              {/* Background Glow - Larger Circles */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-orange-600/25 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl -ml-20 -mb-20"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-600/5 rounded-full blur-3xl"></div>
              
              <div className="relative z-10 pb-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-[0.4em] mb-4">Punteggio Finale</div>
                <div className="text-7xl font-black text-white leading-tight flex items-baseline justify-center gap-1">
                  {isPerfectSeries ? (
                    <span className="text-orange-500">25/25</span>
                  ) : (
                    <>
                      <span>{competition.totalScore}</span>
                      <span className="text-slate-600 text-3xl font-bold">/{competition.totalTargets}</span>
                    </>
                  )}
                </div>
                {isPerfectSeries && (
                  <div className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em] mt-6 flex items-center justify-center gap-2">
                    <div className="h-px w-8 bg-orange-400/30"></div>
                    SERIE PERFETTA 🎯
                    <div className="h-px w-8 bg-orange-400/30"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Event Details Section */}
            <div className="w-full flex flex-col items-center">
              <h3 className="text-2xl font-black text-slate-900 leading-tight mb-2 max-w-[320px]">
                {competition.name}
              </h3>
              
              <div className="text-[11px] font-black text-orange-600 uppercase tracking-[0.3em] mb-6">
                {competition.discipline}
              </div>
              
              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 min-h-[80px] justify-center">
                  <i className="fas fa-map-marker-alt text-orange-600 mb-2 text-sm"></i>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Località</span>
                  <span className="text-[11px] font-bold text-slate-700 w-full px-1 leading-[1.4] break-words pb-1">
                    {competition.location}
                    {societies.find(s => s.name === competition.location)?.code && (
                      <span className="text-orange-600 ml-1">({societies.find(s => s.name === competition.location)?.code})</span>
                    )}
                  </span>
                </div>
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 min-h-[80px] justify-center">
                  <i className="fas fa-calendar-alt text-orange-600 mb-2 text-sm"></i>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data</span>
                  <span className="text-[11px] font-bold text-slate-700 leading-normal">
                    {new Date(competition.date).toLocaleDateString('it-IT')}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Watermark */}
            <div className="mt-12 pt-6 border-t border-slate-100 w-full">
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em]">
                Generato con Clay Performance
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleShare('share')}
            disabled={isGenerating}
            className="col-span-2 bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-orange-600/20 disabled:opacity-50"
          >
            {isGenerating ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <>
                <i className="fas fa-share-alt"></i>
                <span className="text-xs uppercase tracking-widest">Condividi Risultato</span>
              </>
            )}
          </button>
          <button 
            onClick={() => handleShare('download')}
            disabled={isGenerating}
            className="bg-white hover:bg-slate-50 text-slate-900 font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-200 disabled:opacity-50"
          >
            <i className="fas fa-download text-xs"></i>
            <span className="text-[10px] uppercase tracking-widest">Salva</span>
          </button>
          <button 
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ShareCard;
