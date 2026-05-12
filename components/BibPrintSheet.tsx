import React from 'react';

interface BibPrintSheetProps {
  shooter: any;
  competitionName: string;
  societyName: string;
}

export const BibPrintSheet: React.FC<BibPrintSheetProps> = ({ shooter, competitionName, societyName }) => {
  return (
    <div className="printable-bib p-16 flex flex-col border-[8px] border-slate-900 bg-white text-black mx-auto relative shadow-none" style={{ width: '297mm', height: '210mm', minHeight: '210mm', pageBreakAfter: 'always', boxSizing: 'border-box' }}>
      <div className="flex justify-between items-start text-xl font-bold uppercase tracking-[0.2em] mb-4">
        <span>{societyName}</span>
        <span>F.I.T.A.V.</span>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
        <div className="w-full border-b-[6px] border-black pb-8 mb-6">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-center leading-tight px-4">
                {shooter.first_name} {shooter.last_name}
            </h2>
        </div>
        <div className="text-[240px] md:text-[280px] font-black leading-none tracking-tighter py-4">
            {shooter.bib_number}
        </div>
      </div>
      
      <div className="w-full pt-8 border-t-[2px] border-black/20 text-center mt-4">
        <div className="text-xl md:text-2xl font-black uppercase whitespace-normal break-words leading-tight px-12">
          {competitionName}
        </div>
      </div>
    </div>
  );
};
