
import React, { useRef, useState } from 'react';
import { Competition, Cartridge, CartridgeType, AppData, User } from '../types';

interface SettingsProps {
  user: User | null;
  token: string | null;
  competitions: Competition[];
  cartridges: Cartridge[];
  cartridgeTypes: CartridgeType[];
  clientId: string;
  onClientIdChange: (id: string) => void;
  onImport: (data: AppData) => void;
  syncStatus: string;
  lastSync: string | null;
  isDriveConnected: boolean;
  onConnectDrive: () => void;
  onDisconnectDrive: () => void;
  onSaveDrive: () => void;
  onLoadDrive: () => void;
  appSettings?: any;
  onSettingsUpdate?: () => void;
  societies?: any[];
}

const Settings: React.FC<SettingsProps> = ({ 
  user, token, competitions, cartridges, cartridgeTypes, clientId, onClientIdChange, onImport, 
  syncStatus, lastSync, isDriveConnected, onConnectDrive, onDisconnectDrive, onSaveDrive, onLoadDrive,
  appSettings, onSettingsUpdate, societies
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(sessionStorage.getItem('settings_unlocked') === 'true');
  const [passError, setPassError] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentOrigin = window.location.origin;

  const handleUpdateAppSetting = async (key: string, value: any) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ key, value })
      });
      if (res.ok) {
        onSettingsUpdate?.();
      }
    } catch (err) {
      console.error('Error updating setting:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const defaultAccess = { enabled: false, accessType: 'all', allowedSocieties: [] };
  
  const normalizeAccess = (access: any) => {
    if (typeof access === 'boolean') {
      return { enabled: access, accessType: 'all', allowedSocieties: [] };
    }
    return { ...defaultAccess, ...access };
  };

  const resultsAccess = appSettings?.event_results_access || {};
  const tiratoriAccess = normalizeAccess(resultsAccess.tiratori);
  const societaAccess = normalizeAccess(resultsAccess.societa);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'bledar') {
      setIsUnlocked(true);
      sessionStorage.setItem('settings_unlocked', 'true');
      setPassError(false);
    } else {
      setPassError(true);
      setPassword('');
      setTimeout(() => setPassError(false), 2000);
    }
  };

  const handleExport = () => {
    const data: AppData = { competitions, cartridges, cartridgeTypes };
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clay_tracker_pro_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportAll = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/export-all', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Errore durante l\'esportazione');
      const data = await res.json();
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clay_tracker_pro_FULL_SYSTEM_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (_) {
      alert("Errore durante l'esportazione");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Sezione Backup Manuale - Sempre Visibile */}
      <section className="bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-xl">
        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-3">
          <i className="fas fa-hdd text-blue-500"></i> Backup Manuale
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={handleExport} className="flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl border border-slate-600 transition-all">
            <i className="fas fa-file-export text-orange-500"></i> Esporta
          </button>
          {user?.role === 'admin' && (
            <button onClick={handleExportAll} className="flex items-center justify-center gap-3 bg-orange-600/20 hover:bg-orange-600/30 text-orange-500 font-bold py-4 rounded-2xl border border-orange-600/30 transition-all">
              <i className="fas fa-database"></i> Esporta
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl border border-slate-600 transition-all">
            <i className="fas fa-file-import text-blue-500"></i> Importa
          </button>
          <input type="file" ref={fileInputRef} onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
              try {
                const json = JSON.parse(re.target?.result as string);
                if (json && typeof json === 'object') onImport(json);
              } catch (_) { alert("File non valido"); }
            };
            reader.readAsText(file);
          }} accept=".json" className="hidden" />
        </div>
        <p className="mt-4 text-[9px] text-slate-500 font-bold uppercase tracking-widest text-center">
          Utilizza questi tasti per salvare o caricare i dati <span className="text-white">manualmente</span> sul tuo dispositivo
        </p>
      </section>

      {user?.role === 'admin' && (
        <>
          {!isUnlocked ? (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-orange-600/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500">
                <i className="fas fa-lock text-2xl"></i>
              </div>
              <h3 className="text-lg font-black text-white mb-4 uppercase tracking-tight">Cloud & Opzioni Avanzate</h3>
              <form onSubmit={handleUnlock} className="max-w-xs mx-auto space-y-3">
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className={`w-full bg-slate-950 border-2 ${passError ? 'border-red-600' : 'border-slate-800'} rounded-xl px-4 py-3 text-white text-center text-sm focus:border-orange-600 outline-none transition-all font-mono`}
                />
                <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-3 rounded-xl transition-all active:scale-95 text-xs uppercase">Sblocca Area Cloud</button>
              </form>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tight">Sincronizzazione Cloud</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${isDriveConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {isDriveConnected ? 'Collegato al Cloud' : 'Disconnesso'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Stato: <span className="text-orange-500">{syncStatus.toUpperCase()}</span></p>
                      {lastSync && <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">Ultimo: {lastSync}</p>}
                    </div>
                  </div>

                  {!isDriveConnected ? (
                    <div className="space-y-4">
                      <button onClick={onConnectDrive} className="w-full bg-white hover:bg-slate-100 text-slate-900 font-black py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 group">
                        <i className="fab fa-google-drive text-orange-600 group-hover:scale-110 transition-transform"></i> COLLEGA DRIVE
                      </button>
                      <p className="text-center text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                        Collega Drive per sincronizzare <span className="text-white">gare, allenamenti e magazzino</span> automaticamente
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button onClick={onSaveDrive} className="bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95">
                          {syncStatus === 'syncing' ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-upload-alt"></i>} SALVA ORA
                        </button>
                        <button onClick={onLoadDrive} className="bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl transition-all border border-slate-700 flex items-center justify-center gap-3 active:scale-95">
                          <i className="fas fa-cloud-download-alt"></i> RECUPERA TUTTO
                        </button>
                      </div>
                      <div className="flex justify-center mt-2">
                        <button onClick={onDisconnectDrive} className="text-slate-500 hover:text-red-500 text-[9px] font-bold uppercase tracking-widest transition-colors">Scollega Account</button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <i className="fas fa-shield-alt text-orange-500 text-xl"></i>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Accesso Risultati Gare</h2>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tight">Accesso Tiratori</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Permetti ai tiratori di consultare i risultati delle gare</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateAppSetting('event_results_access', { ...resultsAccess, tiratori: { ...tiratoriAccess, enabled: !tiratoriAccess.enabled } })}
                        disabled={isSaving}
                        className={`w-14 h-7 rounded-full transition-all relative shrink-0 ${tiratoriAccess.enabled ? 'bg-orange-600' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg transition-all ${tiratoriAccess.enabled ? 'left-8' : 'left-1'}`}></div>
                      </button>
                    </div>
                    {tiratoriAccess.enabled && (
                      <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="tiratori_access_type" 
                              checked={tiratoriAccess.accessType === 'all'}
                              onChange={() => handleUpdateAppSetting('event_results_access', {
                                ...resultsAccess,
                                tiratori: { ...tiratoriAccess, accessType: 'all' }
                              })}
                              className="accent-orange-600"
                            />
                            <span className="text-xs font-bold text-white uppercase">Tutti i tiratori</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="tiratori_access_type" 
                              checked={tiratoriAccess.accessType === 'specific'}
                              onChange={() => handleUpdateAppSetting('event_results_access', {
                                ...resultsAccess,
                                tiratori: { ...tiratoriAccess, accessType: 'specific' }
                              })}
                              className="accent-orange-600"
                            />
                            <span className="text-xs font-bold text-white uppercase">Solo alcune società</span>
                          </label>
                        </div>
                        
                        {tiratoriAccess.accessType === 'specific' && (
                          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {societies?.map(soc => (
                              <label key={soc.id} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                                <input 
                                  type="checkbox"
                                  checked={tiratoriAccess.allowedSocieties.includes(soc.name)}
                                  onChange={(e) => {
                                    const newSocieties = e.target.checked 
                                      ? [...tiratoriAccess.allowedSocieties, soc.name]
                                      : tiratoriAccess.allowedSocieties.filter((s: string) => s !== soc.name);
                                    handleUpdateAppSetting('event_results_access', {
                                      ...resultsAccess,
                                      tiratori: { ...tiratoriAccess, allowedSocieties: newSocieties }
                                    });
                                  }}
                                  className="w-4 h-4 rounded border-slate-700 text-orange-600 focus:ring-orange-600 focus:ring-offset-slate-900 bg-slate-950"
                                />
                                <span className="text-xs font-bold text-slate-300">{soc.name}</span>
                              </label>
                            ))}
                            {(!societies || societies.length === 0) && (
                              <p className="text-xs text-slate-500 italic">Nessuna società trovata.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tight">Accesso Società</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Permetti alle società di consultare i risultati delle gare</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateAppSetting('event_results_access', { ...resultsAccess, societa: { ...societaAccess, enabled: !societaAccess.enabled } })}
                        disabled={isSaving}
                        className={`w-14 h-7 rounded-full transition-all relative shrink-0 ${societaAccess.enabled ? 'bg-orange-600' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg transition-all ${societaAccess.enabled ? 'left-8' : 'left-1'}`}></div>
                      </button>
                    </div>
                    {societaAccess.enabled && (
                      <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="societa_access_type" 
                              checked={societaAccess.accessType === 'all'}
                              onChange={() => handleUpdateAppSetting('event_results_access', {
                                ...resultsAccess,
                                societa: { ...societaAccess, accessType: 'all' }
                              })}
                              className="accent-orange-600"
                            />
                            <span className="text-xs font-bold text-white uppercase">Tutte le società</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="societa_access_type" 
                              checked={societaAccess.accessType === 'specific'}
                              onChange={() => handleUpdateAppSetting('event_results_access', {
                                ...resultsAccess,
                                societa: { ...societaAccess, accessType: 'specific' }
                              })}
                              className="accent-orange-600"
                            />
                            <span className="text-xs font-bold text-white uppercase">Solo alcune società</span>
                          </label>
                        </div>
                        
                        {societaAccess.accessType === 'specific' && (
                          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {societies?.map(soc => (
                              <label key={soc.id} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                                <input 
                                  type="checkbox"
                                  checked={societaAccess.allowedSocieties.includes(soc.name)}
                                  onChange={(e) => {
                                    const newSocieties = e.target.checked 
                                      ? [...societaAccess.allowedSocieties, soc.name]
                                      : societaAccess.allowedSocieties.filter((s: string) => s !== soc.name);
                                    handleUpdateAppSetting('event_results_access', {
                                      ...resultsAccess,
                                      societa: { ...societaAccess, allowedSocieties: newSocieties }
                                    });
                                  }}
                                  className="w-4 h-4 rounded border-slate-700 text-orange-600 focus:ring-orange-600 focus:ring-offset-slate-900 bg-slate-950"
                                />
                                <span className="text-xs font-bold text-slate-300">{soc.name}</span>
                              </label>
                            ))}
                            {(!societies || societies.length === 0) && (
                              <p className="text-xs text-slate-500 italic">Nessuna società trovata.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-6 p-4 bg-orange-600/5 border border-orange-600/10 rounded-2xl">
                  <p className="text-[10px] text-orange-500/80 font-bold uppercase tracking-widest text-center italic leading-relaxed">
                    Nota: L'amministratore ha sempre accesso completo a tutti i risultati, indipendentemente da queste impostazioni.
                  </p>
                </div>
              </section>

              <div className="flex justify-center">
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-slate-600 hover:text-orange-500 text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2">
                  <i className={`fas ${showAdvanced ? 'fa-eye-slash' : 'fa-cog'}`}></i> {showAdvanced ? 'Nascondi Opzioni Avanzate' : 'Mostra Opzioni Avanzate'}
                </button>
              </div>

              {showAdvanced && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <section className={`bg-slate-950 border ${syncStatus === 'api_disabled' ? 'border-red-500' : 'border-slate-800'} rounded-3xl p-6`}>
                    <div className="flex items-center gap-3 mb-4">
                      <i className={`fas ${syncStatus === 'api_disabled' ? 'fa-exclamation-circle text-red-500' : 'fa-tools text-slate-500'} text-lg`}></i>
                      <h2 className="text-sm font-black uppercase tracking-tight text-white">Configurazione Tecnica</h2>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Origin Autorizzata:</p>
                        <code className="text-orange-500 font-mono text-[10px] break-all">{currentOrigin}</code>
                      </div>
                      <div className="mt-6 space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Google Client ID</label>
                        <input type="text" value={clientId} onChange={(e) => onClientIdChange(e.target.value)} placeholder="Incolla il Client ID" className="w-full bg-slate-900 border-2 border-slate-800 rounded-xl px-4 py-3 text-white text-xs font-mono focus:border-orange-600 outline-none" />
                      </div>
                    </div>
                  </section>
                </div>
              )}

              <div className="text-center pt-4">
                <button onClick={() => { setIsUnlocked(false); sessionStorage.removeItem('settings_unlocked'); }} className="text-slate-600 hover:text-white text-[10px] font-bold uppercase tracking-widest">
                  <i className="fas fa-sign-out-alt mr-2"></i> Blocca Area Riservata
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Settings;
