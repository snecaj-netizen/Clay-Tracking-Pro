import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ShooterSearch from '../ShooterSearch';
import SocietySearch from '../SocietySearch';
import { Competition, User, UserRole, Discipline, getSeriesLayout } from '../../types';
import { calculateRTE } from '../../ratingUtils';
import { useAdmin } from '../../contexts/AdminContext';
import { useUI } from '../../contexts/UIContext';

interface ResultsManagementProps {
  currentUser: any;
  token: string;
  onEditCompetition?: (comp?: Competition, userId?: number) => void;
  onDeleteCompetition?: (id: string) => Promise<boolean | void> | void;
}

// Result Row Component
const ResultRow = React.memo(({ 
  result, 
  onSelect 
}: { 
  result: any, 
  onSelect: (result: any) => void 
}) => {
  return (
    <tr 
      className="group bg-slate-950/40 hover:bg-slate-900/60 transition-all border border-slate-800/50 cursor-pointer"
      onClick={() => onSelect(result)}
    >
      <td className="px-4 py-4 rounded-l-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-500 text-xs font-black">
            {result.avatar ? (
              <img src={result.avatar} alt="" className="w-full h-full object-cover rounded-lg" />
            ) : (
              `${result.userName?.[0] || ''}${result.userSurname?.[0] || ''}`
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors">
              {result.userSurname} {result.userName}
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              {result.society || '-'}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="text-[10px] font-bold text-slate-400 uppercase">
          {result.category || '-'} / {result.qualification || '-'}
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <div className="text-xs font-bold text-white">
          {result.totalCompetitions}
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <div className="flex flex-col items-center">
          <div className={`text-sm font-black ${result.rteCount < 3 ? 'text-slate-500' : 'text-amber-500'}`}>
            {result.rte > 0 ? result.rte.toFixed(2) : '-'}
          </div>
          {result.rte > 0 && (
            <span className={`text-[8px] font-black uppercase tracking-tighter ${result.rteCount < 3 ? 'text-slate-600' : 'text-amber-500/50'}`}>
              {result.rteCount < 3 ? 'Provvisorio' : 'Qualificato'}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-4 text-right rounded-r-2xl">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSelect(result);
          }}
          className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-orange-500 hover:border-orange-500/50 transition-all flex items-center justify-center ml-auto"
        >
          <i className="fas fa-eye text-[10px]"></i>
        </button>
      </td>
    </tr>
  );
});

const ResultsManagement: React.FC<ResultsManagementProps> = ({
  currentUser, token, onEditCompetition, onDeleteCompetition
}) => {
  const { triggerConfirm, triggerToast } = useUI();
  const {
    societies, allResults, setAllResults, totalResults, resultsPage, setResultsPage, resultsPerPage,
    filterShooter, setFilterShooter, filterSociety, setFilterSociety, filterDiscipline, setFilterDiscipline, filterLocation, setFilterLocation, filterYear, setFilterYear,
    filterDate, setFilterDate, filterMonth, setFilterMonth, filterCategory, setFilterCategory, filterQualification, setFilterQualification,
    filterOptions, allUsers: shooters, selectedShooterResults, setSelectedShooterResults, setShareData,
    showFilters, setShowFilters
  } = useAdmin();

  const hasActiveFilters = filterShooter !== '' || filterSociety !== '' || filterDiscipline !== '' || filterLocation !== '' || filterYear !== '' || filterDate !== '' || filterMonth !== '' || filterCategory !== '' || filterQualification !== '';
  const totalPages = Math.ceil(totalResults / resultsPerPage);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement> | string) => {
    const value = typeof e === 'string' ? e : e.target.value;
    setter(value);
    setResultsPage(1);
  };

  const handleSelectShooter = useCallback(async (result: any) => {
    try {
      const queryParams = new URLSearchParams({
        search: filterShooter,
        society: filterSociety,
        discipline: filterDiscipline,
        location: filterLocation,
        year: filterYear,
        date: filterDate,
        month: filterMonth,
        category: filterCategory,
        qualification: filterQualification
      });
      const res = await fetch(`/api/admin/shooter-results/${result.userId}?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const mappedResults = (data || []).map((r: any) => ({
          ...r,
          totalScore: r.totalscore ?? r.totalScore,
          totalTargets: r.totaltargets ?? r.totalTargets,
          averagePerSeries: r.averageperseries ?? r.averagePerSeries,
          detailedScores: typeof r.detailedscores === 'string' ? JSON.parse(r.detailedscores) : (r.detailedscores ?? r.detailedScores),
          seriesImages: typeof r.seriesimages === 'string' ? JSON.parse(r.seriesimages) : (r.seriesimages ?? r.seriesImages),
          usedCartridges: typeof r.usedcartridges === 'string' ? JSON.parse(r.usedcartridges) : (r.usedcartridges ?? r.usedCartridges),
          scores: typeof r.scores === 'string' ? JSON.parse(r.scores) : (r.scores ?? r.scores),
          weather: typeof r.weather === 'string' ? JSON.parse(r.weather) : (r.weather ?? r.weather),
          chokes: typeof r.chokes === 'string' ? JSON.parse(r.chokes) : (r.chokes ?? r.chokes),
          userId: r.user_id ?? r.userId,
          userName: r.user_name ?? r.userName,
          userSurname: r.user_surname ?? r.userSurname,
          eventId: r.event_id ?? r.eventId,
          shootOff: r.shoot_off ?? r.shootOff,
          endDate: r.enddate ?? r.endDate
        }));

        setSelectedShooterResults({
          userId: result.userId,
          userName: result.userName,
          userSurname: result.userSurname,
          society: result.society,
          category: result.category,
          qualification: result.qualification,
          shooter_code: result.shooter_code,
          avatar: result.avatar,
          results: mappedResults,
          rte: result.rte,
          rteCount: result.rteCount
        });
      }
    } catch (err) {
      console.error("Error fetching shooter results:", err);
    }
  }, [token, filterShooter, filterSociety, filterDiscipline, filterLocation, filterYear, filterDate, filterMonth, filterCategory, filterQualification, setSelectedShooterResults]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
          <i className="fas fa-list-ol text-orange-500"></i> Tutti i Risultati
        </h2>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-start sm:justify-end overflow-x-auto pb-1 sm:pb-0 scrollbar-hide scroll-shadows">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border relative ${showFilters || hasActiveFilters ? 'bg-orange-600/10 border-orange-500/50 text-orange-500' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-orange-500 hover:border-slate-700'}`}
          >
            <i className={`fas ${showFilters ? 'fa-filter-slash' : 'fa-filter'}`}></i> Filtri
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 p-4 bg-slate-950/50 rounded-2xl border border-slate-800 animate-in zoom-in-95 duration-300">
            <div className="sm:col-span-1 lg:col-span-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tiratore</label>
              <ShooterSearch 
                value={filterShooter}
                onChange={handleFilterChange(setFilterShooter)}
                shooters={shooters}
                placeholder="Tutti"
              />
            </div>
          {currentUser?.role === 'admin' && (
            <div className="sm:col-span-1 lg:col-span-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Società</label>
              <SocietySearch 
                value={filterSociety}
                onChange={handleFilterChange(setFilterSociety)}
                societies={societies}
                placeholder="Tutte"
              />
            </div>
          )}
          <div className="sm:col-span-1 lg:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disciplina</label>
            <div className="relative group">
              <select 
                value={filterDiscipline} 
                onChange={handleFilterChange(setFilterDiscipline)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
              >
                <option value="">Tutte</option>
                {filterOptions.disciplines.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <i className="fas fa-chevron-down text-[10px]"></i>
              </div>
            </div>
          </div>
          <div className="sm:col-span-1 lg:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Campo</label>
            <div className="relative group">
              <select 
                value={filterLocation} 
                onChange={handleFilterChange(setFilterLocation)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
              >
                <option value="">Tutti</option>
                {filterOptions.locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <i className="fas fa-chevron-down text-[10px]"></i>
              </div>
            </div>
          </div>
          <div className="sm:col-span-1 lg:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Anno</label>
            <div className="relative group">
              <select 
                value={filterYear} 
                onChange={handleFilterChange(setFilterYear)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
              >
                <option value="">Tutti</option>
                {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <i className="fas fa-chevron-down text-[10px]"></i>
              </div>
            </div>
          </div>
          <div className="sm:col-span-1 lg:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mese</label>
            <div className="relative group">
              <select 
                value={filterMonth} 
                onChange={handleFilterChange(setFilterMonth)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
              >
                <option value="">Tutti</option>
                <option value="01">Gennaio</option>
                <option value="02">Febbraio</option>
                <option value="03">Marzo</option>
                <option value="04">Aprile</option>
                <option value="05">Maggio</option>
                <option value="06">Giugno</option>
                <option value="07">Luglio</option>
                <option value="08">Agosto</option>
                <option value="09">Settembre</option>
                <option value="10">Ottobre</option>
                <option value="11">Novembre</option>
                <option value="12">Dicembre</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <i className="fas fa-chevron-down text-[10px]"></i>
              </div>
            </div>
          </div>
          <div className="sm:col-span-1 lg:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data</label>
            <input 
              type="date" 
              value={filterDate} 
              onChange={(e) => handleFilterChange(setFilterDate)(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all"
            />
          </div>
          <div className="sm:col-span-1 lg:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
            <div className="relative group">
              <select 
                value={filterCategory} 
                onChange={handleFilterChange(setFilterCategory)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
              >
                <option value="">Tutte</option>
                <option value="Eccellenza">Eccellenza</option>
                <option value="1*">1*</option>
                <option value="2*">2*</option>
                <option value="3*">3*</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <i className="fas fa-chevron-down text-[10px]"></i>
              </div>
            </div>
          </div>
          <div className="sm:col-span-1 lg:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Qualifica</label>
            <div className="relative group">
              <select 
                value={filterQualification} 
                onChange={handleFilterChange(setFilterQualification)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all appearance-none"
              >
                <option value="">Tutte</option>
                <option value="Veterani">Veterani</option>
                <option value="Master">Master</option>
                <option value="Senior">Senior</option>
                <option value="Lady">Lady</option>
                <option value="Junior">Junior</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <i className="fas fa-chevron-down text-[10px]"></i>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
            <button 
              onClick={() => { 
                setFilterShooter(''); 
                setFilterSociety(''); 
                setFilterDiscipline(''); 
                setFilterLocation(''); 
                setFilterYear(''); 
                setFilterDate('');
                setFilterMonth('');
                setFilterCategory('');
                setFilterQualification('');
                setResultsPage(1); 
              }}
              className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400 transition-colors"
            >
              Resetta Filtri
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto -mx-6 px-6 scroll-shadows">
        <table className="w-full border-separate border-spacing-y-2">
          <thead className="relative z-20">
            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
              <th className="px-4 py-2 text-left">Tiratore</th>
              <th className="px-4 py-2 text-left">Cat / Qual</th>
              <th className="px-4 py-2 text-center">Gare</th>
              <th className="px-4 py-2 text-center relative">
                <div className="flex items-center justify-center gap-1.5">
                  Rating RTE
                  <div className="group relative">
                    <i className="fas fa-info-circle text-xs text-slate-600 cursor-help hover:text-orange-500 transition-colors p-1"></i>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl hidden group-hover:block pointer-events-none z-[100] text-[10px] font-medium text-slate-400 normal-case tracking-normal leading-relaxed">
                      <p className="mb-1 text-white font-bold">Rating Tecnico di Eccellenza (RTE)</p>
                      La media dei <span className="text-white">migliori 5 risultati</span> degli ultimi 12 mesi. 
                      Diventa <span className="text-amber-500 font-bold">Qualificato</span> con almeno 3 gare, altrimenti è <span className="text-slate-500 font-bold">Provvisorio</span>.
                    </div>
                  </div>
                </div>
              </th>
              <th className="px-4 py-2 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {allResults.map((result) => (
              <ResultRow 
                key={result.userId} 
                result={result} 
                onSelect={handleSelectShooter} 
              />
            ))}
          </tbody>
        </table>
      </div>

      {allResults.length === 0 && (
        <div className="text-center py-20 bg-slate-950/30 rounded-3xl border border-dashed border-slate-800">
          <i className="fas fa-search text-4xl text-slate-800 mb-4"></i>
          <p className="text-slate-500 font-bold">Nessun risultato trovato con i filtri selezionati</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Pagina {resultsPage} di {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setResultsPage(prev => Math.max(1, prev - 1))}
              disabled={resultsPage === 1}
              className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (resultsPage <= 3) {
                  pageNum = i + 1;
                } else if (resultsPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = resultsPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setResultsPage(pageNum)}
                    className={`w-10 h-10 rounded-xl text-xs font-black transition-all border ${
                      resultsPage === pageNum 
                        ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setResultsPage(prev => Math.min(totalPages, prev + 1))}
              disabled={resultsPage === totalPages}
              className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

      {selectedShooterResults && createPortal(
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedShooterResults(null)}>
          <div className="bg-slate-900 w-full h-full overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-orange-600 flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-lg shadow-orange-600/20">
                  {(selectedShooterResults.userName?.[0] || '')}{(selectedShooterResults.userSurname?.[0] || '')}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                    {selectedShooterResults.userSurname || ''} {selectedShooterResults.userName || ''}
                  </h2>
                  {selectedShooterResults.shooter_code && (
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em] mt-1">
                      {selectedShooterResults.shooter_code}
                    </p>
                  )}
                  <p className="text-xs font-black text-orange-500 uppercase tracking-[0.2em] mt-1">
                    {selectedShooterResults.society ? (
                      <>
                        {selectedShooterResults.society}
                        {societies.find(soc => soc.name === selectedShooterResults.society)?.code && (
                          <span className="ml-1">({societies.find(soc => soc.name === selectedShooterResults.society)?.code})</span>
                        )}
                      </>
                    ) : 'Nessuna Società'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 mr-8">
                {(() => {
                  const shooterRatings = calculateRTE(
                    (selectedShooterResults.results || []).map((r: any) => ({
                      ...r,
                      totalScore: r.totalscore,
                      totalTargets: r.totaltargets,
                      averagePerSeries: r.averageperseries,
                      scores: typeof r.scores === 'string' ? JSON.parse(r.scores) : r.scores,
                    }))
                  );
                  const bestRating = shooterRatings[0];
                  if (!bestRating) return null;
                  return (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center justify-end gap-1.5 mb-1">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rating RTE</div>
                        <div className="group relative">
                          <i className="fas fa-info-circle text-[10px] text-slate-600 cursor-help hover:text-orange-500 transition-colors p-1"></i>
                          <div className="absolute top-full right-0 mt-1 w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl hidden group-hover:block pointer-events-none z-[100] text-[10px] font-medium text-slate-400 normal-case tracking-normal leading-relaxed text-left">
                            <p className="mb-1 text-white font-bold">Rating Tecnico di Eccellenza (RTE)</p>
                            La media dei <span className="text-white">migliori 5 risultati</span> degli ultimi 12 mesi. 
                            Diventa <span className="text-amber-500 font-bold">Qualificato</span> con almeno 3 gare, altrimenti è <span className="text-slate-500 font-bold">Provvisorio</span>.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-4xl font-black ${bestRating.isProvvisorio ? 'text-slate-500' : 'text-amber-500'}`}>
                          {bestRating.rating.toFixed(2)}
                        </span>
                        <span className="text-xs font-bold text-slate-500">/25</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border ${bestRating.isProvvisorio ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                          {bestRating.isProvvisorio ? 'Provvisorio' : 'Qualificato'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-600 uppercase">{bestRating.discipline}</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="h-12 w-[1px] bg-slate-800"></div>
                <button 
                  onClick={() => setSelectedShooterResults(null)}
                  className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {Object.entries(
                (selectedShooterResults.results || [])
                  .filter((r: any) => {
                    if (r.name?.toLowerCase().includes('allenamento')) return false;
                    return true;
                  })
                  .reduce((acc: any, r: any) => {
                    const disc = r.discipline || 'Altro';
                    if (!acc[disc]) acc[disc] = [];
                    acc[disc].push(r);
                    return acc;
                  }, {})
              ).length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-slate-500 font-bold">Nessuna gara trovata per questo tiratore</p>
                </div>
              ) : (
                Object.entries(
                  (selectedShooterResults.results || [])
                    .filter((r: any) => {
                      if (r.name?.toLowerCase().includes('allenamento')) return false;
                      return true;
                    })
                    .reduce((acc: any, r: any) => {
                      const disc = r.discipline || 'Altro';
                      if (!acc[disc]) acc[disc] = [];
                      acc[disc].push(r);
                      return acc;
                    }, {})
                ).map(([discipline, results]: [string, any]) => (
                  <div key={discipline} className="mb-12 last:mb-0">
                    <div className="flex items-center gap-4 mb-6">
                      <h3 className="text-sm font-black text-white uppercase tracking-[0.3em] whitespace-nowrap">
                        {discipline}
                      </h3>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-orange-500/50 to-transparent"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {results.map((r: any, idx: number) => {
                        const layoutObj = getSeriesLayout(r.discipline as Discipline);
                        const tps = layoutObj.layout.reduce((a, b) => a + b, 0);
                        const avg = r.totalTargets > 0 ? (r.totalScore / r.totalTargets) * tps : 0;
                        
                        return (
                        <div key={idx} className="bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:border-orange-500/30 transition-all group relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-600/5 rounded-full -mr-8 -mt-8 blur-xl group-hover:bg-orange-600/10 transition-all"></div>
                          <div className="flex-1 relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-2 py-1 rounded-lg bg-slate-900 text-[9px] font-black text-slate-400 uppercase tracking-widest border border-slate-800">
                                {r.date}
                              </span>
                              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1 truncate max-w-[150px]">
                                <i className="fas fa-map-marker-alt text-orange-500/50"></i>
                                {r.location || 'Campo N.D.'}
                              </span>
                            </div>
                            <h4 
                              onClick={() => {
                                if (onEditCompetition && (currentUser?.role === 'admin' || (currentUser?.role === 'society' && r.location === currentUser?.society))) {
                                  onEditCompetition(r);
                                }
                              }}
                              className="text-sm font-black text-white group-hover:text-orange-500 transition-colors uppercase tracking-tight truncate cursor-pointer"
                            >
                              {r.name}
                            </h4>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Società TAV:</span>
                              <span className="text-[9px] font-bold text-orange-500/80 uppercase tracking-widest truncate">{r.location || 'Campo N.D.'}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-6 relative z-10">
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1 mb-0.5">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Rating RTE</p>
                                <div className="group relative">
                                  <i className="fas fa-info-circle text-[8px] text-slate-600 cursor-help hover:text-orange-500 transition-colors"></i>
                                  <div className="absolute top-full right-0 mt-1 w-48 p-2 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl hidden group-hover:block pointer-events-none z-[100] text-[9px] font-medium text-slate-400 normal-case tracking-normal leading-relaxed text-left">
                                    Rating calcolato sulla singola prestazione.
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-orange-500">
                                  {avg.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Punteggio</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-white">{r.totalScore}</span>
                                <span className="text-slate-600 font-black text-xs">/ {r.totalTargets}</span>
                              </div>
                            </div>
                            
                            { currentUser?.role === 'admin' && (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    const userForShare: User = {
                                      id: selectedShooterResults.userId,
                                      name: selectedShooterResults.userName,
                                      surname: selectedShooterResults.userSurname,
                                      email: '',
                                      role: UserRole.SHOOTER,
                                      society: selectedShooterResults.society,
                                      category: selectedShooterResults.category,
                                      qualification: selectedShooterResults.qualification,
                                      avatar: selectedShooterResults.avatar
                                    };
                                    setShareData({ comp: r, user: userForShare });
                                  }}
                                  className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-500 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-lg shadow-blue-600/5"
                                  title="Condividi"
                                >
                                  <i className="fas fa-share-alt text-xs"></i>
                                </button>
                                
                                <button 
                                  onClick={() => {
                                    if (onEditCompetition && (currentUser?.role === 'admin' || (currentUser?.role === 'society' && r.location === currentUser?.society))) {
                                      onEditCompetition(r);
                                    }
                                  }}
                                  className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20"
                                  title="Modifica"
                                >
                                  <i className="fas fa-edit text-xs"></i>
                                </button>
                                <button 
                                  onClick={() => {
                                    triggerConfirm(
                                      'Elimina Gara',
                                      `Sei sicuro di voler eliminare la gara "${r.name}"?`,
                                      async () => {
                                        if (onDeleteCompetition) {
                                          const success = await onDeleteCompetition(r.id);
                                          if (success !== false) {
                                            setAllResults(prev => prev.filter(res => res.id !== r.id));
                                            setSelectedShooterResults((prev: any) => ({
                                              ...prev,
                                              results: prev.results.filter((res: any) => res.id !== r.id)
                                            }));
                                          }
                                        }
                                      },
                                      'Elimina',
                                      'danger'
                                    );
                                  }}
                                  className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center hover:bg-red-500 transition-all shadow-lg shadow-red-600/20"
                                  title="Elimina"
                                >
                                  <i className="fas fa-trash-alt text-xs"></i>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ResultsManagement;
