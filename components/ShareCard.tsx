
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

  const handleShare = async () => {
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

      const file = new File([blob], 'risultato-tiro.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Il mio risultato su Clay Tracker Pro',
          text: isPerfectSeries 
            ? `Ho fatto 25/25! 🎯 Guarda il mio risultato su Clay Tracker Pro.` 
            : `Ho completato la gara ${competition.name} con un punteggio di ${competition.totalScore}/${competition.totalTargets}! 🎯`,
        });
      } else {
        // Fallback: download image
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `risultato-${competition.name.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.click();
        URL.revokeObjectURL(url);
        alert('Condivisione non supportata su questo browser. L\'immagine è stata scaricata.');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      alert('Si è verificato un errore durante la generazione dell\'immagine.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWhatsAppShare = async () => {
    const text = isPerfectSeries 
      ? `Ho fatto 25/25! 🎯 Guarda il mio risultato su Clay Tracker Pro.` 
      : `Ho completato la gara ${competition.name} con un punteggio di ${competition.totalScore}/${competition.totalTargets}! 🎯`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md animate-in zoom-in-95 duration-300">
        {/* Preview Area */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-800 shadow-2xl">
          <div 
            ref={cardRef}
            className="relative bg-slate-950 p-8 flex flex-col items-center text-center"
            style={{ minHeight: '500px' }}
          >
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-orange-600 rounded-full blur-[100px]"></div>
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-600 rounded-full blur-[100px]"></div>
            </div>

            {/* App Logo & Name */}
            <div className="relative z-10 flex items-center gap-3 mb-8">
              <div className="bg-orange-600 p-2 rounded-xl shadow-lg">
                <i className="fas fa-bullseye text-2xl text-white"></i>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Clay Tracker <span className="text-orange-600">Pro</span>
              </h1>
            </div>

            {/* User Info */}
            <div className="relative z-10 mb-6">
              <div className="w-24 h-24 mx-auto rounded-full border-4 border-orange-600/30 overflow-hidden shadow-xl mb-4">
                {user.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500 text-3xl">
                    <i className="fas fa-user"></i>
                  </div>
                )}
              </div>
              <h2 className="text-xl font-bold text-white">{user.name} {user.surname}</h2>
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1">Tiratore</p>
            </div>

            {/* Score Display */}
            <div className="relative z-10 w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-6 mb-6 backdrop-blur-sm">
              {isPerfectSeries ? (
                <div className="animate-bounce">
                  <div className="text-6xl font-black text-orange-500 mb-2">25/25</div>
                  <div className="text-xs font-black text-orange-400 uppercase tracking-[0.2em]">Serie Perfetta! 🎯</div>
                </div>
              ) : (
                <>
                  <div className="text-5xl font-black text-white mb-2">
                    {competition.totalScore}<span className="text-slate-600 text-3xl">/{competition.totalTargets}</span>
                  </div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Punteggio Totale</div>
                </>
              )}
            </div>

            {/* Competition Details */}
            <div className="relative z-10 space-y-2">
              <h3 className="text-lg font-bold text-white leading-tight">{competition.name}</h3>
              <div className="flex items-center justify-center gap-4 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <i className="fas fa-map-marker-alt text-orange-600"></i>
                  <span>{competition.location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="fas fa-calendar-alt text-orange-600"></i>
                  <span>{new Date(competition.date).toLocaleDateString('it-IT')}</span>
                </div>
              </div>
              <div className="mt-4 inline-flex items-center px-3 py-1 bg-slate-800 rounded-full text-[10px] font-black text-slate-300 uppercase tracking-widest border border-slate-700">
                {competition.discipline}
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-8 left-0 w-full text-center">
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">claytrackerpro.app</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={handleShare}
            disabled={isGenerating}
            className="bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-orange-600/20 disabled:opacity-50"
          >
            {isGenerating ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <>
                <i className="fas fa-share-alt"></i>
                <span className="text-xs uppercase tracking-widest">Condividi</span>
              </>
            )}
          </button>
          <button 
            onClick={handleWhatsAppShare}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
          >
            <i className="fab fa-whatsapp text-lg"></i>
            <span className="text-xs uppercase tracking-widest">WhatsApp</span>
          </button>
          <button 
            onClick={onClose}
            className="col-span-2 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
          >
            Chiudi Anteprima
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareCard;
