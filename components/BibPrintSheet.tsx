import React from 'react';

interface BibPrintSheetProps {
  shooter: any;
  competitionName: string;
  societyName: string;
}

export const BibPrintSheet: React.FC<BibPrintSheetProps> = ({ shooter, competitionName, societyName }) => {
  return (
    <div className="printable-bib p-6 flex flex-col border-[8px] border-slate-900 bg-white text-black mx-auto relative shadow-none box-border" style={{ width: '297mm', height: '210mm', minHeight: '210mm', pageBreakAfter: 'always', breakAfter: 'page', boxSizing: 'border-box' }}>
      <div className="flex justify-between items-start text-lg font-bold uppercase tracking-[0.2em] mb-1">
        <span>{societyName}</span>
        <span>F.I.T.A.V.</span>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
        <div className="w-full border-b-[4px] border-black pb-2 mb-0.5">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-center leading-tight px-4">
                {shooter.first_name} {shooter.last_name}
            </h2>
        </div>
        <div className="text-[280px] md:text-[320px] font-black leading-[0.8] tracking-tighter py-0">
            {shooter.bib_number}
        </div>
      </div>
      
      <div className="w-full pt-1 border-t-[2px] border-black/20 text-center mt-0.5">
        <div className="text-lg md:text-xl font-black uppercase whitespace-normal break-words leading-tight px-4">
          {competitionName}
        </div>
      </div>
    </div>
  );
};
