import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { BibPrintSheet } from './BibPrintSheet'; // Use existing component
import { SocietyEvent } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useLanguage } from '../contexts/LanguageContext';

interface BibPrintModalProps {
  shooters: any[];
  event: SocietyEvent;
  onClose: () => void;
  hostingSocietyName: string;
  autoAction?: 'print' | 'download' | null;
}

export const BibPrintModal: React.FC<BibPrintModalProps> = ({ shooters, event, onClose, hostingSocietyName, autoAction }) => {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoAction) {
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
    window.focus();
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!containerRef.current) return;
    
    const element = containerRef.current;
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    // Iterate over children (bibs)
    const pages = Array.from(element.children) as HTMLElement[];
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const canvas = await html2canvas(page, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            // Proportions for A4 Landscape at 96 DPI: 1123 x 794
            width: 1123,
            height: 794,
            windowWidth: 1123,
            windowHeight: 794
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        if (i > 0) pdf.addPage('a4', 'landscape');
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }
    
    pdf.save(`pettorali_${event.name || 'gara'}.pdf`);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[2000] overflow-y-auto no-scrollbar print:p-0 print:bg-white print:static print:inset-auto bib-print-overlay">
      
      {/* Controls Header */}
      <div className="sticky top-0 left-0 w-full bg-slate-900/90 backdrop-blur-xl border-b border-white/10 p-3 md:p-4 z-[2100] flex flex-wrap justify-end items-center gap-2 md:gap-4 print:hidden">
        <div className="hidden sm:block mr-auto px-4">
          <h3 className="text-white font-black uppercase text-[10px] md:text-xs tracking-widest opacity-50">Anteprima Pettorali</h3>
        </div>
        
        <button 
          onClick={handleDownloadPDF}
          className="flex-1 sm:flex-none px-3 md:px-6 py-2 rounded-xl bg-slate-800 text-white font-black uppercase text-[9px] md:text-xs tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-xl border border-white/5"
        >
          <i className="fas fa-download"></i> <span className="">{t('download_pdf')}</span>
        </button>
        <button 
          onClick={handlePrint}
          className="flex-1 sm:flex-none px-3 md:px-6 py-2 rounded-xl bg-orange-600 text-white font-black uppercase text-[9px] md:text-xs tracking-widest hover:bg-orange-500 transition-all flex items-center justify-center gap-2 shadow-xl border border-orange-400/20"
        >
          <i className="fas fa-print"></i> <span className="">{t('print')}</span>
        </button>
        <button 
          onClick={onClose}
          className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-white text-slate-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-xl group border border-slate-200"
          title="Chiudi anteprima"
        >
          <i className="fas fa-times text-base md:text-xl group-hover:rotate-90 transition-transform"></i>
        </button>
      </div>

      <div className="flex flex-col items-center justify-center p-4 md:p-10 min-h-screen print:p-0 print:block print:min-h-0">
        <div ref={containerRef} className="w-full max-w-[297mm] mx-auto flex flex-col gap-8 print:gap-0 print:block print:max-w-none print:m-0">
          {shooters.map((shooter, idx) => (
            <BibPrintSheet 
              key={idx}
              shooter={shooter}
              competitionName={event.name}
              societyName={hostingSocietyName}
            />
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
            @page { size: A4 landscape; margin: 0; }
            html, body { 
              margin: 0 !important; 
              padding: 0 !important; 
              background: white !important;
              width: 100%;
              height: 100%;
              overflow: visible !important;
            }
            body > *:not(.bib-print-overlay) { display: none !important; }
            .bib-print-overlay { 
              display: block !important; 
              position: static !important; 
              padding: 0 !important; 
              margin: 0 !important;
              background: white !important;
              overflow: visible !important;
              z-index: 1 !important;
              width: 100%;
            }
            .printable-bib { 
              page-break-after: always !important; 
              break-after: page !important;
              margin: 0 !important;
              border: 6px solid black !important;
              width: 297mm !important;
              height: 210mm !important;
              display: flex !important;
              box-sizing: border-box !important;
            }
            .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>,
    document.body
  );
};
