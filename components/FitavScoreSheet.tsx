import React from 'react';
import { SocietyEvent } from '../types';

interface FitavScoreSheetProps {
  team: {
    name: string;
    members: { id: string; name: string; surname: string; category?: string }[];
    competition_name?: string;
    society?: string;
    date?: string;
  };
  event?: SocietyEvent;
  onClose: () => void;
}

const FitavScoreSheet: React.FC<FitavScoreSheetProps> = ({ team, event, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[2000] flex items-center justify-center p-4 overflow-y-auto no-scrollbar print:p-0 print:bg-white print:static print:inset-auto cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white text-black w-full max-w-[297mm] min-h-[210mm] p-6 shadow-2xl relative print:shadow-none print:max-w-none print:p-0 print:m-0 cursor-default animate-in zoom-in-95 duration-300"
      >
        {/* Close Button (Hidden on Print) */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center print:hidden shadow-xl z-50 group"
          title="Chiudi anteprima"
        >
          <i className="fas fa-times text-xl group-hover:rotate-90 transition-transform"></i>
        </button>

        {/* Print Button (Hidden on Print) */}
        <button 
          onClick={handlePrint}
          className="absolute top-4 right-20 px-6 py-3 rounded-2xl bg-orange-600 text-white font-black uppercase text-xs tracking-widest hover:bg-orange-500 transition-all flex items-center gap-2 print:hidden shadow-xl z-50"
        >
          <i className="fas fa-print text-sm"></i> Stampa Statino
        </button>

        {/* Header Section - Matching the image layout */}
        <div className="flex justify-between items-start mb-2 px-2">
          <div className="space-y-1 pt-4">
            <p className="text-[10px] font-bold uppercase">Pedana N°: <span className="border-b border-black inline-block w-24 ml-1"></span></p>
            <p className="text-[10px] font-bold uppercase">Serie N°: <span className="border-b border-black inline-block w-24 ml-1"></span></p>
          </div>
          
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-4 mb-1">
              <div className="w-12 h-12 border border-black flex items-center justify-center text-[6px] font-bold uppercase text-center">Logo<br/>FITAV</div>
              <h1 className="text-xl font-black uppercase tracking-tighter">FEDERAZIONE ITALIANA TIRO A VOLO</h1>
              <div className="w-12 h-12 border border-black flex items-center justify-center text-[6px] font-bold uppercase text-center">Logo<br/>Società</div>
            </div>
            <div className="h-[1px] bg-black w-full mb-2"></div>
            <div className="flex justify-center gap-8">
              <p className="text-[10px] font-bold uppercase">Gara: <span className="font-black border-b border-black min-w-[200px] inline-block">{team.competition_name || event?.name || '____________________'}</span></p>
              <p className="text-[10px] font-bold uppercase">Società: <span className="font-black border-b border-black min-w-[200px] inline-block">{team.society || event?.location || '____________________'}</span></p>
            </div>
          </div>

          <div className="pt-4 text-right">
            <p className="text-[10px] font-bold uppercase">Arbitro: <span className="border-b border-black inline-block w-40 ml-1"></span></p>
          </div>
        </div>

        {/* Scoring Table */}
        <table className="w-full border-collapse border-[1.5px] border-black text-[9px]">
          <thead>
            <tr className="h-8">
              <th className="border border-black p-1 w-6">N°</th>
              <th className="border border-black p-1 w-40 text-left uppercase">Cognome e Nome</th>
              <th className="border border-black p-1 w-8 uppercase">Cat.</th>
              <th className="border border-black p-0" colSpan={30}>
                <div className="border-b border-black p-0.5 uppercase font-black text-center">Piattelli</div>
                <div className="grid grid-cols-6 h-4">
                  <div className="border-r border-black uppercase font-bold text-[7px] flex items-center justify-center">Pedana 1</div>
                  <div className="border-r border-black uppercase font-bold text-[7px] flex items-center justify-center">Pedana 2</div>
                  <div className="border-r border-black uppercase font-bold text-[7px] flex items-center justify-center">Pedana 3</div>
                  <div className="border-r border-black uppercase font-bold text-[7px] flex items-center justify-center">Pedana 4</div>
                  <div className="border-r border-black uppercase font-bold text-[7px] flex items-center justify-center">Pedana 5</div>
                  <div className="uppercase font-bold text-[7px] flex items-center justify-center">Attesa</div>
                </div>
              </th>
              <th className="border border-black p-1 w-10 uppercase">Totale</th>
              <th className="border border-black p-1 w-16 uppercase">Firma</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5].map((rowIndex) => {
              const member = team.members[rowIndex];
              const waitIndex = 5 - rowIndex;
              
              return (
                <tr key={rowIndex} className="h-10">
                  <td className="border border-black text-center font-bold">{rowIndex + 1}</td>
                  <td className="border border-black px-2 font-black uppercase truncate text-[10px]">
                    {member ? `${member.surname} ${member.name}` : ''}
                  </td>
                  <td className="border border-black text-center font-bold uppercase">
                    {member?.category || ''}
                  </td>
                  
                  {[0, 1, 2, 3, 4, 5].map((stationIndex) => {
                    const isWait = stationIndex === waitIndex;
                    
                    if (isWait) {
                      return (
                        <td key={stationIndex} colSpan={5} className="border border-black bg-gray-100 text-center uppercase font-black text-[8px] h-10">
                          Attesa
                        </td>
                      );
                    }

                    // Calculate pedana number based on rotation
                    let pedanaNum;
                    if (stationIndex < waitIndex) {
                      pedanaNum = rowIndex + stationIndex + 1;
                    } else {
                      pedanaNum = stationIndex - waitIndex;
                    }

                    return (
                      <React.Fragment key={stationIndex}>
                        <td colSpan={5} className="border border-black p-0 h-10">
                          <div className="text-[5px] font-bold text-center border-b border-black bg-gray-50 py-0.5 uppercase leading-none">Pedana {pedanaNum}</div>
                          <div className="grid grid-cols-5 h-full">
                            {[1, 2, 3, 4, 5].map((targetNum) => {
                              const absoluteTargetNum = (pedanaNum - 1) * 5 + targetNum;
                              return (
                                <div key={targetNum} className="border-r last:border-r-0 border-black flex items-center justify-center text-[7px] text-gray-400 relative h-full min-w-[14px]">
                                  <span className="absolute top-0 left-0.5 text-[5px]">{absoluteTargetNum}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </React.Fragment>
                    );
                  })}

                  <td className="border border-black text-center font-black text-base"></td>
                  <td className="border border-black"></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer Info */}
        <div className="mt-4 flex justify-between items-end px-2">
          <div className="w-1/2">
            <p className="text-[8px] font-bold uppercase">Note dell'Arbitro:</p>
            <div className="border-b border-black h-4 mt-1"></div>
            <div className="border-b border-black h-4 mt-1"></div>
          </div>
          <div className="text-right pb-1">
            <p className="text-[10px] font-bold uppercase">Firma dell'Arbitro: ___________________________</p>
          </div>
        </div>

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
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          }
        `}} />
      </div>
    </div>
  );
};

export default FitavScoreSheet;
