import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SocietyEvent, PrizeSetting, User } from '../types';
import ShooterSearch from './ShooterSearch';
import TeamManager from './TeamManager';
import QuickAddShooterModal from './QuickAddShooterModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';

interface EventResultsManagerProps {
  event: SocietyEvent;
  token: string;
  user?: User | null;
  onClose: () => void;
  readOnly?: boolean;
  triggerConfirm?: (title: string, message: string, onConfirm: () => void, confirmText?: string, variant?: 'danger' | 'primary') => void;
  triggerToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onEventUpdate?: () => void;
  societies?: any[];
}

const EventResultsManager: React.FC<EventResultsManagerProps> = ({ event, token, user, onClose, readOnly = false, triggerConfirm, triggerToast, onEventUpdate, societies = [] }) => {
  const [results, setResults] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'generale' | 'categoria' | 'qualifica' | 'societa' | 'squadre'>('generale');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedQualification, setSelectedQualification] = useState<string>('');
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [prizeSettings, setPrizeSettings] = useState<PrizeSetting[]>([]);
  const [showPrizeConfig, setShowPrizeConfig] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [rankingPreference, setRankingPreference] = useState<'categoria' | 'qualifica'>('categoria');
  const [rankingPreferenceOverride, setRankingPreferenceOverride] = useState<'categoria' | 'qualifica' | null>(null);
  const [hasSocietyRanking, setHasSocietyRanking] = useState(event.has_society_ranking || false);
  const [hasTeamRanking, setHasTeamRanking] = useState(event.has_team_ranking || false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [totalTargets, setTotalTargets] = useState(event.targets || 100);
  const [series, setSeries] = useState<string[]>(() => Array(Math.ceil((event.targets || 100) / 25)).fill('0'));
  const [detailedScores, setDetailedScores] = useState<boolean[][]>(() => Array.from({ length: Math.ceil((event.targets || 100) / 25) }, () => []));
  const [expandedSeries, setExpandedSeries] = useState<number | null>(null);
  const [shootOff, setShootOff] = useState('');
  const [showQuickAddShooter, setShowQuickAddShooter] = useState(false);

  const categories = useMemo(() => Array.from(new Set(results.map(r => r.category_at_time || r.category).filter(Boolean))).sort(), [results]);
  const qualifications = useMemo(() => Array.from(new Set(results.map(r => r.qualification_at_time || r.qualification).filter(Boolean))).sort(), [results]);

  const canExportPDF = user?.role === 'admin' || user?.role === 'society';

  // Removed useEffect that was overwriting series/detailedScores on totalTargets change
  // Now handled in onChange and handleEditResult
  
  useEffect(() => {
    fetchData();
    if (event.prize_settings) {
      try {
        setPrizeSettings(JSON.parse(event.prize_settings));
      } catch {
        setPrizeSettings([]);
      }
    } else {
      setPrizeSettings([]);
    }
  }, [event.id, event.prize_settings]);

  useEffect(() => {
    setHasSocietyRanking(event.has_society_ranking || false);
    setHasTeamRanking(event.has_team_ranking || false);
  }, [event.has_society_ranking, event.has_team_ranking]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch results
      const resResults = await fetch(`/api/events/${event.id}/results`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resResults.ok) {
        const data = await resResults.json();
        setResults(data);
      }

      // Fetch teams
      const resTeams = await fetch(`/api/events/${event.id}/teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resTeams.ok) {
        const data = await resTeams.json();
        setTeams(data);
      }

      // Fetch users (shooters) regardless of readOnly to show names in team rankings
      const resUsers = await fetch('/api/admin/users?limit=10000', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resUsers.ok) {
        const data = await resUsers.json();
        let filteredUsers = (data.users || []).filter((u: any) => u.role === 'user' || u.role === 'admin');
        
        // For society events, only show shooters from that society
        if (event.visibility === 'Gara di Società') {
          const eventLoc = (event.location || '').toLowerCase().trim();
          filteredUsers = filteredUsers.filter((u: any) => (u.society || '').toLowerCase().trim() === eventLoc);
        }
        
        setUsers(filteredUsers);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!triggerConfirm) return;
    
    triggerConfirm(
      'Convalida Gara',
      'Sei sicuro di voler convalidare questa gara? Una volta convalidata, non potrai più modificare i risultati. Solo l\'amministratore potrà riaprirla.',
      async () => {
        try {
          const res = await fetch(`/api/events/${event.id}/validate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            if (onEventUpdate) onEventUpdate();
            if (triggerToast) {
              triggerToast('Convalida eseguita correttamente!', 'success');
            } else {
              alert('Convalida eseguita correttamente!');
            }
            onClose();
          } else {
            let errorMessage = 'Errore durante la convalida';
            try {
              const data = await res.json();
              errorMessage = data.error || errorMessage;
            } catch (e) {
              console.error('Failed to parse error response:', e);
              if (res.status === 403) errorMessage = 'Non hai i permessi per questa operazione.';
              else if (res.status === 404) errorMessage = 'Gara non trovata.';
            }
            if (triggerToast) {
              triggerToast(errorMessage, 'error');
            } else {
              alert(errorMessage);
            }
          }
        } catch (error) {
          console.error('Error validating event:', error);
          if (triggerToast) {
            triggerToast('Errore di connessione durante la convalida', 'error');
          } else {
            alert('Errore di connessione durante la convalida');
          }
        }
      }
    );
  };

  const toggleExpandSeries = (idx: number) => {
    if (expandedSeries === idx) {
      setExpandedSeries(null);
    } else {
      setExpandedSeries(idx);
      // Initialize with 25 hits (green) by default if not already set
      if (!detailedScores[idx] || detailedScores[idx].length === 0) {
        const newDetailed = [...detailedScores];
        newDetailed[idx] = Array(25).fill(true);
        setDetailedScores(newDetailed);
        
        const newScores = [...series];
        newScores[idx] = '25';
        setSeries(newScores);
      }
    }
  };

  const handleDetailedScoreChange = (seriesIndex: number, targetIndex: number) => {
    setIsDirty(true);
    setDetailedScores(prev => {
      const newDetailed = [...prev];
      const newSeries = [...(newDetailed[seriesIndex] || Array(25).fill(true))];
      newSeries[targetIndex] = !newSeries[targetIndex];
      newDetailed[seriesIndex] = newSeries;
      
      const newScores = [...series];
      newScores[seriesIndex] = newSeries.filter(Boolean).length.toString();
      setSeries(newScores);
      
      return newDetailed;
    });
  };

  const calculateTotal = () => {
    return series.reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  };

  const sortResults = (a: any, b: any) => {
    // 1. Sort by total score descending
    if (b.totalscore !== a.totalscore) {
      return (b.totalscore || 0) - (a.totalscore || 0);
    }
    
    // 2. Sort by shoot-off score descending
    const aShootOff = a.shoot_off !== null && a.shoot_off !== undefined ? a.shoot_off : -1;
    const bShootOff = b.shoot_off !== null && b.shoot_off !== undefined ? b.shoot_off : -1;
    if (bShootOff !== aShootOff) {
      return bShootOff - aShootOff;
    }
    
    // 3. FITAV Countback Rule (zeroes from the end)
    // Compare detailed scores from the last series and last target backwards
    if (a.detailedScores && b.detailedScores) {
      // Find the maximum number of series
      const maxSeries = Math.max(a.detailedScores.length, b.detailedScores.length);
      
      for (let sIdx = maxSeries - 1; sIdx >= 0; sIdx--) {
        const aSeries = a.detailedScores[sIdx] || [];
        const bSeries = b.detailedScores[sIdx] || [];
        
        // Assuming 25 targets per series
        for (let tIdx = 24; tIdx >= 0; tIdx--) {
          const aHit = aSeries[tIdx] === true;
          const bHit = bSeries[tIdx] === true;
          
          if (aHit !== bHit) {
            // The one with a hit (true) wins over the one with a miss (false)
            return aHit ? -1 : 1;
          }
        }
      }
    }
    
    // If still tied, sort by name
    return `${a.user_surname || ''} ${a.user_name || ''}`.localeCompare(`${b.user_surname || ''} ${b.user_name || ''}`);
  };

  const generatePDF = (shouldDownload = true) => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CLAY TRACKER PRO', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(event.status === 'validated' ? 'Classifica Finale' : 'Classifica Provvisoria', pageWidth / 2, 22, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(event.name.toUpperCase(), pageWidth / 2, 32, { align: 'center' });
    
    let currentY = 50;
    
    // Event Info
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SOCIETÀ:', 20, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(event.location || 'N/D', 45, currentY);
    
    doc.setFont('helvetica', 'bold');
    doc.text('DATE:', 120, currentY);
    doc.setFont('helvetica', 'normal');
    const startDate = event.start_date ? new Date(event.start_date).toLocaleDateString('it-IT') : 'N/D';
    const endDate = event.end_date ? new Date(event.end_date).toLocaleDateString('it-IT') : null;
    const dateText = endDate && endDate !== startDate ? `${startDate} - ${endDate}` : startDate;
    doc.text(dateText, 135, currentY);
    
    currentY += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('DISCIPLINA:', 20, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(event.discipline || 'N/D', 45, currentY);
    
    doc.setFont('helvetica', 'bold');
    doc.text('PIATTELLI:', 120, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text((event.targets || 100).toString(), 145, currentY);
    
    currentY += 15;

    const pdfMaxSeriesCount = results.length > 0 
      ? Math.max(...results.map(r => Array.isArray(r.scores) ? r.scores.length : 0))
      : 0;

    const renderTable = (title: string, data: any[]) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(234, 88, 12); // orange-600
      doc.text(title.toUpperCase(), 20, currentY);
      currentY += 5;

      const seriesHeaders = Array.from({ length: pdfMaxSeriesCount }).map((_, i) => `S${i + 1}`);
      const headers = [['Pos', 'P', 'Tiratore', 'Cat/Qual', ...seriesHeaders, 'Tot', 'S.O.']];

      autoTable(doc, {
        startY: currentY,
        head: headers,
        body: data.map((r, index) => {
          const isPrize = getPrizeStatus(r);
          const seriesData = Array.from({ length: pdfMaxSeriesCount }).map((_, i) => 
            r.scores && r.scores[i] !== undefined ? r.scores[i] : '-'
          );
          
          return [
            index + 1,
            isPrize ? 'P' : '',
            `${r.user_surname || ''} ${r.user_name || ''}${r.shooter_code ? `\n(${r.shooter_code})` : ''}`,
            `${r.category_at_time || r.category || '-'}/${r.qualification_at_time || r.qualification || '-'}`,
            ...seriesData,
            r.totalscore || 0,
            r.shoot_off || '-'
          ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 10 }, // Pos
          1: { cellWidth: 8, halign: 'center' }, // P
          2: { cellWidth: 'auto' }, // Tiratore
        },
        margin: { left: 15, right: 15 },
        didDrawPage: (data: any) => {
          currentY = data.cursor.y + 15;
        }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;
    };

    // 1. Classifica Generale
    const sortedGeneral = [...results].sort(sortResults);
    renderTable('Classifica Generale', sortedGeneral);

    // 2. Classifiche per Categoria
    categories.forEach(cat => {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      const catResults = results.filter(r => {
        const effectivePref = event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria';
        if (effectivePref === 'qualifica') return false;
        return (r.category_at_time || r.category) === cat;
      }).sort(sortResults);
      if (catResults.length > 0) {
        renderTable(`Classifica Categoria: ${cat}`, catResults);
      }
    });

    // 3. Classifiche per Qualifica
    qualifications.forEach(qual => {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      const qualResults = results.filter(r => {
        const effectivePref = event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria';
        if (effectivePref !== 'qualifica') return false;
        return (r.qualification_at_time || r.qualification) === qual;
      }).sort(sortResults);
      if (qualResults.length > 0) {
        renderTable(`Classifica Qualifica: ${qual}`, qualResults);
      }
    });

    // 4. Classifica Società
    if (event.has_society_ranking && societyRanking.length > 0) {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(234, 88, 12); // orange-600
      doc.text('CLASSIFICA SOCIETÀ', 20, currentY);
      currentY += 5;

      const headers = [['Pos', 'Società', 'Tiratori', 'Totale']];
      
      const bodyData = societyRanking.map((soc, index) => {
        const shootersStr = soc.shooters.map(s => 
          `${s.user_surname} ${s.user_name} (${s.totalscore})`
        ).join('\n');
        
        return [
          index + 1,
          soc.societyName,
          shootersStr,
          soc.totalScore
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: headers,
        body: bodyData,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10 }, // Pos
          1: { cellWidth: 40 }, // Società
          2: { cellWidth: 'auto' }, // Tiratori
          3: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }, // Totale
        },
        margin: { left: 15, right: 15 },
        didDrawPage: (data: any) => {
          currentY = data.cursor.y + 15;
        }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // 5. Classifica Squadre
    if (event.has_team_ranking && teams.length > 0) {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(234, 88, 12); // orange-600
      doc.text('CLASSIFICA SQUADRE', 20, currentY);
      currentY += 5;

      const teamRankings = teams.map(team => {
        const teamMembers = (team.member_ids || []).map((id: string) => {
          const result = results.find(r => r.user_id === id);
          const user = users.find(u => u.id === id);
          return {
            id: id,
            user_id: id,
            user_name: result?.user_name || user?.name || 'Sconosciuto',
            user_surname: result?.user_surname || user?.surname || '',
            totalscore: result?.totalscore || 0
          };
        });
        const totalScore = teamMembers.reduce((sum: number, m: any) => sum + (m.totalscore || 0), 0);
        return {
          ...team,
          totalScore,
          members: teamMembers
        };
      }).sort((a, b) => b.totalScore - a.totalScore);

      const headers = [['Pos', 'Squadra', 'Tiratori', 'Totale']];
      
      const bodyData = teamRankings.map((team, index) => {
        const typeStr = team.type ? ` (${team.type})` : '';
        const nameStr = `${team.name}\n${team.society}${typeStr}`;
        const shootersStr = team.members.map((s: any) => 
          `${s.user_surname} ${s.user_name} (${s.totalscore})`
        ).join('\n');
        
        return [
          index + 1,
          nameStr,
          shootersStr,
          team.totalScore
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: headers,
        body: bodyData,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10 }, // Pos
          1: { cellWidth: 40 }, // Squadra
          2: { cellWidth: 'auto' }, // Tiratori
          3: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }, // Totale
        },
        margin: { left: 15, right: 15 },
        didDrawPage: (data: any) => {
          currentY = data.cursor.y + 15;
        }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Footer on each page
    const pageCount = (doc as any).internal.getNumberOfPages();
    console.log(`PDF generated with ${pageCount} pages`);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Pagina ${i} di ${pageCount} - Generato da Clay Tracker Pro`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    if (shouldDownload) {
      console.log('Downloading PDF...');
      doc.save(`Risultati_${event.name.replace(/\s+/g, '_')}.pdf`);
    } else {
      const blob = doc.output('blob');
      console.log('Returning PDF Blob:', blob);
      return blob;
    }
  };

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const closePDFPreview = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setShowPDFPreview(false);
    setPdfUrl(null);
  };

  const handlePreviewPDF = () => {
    if (results.length === 0) {
      if (triggerToast) triggerToast('Nessun risultato da esportare', 'info');
      return;
    }
    
    setIsGeneratingPDF(true);
    
    // Small timeout to allow UI to update and not block main thread
    setTimeout(() => {
      try {
        console.log('Generating PDF for preview...');
        const blob = generatePDF(false);
        console.log('PDF Blob generated:', blob);
        if (blob instanceof Blob) {
          const url = URL.createObjectURL(blob);
          console.log('PDF Preview URL created:', url);
          setPdfUrl(url);
          setShowPDFPreview(true);
        } else {
          console.error('PDF generation did not return a Blob:', blob);
          throw new Error('La generazione del PDF non ha restituito un formato valido');
        }
      } catch (err: any) {
        console.error('Error generating PDF preview:', err);
        if (triggerToast) triggerToast('Errore nella generazione dell\'anteprima PDF: ' + err.message, 'error');
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 100);
  };
  
  const filteredResults = [...results].filter(r => {
    const rCat = r.category_at_time || r.category;
    const rQual = r.qualification_at_time || r.qualification;
    
    // Priority: Event Override > Competition Override > Shooter Preference
    const effectivePref = event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria';

    if (viewMode === 'categoria') {
      if (!selectedCategory) return true;
      // If considering qualification, shooters with 'qualifica' effective preference don't show up in category ranking
      if (effectivePref === 'qualifica') return false;
      return rCat === selectedCategory;
    }
    if (viewMode === 'qualifica') {
      if (!selectedQualification) return true;
      // Only shooters with 'qualifica' effective preference show up in qualification ranking if considering qualification
      return rQual === selectedQualification && effectivePref === 'qualifica';
    }
    return true;
  }).sort(sortResults);

  const societyRanking = useMemo(() => {
    if (!event.has_society_ranking) return [];
    
    const societyMap = new Map<string, any[]>();
    
    results.forEach(r => {
      const soc = r.society_at_time || r.society;
      if (!soc) return;
      if (!societyMap.has(soc)) {
        societyMap.set(soc, []);
      }
      societyMap.get(soc)!.push(r);
    });

    const isRestrictedCategory = (cat: string | null | undefined) => {
      if (!cat) return false;
      const c = cat.toLowerCase().trim();
      return c === 'eccellenza' || c === '1' || c === '1°' || c === '1a' || c === '1^' || c === '1*';
    };

    const ranking = Array.from(societyMap.entries()).map(([societyName, shooters]) => {
      // Sort shooters by score descending
      const sortedShooters = [...shooters].sort(sortResults);
      
      const top3 = [];
      let restrictedCount = 0;
      
      for (const shooter of sortedShooters) {
        if (top3.length >= 3) break;
        
        const cat = shooter.category_at_time || shooter.category;
        const isRestricted = isRestrictedCategory(cat);
        
        if (isRestricted) {
          if (restrictedCount < 1) {
            top3.push(shooter);
            restrictedCount++;
          }
        } else {
          top3.push(shooter);
        }
      }

      const totalScore = top3.reduce((sum, s) => sum + (s.totalscore || 0), 0);
      
      return {
        societyName,
        totalScore,
        shooters: top3,
        allShooters: sortedShooters
      };
    });

    // Sort societies by total score descending
    return ranking.sort((a, b) => b.totalScore - a.totalScore);
  }, [results, event.has_society_ranking]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      if (triggerToast) triggerToast('Seleziona un tiratore', 'error');
      else alert('Seleziona un tiratore');
      return;
    }
    
    // Check if shooter already has a result
    const existingResult = results.find(r => r.user_id.toString() === selectedUserId);
    
    if (existingResult && !editingResultId) {
      if (triggerConfirm) {
        triggerConfirm(
          'Tiratore già presente',
          `Il tiratore ${existingResult.user_surname} ${existingResult.user_name} ha già un risultato registrato per questa gara. Vuoi sostituirlo con i nuovi dati?`,
          () => performSave(existingResult.id),
          'Sostituisci',
          'primary'
        );
      }
      return;
    }

    await performSave(editingResultId);
  };

  const performSave = async (resultIdToUse: string | null) => {
    setSaving(true);
    try {
      const totalScore = calculateTotal();
      const completedSeriesCount = series.filter(s => (parseInt(s) || 0) > 0).length || 1;
      const averagePerSeries = totalScore / completedSeriesCount;
      
      const payload = {
        id: resultIdToUse || `evt_${event.id}_${selectedUserId}_${Date.now()}`,
        userId: parseInt(selectedUserId),
        eventId: event.id,
        name: event.name,
        date: event.start_date.split('T')[0],
        location: event.location,
        discipline: event.discipline,
        level: event.type,
        totalScore,
        totalTargets,
        averagePerSeries,
        ranking_preference: rankingPreference,
        ranking_preference_override: rankingPreferenceOverride,
        scores: series.map(s => parseInt(s) || 0),
        detailedScores: detailedScores,
        shootOff: shootOff ? parseInt(shootOff) : null
      };

      const isUpdate = !!resultIdToUse;
      const res = await fetch(isUpdate ? `/api/competitions/${resultIdToUse}` : '/api/competitions', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore durante il salvataggio');
      }

      // Reset form and refresh
      const numSeries = Math.ceil((event.targets || 100) / 25);
      setSelectedUserId('');
      setSeries(Array(numSeries).fill('0'));
      setDetailedScores(Array.from({ length: numSeries }, () => []));
      setShootOff('');
      setRankingPreference('categoria');
      setEditingResultId(null);
      setExpandedSeries(null);
      setIsDirty(false);
      fetchData();
    } catch (err: any) {
      if (triggerToast) triggerToast(err.message, 'error');
      else alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditResult = (r: any) => {
    setEditingResultId(r.id);
    setSelectedUserId(r.user_id.toString());
    setSeries(r.scores.map((s: any) => s.toString()));
    setDetailedScores(r.detailedScores || r.scores.map(() => []));
    setShootOff(r.shoot_off !== null ? r.shoot_off.toString() : '');
    setRankingPreference(r.ranking_preference || 'categoria');
    setRankingPreferenceOverride(r.ranking_preference_override || null);
    setTotalTargets(r.totaltargets || event.targets || 100);
    setExpandedSeries(null);
    setIsDirty(false);
    // Scroll to form
    const formElement = document.getElementById('result-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const maxSeriesCount = React.useMemo(() => {
    if (filteredResults.length === 0) return 0;
    return Math.max(...filteredResults.map(r => Array.isArray(r.scores) ? r.scores.length : 0));
  }, [filteredResults]);

  const handleSavePrizeSettings = async () => {
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prize_settings: JSON.stringify(prizeSettings) })
      });
      if (res.ok) {
        setShowPrizeConfig(false);
        if (onEventUpdate) onEventUpdate();
        if (triggerToast) triggerToast('Configurazione premi salvata con successo', 'success');
        else alert('Configurazione premi salvata con successo');
      } else {
        if (triggerToast) triggerToast('Errore nel salvataggio della configurazione premi', 'error');
        else alert('Errore nel salvataggio della configurazione premi');
      }
    } catch (err) {
      console.error('Error saving prize settings:', err);
      if (triggerToast) triggerToast('Errore nel salvataggio della configurazione premi', 'error');
      else alert('Errore nel salvataggio della configurazione premi');
    }
  };

  const handleSaveEventSettings = async () => {
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ has_society_ranking: hasSocietyRanking, has_team_ranking: hasTeamRanking })
      });
      if (res.ok) {
        if (onEventUpdate) onEventUpdate();
        if (triggerToast) triggerToast('Impostazioni gara salvate con successo', 'success');
        else alert('Impostazioni gara salvate con successo');
      } else {
        if (triggerToast) triggerToast('Errore nel salvataggio delle impostazioni', 'error');
        else alert('Errore nel salvataggio delle impostazioni');
      }
    } catch (err) {
      console.error('Error saving event settings:', err);
      if (triggerToast) triggerToast('Errore nel salvataggio delle impostazioni', 'error');
      else alert('Errore nel salvataggio delle impostazioni');
    }
  };

  const getPrizeStatus = (result: any) => {
    if (!prizeSettings || prizeSettings.length === 0) return false;

    const rCat = result.category_at_time || result.category;
    const rQual = result.qualification_at_time || result.qualification;
    
    // Priority: Event Override > Competition Override > Shooter Preference
    const effectivePref = event.ranking_preference_override || result.ranking_preference_override || result.ranking_preference || 'categoria';

    // Calculate ranking in category
    if (effectivePref === 'categoria') {
      const categorySetting = prizeSettings.find(s => s.type === 'categoria' && s.name === rCat);
      if (categorySetting) {
        const catResults = results
          .filter(r => (r.category_at_time || r.category) === rCat && (event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria') === 'categoria')
          .sort(sortResults);
        const rank = catResults.findIndex(r => r.id === result.id);
        if (rank !== -1 && rank < categorySetting.count) return true;
      }
    }

    // Calculate ranking in qualification
    if (effectivePref === 'qualifica') {
      const qualificationSetting = prizeSettings.find(s => s.type === 'qualifica' && s.name === rQual);
      if (qualificationSetting) {
        const qualResults = results
          .filter(r => (r.qualification_at_time || r.qualification) === rQual && (event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria') === 'qualifica')
          .sort(sortResults);
        const rank = qualResults.findIndex(r => r.id === result.id);
        if (rank !== -1 && rank < qualificationSetting.count) return true;
      }
    }

    return false;
  };

  const handleDeleteResult = async (id: string) => {
    const confirmDelete = () => {
      fetch(`/api/competitions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => {
        if (res.ok) fetchData();
      }).catch(err => console.error('Error deleting result:', err));
    };

    if (triggerConfirm) {
      triggerConfirm(
        'Elimina Risultato',
        'Sei sicuro di voler eliminare questo risultato? Questa azione non può essere annullata.',
        confirmDelete,
        'Elimina',
        'danger'
      );
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (triggerConfirm) {
        triggerConfirm(
          'Modifiche non salvate',
          'Hai delle modifiche non salvate. Vuoi uscire comunque?',
          onClose,
          'Esci',
          'danger'
        );
      }
    } else {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1050] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-none sm:rounded-3xl w-full h-full sm:h-auto sm:max-w-[98vw] max-h-[100dvh] sm:max-h-[98vh] flex flex-col overflow-hidden border-0 sm:border border-slate-800 shadow-2xl">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0 shadow-lg relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-600/20 text-orange-500 flex items-center justify-center text-lg sm:text-xl shadow-inner border border-orange-500/20">
              <i className="fas fa-trophy"></i>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-none">
                {readOnly ? 'Risultati Gara' : 'Gestione Risultati'}
              </h2>
              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-orange-500 font-bold tracking-widest text-[9px] sm:text-[10px] uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                  {event.name}
                </p>
                {event.status === 'validated' && !readOnly && (
                  <span className="px-2 py-0.5 rounded-md bg-green-600/20 text-green-500 text-[8px] font-black uppercase tracking-widest border border-green-500/30">
                    Convalidata
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && event.status !== 'validated' && results.length > 0 && (
              <button 
                onClick={handleValidate}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-green-500 transition-all shadow-lg flex items-center gap-2"
              >
                <i className="fas fa-check-double"></i>
                <span className="hidden sm:inline">Convalida Gara</span>
              </button>
            )}
            <button 
              onClick={handleClose} 
              className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95 shadow-lg border border-slate-700"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
          {/* Form Section */}
          {!readOnly && event.status !== 'validated' && (
            <div className="w-full md:w-1/3 p-4 sm:p-6 border-b md:border-b-0 md:border-r border-slate-800 md:overflow-y-auto bg-slate-900/50 shrink-0 md:shrink">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white uppercase tracking-widest">
                  {editingResultId ? 'Modifica Risultato' : 'Inserisci Risultato'}
                </h3>
                <button 
                  type="button"
                  onClick={() => setShowPrizeConfig(!showPrizeConfig)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${showPrizeConfig ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-orange-500 hover:bg-slate-800'}`}
                  title="Configura Premi"
                >
                  <i className="fas fa-cog"></i>
                </button>
              </div>

              {showPrizeConfig && (
                <div className="mb-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Configurazione Premi</h4>
                    <button 
                      onClick={handleSavePrizeSettings}
                      className="px-3 py-1 rounded-lg bg-green-600 text-white text-[10px] font-bold hover:bg-green-500 transition-all shadow-lg"
                    >
                      Salva
                    </button>
                  </div>
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Categories */}
                    <div>
                      <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Categorie</h5>
                      <div className="space-y-2">
                        {categories.length === 0 ? (
                          <p className="text-[9px] text-slate-600 italic">Nessuna categoria trovata</p>
                        ) : categories.map(cat => {
                          const setting = prizeSettings.find(s => s.type === 'categoria' && s.name === cat);
                          return (
                            <div key={cat as string} className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-300 truncate flex-1">{cat as string}</span>
                              <input 
                                type="number" 
                                min="0" 
                                value={setting?.count || 0}
                                onChange={(e) => {
                                  const count = parseInt(e.target.value) || 0;
                                  setPrizeSettings(prev => {
                                    const filtered = prev.filter(s => !(s.type === 'categoria' && s.name === cat));
                                    if (count > 0) {
                                      return [...filtered, { type: 'categoria', name: cat as string, count }];
                                    }
                                    return filtered;
                                  });
                                }}
                                className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center text-white text-[11px] focus:border-orange-500 outline-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Qualifications */}
                    <div>
                      <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Qualifiche</h5>
                      <div className="space-y-2">
                        {qualifications.length === 0 ? (
                          <p className="text-[9px] text-slate-600 italic">Nessuna qualifica trovata</p>
                        ) : qualifications.map(qual => {
                          const setting = prizeSettings.find(s => s.type === 'qualifica' && s.name === qual);
                          return (
                            <div key={qual as string} className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-300 truncate flex-1">{qual as string}</span>
                              <input 
                                type="number" 
                                min="0" 
                                value={setting?.count || 0}
                                onChange={(e) => {
                                  const count = parseInt(e.target.value) || 0;
                                  setPrizeSettings(prev => {
                                    const filtered = prev.filter(s => !(s.type === 'qualifica' && s.name === qual));
                                    if (count > 0) {
                                      return [...filtered, { type: 'qualifica', name: qual as string, count }];
                                    }
                                    return filtered;
                                  });
                                }}
                                className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center text-white text-[11px] focus:border-orange-500 outline-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <form id="result-form" onSubmit={handleSave} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tiratore</label>
                  <div className="flex gap-2">
                    <ShooterSearch 
                      value={selectedUserId} 
                      onChange={(val) => {
                        setSelectedUserId(val);
                        setIsDirty(true);
                      }}
                      shooters={users}
                      useId={true}
                      placeholder="Cerca Tiratore (Nome, Cognome o Codice)..."
                      className="flex-1"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowQuickAddShooter(true)}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-orange-500 hover:bg-orange-600 hover:text-white border border-slate-700 hover:border-orange-500 transition-all active:scale-95 flex items-center justify-center shadow-lg"
                      title="Aggiungi nuovo tiratore"
                    >
                      <i className="fas fa-user-plus"></i>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Serie</label>
                    <span className="text-[9px] text-orange-500 font-medium italic">Clicca sul numero per inserire il dettaglio piattelli</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {series.map((s, i) => (
                      <div key={i} className="relative">
                        <input 
                          type="number" 
                          min="0" 
                          max="25"
                          value={s}
                          readOnly
                          onClick={() => toggleExpandSeries(i)}
                          placeholder={`S${i+1}`}
                          className={`w-full bg-slate-950 border ${expandedSeries === i ? 'border-orange-500' : 'border-slate-800'} rounded-lg px-2 py-2 text-center text-white focus:border-orange-600 outline-none cursor-pointer text-sm font-bold`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => toggleExpandSeries(i)}
                          className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] transition-colors ${detailedScores[i] && detailedScores[i].length > 0 ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                          title="Dettaglio Piattelli"
                        >
                          <i className="fas fa-crosshairs"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {expandedSeries !== null && (
                    <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 animate-in fade-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dettaglio Serie {expandedSeries + 1}</h4>
                        <button type="button" onClick={() => setExpandedSeries(null)} className="text-slate-500 hover:text-white">
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {Array.from({ length: 25 }).map((_, targetIdx) => {
                          const isHit = detailedScores[expandedSeries]?.[targetIdx];
                          return (
                            <button
                              key={targetIdx}
                              type="button"
                              onClick={() => handleDetailedScoreChange(expandedSeries, targetIdx)}
                              className={`w-full aspect-square rounded-full border-2 transition-all active:scale-90 flex items-center justify-center text-[10px] font-bold ${isHit ? 'bg-[#a3e635] border-[#65a30d] text-green-900 shadow-[0_0_10px_rgba(163,230,53,0.2)]' : 'bg-[#ef4444] border-[#b91c1c] text-red-900 shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}
                            >
                              {targetIdx + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tiratore iscritto per:</label>
                  <select 
                    value={rankingPreference} 
                    onChange={(e) => {
                      setRankingPreference(e.target.value as 'categoria' | 'qualifica');
                      setIsDirty(true);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-600 outline-none"
                  >
                    <option value="categoria">Categoria</option>
                    <option value="qualifica">Qualifica</option>
                  </select>
                </div>

                {/* Competition Override */}
                <div className="p-3 bg-orange-600/10 rounded-xl border border-orange-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-orange-500">
                    <i className="fas fa-exclamation-triangle text-[10px]"></i>
                    <h4 className="text-[9px] font-black uppercase tracking-widest">Override Classifica (Società)</h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setRankingPreferenceOverride(null); setIsDirty(true); }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                        rankingPreferenceOverride === null 
                          ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20' 
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-orange-500/50'
                      }`}
                    >
                      Nessuno
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRankingPreferenceOverride('categoria'); setIsDirty(true); }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                        rankingPreferenceOverride === 'categoria' 
                          ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20' 
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-orange-500/50'
                      }`}
                    >
                      Forza Categoria
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRankingPreferenceOverride('qualifica'); setIsDirty(true); }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                        rankingPreferenceOverride === 'qualifica' 
                          ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20' 
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-orange-500/50'
                      }`}
                    >
                      Forza Qualifica
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Classifica Società (Gara)</label>
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasSocietyRankingResult"
                        checked={hasSocietyRanking}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setHasSocietyRanking(checked);
                          if (!checked && viewMode === 'societa') setViewMode('generale');
                          // Auto-save the event setting
                          fetch(`/api/events/${event.id}`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ has_society_ranking: checked })
                          }).then(res => {
                            if (res.ok && onEventUpdate) onEventUpdate();
                          });
                        }}
                        className="w-4 h-4 rounded border-slate-700 text-orange-600 focus:ring-orange-500 bg-slate-950"
                      />
                      <label htmlFor="hasSocietyRankingResult" className="text-xs font-bold text-slate-300 cursor-pointer">
                        Abilita Classifica Società
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Classifica Squadre (Gara)</label>
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasTeamRankingResult"
                        checked={hasTeamRanking}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setHasTeamRanking(checked);
                          if (!checked && viewMode === 'squadre') setViewMode('generale');
                          // Auto-save the event setting
                          fetch(`/api/events/${event.id}`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ has_team_ranking: checked })
                          }).then(res => {
                            if (res.ok && onEventUpdate) onEventUpdate();
                          });
                        }}
                        className="w-4 h-4 rounded border-slate-700 text-orange-600 focus:ring-orange-500 bg-slate-950"
                      />
                      <label htmlFor="hasTeamRankingResult" className="text-xs font-bold text-slate-300 cursor-pointer">
                        Abilita Classifica Squadre
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Spareggio (Opzionale)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={shootOff} 
                    onChange={(e) => {
                      setShootOff(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-600 outline-none"
                    placeholder="Es. 24"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                  <div className="text-slate-400">
                    Totale: <span className="text-xl font-black text-white">{calculateTotal()}</span>
                  </div>
                  <div className="flex gap-2">
                    {editingResultId && (
                      <button 
                        type="button"
                        onClick={() => {
                          const numSeries = Math.ceil((event.targets || 100) / 25);
                          setEditingResultId(null);
                          setSelectedUserId('');
                          setSeries(Array(numSeries).fill('0'));
                          setDetailedScores(Array.from({ length: numSeries }, () => []));
                          setShootOff('');
                          setExpandedSeries(null);
                          setIsDirty(false);
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all"
                      >
                        Annulla
                      </button>
                    )}
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-500 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Salvataggio...' : (editingResultId ? 'Aggiorna' : 'Salva')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Results Table Section */}
          <div className={`w-full ${(readOnly || event.status === 'validated') ? 'md:w-full' : 'md:w-2/3'} p-4 sm:p-6 md:overflow-y-auto bg-slate-950 shrink-0 md:shrink`}>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
              <h3 className="text-lg font-bold text-white uppercase tracking-widest">
                {event.status === 'validated' ? 'Classifica Finale' : (readOnly ? 'Classifica Generale' : 'Classifica Provvisoria')}
              </h3>
              
              <div className="flex flex-wrap items-center gap-4">
                {canExportPDF && (
                  <button
                    onClick={handlePreviewPDF}
                    disabled={isGeneratingPDF}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-orange-500 hover:border-orange-500/50 transition-all text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingPDF ? (
                      <i className="fas fa-circle-notch fa-spin text-orange-500"></i>
                    ) : (
                      <i className="fas fa-file-pdf text-red-500"></i>
                    )}
                    {isGeneratingPDF ? 'Generazione...' : 'Scarica PDF'}
                  </button>
                )}
                <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
                  <button
                    onClick={() => setViewMode('generale')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'generale' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Generale
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('categoria');
                      if (!selectedCategory && categories.length > 0) {
                        setSelectedCategory(categories[0] as string);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'categoria' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Categoria
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('qualifica');
                      if (!selectedQualification && qualifications.length > 0) {
                        setSelectedQualification(qualifications[0] as string);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'qualifica' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Qualifica
                  </button>
                  {hasSocietyRanking && (
                    <button
                      onClick={() => setViewMode('societa')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'societa' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Società
                    </button>
                  )}
                  {hasTeamRanking && (
                    <button
                      onClick={() => setViewMode('squadre')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'squadre' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Squadre
                    </button>
                  )}
                </div>
              </div>
            </div>

            {viewMode === 'categoria' && categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {categories.map(cat => (
                  <button
                    key={cat as string}
                    onClick={() => setSelectedCategory(cat as string)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${selectedCategory === cat ? 'bg-slate-800 border-orange-500 text-orange-500' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                  >
                    {cat as string}
                  </button>
                ))}
              </div>
            )}

            {viewMode === 'qualifica' && qualifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {qualifications.map(qual => (
                  <button
                    key={qual as string}
                    onClick={() => setSelectedQualification(qual as string)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${selectedQualification === qual ? 'bg-slate-800 border-orange-500 text-orange-500' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                  >
                    {qual as string}
                  </button>
                ))}
              </div>
            )}
            
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            ) : viewMode === 'squadre' ? (
              <TeamManager 
                event={event} 
                results={results} 
                users={Array.from(new Map([...users, ...results.map(r => ({
                  id: r.user_id,
                  name: r.user_name,
                  surname: r.user_surname,
                  society: r.society_at_time || r.society,
                  category: r.category_at_time || r.category,
                  qualification: r.qualification_at_time || r.qualification
                }))].map(u => [u.id, u])).values())}
                teams={teams} 
                token={token} 
                onTeamsUpdate={fetchData}
                triggerToast={triggerToast}
                triggerConfirm={triggerConfirm}
                readOnly={readOnly || event.status === 'validated'}
                currentUser={user}
                allSocieties={societies}
              />
            ) : viewMode === 'societa' ? (
              societyRanking.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <i className="fas fa-users text-4xl mb-3 opacity-50"></i>
                  <p>Nessuna società trovata nei risultati.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {societyRanking.map((soc, idx) => (
                    <div key={soc.societyName} className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                      <div className="flex items-center justify-between p-4 bg-slate-800/50">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-orange-600/20 text-orange-500 flex items-center justify-center font-black text-lg border border-orange-500/30">
                            {idx + 1}
                          </div>
                          <h4 className="text-lg font-bold text-white uppercase tracking-widest">{soc.societyName}</h4>
                        </div>
                        <div className="text-2xl font-black text-orange-500">
                          {soc.totalScore} <span className="text-xs text-slate-500 uppercase tracking-widest font-normal">pt</span>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950/50">
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">I 3 Migliori Risultati</h5>
                        <div className="space-y-2">
                          {soc.shooters.map((shooter, sIdx) => (
                            <div key={shooter.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-900 border border-slate-800/50">
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500 font-black text-xs">{sIdx + 1}.</span>
                                <span className="text-sm font-bold text-white">{shooter.user_surname} {shooter.user_name}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                  {shooter.category_at_time || shooter.category} / {shooter.qualification_at_time || shooter.qualification}
                                </span>
                              </div>
                              <div className="font-black text-white">
                                {shooter.totalscore}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <i className="fas fa-clipboard-list text-4xl mb-3 opacity-50"></i>
                <p>Nessun risultato trovato.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500">
                      <th className="p-2 sm:p-3 font-black">Pos</th>
                      <th className="p-2 sm:p-3 font-black text-center">Premio</th>
                      <th className="p-2 sm:p-3 font-black">Tiratore</th>
                      <th className="p-2 sm:p-3 font-black">Cat/Qua</th>
                      {Array.from({ length: maxSeriesCount }).map((_, i) => (
                        <th key={i} className="p-2 sm:p-3 font-black text-center">S{i + 1}</th>
                      ))}
                      <th className="p-2 sm:p-3 font-black text-right">Totale</th>
                      <th className="p-2 sm:p-3 font-black text-right">Spar.</th>
                      {!readOnly && event.status !== 'validated' && <th className="p-2 sm:p-3 font-black text-center">Azioni</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r, idx) => {
                      const rCat = r.category_at_time || r.category;
                      const rQual = r.qualification_at_time || r.qualification;
                      
                      // Priority: Event Override > Competition Override > Shooter Preference
                      const effectivePref = event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria';
                      const isOverridden = !!(event.ranking_preference_override || r.ranking_preference_override);
                      
                      return (
                        <React.Fragment key={r.id}>
                          <tr className="border-b border-slate-800/50 transition-colors">
                            <td className="p-2 sm:p-3 text-white font-bold text-xs sm:text-sm">{idx + 1}</td>
                            <td className="p-2 sm:p-3 text-center">
                              {getPrizeStatus(r) && (
                                <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 flex items-center justify-center font-black text-[10px] sm:text-xs mx-auto shadow-[0_0_10px_rgba(234,179,8,0.2)]" title="Va a Premio">
                                  P
                                </span>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 text-white font-medium text-xs sm:text-sm">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  {r.user_surname} {r.user_name}
                                  {isOverridden && (
                                    <i className="fas fa-exclamation-triangle text-[10px] text-orange-500" title={`Classifica forzata a ${effectivePref}`}></i>
                                  )}
                                </div>
                                {r.shooter_code && (
                                  <span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mt-0.5">{r.shooter_code}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 sm:p-3 text-slate-400 text-[10px] sm:text-xs">
                              <span className={(effectivePref === 'categoria') ? 'text-white font-bold' : ''}>
                                {rCat || '-'}
                              </span>
                              <span className="mx-1">/</span>
                              <span className={(effectivePref === 'qualifica') ? 'text-white font-bold' : ''}>
                                {rQual || '-'}
                              </span>
                            </td>
                          {Array.from({ length: maxSeriesCount }).map((_, i) => (
                            <td key={i} className="p-2 sm:p-3 text-slate-300 font-mono text-[11px] sm:text-sm text-center">
                              {r.scores && r.scores[i] !== undefined ? r.scores[i] : '-'}
                            </td>
                          ))}
                          <td className="p-2 sm:p-3 text-orange-500 font-black text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-sm sm:text-base">{r.totalscore}</span>
                              {r.detailedScores && r.detailedScores.some((s: any) => s && s.length > 0) && (
                                <button 
                                  onClick={() => setExpandedResultId(expandedResultId === r.id ? null : r.id)}
                                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white flex items-center justify-center transition-colors ml-1 sm:ml-2"
                                  title="Dettaglio pallini"
                                >
                                  <i className={`fas fa-chevron-${expandedResultId === r.id ? 'up' : 'down'} text-[8px] sm:text-[10px]`}></i>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2 sm:p-3 text-slate-400 font-bold text-right text-xs sm:text-sm">{r.shoot_off !== null ? r.shoot_off : '-'}</td>
                          {!readOnly && event.status !== 'validated' && (
                            <td className="p-2 sm:p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => handleEditResult(r)}
                                  disabled={event.status === 'validated'}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors ${event.status === 'validated' ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-blue-950/30 text-blue-500 hover:bg-blue-600 hover:text-white'}`}
                                  title="Modifica"
                                >
                                  <i className="fas fa-edit text-xs sm:text-sm"></i>
                                </button>
                                <button 
                                  onClick={() => handleDeleteResult(r.id)}
                                  disabled={event.status === 'validated'}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors ${event.status === 'validated' ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-red-950/30 text-red-500 hover:bg-red-600 hover:text-white'}`}
                                  title="Elimina"
                                >
                                  <i className="fas fa-trash-alt text-xs sm:text-sm"></i>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                        {expandedResultId === r.id && (
                          <tr className="bg-slate-900/30 border-b border-slate-800/50">
                            <td colSpan={(readOnly || event.status === 'validated') ? 6 + maxSeriesCount : 7 + maxSeriesCount} className="p-4">
                              <div className="space-y-3">
                                {r.scores.map((score: number, sIdx: number) => {
                                  // Use detailed scores if available, otherwise generate default dots based on score
                                  const dScore = (r.detailedScores && r.detailedScores[sIdx] && r.detailedScores[sIdx].length > 0) 
                                    ? r.detailedScores[sIdx] 
                                    : Array.from({ length: 25 }, (_, i) => i < score);
                                  
                                  return (
                                    <div key={sIdx} className="flex flex-col gap-1">
                                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Serie {sIdx + 1} ({score})</div>
                                      <div className="flex flex-wrap gap-1">
                                        {dScore.map((hit: boolean, tIdx: number) => (
                                          <div 
                                            key={tIdx} 
                                            className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${hit ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}
                                            title={`Piattello ${tIdx + 1}: ${hit ? 'Colpito' : 'Zero'}`}
                                          >
                                            {hit ? '1' : '0'}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* PDF Preview Modal */}
      <AnimatePresence>
        {showPDFPreview && pdfUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1060] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-700 rounded-[2rem] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Anteprima PDF</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Verifica il documento prima di scaricarlo</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => generatePDF(true)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-orange-600/20"
                  >
                    <i className="fas fa-download"></i>
                    Scarica Ora
                  </button>
                  <button
                    onClick={closePDFPreview}
                    className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
              
              <div className="flex-1 bg-slate-950 p-2 sm:p-4 overflow-hidden relative">
                {!pdfUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-orange-500"></i>
                    <p className="text-xs uppercase tracking-widest font-black">Caricamento Anteprima...</p>
                  </div>
                )}
                {pdfUrl && (
                  <div className="w-full h-full">
                    <object 
                      key={pdfUrl}
                      data={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`} 
                      type="application/pdf"
                      className="w-full h-full rounded-xl border border-slate-800"
                    >
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
                        <i className="fas fa-file-pdf text-5xl text-red-500 mb-4"></i>
                        <h4 className="text-white font-bold mb-2">L'anteprima non può essere visualizzata</h4>
                        <p className="text-slate-400 text-sm mb-6 max-w-md">Il tuo browser non supporta la visualizzazione dei PDF integrata. Puoi comunque scaricare il file per visualizzarlo.</p>
                        <button
                          onClick={() => generatePDF(true)}
                          className="px-8 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg"
                        >
                          Scarica il PDF
                        </button>
                      </div>
                    </object>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showQuickAddShooter && (
        <QuickAddShooterModal
          token={token}
          currentUser={user}
          societies={societies}
          onClose={() => setShowQuickAddShooter(false)}
          triggerToast={triggerToast}
          onSuccess={(newUser) => {
            setUsers(prev => [...prev, newUser]);
            setSelectedUserId(newUser.id);
            setIsDirty(true);
            setShowQuickAddShooter(false);
          }}
        />
      )}
    </div>,
    document.body
  );
};

export default EventResultsManager;
