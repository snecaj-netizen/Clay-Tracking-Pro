import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { SocietyEvent, PrizeSetting, User, Discipline, getSeriesLayout } from '../types';
import { calculateRTE, shortenCategoryName, getDisplayCategory, INTERNATIONAL_CODES, INTL_TO_DOMESTIC, getCategoryForDiscipline } from '../ratingUtils';
import ShooterSearch from './ShooterSearch';
import TeamManager from './TeamManager';
import QuickAddShooterModal from './QuickAddShooterModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { handleNetworkError } from './ConnectionStatus';
import { motion, AnimatePresence } from 'motion/react';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';

interface EventResultsManagerProps {
  event: SocietyEvent;
  token: string;
  user?: User | null;
  onClose: () => void;
  readOnly?: boolean;
  onEventUpdate?: () => void;
  societies?: any[];
}

const normalizeCategory = (catStr: any): string => {
  if (!catStr) return 'Seconda';
  const upper = catStr.toString().toUpperCase().trim();
  if (upper === 'ECCELLENZA' || upper === 'E') return 'Eccellenza';
  if (upper.includes('PRIMA') || upper === '1' || upper === '1^' || upper === '1*' || upper === '1ª') return 'Prima';
  if (upper.includes('SECONDA') || upper === '2' || upper === '2^' || upper === '2*' || upper === '2ª') return 'Seconda';
  if (upper.includes('TERZA') || upper === '3' || upper === '3^' || upper === '3*' || upper === '3ª') return 'Terza';
  return 'Seconda';
};

const normalizeQualification = (qualStr: any): string => {
  if (!qualStr) return '';
  const upper = qualStr.toString().toUpperCase().trim();
  if (upper.includes('LAD')) return 'Lady';
  if (upper.includes('SETT') || upper.includes('GIOV')) return 'Settore Giovanile';
  if (upper.includes('JUN')) return 'Junior';
  if (upper.includes('VET')) return 'Veterani';
  if (upper.includes('MAS')) return 'Master';
  if (upper.includes('PARAL') || upper.includes('PARA')) return 'Paralimpici';
  if (upper.includes('SEN') || upper.includes('SR')) return 'Senior';
  return '';
};

