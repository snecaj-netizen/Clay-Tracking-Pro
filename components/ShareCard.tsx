
import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Competition, User } from '../types';

interface ShareCardProps {
  competition: Competition;
  user: User;
  onClose: () => void;
  isPerfectSeries?: boolean;
  seriesIndex?: number;
}

const ShareCard: React.FC<ShareCardProps> = ({ competition, user, onClose, isPerfectSeries, seriesIndex }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleShare = async (mode: 'share' | 'download' = 'share') => {
    if (!cardRef.current) return;
    setIsGenerating(true);

    try {
      // Piccola attesa per il rendering
      await new Promise(resolve => setTimeout(resolve, 200));

      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 3,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
      });

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to generate image');

      const fileName = `risultato-${competition.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (mode === 'share' && navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Il mio risultato su Clay Tracker Pro',
          text: isPerfectSeries 
            ? `Ho fatto 25/25! 🎯 Guarda il mio risultato su Clay Tracker Pro.` 
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md my-auto animate-in zoom-in-95 duration-300 py-4">
        {/* Card Container */}
        <div className="mb-6 overflow-hidden rounded-[2.5rem] shadow-2xl bg-white">
          <div 
            ref={cardRef}
            className="p-8 text-center bg-white relative"
            style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center' }}
          >
            {/* Header */}
            <div className="mb-8" style={{ textAlign: 'center' }}>
              <div className="inline-flex items-center justify-center gap-3" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <div className="bg-orange-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
                  <i className="fas fa-bullseye text-white text-xl"></i>
                </div>
                <span className="text-xl font-black tracking-tighter text-slate-900" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '8px' }}>
                  Clay Tracker <span className="text-orange-600">Pro</span>
                </span>
              </div>
            </div>

            {/* User */}
            <div className="mb-8" style={{ textAlign: 'center' }}>
              <div className="w-24 h-24 mx-auto rounded-full border-4 border-orange-100 overflow-hidden mb-4 shadow-xl bg-slate-50" style={{ margin: '0 auto 16px auto' }}>
                {user.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-3xl">
                    <i className="fas fa-user"></i>
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight m-0" style={{ margin: 0 }}>
                {user.name} {user.surname}
              </h2>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1">Tiratore</div>
            </div>

            {/* Score */}
            <div className="bg-slate-50 rounded-[2rem] p-10 mb-8 border border-slate-100" style={{ textAlign: 'center' }}>
              <div className="text-7xl font-black text-slate-900 leading-none" style={{ lineHeight: 1 }}>
                {isPerfectSeries ? (
                  <span className="text-orange-600">25/25</span>
                ) : (
                  <>
                    {competition.totalScore}<span className="text-slate-300 text-3xl">/{competition.totalTargets}</span>
                  </>
                )}
              </div>
              {isPerfectSeries && (
                <div className="text-xs font-black text-orange-500 uppercase tracking-[0.3em] mt-3">Serie Perfetta! 🎯</div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-4" style={{ textAlign: 'center' }}>
              <h3 className="text-xl font-black text-slate-900 leading-tight px-4 m-0" style={{ margin: '0 0 16px 0' }}>{competition.name}</h3>
              <div className="flex items-center justify-center gap-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '24px' }}>
                <span style={{ display: 'inline-block', margin: '0 12px' }}>
                  <i className="fas fa-map-marker-alt text-orange-600 mr-2"></i>
                  {competition.location}
                </span>
                <span style={{ display: 'inline-block', margin: '0 12px' }}>
                  <i className="fas fa-calendar-alt text-orange-600 mr-2"></i>
                  {new Date(competition.date).toLocaleDateString('it-IT')}
                </span>
              </div>
              <div className="inline-block px-8 py-3 bg-orange-600 text-white rounded-full text-[12px] font-black uppercase tracking-[0.2em] shadow-lg shadow-orange-600/20" style={{ display: 'inline-block' }}>
                {competition.discipline}
              </div>
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
    </div>
  );
};

export default ShareCard;
