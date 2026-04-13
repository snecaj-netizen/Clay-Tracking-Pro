import React, { useRef } from 'react';
import { SocietyEvent } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface FitavScoreSheetProps {
  teams: {
    name: string;
    members: { id: string; name: string; surname: string; category?: string }[];
    competition_name?: string;
    society?: string;
    date?: string;
  }[];
  event?: SocietyEvent;
  onClose: () => void;
  hostingSociety?: {
    name: string;
    code?: string;
    logo?: string;
  };
  autoAction?: 'print' | 'download' | null;
}

const FitavScoreSheet: React.FC<FitavScoreSheetProps> = ({ teams, event, onClose, hostingSociety, autoAction }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoAction) {
      // Small delay to ensure rendering and images are ready
      const timer = setTimeout(() => {
        if (autoAction === 'print') {
          handlePrint();
        } else if (autoAction === 'download') {
          handleDownloadPDF();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoAction]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!containerRef.current) return;
    
    const element = containerRef.current;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`statino_${event?.name || 'gara'}.pdf`);
  };

  // Helper to get Pedana number and target range for a specific cell
  const getCellInfo = (rowIndex: number, colIndex: number) => {
    const attesaPos = 5 - rowIndex;
    if (colIndex === attesaPos) {
      return { isAttesa: true };
    }
    
    // Calculate Pedana number
    const pedanaNum = ((colIndex + rowIndex) % 6) + 1;
    
    // Calculate target range (1-25)
    let nonAttesaBefore = 0;
    for (let i = 0; i < colIndex; i++) {
      if (i !== attesaPos) nonAttesaBefore++;
    }
    const startNum = nonAttesaBefore * 5 + 1;
    
    return { isAttesa: false, pedanaNum, startNum };
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[2000] flex items-start justify-center p-4 md:p-10 md:py-20 overflow-y-auto no-scrollbar print:p-0 print:bg-white print:static print:inset-auto cursor-pointer"
    >
      <div ref={containerRef} className="flex flex-col gap-8 w-full max-w-[297mm] print:gap-0 print:max-w-none">
        {/* Controls (Hidden on Print) */}
        <div className="fixed top-6 right-6 flex gap-4 z-[2100] print:hidden">
          <button 
            onClick={handleDownloadPDF}
            className="px-6 py-3 rounded-2xl bg-slate-800 text-white font-black uppercase text-xs tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2 shadow-2xl"
          >
            <i className="fas fa-download text-sm"></i> Scarica PDF
          </button>
          <button 
            onClick={handlePrint}
            className="px-6 py-3 rounded-2xl bg-orange-600 text-white font-black uppercase text-xs tracking-widest hover:bg-orange-500 transition-all flex items-center gap-2 shadow-2xl"
          >
            <i className="fas fa-print text-sm"></i> Stampa {teams.length > 1 ? 'Tutti' : 'Statino'}
          </button>
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-2xl bg-white text-slate-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-2xl group border border-slate-200"
            title="Chiudi anteprima"
          >
            <i className="fas fa-times text-xl group-hover:rotate-90 transition-transform"></i>
          </button>
        </div>

        {teams.map((team, tIdx) => (
          <div 
            key={tIdx}
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-black w-full min-h-[210mm] p-4 md:p-8 shadow-2xl relative print:shadow-none print:p-0 print:m-0 cursor-default animate-in zoom-in-95 duration-300 border-[4px] border-double border-black print:break-after-page"
          >
            {/* Header Section */}
            <div className="flex items-center justify-between mb-8 px-6 relative">
              <div className="w-32 flex items-center justify-start">
                {hostingSociety?.logo ? (
                  <img 
                    src={hostingSociety.logo} 
                    alt="Society Logo" 
                    className="w-24 h-24 object-contain"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <img 
                    src="https://www.fitav.it/wp-content/uploads/2021/03/logo-fitav.png" 
                    alt="FITAV Logo" 
                    className="w-24 h-24 object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      console.error("Logo FITAV failed to load", e);
                      (e.target as HTMLImageElement).src = "https://picsum.photos/seed/fitav/200/200";
                    }}
                  />
                )}
              </div>

              <div className="flex-1 text-center">
                {hostingSociety ? (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center gap-4 mb-1">
                      <h1 className="text-3xl font-black uppercase tracking-tighter leading-none text-slate-900">
                        {hostingSociety.name}
                      </h1>
                      {hostingSociety.code && (
                        <div className="h-8 w-[2px] bg-slate-300 hidden sm:block"></div>
                      )}
                      {hostingSociety.code && (
                        <span className="text-xl font-black text-orange-600 tracking-widest">
                          {hostingSociety.code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-[1px] w-12 bg-slate-200"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
                        Società Affiliata FITAV
                      </p>
                      <div className="h-[1px] w-12 bg-slate-200"></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <h1 className="text-2xl font-black uppercase tracking-[0.1em] leading-none text-slate-900">
                      FEDERAZIONE ITALIANA TIRO A VOLO
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">
                      Statino di Gara Ufficiale
                    </p>
                  </div>
                )}
              </div>

              <div className="w-32 flex items-center justify-end">
                <img 
                  src="https://www.fitav.it/wp-content/uploads/2021/03/logo-fitav.png" 
                  alt="FITAV Logo" 
                  className="w-24 h-24 object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    console.error("Logo FITAV failed to load", e);
                    (e.target as HTMLImageElement).src = "https://picsum.photos/seed/fitav/200/200";
                  }}
                />
              </div>
            </div>

            {/* Info Bar (Requested by user) */}
            <div className="grid grid-cols-3 gap-4 mb-4 px-2 text-[10px] font-black uppercase">
              <div className="flex items-end gap-2">
                <span className="text-slate-500">Gara:</span>
                <span className="flex-1 border-b border-black pb-0.5 truncate">{event?.name || team.competition_name || 'N.D.'}</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-slate-500">Data:</span>
                <span className="flex-1 border-b border-black pb-0.5 text-center">{team.date || (event?.start_date ? new Date(event.start_date).toLocaleDateString('it-IT') : '____/____/________')}</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-slate-500">Campo:</span>
                <span className="flex-1 border-b border-black pb-0.5 truncate">{team.society || event?.location || 'N.D.'}</span>
              </div>
            </div>

            {/* Sub-header Bar (From official image) */}
            <div className="grid grid-cols-3 gap-12 mb-4 px-2 text-[10px] font-bold uppercase">
              <div className="flex items-end gap-2">
                <span>Batteria: <span className="ml-2 font-black text-xs">{team.name}</span></span>
              </div>
              <div className="flex items-end gap-2">
                <span>Serie N°:</span>
                <span className="flex-1 border-b border-black pb-0.5"></span>
              </div>
              <div className="flex items-end gap-2">
                <span>Arbitro:</span>
                <span className="flex-1 border-b border-black pb-0.5"></span>
              </div>
            </div>

            {/* Scoring Table */}
            <div className="overflow-x-auto relative">
              {/* Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] grayscale">
                <img 
                  src="https://www.fitav.it/wp-content/uploads/2021/03/logo-fitav.png" 
                  alt="" 
                  className="w-[400px] h-[400px] object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <table className="w-full border-collapse border-[2px] border-black text-[9px] relative z-10">
                <thead>
                  <tr className="h-10">
                    <th className="border border-black w-8 uppercase font-black">N°</th>
                    <th className="border border-black w-64 uppercase font-black text-left px-2">Cognome e Nome</th>
                    <th className="border border-black w-10 uppercase font-black">Cat.</th>
                    <th className="border border-black uppercase font-black text-center" colSpan={6}>Piattelli</th>
                    <th className="border border-black w-16 uppercase font-black">Totale</th>
                    <th className="border border-black w-24 uppercase font-black">Firma</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5].map((rowIndex) => {
                    const member = team.members[rowIndex];
                    return (
                      <tr key={rowIndex} className="h-14">
                        <td className="border border-black text-center font-black text-xs">{rowIndex + 1}</td>
                        <td className="border border-black px-2 font-black uppercase text-xs truncate">
                          {member ? `${member.surname} ${member.name}` : ''}
                        </td>
                        <td className="border border-black text-center font-black uppercase text-[10px]">{member?.category || ''}</td>
                        
                        {/* Piattelli Blocks */}
                        {[0, 1, 2, 3, 4, 5].map((colIndex) => {
                          const info = getCellInfo(rowIndex, colIndex);
                          
                          if (info.isAttesa) {
                            return (
                              <td key={colIndex} className="border border-black bg-slate-50 w-28">
                                <div className="flex items-center justify-center h-full font-black uppercase text-slate-400 tracking-widest text-[10px]">
                                  Attesa
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td key={colIndex} className="border border-black p-0 w-28">
                              <div className="flex flex-col h-full">
                                <div className="text-[7px] font-black text-center border-b border-black py-0.5 bg-slate-50 uppercase">
                                  Pedana {info.pedanaNum}
                                </div>
                                <div className="grid grid-cols-5 flex-1">
                                  {[0, 1, 2, 3, 4].map(targetIdx => (
                                    <div key={targetIdx} className="border-r last:border-r-0 border-black flex flex-col">
                                      <div className="text-[5px] font-bold text-center border-b border-black/20 py-0.5 bg-white">
                                        {(info.startNum || 0) + targetIdx}
                                      </div>
                                      <div className="flex-1 min-h-[24px]"></div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          );
                        })}

                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Info */}
            <div className="mt-6 flex justify-between items-end text-[9px] font-bold uppercase italic text-slate-400">
              <p>Documento generato da Clay Performance</p>
              <div className="flex gap-8">
                <div className="flex items-end gap-2">
                  <span>Direttore di Tiro:</span>
                  <span className="w-40 border-b border-black"></span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Print Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 landscape;
              margin: 5mm;
            }
            body {
              background: white !important;
              -webkit-print-color-adjust: exact;
            }
            .fixed {
              position: static !important;
            }
            .shadow-2xl {
              box-shadow: none !important;
            }
            .border-double {
              border-style: solid !important;
              border-width: 2px !important;
            }
            .print\\:break-after-page {
              break-after: page;
            }
          }
        `}} />
      </div>
    </div>
  );
};


export default FitavScoreSheet;
