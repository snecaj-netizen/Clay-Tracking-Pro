
import React from 'react';

interface MySocietyProps {
  onNavigate: (view: any, tab?: string) => void;
}

const MySociety: React.FC<MySocietyProps> = ({ onNavigate }) => {
  const sections = [
    {
      id: 'tiratori',
      title: 'Tiratori',
      description: 'Gestisci l\'elenco dei tiratori della tua società',
      icon: 'fa-users',
      color: 'bg-blue-600',
      tab: 'users'
    },
    {
      id: 'squadre',
      title: 'Squadre',
      description: 'Crea e gestisci le squadre per le competizioni',
      icon: 'fa-users-cog',
      color: 'bg-indigo-600',
      tab: 'teams'
    },
    {
      id: 'hall-of-fame',
      title: 'Hall of Fame',
      description: 'Visualizza i record e i campioni della società',
      icon: 'fa-award',
      color: 'bg-amber-500',
      tab: 'hall-of-fame'
    },
    {
      id: 'risultati-gare',
      title: 'Risultati Gare',
      description: 'Monitora le prestazioni e il Rating RTE dei tuoi tiratori',
      icon: 'fa-poll',
      color: 'bg-orange-600',
      tab: 'results'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">La mia Società</h2>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Gestione interna della società TAV</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onNavigate('admin', section.tab)}
            className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left transition-all hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-600/10 active:scale-[0.98] overflow-hidden"
          >
            <div className={`w-12 h-12 ${section.color} rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
              <i className={`fas ${section.icon} text-xl text-white`}></i>
            </div>
            
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1 group-hover:text-orange-500 transition-colors">
              {section.title}
            </h3>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              {section.description}
            </p>

            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="fas fa-arrow-right text-orange-500"></i>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MySociety;