const EventResultsManager: React.FC<EventResultsManagerProps> = ({ event, token, user, onClose, readOnly = false, onEventUpdate, societies = [] }) => {
  const { triggerConfirm, triggerToast } = useUI();
  const { language, t } = useLanguage();
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
  const [searchTerm, setSearchTerm] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  
  const layoutInfo = useMemo(() => getSeriesLayout(event.discipline as Discipline), [event.discipline]);
  const targetsPerSeries = useMemo(() => {
    const sum = layoutInfo.layout.reduce((a, b) => a + b, 0);
    return sum > 0 ? sum : 25;
  }, [layoutInfo]);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [totalTargets, setTotalTargets] = useState(event.targets || 100);
  const [series, setSeries] = useState<string[]>(() => Array(Math.ceil((event.targets || 100) / targetsPerSeries)).fill('0'));
  const [detailedScores, setDetailedScores] = useState<boolean[][]>(() => Array.from({ length: Math.ceil((event.targets || 100) / targetsPerSeries) }, () => []));
  const [expandedSeries, setExpandedSeries] = useState<number | null>(null);
  const [shootOff, setShootOff] = useState('');
  const [showQuickAddShooter, setShowQuickAddShooter] = useState(false);
  const [quickAddInitialDetails, setQuickAddInitialDetails] = useState<any>(null);

  const reEvaluateParsedRows = (updatedUsers: any[]) => {
    setParsedRows(prevRows => {
      return prevRows.map(row => {
        let userId: number | undefined = undefined;
        let userFound = false;
        let foundUser: any = null;

        const cleanRowCode = row.shooterCode?.toUpperCase().trim() || '';

        // Try code lookup (ONLY if row has a truthy, non-empty shooterCode)
        if (cleanRowCode) {
          foundUser = updatedUsers.find(u => {
            const cleanUserCode = (u.shooter_code || u.shooterCode || '').toUpperCase().trim();
            return cleanUserCode !== '' && cleanUserCode === cleanRowCode;
          });
        }

        // Try Name + Surname lookup
        if (!foundUser && row.surname && row.name) {
          foundUser = updatedUsers.find(u => {
            const uSurname = (u.surname || u.cognome || '').toLowerCase().trim();
            const uName = (u.name || u.nome || '').toLowerCase().trim();
            return uSurname === row.surname.toLowerCase().trim() && 
                   uName === row.name.toLowerCase().trim();
          });
        }

        if (foundUser) {
          userId = foundUser.id;
          userFound = true;
        }

        // Re-construct the errors array
        const updatedErrors = row.errors.filter((e: string) => 
          !e.includes("mancante") && 
          !e.includes("non registrato") && 
          !e.includes("non trovato") &&
          !e.includes("ricerca fallita")
        );

        const finalShooterCode = row.shooterCode || (foundUser ? (foundUser.shooter_code || foundUser.shooterCode || '') : '');
        const surname = row.surname || (foundUser ? (foundUser.surname || foundUser.cognome || '') : '');
        const name = row.name || (foundUser ? (foundUser.name || foundUser.nome || '') : '');
        const email = row.email || (foundUser ? (foundUser.email || '') : '');
        const society = row.society || (foundUser ? (foundUser.society || '') : '') || event.location || '';
        const category = getCategoryForDiscipline(foundUser, event.discipline as Discipline) || (row.category && row.category !== 'Seconda' ? row.category : normalizeCategory(foundUser ? (foundUser.category || 'Seconda') : 'Seconda'));
        const qualification = row.qualification || normalizeQualification(foundUser ? (foundUser.qualification || '') : '');

        // Check if shooters or codes are missing, similar to initial mapping
        if (!finalShooterCode && !userFound) {
          updatedErrors.push("Codice Tiratore mancante");
        } else if (finalShooterCode && finalShooterCode.length < 5) {
          updatedErrors.push("Codice Tiratore troppo corto");
        }

        if (!surname) updatedErrors.push("Cognome mancante");
        if (!name) updatedErrors.push("Nome mancante");
        if (!email) {
          updatedErrors.push("Email mancante");
        } else if (email && !email.includes('@')) {
          updatedErrors.push("Formato Email non valido");
        }

        if (!userFound) {
          updatedErrors.push("Tiratore non registrato a portale (ricerca fallita per Codice e per Nome + Cognome)");
        }

        if (userFound) {
          const hasExisting = results.some(r => r.user_id === userId && !r.is_registered_only);
          if (hasExisting && !updatedErrors.some((e: string) => e.includes("Risultato già registrato"))) {
            updatedErrors.push("ATTENZIONE: Risultato già registrato nel database per questo tiratore (verrà sovrascritto)");
          }
        }

        return {
          ...row,
          shooterCode: finalShooterCode ? finalShooterCode.toUpperCase() : '',
          surname,
          name,
          email,
          society,
          category,
          qualification,
          userId,
          userFound,
          errors: updatedErrors,
          isValid: updatedErrors.filter((e: string) => !e.startsWith("ATTENZIONE:")).length === 0
        };
      });
    });
  };

  const categories = useMemo(() => {
    const list = Array.from(new Set(results.map(r => r.category_at_time || r.category).filter(Boolean)));
    return list.sort((a, b) => {
      const getCategoryRank = (cat: string) => {
        const upper = (cat || "").toUpperCase().trim();
        if (upper === "ECCELLENZA" || upper === "E") return 1;
        if (upper === "PRIMA" || upper === "1*" || upper === "1ª" || upper === "1" || upper.includes("PRIMA") || upper.includes("1^") || upper.includes("1ª")) return 2;
        if (upper === "SECONDA" || upper === "2*" || upper === "2ª" || upper === "2" || upper.includes("SECONDA") || upper.includes("2^") || upper.includes("2ª")) return 3;
        if (upper === "TERZA" || upper === "3*" || upper === "3ª" || upper === "3" || upper.includes("TERZA") || upper.includes("3^") || upper.includes("3ª")) return 4;
        return 999;
      };
      const rankA = getCategoryRank(a);
      const rankB = getCategoryRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });
  }, [results]);
  const shouldShowInternational = event.type === 'Internazionale';

  const getShooterQualification = (r: any) => {
    // Detect hunter: if categorized as Cacciatore or in Cacciatori society
    const isHunter = r?.category_at_time === 'Cacciatore' || 
                     r?.category === 'Cacciatore' ||
                     (r?.society_at_time || r?.society || '').toLowerCase() === 'cacciatori';
    if (isHunter) return 'CA';

    const qual = r?.qualification_at_time || r?.qualification;
    if (!qual) return '';
    if (!shouldShowInternational && qual.toUpperCase() === 'MAN') {
      return '';
    }
    return qual;
  };

  const qualifications = useMemo(() => {
    const list = results.map(r => getShooterQualification(r)).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [results, shouldShowInternational]);

  const formatDisplayValue = (val: string | null | undefined, type: 'category' | 'qualification') => {
    if (!val || val === '-') return '';
    const upper = val.toUpperCase();
    const isIntCode = INTERNATIONAL_CODES.includes(upper);
    
    if (shouldShowInternational) {
      // Per eventi internazionali mostriamo solo i codici internazionali se disponibili
      return isIntCode ? upper : '';
    } else {
      // Per eventi normali (locali):
      if (type === 'category') {
        // ESCLUDIAMO i codici internazionali se usati come categoria (MAN, SEN, VET, etc.)
        if (isIntCode) return '';
        // Abbreviamo le categorie domestiche (Prima -> 1*, etc.)
        return shortenCategoryName(val);
      } else {
        // Per le Qualifiche: se è un codice internazionale, lo convertiamo in codice domestico short
        // se esiste una mappatura (es. SEN -> SE, VET -> VE). 
        // Se non esiste mappatura ma è un codice internazionale (es. MAN), lo nascondiamo.
        if (INTL_TO_DOMESTIC[upper]) {
          return INTL_TO_DOMESTIC[upper];
        }
        if (isIntCode) return '';
        // Abbreviamo le qualifiche domestiche
        return shortenCategoryName(val);
      }
    }
  };

  const canExportPDF = user?.role === 'admin' || user?.role === 'society';

  const shootersWithoutResults = useMemo(() => {
    // Only exclude those who have an actual competition record (not just a registration)
    const resultUserIds = new Set(results.filter(r => !r.is_registered_only).map(r => r.user_id));
    
    // If we are editing, we want to keep the current shooter in the list
    const currentEditingUserId = editingResultId ? results.find(r => r.id === editingResultId)?.user_id : null;

    return users.filter(u => {
      if (u.id === currentEditingUserId) return true;
      return !resultUserIds.has(u.id);
    });
  }, [users, results, editingResultId]);

  useEffect(() => {
    if (selectedUserId && !editingResultId) {
      const registration = results.find(r => r.user_id.toString() === selectedUserId && r.is_registered_only);
      if (registration) {
        if (registration.registration_type === 'Qualifica' || registration.registration_type === 'Per Qualifica') {
          setRankingPreference('qualifica');
        } else {
          setRankingPreference('categoria');
        }
      }
    }
  }, [selectedUserId, results, editingResultId]);

  useEffect(() => {
    if (parsedRows.length > 0 && users.length > 0) {
      reEvaluateParsedRows(users);
    }
  }, [users]);

  const handleDownloadExcelTemplate = () => {
    const numSeries = Math.ceil((event.targets || 100) / targetsPerSeries);
    const headers = [
      'Codice Tiratore *',
      'Cognome *',
      'Nome *',
      'Email *',
      'Società',
      'Categoria *',
      'Qualifica',
      'PETT'
    ];
    for (let i = 1; i <= numSeries; i++) {
      headers.push(`S${i}`);
    }
    headers.push('Shoot-Off');
    headers.push('Preferenza Classifica');

    const exampleRow: any = {
      'Codice Tiratore *': 'RSSMRA80A01H501Y',
      'Cognome *': 'Rossi',
      'Nome *': 'Mario',
      'Email *': 'mario.rossi@example.com',
      'Società': event.location || 'Società Esempio',
      'Categoria *': 'Seconda',
      'Qualifica': 'Lady',
      'PETT': '1'
    };
    for (let i = 1; i <= numSeries; i++) {
      exampleRow[`S${i}`] = '22';
    }
    exampleRow['Shoot-Off'] = '';
    exampleRow['Preferenza Classifica'] = 'Categoria';

    const worksheet = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Risultati");
    
    XLSX.writeFile(workbook, `Template_Risultati_${event.name.replace(/\s+/g, '_')}.xlsx`);
    triggerToast("Template scaricato con successo!", "success");
  };

  const handleUploadExcelResults = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet);

        if (rawRows.length === 0) {
          triggerToast("Il file Excel non contiene righe di dati.", "error");
          setLoading(false);
          return;
        }

        const numSeries = Math.ceil((event.targets || 100) / targetsPerSeries);

        const parsed: any[] = rawRows.map((raw: any, index: number) => {
          const getVal = (keys: string[]): string => {
            for (const k of keys) {
              const matchedKey = Object.keys(raw).find(rk => rk.toLowerCase().replace(/\s+/g, '').replace(/[*_]/g, '') === k.toLowerCase().replace(/\s+/g, ''));
              if (matchedKey) return String(raw[matchedKey] || '').trim();
            }
            return '';
          };

          const shooterCode = getVal(['codicetiratore', 'codice', 'cf', 'fiscalcode', 'tessera', 'fitav']);
          const rawSurname = getVal(['cognome', 'surname', 'lastname']);
          const rawName = getVal(['nome', 'name', 'firstname']);
          const rawEmail = getVal(['email', 'mail']);
          const rawSociety = getVal(['societa', 'club', 'team']);
          const rawCategory = getVal(['categoria', 'category', 'class']);
          const rawQualification = getVal(['qualifica', 'qualification']);
          const bibNumber = getVal(['pett', 'pettorale', 'bib']);
          
          const rawPref = getVal(['preferenza', 'preferenzaclassifica', 'rankingpreference']);
          const rankingPreference: 'categoria' | 'qualifica' = (rawPref.toLowerCase().includes('qual') || rawPref.toLowerCase() === 'qualifica') ? 'qualifica' : 'categoria';

          const scores: number[] = [];
          for (let sIdx = 1; sIdx <= numSeries; sIdx++) {
            const val = getVal([`s${sIdx}`]);
            const scoreNum = parseInt(val);
            scores.push(isNaN(scoreNum) ? 0 : scoreNum);
          }

          const rawOff = getVal(['shootoff', 'shoot-off', 'spareggio']);
          const shootOff = rawOff ? (parseInt(rawOff) || null) : null;

          let userId: number | undefined;
          let userFound = false;
          let foundUser: any = null;

          if (shooterCode) {
            foundUser = users.find(u => u.shooter_code?.toUpperCase().trim() === shooterCode.toUpperCase().trim());
            if (foundUser) {
              userId = foundUser.id;
              userFound = true;
            }
          }

          if (!userFound && rawSurname && rawName) {
            foundUser = users.find(u => 
              u.surname?.toLowerCase().trim() === rawSurname.toLowerCase().trim() && 
              u.name?.toLowerCase().trim() === rawName.toLowerCase().trim()
            );
            if (foundUser) {
              userId = foundUser.id;
              userFound = true;
            }
          }

          // Resolve values based on existing user or raw values from Excel
          const finalShooterCode = shooterCode || (foundUser ? foundUser.shooter_code : '');
          const surname = rawSurname || (foundUser ? foundUser.surname : '');
          const name = rawName || (foundUser ? foundUser.name : '');
          const email = rawEmail || (foundUser ? foundUser.email : '');
          const society = rawSociety || (foundUser ? foundUser.society : '') || event.location || '';
          const category = getCategoryForDiscipline(foundUser, event.discipline as Discipline) || normalizeCategory(rawCategory || (foundUser ? foundUser.category : 'Seconda'));
          const qualification = normalizeQualification(rawQualification || (foundUser ? foundUser.qualification : ''));

          const errors: string[] = [];
          
          if (!finalShooterCode && !userFound) {
            errors.push("Codice Tiratore mancante");
          } else if (finalShooterCode && finalShooterCode.length < 5) {
            errors.push("Codice Tiratore troppo corto");
          }

          if (!surname) errors.push("Cognome mancante");
          if (!name) errors.push("Nome mancante");
          if (!email) {
            errors.push("Email mancante");
          } else if (!email.includes('@')) {
            errors.push("Formato Email non valido");
          }

          scores.forEach((s, sI) => {
            if (s < 0 || s > targetsPerSeries) {
              errors.push(`Punteggio S${sI+1} (${s}) non valido (deve essere tra 0 e ${targetsPerSeries})`);
            }
          });

          if (!userFound) {
            errors.push("Tiratore non registrato a portale (ricerca fallita per Codice e per Nome + Cognome)");
          }

          if (userFound) {
            const hasExisting = results.some(r => r.user_id === userId && !r.is_registered_only);
            if (hasExisting) {
              errors.push("ATTENZIONE: Risultato già registrato nel database per questo tiratore (verrà sovrascritto)");
            }
          }

          return {
            index,
            shooterCode: finalShooterCode ? finalShooterCode.toUpperCase() : '',
            surname,
            name,
            email,
            society,
            category,
            qualification,
            bibNumber,
            scores,
            shootOff,
            rankingPreference,
            errors,
            userFound,
            userId,
            isValid: errors.filter(e => !e.startsWith("ATTENZIONE:")).length === 0
          };
        });

        setParsedRows(parsed);
        triggerToast(`File Excel analizzato: ${parsed.length} righe caricate. Controlla la tabella di convalida.`, "success");
      } catch (err: any) {
        triggerToast(`Errore durante l'analisi del file Excel: ${err.message}`, "error");
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      triggerToast("Errore di caricamento del file Excel.", "error");
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCreateUserInline = (rowIndex: number) => {
    const row = parsedRows[rowIndex];
    if (!row) return;

    const initialDetails = {
      name: row.name ? row.name.trim() : '',
      surname: row.surname ? row.surname.trim() : '',
      email: row.email ? row.email.trim() : '',
      society: row.society ? row.society.trim() : '',
      shooterCode: row.shooterCode ? row.shooterCode.toUpperCase().trim() : '',
      category: row.category || '',
      qualification: row.qualification || ''
    };

    setQuickAddInitialDetails(initialDetails);
    setShowQuickAddShooter(true);
  };

  const handleSaveAllExcelResults = async () => {
    const rowsWithCriticalErrors = parsedRows.filter(r => r.errors.some(e => !e.startsWith("ATTENZIONE:")));
    
    if (rowsWithCriticalErrors.length > 0) {
      triggerToast("Risolvi gli errori dei tiratori prima di procedere con il salvataggio dei risultati.", "error");
      return;
    }

    setSaving(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of parsedRows) {
      const numSeries = Math.ceil((event.targets || 100) / targetsPerSeries);
      const totalScore = row.scores.reduce((a: number, b: number) => a + b, 0);
      const totalTargetsVal = event.targets || 100;
      const averagePerSeries = totalScore / numSeries;

      const detailed: boolean[][] = row.scores.map((score: number) => {
        const arr = Array(targetsPerSeries).fill(false);
        for (let i = 0; i < score; i++) {
          arr[i] = true;
        }
        return arr;
      });

      const payload = {
        id: `evt_${event.id}_${row.userId}_${Date.now()}`,
        userId: row.userId,
        eventId: event.id,
        name: event.name,
        date: event.start_date ? event.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
        location: event.location,
        discipline: event.discipline,
        level: event.type,
        totalScore,
        totalTargets: totalTargetsVal,
        averagePerSeries,
        ranking_preference: row.rankingPreference || 'categoria',
        ranking_preference_override: null,
        scores: row.scores,
        detailedScores: detailed,
        shootOff: row.shootOff
      };

      try {
        const res = await fetch('/api/competitions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    setSaving(false);
    if (failCount === 0) {
      triggerToast(`Importazione completata con successo! ${successCount} risultati salvati.`, "success");
      setParsedRows([]);
      fetchData();
    } else {
      triggerToast(`Importazione terminata con qualche errore. Salvati: ${successCount}. Falliti: ${failCount}`, "info");
      fetchData();
    }
  };

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

    // Auto-update results every 20 seconds to keep the ranking fresh
    const intervalId = setInterval(() => {
      fetchResultsAndTeams(true);
    }, 20000);

    return () => clearInterval(intervalId);
  }, [event.id, event.prize_settings]);

  const fetchResultsAndTeams = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const resultsUrl = token ? `/api/events/${event.id}/results` : `/api/public/events/${event.id}/results`;
      const teamsUrl = token ? `/api/events/${event.id}/teams` : `/api/public/events/${event.id}/teams`;
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [resResults, resTeams] = await Promise.all([
        fetch(resultsUrl, { headers }),
        fetch(teamsUrl, { headers })
      ]);

      if (resResults.ok) {
        const data = await resResults.json();
        setResults(data);
      }

      if (resTeams.ok) {
        const data = await resTeams.json();
        setTeams(data);
      }
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        console.error('Error refreshing results/teams:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch results and teams first
      await fetchResultsAndTeams(true);

      // Fetch users (shooters) only if authenticated
      if (token) {
        const usersUrl = `/api/admin/users?limit=10000&excludeRole=society${user?.role === 'society' ? '&all=true' : ''}`;
        const resUsers = await fetch(usersUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resUsers.ok) {
          const data = await resUsers.json();
          let filteredUsers = (data.users || []).filter((u: any) => u.role === 'user' || u.role === 'admin');
          setUsers(filteredUsers);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        console.error('Error fetching data:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!triggerConfirm) return;
    
    triggerConfirm(
      t('validate_event_title'),
      t('validate_event_confirm'),
      async () => {
        try {
          const res = await fetch(`/api/events/${event.id}/validate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            if (onEventUpdate) onEventUpdate();
            if (triggerToast) {
              triggerToast(t('validate_success'), 'success');
            } else {
              alert(t('validate_success'));
            }
            onClose();
          } else {
            let errorMessage = t('validate_error');
            try {
              const data = await res.json();
              errorMessage = data.error || errorMessage;
            } catch (e) {
              console.error('Failed to parse error response:', e);
              if (res.status === 403) errorMessage = t('validate_permission_error');
              else if (res.status === 404) errorMessage = t('validate_not_found_error');
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
            triggerToast(t('validate_network_error'), 'error');
          } else {
            alert(t('validate_network_error'));
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
      // Initialize with hits (green) by default if not already set
      if (!detailedScores[idx] || detailedScores[idx].length === 0) {
        const newDetailed = [...detailedScores];
        newDetailed[idx] = Array(targetsPerSeries).fill(true);
        setDetailedScores(newDetailed);
        
        const newScores = [...series];
        newScores[idx] = targetsPerSeries.toString();
        setSeries(newScores);
      }
    }
  };

  const handleDetailedScoreChange = (seriesIndex: number, targetIndex: number) => {
    setIsDirty(true);
    setDetailedScores(prev => {
      const newDetailed = [...prev];
      const newSeries = [...(newDetailed[seriesIndex] || Array(targetsPerSeries).fill(true))];
      newSeries[targetIndex] = !newSeries[targetIndex];
      newDetailed[seriesIndex] = newSeries;
      
      const newScores = [...series];
      newScores[seriesIndex] = newSeries.filter(Boolean).length.toString();
      setSeries(newScores);
      
      return newDetailed;
    });
  };

  const handleSeriesValueChange = (idx: number, val: string) => {
    setIsDirty(true);
    const score = parseInt(val);
    if (isNaN(score)) {
      const newScores = [...series];
      newScores[idx] = '';
      setSeries(newScores);
      return;
    }

    const clampedScore = Math.min(targetsPerSeries, Math.max(0, score));
    
    // Update series numeric value
    const newScores = [...series];
    newScores[idx] = clampedScore.toString();
    setSeries(newScores);

    // Update detailed scores: first 'clampedScore' are hits, rest are misses (zeros)
    const newDetailed = [...detailedScores];
    newDetailed[idx] = Array(targetsPerSeries).fill(false).map((_, i) => i < clampedScore);
    setDetailedScores(newDetailed);
  };

  const calculateTotal = () => {
    return series.reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  };

  const sortResults = (a: any, b: any) => {
    // Registered only always at the bottom
    if (a.is_registered_only && !b.is_registered_only) return 1;
    if (!a.is_registered_only && b.is_registered_only) return -1;
    if (a.is_registered_only && b.is_registered_only) {
      return (a.user_surname || '').localeCompare(b.user_surname || '');
    }

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
        
        // Countback from the last target of the series
        const targetsToCompare = Math.max(aSeries.length, bSeries.length, targetsPerSeries);
        for (let tIdx = targetsToCompare - 1; tIdx >= 0; tIdx--) {
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
    doc.text('CLAY PERFORMANCE', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(event.status === 'validated' ? t('pdf_final_ranking') : t('pdf_provisional_ranking'), pageWidth / 2, 22, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(event.name.toUpperCase(), pageWidth / 2, 32, { align: 'center' });
    
    let currentY = 50;
    
    // Event Info
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(t('pdf_club'), 20, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(event.location || 'N/D', 45, currentY);
    
    doc.setFont('helvetica', 'bold');
    doc.text(t('pdf_date'), 120, currentY);
    doc.setFont('helvetica', 'normal');
    const startDate = event.start_date ? new Date(event.start_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US') : 'N/D';
    const endDate = event.end_date ? new Date(event.end_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US') : null;
    const dateText = endDate && endDate !== startDate ? `${startDate} - ${endDate}` : startDate;
    doc.text(dateText, 135, currentY);
    
    currentY += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(t('pdf_discipline'), 20, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(event.discipline || 'N/D', 45, currentY);
    
    doc.setFont('helvetica', 'bold');
    doc.text(t('pdf_targets'), 120, currentY);
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
      const headers = [[t('pdf_pos'), 'PETT', t('pdf_shooter'), t('pdf_cat_qual'), ...seriesHeaders, t('pdf_total'), t('pdf_shoot_off')]];

      autoTable(doc, {
        startY: currentY,
        head: headers,
        body: data.map((r, index) => {
          const isPrize = getPrizeStatus(r);
          const seriesData = Array.from({ length: pdfMaxSeriesCount }).map((_, i) => 
            r.scores && r.scores[i] !== undefined ? r.scores[i] : '-'
          );
          
            const catDisp = formatDisplayValue(r.category_at_time || r.category, 'category');
            const qualDisp = formatDisplayValue(getShooterQualification(r), 'qualification');
            const displayStr = [catDisp, qualDisp].filter(Boolean).join('/');
            
            return [
              `${index + 1}${isPrize ? ' (P)' : ''}`,
              r.bib_number || '-',
              `${r.user_surname || ''} ${r.user_name || ''}${r.shooter_code ? `\n(${r.shooter_code})` : ''}`,
              displayStr || '-',
              ...seriesData,
              r.totalscore || 0,
              r.shoot_off || '-'
            ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 15 }, // Pos
          1: { cellWidth: 10, halign: 'center' }, // PETT
          2: { cellWidth: 'auto' }, // Tiratore
        },
        margin: { left: 15, right: 15 },
        didParseCell: (cellData) => {
          if (cellData.section === 'body' && cellData.cell.text[0] === targetsPerSeries.toString()) {
            // Series columns start at index 4
            if (cellData.column.index >= 4 && cellData.column.index < 4 + pdfMaxSeriesCount) {
              cellData.cell.styles.textColor = [220, 38, 38]; // red-600
              cellData.cell.styles.fontStyle = 'bold';
            }
          }
        },
        didDrawPage: (data: any) => {
          currentY = data.cursor.y + 15;
        }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;
    };

    // 1. Classifica Generale
    const sortedGeneral = [...results].sort(sortResults);
    renderTable(t('pdf_general_ranking'), sortedGeneral);

    // 2. Classifiche per Categoria
    categories.forEach(cat => {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      const catResults = results.filter(r => {
        const rQual = getShooterQualification(r);
        let effectivePref = event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria';
        if (effectivePref === 'qualifica' && !rQual) {
          effectivePref = 'categoria';
        }
        if (effectivePref === 'qualifica') return false;
        return (r.category_at_time || r.category) === cat;
      }).sort(sortResults);
      if (catResults.length > 0) {
        renderTable(`${t('pdf_category_ranking')}: ${cat}`, catResults);
      }
    });

    // 3. Classifiche per Qualifica
    qualifications.forEach(qual => {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      const qualResults = results.filter(r => {
        const rQual = getShooterQualification(r);
        let effectivePref = event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria';
        if (effectivePref === 'qualifica' && !rQual) {
          effectivePref = 'categoria';
        }
        if (effectivePref !== 'qualifica') return false;
        return rQual === qual;
      }).sort(sortResults);
      if (qualResults.length > 0) {
        renderTable(`${t('pdf_qualification_ranking')}: ${qual}`, qualResults);
      }
    });

    // 4. Classifica Società
    if (event.has_society_ranking && societyRanking.length > 0) {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(234, 88, 12); // orange-600
      doc.text(t('pdf_society_ranking'), 20, currentY);
      currentY += 5;

      const headers = [[t('pdf_pos'), t('society_label'), t('shooters_label'), t('pdf_total')]];
      
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
      
      const teamRankings = teams.map(team => {
        const teamMembers = (team.member_ids || []).map((id: string) => {
          const result = results.find(r => r.user_id === id);
          const user = users.find(u => u.id === id);
          return {
            id: id,
            user_id: id,
            user_name: result?.user_name || user?.name || t('unknown'),
            user_surname: result?.user_surname || user?.surname || '',
            totalscore: result?.totalscore || 0,
            qualification: getShooterQualification(result || { ...user })
          };
        });
        const totalScore = teamMembers.reduce((sum: number, m: any) => sum + (m.totalscore || 0), 0);
        return {
          ...team,
          totalScore,
          members: teamMembers
        };
      }).sort((a, b) => b.totalScore - a.totalScore);

      const isHunter = (type: string) => {
        if (!type) return false;
        const t = type.toUpperCase();
        return t === 'CACCIATORI' || t.includes('CACCIATOR');
      };

      const fitavTeams = teamRankings.filter(t => !isHunter(t.type || t.team_type));
      const hunterTeams = teamRankings.filter(t => isHunter(t.type || t.team_type));

      const drawRankTable = (title: string, list: typeof teamRankings) => {
        if (list.length === 0) return;
        if (currentY > 240) { doc.addPage(); currentY = 20; }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(234, 88, 12); // orange-600
        doc.text(title, 20, currentY);
        currentY += 5;

        const headers = [[t('pdf_pos'), t('team_label'), t('shooters_label'), t('pdf_total')]];
        const bodyData = list.map((team, index) => {
          const typeStr = team.type ? ` (${team.type})` : '';
          const nameStr = `${team.name}\n${team.society}${typeStr}`;
          const membersToRender = title.includes('Cacciatori') ? team.members.filter(m => m.qualification === 'CA') : team.members;
          const shootersStr = membersToRender.map((s: any) => 
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
      };

      if (fitavTeams.length > 0) {
        drawRankTable(t('pdf_team_ranking') || 'Classifica Squadre FITAV', fitavTeams);
      }
      if (hunterTeams.length > 0) {
        drawRankTable('Classifica Squadre Cacciatori', hunterTeams);
      }
    }

    // Footer on each page
    const pageCount = (doc as any).internal.getNumberOfPages();
    console.log(`PDF generated with ${pageCount} pages`);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`${t('pdf_page')} ${i} ${t('pdf_of')} ${pageCount} - ${t('pdf_generated_by')}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
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
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const fullName = `${r.user_name || ''} ${r.user_surname || ''}`.toLowerCase();
      const surnameName = `${r.user_surname || ''} ${r.user_name || ''}`.toLowerCase();
      const shooterCode = (r.shooter_code || '').toLowerCase();
      if (!fullName.includes(search) && !surnameName.includes(search) && !shooterCode.includes(search)) {
        return false;
      }
    }

    const rCat = r.category_at_time || r.category;
    const rQual = getShooterQualification(r);
    
    // Priority: Event Override > Competition Override > Shooter Preference
    let effectivePref = event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria';
    if (effectivePref === 'qualifica' && !rQual) {
      effectivePref = 'categoria';
    }

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
    
    results.filter(r => !r.is_registered_only).forEach(r => {
      const rawSoc = r.society_at_time || r.society;
      if (!rawSoc) return;
      const soc = rawSoc.trim();
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
      const numSeries = Math.ceil((event.targets || 100) / targetsPerSeries);
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
      handleNetworkError(err, triggerToast);
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

  const getDotColors = (isHit: boolean) => {
    const isElica = event.discipline === Discipline.EL;
    const isSporting = event.discipline === Discipline.SP || event.discipline === Discipline.CK || event.discipline === Discipline.ES || event.discipline === Discipline.DCK;
    
    if (isHit) {
      if (isElica) return 'bg-white border-slate-200 text-slate-900 shadow-[0_0_10px_rgba(255,255,255,0.3)]';
      return 'bg-[#a3e635] border-[#65a30d] text-green-900 shadow-[0_0_10px_rgba(163,230,53,0.2)]';
    } else {
      return 'bg-[#ef4444] border-[#b91c1c] text-red-900 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
    }
  };

  const getSmallDotColors = (isHit: boolean) => {
    const isElica = event.discipline === Discipline.EL;
    const isSporting = event.discipline === Discipline.SP || event.discipline === Discipline.CK || event.discipline === Discipline.ES || event.discipline === Discipline.DCK;
    
    if (isHit) {
      if (isElica) return 'bg-white border-slate-200 text-slate-900';
      return 'bg-green-500/20 text-green-500 border-green-500/30';
    } else {
      return 'bg-red-500/20 text-red-500 border-red-500/30';
    }
  };

  const maxSeriesCount = React.useMemo(() => {
    const eventSeriesCount = Math.ceil((event.targets || 100) / targetsPerSeries);
    if (filteredResults.length === 0) return eventSeriesCount;
    const resultSeriesCounts = filteredResults.map(r => Array.isArray(r.scores) ? r.scores.length : 0);
    return Math.max(eventSeriesCount, ...resultSeriesCounts);
  }, [filteredResults, event.targets, targetsPerSeries]);

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
    const rQual = getShooterQualification(result);
    
    // Priority: Event Override > Competition Override > Shooter Preference
    let effectivePref = event.ranking_preference_override || result.ranking_preference_override || result.ranking_preference || 'categoria';
    if (effectivePref === 'qualifica' && !rQual) {
      effectivePref = 'categoria';
    }

    // Calculate ranking in category
    if (effectivePref === 'categoria') {
      const categorySetting = prizeSettings.find(s => s.type === 'categoria' && s.name === rCat);
      if (categorySetting) {
        const catResults = results
          .filter(r => {
            const rQualLocal = getShooterQualification(r);
            let rPref = event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria';
            if (rPref === 'qualifica' && !rQualLocal) {
              rPref = 'categoria';
            }
            return (r.category_at_time || r.category) === rCat && rPref === 'categoria';
          })
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
          .filter(r => {
            const rQualLocal = getShooterQualification(r);
            let rPref = event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria';
            if (rPref === 'qualifica' && !rQualLocal) {
              rPref = 'categoria';
            }
            return rQualLocal === rQual && rPref === 'qualifica';
          })
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
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-0 sm:p-4 bg-black/80 [.light-theme_&]:bg-slate-900/80 backdrop-blur-sm transition-colors">
      <div className="bg-slate-900 [.light-theme_&]:bg-white rounded-none sm:rounded-[2.5rem] w-full h-full sm:h-auto sm:max-w-[98vw] max-h-[100dvh] sm:max-h-[98vh] flex flex-col overflow-hidden border-0 sm:border border-slate-800 [.light-theme_&]:border-slate-200 shadow-2xl animate-in zoom-in-95 duration-300 transition-colors">
        <div className="p-4 sm:p-8 border-b border-slate-800 [.light-theme_&]:border-slate-200 flex justify-between items-center bg-slate-950 [.light-theme_&]:bg-slate-50 shrink-0 shadow-lg relative z-10 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-600/20 text-orange-500 flex items-center justify-center text-lg sm:text-xl shadow-inner border border-orange-500/20">
              <i className="fas fa-trophy"></i>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white [.light-theme_&]:text-slate-900 uppercase tracking-tight leading-none transition-colors">
                {readOnly ? t('competition_results') : t('results_management')}
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
            {canExportPDF && (
              <button
                onClick={handlePreviewPDF}
                disabled={isGeneratingPDF}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-orange-500 hover:border-orange-500/50 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGeneratingPDF ? (
                  <i className="fas fa-circle-notch fa-spin text-orange-500"></i>
                ) : (
                  <i className="fas fa-file-pdf text-red-500"></i>
                )}
                <span className="hidden sm:inline">{isGeneratingPDF ? 'Generazione...' : 'Scarica PDF'}</span>
                <span className="sm:hidden">PDF</span>
              </button>
            )}
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
          {!readOnly && event.status !== 'validated' && parsedRows.length === 0 && (
            <div className="w-full md:w-1/3 p-4 sm:p-6 border-b md:border-b-0 md:border-r border-slate-800 md:overflow-y-auto bg-slate-900/50 shrink-0 md:shrink">
              {/* Excel Import/Export for Admin */}
              {user?.role === 'admin' && (
                <div className="mb-6 p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-2 shadow-inner">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <i className="fas fa-file-excel text-sm"></i>
                    <h4 className="text-[10px] font-black uppercase tracking-widest leading-none">Importazione Excel</h4>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadExcelTemplate}
                      className="px-3 py-2 rounded-xl bg-slate-700/50 border border-slate-600 hover:border-emerald-500/50 text-white hover:text-emerald-300 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 text-center shadow-md w-full"
                    >
                      <i className="fas fa-download text-xs"></i>
                      <span>{t('download_template_excel')}</span>
                    </button>
                    <label className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-center shadow-lg shadow-emerald-500/20 w-full">
                      <i className="fas fa-upload text-xs"></i>
                      <span>{t('upload_results_excel')}</span>
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleUploadExcelResults}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white uppercase tracking-widest">
                  {editingResultId ? t('update_label') : t('insert_result_label')}
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
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{t('prize_config_title')}</h4>
                    <button 
                      onClick={handleSavePrizeSettings}
                      className="px-3 py-1 rounded-lg bg-green-600 text-white text-[10px] font-bold hover:bg-green-500 transition-all shadow-lg"
                    >
                      {t('save')}
                    </button>
                  </div>
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Categories */}
                    <div>
                      <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">{t('categories_label')}</h5>
                      <div className="space-y-2">
                        {categories.length === 0 ? (
                          <p className="text-[9px] text-slate-600 italic">{t('no_categories_found')}</p>
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
                      <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">{t('qualifications_label')}</h5>
                      <div className="space-y-2">
                        {qualifications.length === 0 ? (
                          <p className="text-[9px] text-slate-600 italic">{t('no_qualifications_found')}</p>
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('shooter')}</label>
                  <div className="flex gap-2">
                    <ShooterSearch 
                      value={selectedUserId} 
                      onChange={(val) => {
                        setSelectedUserId(val);
                        setIsDirty(true);
                      }}
                      shooters={shootersWithoutResults}
                      useId={true}
                      placeholder={t('search_shooter_ranking_placeholder')}
                      className="flex-1"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowQuickAddShooter(true)}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-orange-500 hover:bg-orange-600 hover:text-white border border-slate-700 hover:border-orange-500 transition-all active:scale-95 flex items-center justify-center shadow-lg"
                      title={t('add_new_shooter_title')}
                    >
                      <i className="fas fa-user-plus"></i>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('series_label')}</label>
                    <span className="text-[9px] text-orange-500 font-medium italic">{t('series_detail_hint')}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {series.map((s, i) => (
                      <div key={i} className="relative">
                        <input 
                          type="number" 
                          min="0" 
                          max={targetsPerSeries}
                          value={s}
                          onChange={(e) => handleSeriesValueChange(i, e.target.value)}
                          onFocus={() => {
                            if (expandedSeries !== i) setExpandedSeries(i);
                          }}
                          placeholder={`S${i+1}`}
                          className={`w-full bg-slate-950 border ${expandedSeries === i ? 'border-orange-500' : 'border-slate-800'} rounded-lg px-2 py-2 text-center text-white focus:border-orange-600 outline-none text-sm font-bold`}
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
                      <div className="space-y-4">
                        {(() => {
                          const layoutInfo = getSeriesLayout(event.discipline as Discipline);
                          let absoluteIdx = 0;
                          const isDCK = event.discipline === Discipline.DCK;
                          return layoutInfo.layout.map((count, groupIdx) => (
                            <div key={groupIdx} className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-slate-800"></div>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-2">{layoutInfo.label} {groupIdx + 1}</span>
                                <div className="h-px flex-1 bg-slate-800"></div>
                              </div>
                              <div className={`flex flex-wrap ${isDCK ? 'gap-1' : 'gap-1.5'} justify-center`}>
                                {Array.from({ length: count }).map(() => {
                                  const targetIdx = absoluteIdx++;
                                  const isHit = detailedScores[expandedSeries!]?.[targetIdx];
                                  return (
                                    <button
                                      key={targetIdx}
                                      type="button"
                                      onClick={() => handleDetailedScoreChange(expandedSeries!, targetIdx)}
                                      className={`${isDCK ? 'w-6 h-6 sm:w-5 sm:h-5 text-[7px] sm:text-[9px] border' : 'w-9 h-9 border-2 text-[11px]'} rounded-full transition-all active:scale-90 flex items-center justify-center font-black ${getDotColors(isHit)}`}
                                    >
                                      {targetIdx + 1}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('shooter_signed_up_for')}</label>
                  <select 
                    value={rankingPreference} 
                    onChange={(e) => {
                      setRankingPreference(e.target.value as 'categoria' | 'qualifica');
                      setIsDirty(true);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-600 outline-none"
                  >
                    <option value="categoria">{t('category')}</option>
                    <option value="qualifica">{t('qualification')}</option>
                  </select>
                </div>

                {/* Competition Override */}
                <div className="p-3 bg-orange-600/10 rounded-xl border border-orange-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-orange-500">
                    <i className="fas fa-exclamation-triangle text-[10px]"></i>
                    <h4 className="text-[9px] font-black uppercase tracking-widest">{t('ranking_priority_override')}</h4>
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
                      {t('none')}
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
                      {t('force_category')}
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
                      {t('force_qualification')}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('enable_society_ranking')}</label>
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
                        {t('enable_action_label')}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('enable_team_ranking')}</label>
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
                        {t('enable_action_label')}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('shoot_off_competition_label')} ({t('optional')})</label>
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
                    {t('total')}: <span className="text-xl font-black text-white">{calculateTotal()}</span>
                  </div>
                  <div className="flex gap-2">
                    {editingResultId && (
                      <button 
                        type="button"
                        onClick={() => {
                          const numSeries = Math.ceil((event.targets || 100) / targetsPerSeries);
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
                        {t('cancel')}
                      </button>
                    )}
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-500 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving && <i className="fas fa-circle-notch fa-spin"></i>}
                      {saving ? `${t('saving_short')}...` : (editingResultId ? t('update_label') : t('save'))}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Results Table Section */}
          <div className={`w-full ${(readOnly || event.status === 'validated' || parsedRows.length > 0) ? 'md:w-full' : 'md:w-2/3'} p-4 sm:p-6 md:overflow-y-auto bg-slate-950 [.light-theme_&]:bg-white shrink-0 md:shrink transition-colors`}>
            {parsedRows.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-xl font-black text-white [.light-theme_&]:text-slate-900 uppercase tracking-tight leading-none">
                      {t('excel_import_preview_title')}
                    </h3>
                    <p className="text-xs text-slate-400 mt-2">
                      Rivedi i dati caricati dall'Excel. Correggi eventuali errori o registra i tiratori mancanti direttamente prima di salvare i risultati in database.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setParsedRows([])}
                      className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all"
                    >
                      {t('back_to_results')}
                    </button>
                    <button
                      type="button"
                      disabled={saving || parsedRows.some(r => r.errors.some((e: string) => !e.startsWith("ATTENZIONE:")))}
                      onClick={handleSaveAllExcelResults}
                      className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-600/20 flex items-center gap-2"
                    >
                      {saving && <i className="fas fa-circle-notch fa-spin"></i>}
                      {saving ? 'Salvataggio...' : t('confirm_and_save_all')}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/45 custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-700 text-[10px] uppercase tracking-widest text-slate-200 bg-slate-800">
                        <th className="p-3 font-black text-center w-12 text-slate-300">Stato</th>
                        <th className="p-3 font-black text-slate-300">Tiratore</th>
                        <th className="p-3 font-black text-center text-slate-300">Codice</th>
                        <th className="p-3 font-black text-center text-slate-300">Email</th>
                        <th className="p-3 font-black text-slate-300">Società / Categoria / Qualifica</th>
                        {Array.from({ length: Math.ceil((event.targets || 100) / targetsPerSeries) }).map((_, i) => (
                          <th key={i} className="p-3 font-black text-center w-14 text-slate-300 font-bold">S{i + 1}</th>
                        ))}
                        <th className="p-3 font-black text-center w-14 text-slate-300">Shoot-Off</th>
                        <th className="p-3 font-black text-center w-20 text-slate-300 font-bold">Preferenza</th>
                        <th className="p-3 font-black text-center w-36 text-slate-300">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, idx) => {
                        const hasErrors = row.errors.some((e: string) => !e.startsWith("ATTENZIONE:"));
                        const hasWarnings = row.errors.some((e: string) => e.startsWith("ATTENZIONE:"));
                        
                        return (
                          <tr key={idx} className={`border-b border-slate-700 hover:bg-slate-800/50 transition-colors ${hasErrors ? 'bg-red-500/10' : ''}`}>
                            <td className="p-3 text-center">
                              {hasErrors ? (
                                <i className="fas fa-exclamation-circle text-red-500 text-base" title={row.errors.filter((e: string) => !e.startsWith("ATTENZIONE:")).join('\n')}></i>
                              ) : hasWarnings ? (
                                <i className="fas fa-exclamation-triangle text-amber-500 text-base" title={row.errors.join('\n')}></i>
                              ) : (
                                <i className="fas fa-check-circle text-green-500 text-base"></i>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="font-black text-white text-xs">{row.surname} {row.name}</div>
                              {row.errors.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {row.errors.map((err: string, eIdx: number) => (
                                    <div key={eIdx} className={`text-[9px] font-medium leading-none ${err.startsWith("ATTENZIONE:") ? 'text-amber-500 font-bold' : 'text-red-500'}`}>
                                      • {err}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono text-xs text-slate-400 font-bold">{row.shooterCode}</td>
                            <td className="p-3 text-center text-xs text-slate-400">{row.email}</td>
                            <td className="p-3 text-xs">
                              <div className="text-slate-300">{row.society}</div>
                              <div className="flex gap-1 mt-1">
                                <span className="px-1.5 py-0.5 rounded bg-slate-850 text-orange-400 border border-slate-800 text-[9px] font-bold">{row.category}</span>
                                {row.qualification && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-850 text-indigo-400 border border-slate-800 text-[9px] font-bold">{row.qualification}</span>
                                )}
                              </div>
                            </td>
                            {row.scores.map((s: number, sIdx: number) => (
                              <td key={sIdx} className="p-3 text-center font-bold text-sm text-white">{s}</td>
                            ))}
                            <td className="p-3 text-center font-bold text-sm text-amber-500">{row.shootOff || '-'}</td>
                            <td className="p-3 text-center text-[10px] font-bold uppercase text-slate-500">
                              {row.rankingPreference === 'qualifica' ? 'Qualifica' : 'Categoria'}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {!row.userFound && (
                                  <button
                                    type="button"
                                    onClick={() => handleCreateUserInline(idx)}
                                    className="px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white text-[9px] font-black uppercase tracking-wider border border-blue-500/30 transition-all flex items-center gap-1"
                                    title="Registra Tiratore a database con questi dati Excel"
                                  >
                                    <i className="fas fa-user-plus"></i>
                                    <span>Crea</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setParsedRows(prev => prev.filter((_, i) => i !== idx));
                                    triggerToast("Riga rimossa dall'importazione.", "info");
                                  }}
                                  className="px-2 py-1 rounded bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white text-[9px] font-black uppercase tracking-wider border border-red-500/30 transition-all flex items-center gap-1"
                                  title="Escludi questa riga dall'importazione"
                                >
                                  <i className="fas fa-trash text-[8px]"></i>
                                  <span>Escludi</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
              <h3 className="text-lg font-bold text-white [.light-theme_&]:text-slate-900 uppercase tracking-widest transition-colors">
                {event.status === 'validated' ? t('pdf_final_ranking') : (readOnly ? t('pdf_general_ranking') : t('pdf_provisional_ranking'))}
              </h3>
              
              <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                {/* Search Shooter Input */}
                <div className="relative flex-1 min-w-[200px] lg:max-w-[300px]">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  <input 
                    type="text" 
                    placeholder={t('search_shooter_ranking_placeholder')} 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 [.light-theme_&]:bg-slate-50 border border-slate-800 [.light-theme_&]:border-slate-200 rounded-xl py-2 pl-9 pr-10 text-sm text-white [.light-theme_&]:text-slate-900 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-slate-600 font-bold"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-full transition-all"
                    >
                      <i className="fas fa-times-circle text-sm"></i>
                    </button>
                  )}
                </div>

                <div className="flex bg-slate-900 [.light-theme_&]:bg-slate-100 rounded-xl p-1 border border-slate-800 [.light-theme_&]:border-slate-200 transition-colors">
                  <button
                    onClick={() => setViewMode('generale')}
                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'generale' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                  >
                    {t('all_results_view')}
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('categoria');
                      if (!selectedCategory && categories.length > 0) {
                        setSelectedCategory(categories[0] as string);
                      }
                    }}
                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'categoria' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                  >
                    {t('category')}
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('qualifica');
                      if (!selectedQualification && qualifications.length > 0) {
                        setSelectedQualification(qualifications[0] as string);
                      }
                    }}
                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'qualifica' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                  >
                    {t('qualification')}
                  </button>
                  {hasSocietyRanking && (
                    <button
                      onClick={() => setViewMode('societa')}
                      className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'societa' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                    >
                      {t('society_label')}
                    </button>
                  )}
                  {hasTeamRanking && (
                    <button
                      onClick={() => setViewMode('squadre')}
                      className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'squadre' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                    >
                      {t('teams_label')}
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
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedCategory === cat ? 'bg-slate-800 border-orange-500 text-orange-500 shadow-lg shadow-orange-500/10' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
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
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedQualification === qual ? 'bg-slate-800 border-orange-500 text-orange-500 shadow-lg shadow-orange-500/10' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
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
                  qualification: getShooterQualification(r)
                }))].map(u => [u.id, u])).values())}
                teams={teams} 
                token={token} 
                onTeamsUpdate={fetchData}
                readOnly={readOnly}
                currentUser={user}
                allSocieties={societies}
              />
            ) : viewMode === 'societa' ? (
              societyRanking.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <i className="fas fa-users text-4xl mb-3 opacity-50"></i>
                  <p>{t('no_societies_found_in_results')}</p>
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
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{t('top_3_results_label')}</h5>
                        <div className="space-y-2">
                          {soc.shooters.map((shooter, sIdx) => (
                            <div key={shooter.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-900 border border-slate-800/50">
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500 font-black text-xs">{sIdx + 1}.</span>
                                <span className="text-sm font-bold text-white">{shooter.user_surname} {shooter.user_name}</span>
                                <div className="flex items-center gap-1">
                                  {formatDisplayValue(shooter.category_at_time || shooter.category, 'category') && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black border ${ (event.ranking_preference_override || shooter.ranking_preference_override || shooter.ranking_preference || 'categoria') === 'categoria' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-slate-700 text-slate-200 border-slate-600'}`}>
                                      {formatDisplayValue(shooter.category_at_time || shooter.category, 'category')}
                                    </span>
                                  )}
                                  {formatDisplayValue(shooter.category_at_time || shooter.category, 'category') && formatDisplayValue(getShooterQualification(shooter), 'qualification') && (
                                    <span className="text-slate-700 text-[10px]">/</span>
                                  )}
                                  {formatDisplayValue(getShooterQualification(shooter), 'qualification') && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black border ${ (event.ranking_preference_override || shooter.ranking_preference_override || shooter.ranking_preference || 'categoria') === 'qualifica' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                      {formatDisplayValue(getShooterQualification(shooter), 'qualification')}
                                    </span>
                                  )}
                                </div>
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
                <p>{t('no_results')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500">
                      <th className="p-2 sm:p-3 font-black">{t('pos_short')}</th>
                      <th className="p-2 sm:p-3 font-black text-center">PETT</th>
                      <th className="p-2 sm:p-3 font-black">{t('shooter')}</th>
                      <th className="p-2 sm:p-3 font-black">{t('cat_qua')}</th>
                      {Array.from({ length: maxSeriesCount }).map((_, i) => (
                        <th key={i} className="p-2 sm:p-3 font-black text-center">S{i + 1}</th>
                      ))}
                      <th className="p-2 sm:p-3 font-black text-right">{t('total')}</th>
                      <th className="p-2 sm:p-3 font-black text-right">{t('shootoff')}</th>
                      {!readOnly && event.status !== 'validated' && <th className="p-2 sm:p-3 font-black text-center">{t('actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r, idx) => {
                      const rCat = r.category_at_time || r.category;
                      const rQual = getShooterQualification(r);
                      
                      // Priority: Event Override > Competition Override > Shooter Preference
                      let effectivePref = event.ranking_preference_override || r.ranking_preference_override || r.ranking_preference || 'categoria';
                      if (effectivePref === 'qualifica' && !rQual) {
                        effectivePref = 'categoria';
                      }
                      const isOverridden = !!(event.ranking_preference_override || r.ranking_preference_override);
                      
                      if (r.is_registered_only) {
                        return (
                          <tr key={`reg-${r.registration_id}`} className="border-b border-slate-800/50 bg-slate-900/30">
                            <td className="p-2 sm:p-3 text-slate-500 font-bold text-xs sm:text-sm">-</td>
                            <td className="p-2 sm:p-3 text-center text-orange-500 font-black text-xs">
                              {r.bib_number || '-'}
                            </td>
                            <td className="p-2 sm:p-3 text-slate-300 font-medium text-xs sm:text-sm">
                              <div className="flex flex-col">
                                <span>{r.user_surname} {r.user_name}</span>
                                {r.shooter_code && (
                                  <span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mt-0.5">{r.shooter_code}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 sm:p-3 text-slate-500 text-[9px] sm:text-[10px]">
                              <div className="flex items-center gap-1">
                                {formatDisplayValue(r.category, 'category') && (
                                  <span className={`px-1.5 py-0.5 rounded ${r.registration_type !== 'Qualifica' && r.registration_type !== 'Per Qualifica' ? 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30' : 'bg-slate-800 text-slate-500'}`}>
                                    {formatDisplayValue(r.category, 'category')}
                                  </span>
                                )}
                                {formatDisplayValue(r.category, 'category') && formatDisplayValue(getShooterQualification(r), 'qualification') && (
                                  <span className="text-slate-800">/</span>
                                )}
                                {formatDisplayValue(getShooterQualification(r), 'qualification') && (
                                  <span className={`px-1.5 py-0.5 rounded ${r.registration_type === 'Qualifica' || r.registration_type === 'Per Qualifica' ? 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30' : 'bg-slate-800 text-slate-500'}`}>
                                    {formatDisplayValue(getShooterQualification(r), 'qualification')}
                                  </span>
                                )}
                                {!formatDisplayValue(r.category, 'category') && !formatDisplayValue(getShooterQualification(r), 'qualification') && <span>-</span>}
                              </div>
                            </td>
                            {Array.from({ length: maxSeriesCount }).map((_, i) => (
                              <td key={i} className="p-2 sm:p-3 text-center text-slate-700">-</td>
                            ))}
                            <td className="p-2 sm:p-3 text-right text-slate-700 font-bold">-</td>
                            <td className="p-2 sm:p-3 text-right text-slate-700">-</td>
                            {!readOnly && event.status !== 'validated' && (
                              <td className="p-2 sm:p-3 text-center">
                                  <button
                                    onClick={() => {
                                      if (r.user_id) {
                                        setSelectedUserId(r.user_id.toString());
                                        setEditingResultId(null);
                                        // Reset form for new result
                                        const numSeries = Math.ceil((event.targets || 100) / targetsPerSeries);
                                        setSeries(Array(numSeries).fill('0'));
                                        setDetailedScores(Array.from({ length: numSeries }, () => []));
                                        setShootOff('');
                                        setExpandedSeries(null);
                                        
                                        // Auto-fill ranking preference from registration
                                        if (r.registration_type === 'Per Qualifica') {
                                          setRankingPreference('qualifica');
                                        } else {
                                          setRankingPreference('categoria');
                                        }
                                        
                                        setIsDirty(true);
                                        // Scroll to form on mobile
                                        const form = document.getElementById('result-form');
                                        if (form) form.scrollIntoView({ behavior: 'smooth' });
                                      }
                                    }}
                                    className="p-2 text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors"
                                    title={t('insert_result_label')}
                                  >
                                  <i className="fas fa-plus-circle"></i>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      }

                      return (
                        <React.Fragment key={r.id}>
                          <tr className="border-b border-slate-800/50 transition-colors">
                            <td className="p-2 sm:p-3 text-white font-bold text-xs sm:text-sm whitespace-nowrap">
                              {idx + 1} {getPrizeStatus(r) && <span className="text-yellow-500 text-[10px] ml-1 font-black">(P)</span>}
                            </td>
                            <td className="p-2 sm:p-3 text-center text-orange-500 font-black text-xs sm:text-sm">
                              {r.bib_number || '-'}
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
                            <td className="p-2 sm:p-3 text-slate-400 text-[9px] sm:text-[10px]">
                              <div className="flex items-center gap-1">
                                {formatDisplayValue(rCat, 'category') && (
                                  <span className={`px-1.5 py-0.5 rounded ${effectivePref === 'categoria' ? 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30' : 'bg-slate-800 text-slate-500'}`}>
                                    {formatDisplayValue(rCat, 'category')}
                                  </span>
                                )}
                                {formatDisplayValue(rCat, 'category') && formatDisplayValue(rQual, 'qualification') && (
                                  <span className="text-slate-700">/</span>
                                )}
                                {formatDisplayValue(rQual, 'qualification') && (
                                  <span className={`px-1.5 py-0.5 rounded ${effectivePref === 'qualifica' ? 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30' : 'bg-slate-800 text-slate-500'}`}>
                                    {formatDisplayValue(rQual, 'qualification')}
                                  </span>
                                )}
                                {!formatDisplayValue(rCat, 'category') && !formatDisplayValue(rQual, 'qualification') && <span>-</span>}
                              </div>
                            </td>
                          {Array.from({ length: maxSeriesCount }).map((_, i) => (
                            <td key={i} className={`p-2 sm:p-3 font-mono text-[11px] sm:text-sm text-center ${r.scores && r.scores[i] === targetsPerSeries ? 'text-red-500 font-black' : 'text-slate-300'}`}>
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
                                  title={t('hits_detail')}
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
                                    : Array.from({ length: targetsPerSeries }, (_, i) => i < score);
                                  
                                  return (
                                    <div key={sIdx} className="flex flex-col gap-2 p-3 bg-slate-900/50 rounded-xl border border-slate-800/50">
                                      <div className="flex justify-between items-center px-1">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serie {sIdx + 1}</div>
                                        <div className="text-sm font-black text-orange-500">{score}<span className="text-[8px] text-slate-500 ml-0.5">/{targetsPerSeries}</span></div>
                                      </div>
                                      <div className="flex flex-wrap gap-4 items-end">
                                        {(() => {
                                          const layoutInfo = getSeriesLayout(event.discipline as Discipline);
                                          let absIdx = 0;
                                          return layoutInfo.layout.map((count, gIdx) => (
                                            <div key={gIdx} className="flex flex-col gap-1">
                                              <span className="text-[7px] text-slate-600 font-black uppercase tracking-tight opacity-70 leading-none">{layoutInfo.label.charAt(0)}{gIdx + 1}</span>
                                              <div className="flex gap-0.5">
                                                {Array.from({ length: count }).map(() => {
                                                  const tIdx = absIdx++;
                                                  const hit = dScore[tIdx];
                                                  return (
                                                    <div 
                                                      key={tIdx} 
                                                      className={`w-2 h-2 rounded-full border ${getSmallDotColors(hit)} shadow-sm`}
                                                      title={`P${tIdx + 1}: ${hit ? 'Colpito' : 'Zero'}`}
                                                    >
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ));
                                        })()}
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
          </>
        )}
      </div>
    </div>

        {/* Floating Refresh Button */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1050]">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchResultsAndTeams(false)}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900/90 [.light-theme_&]:bg-white/95 backdrop-blur-md border border-slate-800/50 [.light-theme_&]:border-slate-300 shadow-2xl text-slate-300 [.light-theme_&]:text-slate-600 hover:text-slate-100 [.light-theme_&]:hover:text-black transition-all font-bold uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-not-allowed disabled:text-slate-500 [.light-theme_&]:disabled:text-slate-500"
          >
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
            <span>{loading ? t('loading_short') : t('refresh')}</span>
          </motion.button>
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
          initialDetails={quickAddInitialDetails || undefined}
          onClose={() => {
            setShowQuickAddShooter(false);
            setQuickAddInitialDetails(null);
          }}
          onSuccess={(newUser) => {
            const updatedUsers = [...users, newUser];
            setUsers(updatedUsers);
            setSelectedUserId(newUser.id);
            setIsDirty(true);
            setShowQuickAddShooter(false);
            if (parsedRows.length > 0) {
              reEvaluateParsedRows(updatedUsers);
            }
            setQuickAddInitialDetails(null);
          }}
        />
      )}
    </div>,
    document.body
  );
};

export default EventResultsManager;
