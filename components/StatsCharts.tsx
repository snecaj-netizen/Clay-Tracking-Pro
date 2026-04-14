
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Competition } from '../types';

interface StatsChartsProps {
  competitions: Competition[];
}

const StatsCharts: React.FC<StatsChartsProps> = ({ competitions }) => {
  // Filtriamo solo le sessioni con punteggio > 0
  const completedCompetitions = React.useMemo(() => {
    return competitions.filter(c => c.totalScore > 0);
  }, [competitions]);

  // Ordinamento cronologico dei dati per il grafico (dal più vecchio al più recente)
  const chartData = [...completedCompetitions]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(c => ({
      date: new Date(c.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
      score: c.totalScore,
      average: parseFloat(c.averagePerSeries.toFixed(1)),
      discipline: c.discipline.split(' ')[0]
    }));

  // Aggregazione per disciplina basata solo su gare concluse
  const disciplineData = Object.values(
    completedCompetitions.reduce((acc, c) => {
      const disc = c.discipline.split(' ')[0];
      if (!acc[disc]) acc[disc] = { name: disc, total: 0, count: 0 };
      acc[disc].total += c.averagePerSeries;
      acc[disc].count += 1;
      return acc;
    }, {} as Record<string, { name: string; total: number; count: number }>)
  ).map((d: { name: string; total: number; count: number }) => ({
    name: d.name,
    avg: parseFloat((d.total / d.count).toFixed(1))
  }));

  if (completedCompetitions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Andamento Media (Solo Concluse)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="var(--chart-text)" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke="var(--chart-text)" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                domain={[0, 25]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--chart-tooltip-bg)', 
                  border: '1px solid var(--chart-tooltip-border)', 
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
                itemStyle={{ color: '#f97316', fontWeight: 'bold' }}
                labelStyle={{ color: 'var(--chart-tooltip-label)', fontWeight: 'bold', marginBottom: '4px' }}
              />
              <Line 
                type="monotone" 
                dataKey="average" 
                stroke="#f97316" 
                strokeWidth={4} 
                dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }} 
                activeDot={{ r: 8, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Media per Disciplina</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={disciplineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="var(--chart-text)" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke="var(--chart-text)" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                domain={[0, 25]}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ 
                  backgroundColor: 'var(--chart-tooltip-bg)', 
                  border: '1px solid var(--chart-tooltip-border)', 
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
                itemStyle={{ color: '#f97316', fontWeight: 'bold' }}
                labelStyle={{ color: 'var(--chart-tooltip-label)', fontWeight: 'bold', marginBottom: '4px' }}
              />
              <Bar dataKey="avg" radius={[8, 8, 0, 0]} barSize={40}>
                {disciplineData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#f97316' : '#ea580c'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default StatsCharts;
