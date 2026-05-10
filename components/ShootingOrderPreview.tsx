import React, { useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SocietyEvent, EventSquad } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { X, Download, Printer } from 'lucide-react';

interface ShootingOrderPreviewProps {
  event: SocietyEvent;
  squads: EventSquad[];
  onClose: () => void;
  squadNumberMap: Map<number | string, number>;
}

const ShootingOrderPreview: React.FC<ShootingOrderPreviewProps> = ({ event, squads, onClose, squadNumberMap }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizeDate = (d: any) => {
    if (!d || d === 'all') return 'all';
    const s = String(d);
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[0];
    const itMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (itMatch) return `${itMatch[3]}-${itMatch[2]}-${itMatch[1]}`;
    return s;
  };

  const formatDateDisplay = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const normalized = normalizeDate(dateStr);
    if (!normalized || normalized === 'all') return '';
    const [year, month, day] = normalized.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleDownloadPDF = async () => {
    if (!containerRef.current) return;
    
    const element = containerRef.current;
    const pages = Array.from(element.children).filter(child => child.tagName === 'DIV');
    
    const totalFields = Math.max(...squads.map(s => s.field_number), 0);
    const orientation = totalFields <= 3 ? 'portrait' : 'landscape';

    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4'
    });
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i] as HTMLElement;
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        // Force the capture size to match A4 proportions in pixels at 96dpi
        windowWidth: orientation === 'portrait' ? 794 : 1123,
        windowHeight: orientation === 'portrait' ? 1123 : 794
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }
    
    pdf.save(`ordine_di_tiro_${event.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const dayData = useMemo(() => {
    const grouped: Record<string, EventSquad[]> = {};
    squads.forEach(s => {
      const day = normalizeDate(s.squad_day);
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(s);
    });

    const maxField = event.total_fields || Math.max(...squads.map(s => s.field_number), 0);
    const fields = Array.from({ length: maxField }, (_, i) => i + 1);
    const isPortrait = maxField <= 3;
    const slotsPerPage = isPortrait ? 5 : 3;

    return {
      grouped,
      fields,
      isPortrait,
      slotsPerPage
    };
  }, [squads, event.total_fields]);

  const days = Object.keys(dayData.grouped).sort();

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-start justify-center p-4 md:p-10 md:py-20 overflow-y-auto no-scrollbar print:p-0 print:bg-white print:static print:inset-auto order-preview-overlay"
    >
      {/* Controls Container */}
      <div className="fixed top-6 right-6 flex gap-4 z-[10000] print:hidden">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadPDF();
          }}
          className="px-6 py-3 rounded-2xl bg-slate-800 text-white font-black uppercase text-xs tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2 shadow-2xl"
        >
          <Download className="w-4 h-4" /> Scarica PDF
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handlePrint();
          }}
          className="px-6 py-3 rounded-2xl bg-orange-600 text-white font-black uppercase text-xs tracking-widest hover:bg-orange-500 transition-all flex items-center gap-2 shadow-2xl"
        >
          <Printer className="w-4 h-4" /> Stampa
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-12 h-12 rounded-2xl bg-white text-slate-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-2xl group border border-slate-200"
          title="Chiudi anteprima"
        >
          <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
        </button>
      </div>

      <div ref={containerRef} className="flex flex-col gap-8 w-full max-w-[297mm] print:gap-0 print:max-w-none">
        {days.map((day, dayIdx) => {
          const daySquads = dayData.grouped[day];
          const times = Array.from(new Set(daySquads.map(s => s.start_time))).sort();
          
          // Split times into chunks (pages)
          const timeChunks: string[][] = [];
          for (let i = 0; i < times.length; i += dayData.slotsPerPage) {
            timeChunks.push(times.slice(i, i + dayData.slotsPerPage));
          }

          const squadsByTime: Record<string, Record<number, EventSquad>> = {};
          daySquads.forEach(s => {
            if (!squadsByTime[s.start_time]) squadsByTime[s.start_time] = {};
            squadsByTime[s.start_time][s.field_number] = s;
          });

          return timeChunks.map((chunk, chunkIdx) => (
            <div 
              key={`${day}-${chunkIdx}`}
              onClick={(e) => e.stopPropagation()}
              className={`bg-white text-black p-8 md:p-12 shadow-2xl relative print:shadow-none print:p-8 print:m-0 cursor-default animate-in zoom-in-95 duration-300 print:break-after-page ${dayData.isPortrait ? 'w-[210mm] min-h-[297mm]' : 'w-[297mm] min-h-[210mm]'} mx-auto overflow-hidden`}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight">{event.location || "ASD Tav Lazio"}</h1>
                </div>
                <div className="text-right">
                  <h2 className="text-sm font-black uppercase">{event.name}</h2>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">
                    Dal {formatDateDisplay(event.start_date)} al {formatDateDisplay(event.end_date)}
                  </p>
                  <p className="text-[10px] font-black uppercase mt-1">
                    Giorno {dayIdx + 1} - Pagina {chunkIdx + 1}
                  </p>
                </div>
              </div>

              {/* Table Body */}
              <div className="w-full pb-16">
                {/* Field Headers */}
                <div className="flex border-b-2 border-black mb-2">
                  {dayData.fields.map(field => (
                    <div key={field} className="flex-1 px-4 py-1 text-xs font-black uppercase border-r border-slate-200 last:border-r-0">
                      Campo {field}
                    </div>
                  ))}
                </div>

                {/* Times and Squads */}
                <div className="space-y-6">
                  {chunk.map(time => (
                    <div key={time} className="flex min-h-[30mm]">
                      {dayData.fields.map(field => {
                        const squad = squadsByTime[time]?.[field];
                        const sqNum = squad ? (squadNumberMap.get(squad.id) || squad.squad_number) : null;
                        
                        return (
                          <div key={field} className="flex-1 px-4 border-r border-slate-100 last:border-r-0">
                            {squad ? (
                              <div className="space-y-1">
                                <div className="border-b border-black pb-1 mb-2 bg-slate-50/50 p-1 rounded-sm">
                                  <div className="text-[10px] font-black uppercase text-slate-900 flex justify-between items-center">
                                    <span>Batt. {sqNum}</span>
                                    <span className="text-orange-600 font-bold">{squad.start_time}</span>
                                  </div>
                                </div>
                                <div className="space-y-[1px] mt-1">
                                  {[1, 2, 3, 4, 5, 6].map(pos => {
                                    const member = squad.members.find(m => m.position === pos);
                                    const cat = member?.category || "";
                                    const qual = member?.qualification || "";
                                    const catQual = [cat, qual].filter(Boolean).join(' - ');

                                    return (
                                      <div key={pos} className="flex items-center text-[9px] h-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors px-1">
                                        <span className="w-5 font-bold text-slate-300">{pos}</span>
                                        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                                          {member ? (
                                            <>
                                              {member.bib_number && (
                                                <span className="font-black text-orange-600 mr-0.5 text-[9px]">
                                                  ({member.bib_number})
                                                </span>
                                              )}
                                              <span className="font-black text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis text-[9px]">
                                                {member.last_name} {member.first_name}
                                              </span>
                                              {catQual && (
                                                <span className="text-[7px] font-black text-slate-400 bg-slate-100 px-1 py-0.5 rounded uppercase flex-shrink-0">
                                                  {catQual}
                                                </span>
                                              )}
                                            </>
                                          ) : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="h-full border-b border-slate-50 flex items-center justify-center py-4">
                                {/* Empty Column Space */}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="absolute bottom-10 left-12 right-12 flex justify-between items-end text-[7px] font-bold uppercase italic text-slate-400">
                <p>Documento generato da Clay Performance</p>
                <p>Pagina {chunkIdx + 1} di {timeChunks.length} - {formatDateDisplay(day)}</p>
                <p>Data: {new Date().toLocaleString('it-IT')}</p>
              </div>
            </div>
          ));
        })}

        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: ${dayData.isPortrait ? 'A4 portrait' : 'A4 landscape'};
              margin: 0;
            }
            body {
              background: white !important;
              -webkit-print-color-adjust: exact;
            }
            body > *:not(.order-preview-overlay) {
              display: none !important;
            }
            .order-preview-overlay {
              display: block !important;
              position: static !important;
              padding: 0 !important;
              background: white !important;
            }
            .shadow-2xl {
              box-shadow: none !important;
            }
            .print\\:break-after-page {
              break-after: page;
            }
          }
        `}} />
      </div>
    </div>,
    document.body
  );
};

export default ShootingOrderPreview;
