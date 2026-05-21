import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { SocietyEvent } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { MapPin, Calendar, Crosshair, Euro, Share2, Download, X, Target } from 'lucide-react';

interface CompetitionShareCardProps {
  event: SocietyEvent;
  societies: any[];
  onClose: () => void;
  triggerToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const CompetitionShareCard: React.FC<CompetitionShareCardProps> = ({ event, societies, onClose, triggerToast }) => {
  const { t, language } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL('https://clay-tracking-pro-production-3fe8.up.railway.app', {
      margin: 1,
      width: 180,
      color: {
        dark: '#0f172a', // slate-900 / dark color
        light: '#ffffff'
      }
    })
      .then(url => {
        setQrCodeDataUrl(url);
      })
      .catch(err => {
        console.error('Error generating QR code:', err);
      });
  }, []);

  const getFormattedDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const getDoubleDateFormatted = (start: string, end: string) => {
    try {
      const sDate = new Date(start);
      const eDate = new Date(end);
      
      if (sDate.toDateString() === eDate.toDateString()) {
        return getFormattedDate(start);
      }
      
      const sOpt: Intl.DateTimeFormatOptions = { day: 'numeric', month: sDate.getMonth() === eDate.getMonth() ? undefined : 'long' };
      const eOpt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

      const startPart = sDate.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', sOpt);
      const endPart = eDate.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-GB', eOpt);
      
      return `${startPart} - ${endPart}`;
    } catch (e) {
      return `${getFormattedDate(start)} - ${getFormattedDate(end)}`;
    }
  };

  const handleShare = async (mode: 'share' | 'download' = 'share') => {
    if (!cardRef.current) return;
    setIsGenerating(true);

    try {
      // Temporarily expand/force card size to render perfectly on all devices
      const originalWidth = cardRef.current.style.width;
      const originalMinWidth = cardRef.current.style.minWidth;
      
      cardRef.current.style.width = '480px';
      cardRef.current.style.minWidth = '480px';
      cardRef.current.style.overflow = 'visible';

      // Give browser time to complete layout
      await new Promise(resolve => setTimeout(resolve, 350));

      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 4, // Retains high resolution
        backgroundColor: '#f8fafc',
        logging: false,
        allowTaint: true,
        width: 480,
        windowWidth: 480,
        scrollX: 0,
        scrollY: 0,
      });

      // Restore style
      cardRef.current.style.width = originalWidth;
      cardRef.current.style.minWidth = originalMinWidth;
      cardRef.current.style.overflow = '';

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to generate image');

      const fileName = `scheda-gara-${event.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (mode === 'share' && navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Gara: ${event.name}`,
          text: `Gara di tiro al piattello "${event.name}" presso ${event.location}. Iscriviti su Clay Performance! 🎯`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        if (mode === 'share') {
          triggerToast?.(t?.('share_not_supported') || 'Condivisione non supportata. L\'immagine è stata scaricata.', 'info');
        }
      }
    } catch (error) {
      console.error('Error sharing competition:', error);
      triggerToast?.('Si è verificato un errore durante la generazione della scheda.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[2200] flex items-start justify-center p-4 bg-black/95 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-md animate-in slide-in-from-top-10 duration-300 py-8">
        
        {/* Card Container */}
        <div className="mb-6 overflow-hidden rounded-[2.5rem] shadow-2xl bg-slate-50 mx-auto w-full max-w-[480px]">
          <div 
            ref={cardRef}
            className="bg-slate-50 relative flex flex-col items-center justify-start w-full"
            style={{ 
              padding: '44px 28px 48px 28px',
              boxSizing: 'border-box', 
              textAlign: 'center',
              backgroundColor: '#f8fafc', // Soft light-grey layout background for premium contrast
              minHeight: '640px'
            }}
          >
            {/* Top decorative gradient band */}
            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500"></div>
            
            {/* Elegant light grey and orange ambient circles behind brand */}
            <div className="absolute top-10 left-5 w-40 h-40 bg-orange-500/5 rounded-full blur-3xl -z-10"></div>
            <div className="absolute top-40 right-5 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl -z-10"></div>

            {/* Header / Brand */}
            <div className="mb-6 flex flex-col items-center">
              <div className="flex items-center justify-center gap-3 mb-2 h-11">
                <div className="bg-gradient-to-br from-orange-500 to-rose-600 w-11 h-11 rounded-full relative shrink-0 shadow-lg shadow-orange-500/20 flex items-center justify-center">
                  <svg viewBox="0 0 512 512" className="w-6 h-6 shrink-0" fill="none" stroke="white">
                    <circle cx="256" cy="256" r="200" fill="none" stroke="white" strokeWidth="44"/>
                    <circle cx="256" cy="256" r="120" fill="none" stroke="white" strokeWidth="44"/>
                    <circle cx="256" cy="256" r="40" fill="white" stroke="white" strokeWidth="12"/>
                  </svg>
                </div>
                <span className="text-xl font-black tracking-tight text-slate-900 leading-none flex items-center h-full">
                  Clay <span className="text-orange-600 ml-1.5">Performance</span>
                </span>
              </div>
            </div>

            {/* Premium background design target circles in clean white */}
            <div className="absolute top-[185px] left-1/2 -ml-[170px] w-[340px] h-[340px] select-none pointer-events-none -z-10 flex items-center justify-center">
              <svg viewBox="0 0 512 512" className="w-full h-full opacity-[0.95]" fill="none" stroke="#ffffff">
                <circle cx="256" cy="256" r="236" fill="none" stroke="#ffffff" strokeWidth="12" />
                <circle cx="256" cy="256" r="180" fill="none" stroke="#ffffff" strokeWidth="12" />
                <circle cx="256" cy="256" r="120" fill="none" stroke="#ffffff" strokeWidth="12" />
                <circle cx="256" cy="256" r="60" fill="none" stroke="#ffffff" strokeWidth="12" />
                <circle cx="256" cy="256" r="15" fill="#ffffff" />
              </svg>
            </div>

            {/* Poster / Thumbnail if available inside the card */}
            {event.poster_url && !event.poster_url.startsWith('data:application/pdf') && (
              <div className="w-full max-h-[160px] rounded-3xl overflow-hidden mb-6 border border-white shadow-md">
                <img src={event.poster_url} alt="Locandina" className="w-full h-full object-cover" crossOrigin="anonymous" />
              </div>
            )}

            {/* Competition Details */}
            <div className="w-full flex flex-col items-center flex-1">
              {/* Discipline Badge (Type has been removed per user instruction) */}
              <div className="flex gap-2 mb-3.5">
                <span className="text-[10px] font-black px-3 py-1 bg-orange-600 text-white border border-orange-500/20 rounded-full uppercase tracking-wider shadow-sm">
                  {event.discipline}
                </span>
              </div>

              {/* Title */}
              <h2 className="text-[22px] sm:text-[24px] font-black text-slate-900 leading-[1.25] uppercase tracking-tight max-w-[380px] break-words mb-1.5 italic font-sans">
                {event.name}
              </h2>
              
              <div className="h-0.5 w-14 bg-gradient-to-r from-orange-500 to-rose-600 rounded-full mb-6"></div>

              {/* Key info blocks */}
              <div className="grid grid-cols-1 gap-3 w-full mb-6">
                
                {/* Location */}
                <div className="flex items-center p-4 bg-white/95 rounded-2xl border border-white text-left gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-orange-600/10 text-orange-600 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-5 h-5 shrink-0">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1">Società Ospitante</span>
                    <span className="block text-sm font-black text-slate-800 tracking-tight leading-normal overflow-visible break-words">
                      {event.location}
                      {societies.find(s => s.name === event.location)?.code && (
                        <span className="text-orange-600 ml-1.5 font-bold">({societies.find(s => s.name === event.location)?.code})</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center p-4 bg-white/95 rounded-2xl border border-white text-left gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-5 h-5 shrink-0">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                      <line x1="16" x2="16" y1="2" y2="6"/>
                      <line x1="8" x2="8" y1="2" y2="6"/>
                      <line x1="3" x2="21" y1="10" y2="10"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1 font-sans">Periodo della Gara</span>
                    <span className="block text-sm font-black text-slate-800 tracking-tight leading-normal">
                      {getDoubleDateFormatted(event.start_date, event.end_date)}
                    </span>
                  </div>
                </div>

                {/* Details grid inline with 100% centering for graphics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center p-3.5 bg-white/95 rounded-2xl border border-white text-left gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-4 h-4 shrink-0">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="22" x2="18" y1="12" y2="12"/>
                        <line x1="6" x2="2" y1="12" y2="12"/>
                        <line x1="12" x2="12" y1="2" y2="6"/>
                        <line x1="12" x2="12" y1="18" y2="22"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1">Piattelli</span>
                      <span className="block text-sm font-black text-slate-800 leading-none">
                        {event.targets}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center p-3.5 bg-white/95 rounded-2xl border border-white text-left gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-amber-600/10 text-amber-600 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-4 h-4 shrink-0">
                        <path d="M4 12h8"/>
                        <path d="M4 10h6"/>
                        <path d="M19 19a8.5 8.5 0 0 1-13-1.35A8.3 8.3 0 0 1 5 12c0-2 1-3.9 2.5-5.35A8.5 8.5 0 0 1 19 5"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1">{t?.('cost') || 'QUOTA'}</span>
                      <span className="block text-sm font-black text-slate-800 leading-none">
                        {event.cost ? `€ ${parseFloat(event.cost).toFixed(2)}` : 'Nessuna'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Promo box & QR Code side-by-side or stacked inside dark card */}
              <div className="w-full bg-slate-900 rounded-3xl p-5 border border-slate-950 flex items-center gap-4 relative overflow-hidden shadow-md text-left mt-auto">
                <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-orange-500/15 rounded-full blur-xl"></div>
                <div className="flex-1 relative z-10">
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.25em] mb-1">Inquadra per iscriverti</p>
                  <p className="text-xs font-black text-white leading-snug uppercase">Segui la gara e i risultati in tempo reale!</p>
                </div>
                {qrCodeDataUrl ? (
                  <div className="w-16 h-16 bg-white p-1 rounded-xl shrink-0 z-10 shadow-lg flex items-center justify-center">
                    <img src={qrCodeDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-slate-800 animate-pulse rounded-xl shrink-0 z-10 animate-in fade-in" />
                )}
              </div>

            </div>

          </div>
        </div>

        {/* Actions Button Panel */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleShare('share')}
            disabled={isGenerating}
            className="col-span-2 bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-orange-600/15 disabled:opacity-50"
          >
            {isGenerating ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                <span className="text-xs uppercase tracking-widest font-black">Invia Gara / Condividi</span>
              </>
            )}
          </button>
          
          <button 
            onClick={() => handleShare('download')}
            disabled={isGenerating}
            className="bg-white hover:bg-slate-100 text-slate-900 font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-250 disabled:opacity-50 shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-700" />
            <span className="text-[10px] uppercase tracking-widest font-black">Salva Immagine</span>
          </button>
          
          <button 
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm"
          >
            Annulla
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default CompetitionShareCard;
