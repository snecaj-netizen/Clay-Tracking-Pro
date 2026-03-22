
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
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#0f172a', // slate-950
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
        // Download image
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md animate-in zoom-in-95 duration-300">
        {/* Preview Area */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-800 shadow-2xl">
          <div 
            ref={cardRef}
            className="relative bg-slate-950 p-8 flex flex-col items-center text-center w-full"
            style={{ minHeight: '520px', width: '100%', maxWidth: '400px', margin: '0 auto' }}
          >
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-orange-600 rounded-full blur-[100px]"></div>
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-600 rounded-full blur-[100px]"></div>
            </div>

            {/* App Logo & Name */}
            <div className="relative z-10 flex items-center justify-center gap-4 mb-10 w-full">
              <div className="bg-orange-600 w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center shrink-0">
                <i className="fas fa-bullseye text-2xl text-white"></i>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Clay Tracker <span className="text-orange-600">Pro</span>
              </h1>
            </div>

            {/* User Info */}
            <div className="relative z-10 mb-8 w-full">
              <div className="w-24 h-24 mx-auto rounded-full border-4 border-orange-600/30 overflow-hidden shadow-2xl mb-4 flex items-center justify-center bg-slate-900">
                {user.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="text-slate-500 text-3xl">
                    <i className="fas fa-user"></i>
                  </div>
                )}
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight w-full text-center">
                {user.name} {user.surname}
              </h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 w-full text-center">Tiratore</p>
            </div>

            {/* Score Display */}
            <div className="relative z-10 w-full bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 mb-8 backdrop-blur-sm shadow-inner flex flex-col items-center justify-center">
              {isPerfectSeries ? (
                <div className="flex flex-col items-center justify-center w-full">
                  <div className="text-7xl font-black text-orange-500 mb-2 drop-shadow-[0_0_15px_rgba(249,115,22,0.4)] text-center">25/25</div>
                  <div className="text-xs font-black text-orange-400 uppercase tracking-[0.3em] text-center">Serie Perfetta! 🎯</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full">
                  <div className="text-6xl font-black text-white mb-2 text-center">
                    {competition.totalScore}<span className="text-slate-600 text-3xl">/{competition.totalTargets}</span>
                  </div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] text-center">Punteggio Totale</div>
                </div>
              )}
            </div>

            {/* Competition Details */}
            <div className="relative z-10 space-y-4 pb-4 w-full flex flex-col items-center">
              <h3 className="text-xl font-black text-white leading-tight px-4 w-full text-center">{competition.name}</h3>
              <div className="flex items-center justify-center gap-5 text-slate-400 text-[10px] font-black uppercase tracking-widest w-full">
                <div className="flex items-center gap-2">
                  <i className="fas fa-map-marker-alt text-orange-600"></i>
                  <span>{competition.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-calendar-alt text-orange-600"></i>
                  <span>{new Date(competition.date).toLocaleDateString('it-IT')}</span>
                </div>
              </div>
              <div className="mt-6 inline-flex items-center justify-center px-6 py-2.5 bg-orange-600/10 border border-orange-600/20 rounded-full text-[12px] font-black text-orange-500 uppercase tracking-[0.3em] shadow-lg">
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
                <span className="text-xs uppercase tracking-widest">Condividi Immagine</span>
              </>
            )}
          </button>
          <button 
            onClick={() => handleShare('download')}
            disabled={isGenerating}
            className="bg-slate-800 hover:bg-slate-700 text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-700 disabled:opacity-50"
          >
            <i className="fas fa-download text-xs"></i>
            <span className="text-[10px] uppercase tracking-widest">Salva</span>
          </button>
          <button 
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-400 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-700"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareCard;
