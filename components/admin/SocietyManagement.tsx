import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as XLSX from 'xlsx';
import SocietyDetailModal from '../SocietyDetailModal';
import { Discipline } from '../../types';
import { useAdmin } from '../../contexts/AdminContext';
import { useUI } from '../../contexts/UIContext';
import { useLanguage } from '../../contexts/LanguageContext';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Red icon for user's society
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Orange icon for other societies
const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map Resizer component to fix Leaflet "half-loaded" issue
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

interface SocietyManagementProps {
  currentUser: any;
  token: string;
}

// Society Card Component
const SocietyCard = React.memo(({ 
  soc, 
  currentUser, 
  onSelect 
}: { 
  soc: any, 
  currentUser: any, 
  onSelect: (soc: any) => void 
}) => {
  const isMySoc = currentUser?.society?.trim().toLowerCase() === soc.name.trim().toLowerCase();
  const { t } = useLanguage();
  
  return (
    <div 
      onClick={() => onSelect(soc)}
      className={`bg-slate-950/50 border ${isMySoc ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'border-slate-800'} rounded-2xl p-4 relative flex items-center gap-4 cursor-pointer hover:bg-slate-900/50 transition-all group shadow-sm hover:shadow-md`}
    >
      {soc.logo ? (
        <img src={soc.logo} alt={soc.name} className="w-12 h-12 rounded-xl object-cover border border-slate-800 flex-shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
          <i className="fas fa-building text-xl text-slate-600"></i>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-white truncate group-hover:text-orange-500 transition-colors flex items-center gap-2">
          {soc.name} {soc.code ? <span className="text-orange-500 font-bold ml-1">({soc.code})</span> : ''}
          {currentUser?.role === 'admin' && (
            <span 
              className={`w-2 h-2 rounded-full ${soc.google_maps_link ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'}`} 
              title={soc.google_maps_link ? t('maps_link_present') : t('maps_link_missing')}
            ></span>
          )}
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
          {soc.city && <span className="truncate"><i className="fas fa-map-marker-alt mr-1"></i>{soc.city} {soc.region ? `(${soc.region})` : ''}</span>}
          <span className="truncate"><i className="fas fa-envelope mr-1"></i>{soc.email}</span>
        </div>
        {soc.disciplines && (
          <div className="flex flex-wrap gap-1 mt-1">
            {soc.disciplines.split(',').slice(0, 5).map((d: string, idx: number) => (
              <span key={`${d}-${soc.id}-${idx}`} className="text-[8px] font-black text-orange-500/80 bg-orange-500/10 px-1 rounded uppercase">{d}</span>
            ))}
            {soc.disciplines.split(',').length > 5 && <span className="text-[8px] font-black text-slate-500">...</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {(soc.google_maps_link || (soc.lat && soc.lng)) && (
          <a 
            href={soc.google_maps_link || `https://www.google.com/maps/dir/?api=1&destination=${soc.lat},${soc.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
            title={t('open_in_google_maps')}
          >
            <i className="fas fa-directions"></i>
          </a>
        )}
        <div className="text-slate-600 group-hover:text-orange-500 transition-colors ml-2">
          <i className="fas fa-chevron-right"></i>
        </div>
      </div>
    </div>
  );
});

const SocietyManagement: React.FC<SocietyManagementProps> = ({
  currentUser, token
}) => {
  const { triggerConfirm, triggerToast } = useUI();
  const { t } = useLanguage();
  const {
    societies, setSocieties, fetchSocieties, loading, backgroundLoading, error, setError,
    setShowUserForm, setEditingUser, setName, setSurname, setEmail, setRole, setSociety, setShooterCode, setPassword, setCategory, setQualification, setUserAvatar, setBirthDate, setActiveTab,
    showSocietyForm, setShowSocietyForm, editingSociety, setEditingSociety, societySearch, setSocietySearch, societyRegionSearch, setSocietyRegionSearch, societyViewMode, setSocietyViewMode, selectedSociety, setSelectedSociety,
    socName, setSocName, socCode, setSocCode, socEmail, setSocEmail, socWebsite, setSocWebsite, socGoogleMapsLink, setSocGoogleMapsLink, socContactName, setSocContactName, socAddress, setSocAddress, socCity, setSocCity, socRegion, setSocRegion, socZip, setSocZip, socPhone, setSocPhone, socMobile, setSocMobile, socLogo, setSocLogo, socOpeningHours, setSocOpeningHours, socDisciplines, setSocDisciplines,
    socLat, setSocLat, socLng, setSocLng
  } = useAdmin();

  const filteredSocieties = useMemo(() => {
    return societies.filter(soc => {
      const term = societySearch.toLowerCase();
      const regionTerm = societyRegionSearch.toLowerCase();
      
      const matchesSearch = !term || 
        soc.name.toLowerCase().includes(term) || 
        (soc.code && soc.code.toLowerCase().includes(term));
        
      const matchesRegion = !regionTerm || 
        (soc.region && soc.region.toLowerCase().includes(regionTerm)) ||
        (soc.city && soc.city.toLowerCase().includes(regionTerm));
        
      return matchesSearch && matchesRegion;
    });
  }, [societies, societySearch, societyRegionSearch]);

  const handleSocietyLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError(t('image_too_large_error'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSocLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSocietySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const endpoint = editingSociety ? `/api/admin/societies/${editingSociety.id}` : '/api/admin/societies';
    const method = editingSociety ? 'PUT' : 'POST';
    const body = { 
      name: socName, 
      code: socCode, 
      email: socEmail,
      website: socWebsite,
      google_maps_link: socGoogleMapsLink,
      contact_name: socContactName,
      address: socAddress,
      city: socCity,
      region: socRegion,
      zip: socZip,
      phone: socPhone,
      mobile: socMobile,
      opening_hours: socOpeningHours,
      logo: socLogo || undefined,
      disciplines: socDisciplines.join(','),
      lat: socLat ? parseFloat(socLat) : null,
      lng: socLng ? parseFloat(socLng) : null
    };

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(t('save_error_msg'));
      
      setEditingSociety(null);
      setShowSocietyForm(false);
      resetSocietyForm();
      fetchSocieties();
      triggerToast?.(t('society_saved_success'), 'success');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetSocietyForm = () => {
    setSocName('');
    setSocCode('');
    setSocEmail('');
    setSocWebsite('');
    setSocGoogleMapsLink('');
    setSocContactName('');
    setSocAddress('');
    setSocCity('');
    setSocRegion('');
    setSocZip('');
    setSocPhone('');
    setSocMobile('');
    setSocOpeningHours('');
    setSocLogo('');
    setSocDisciplines([]);
    setSocLat('');
    setSocLng('');
  };

  const handleEditSociety = (soc: any) => {
    setEditingSociety(soc);
    setSocName(soc.name || '');
    setSocCode(soc.code || '');
    setSocEmail(soc.email || '');
    setSocWebsite(soc.website || '');
    setSocGoogleMapsLink(soc.google_maps_link || '');
    setSocContactName(soc.contact_name || '');
    setSocAddress(soc.address || '');
    setSocCity(soc.city || '');
    setSocRegion(soc.region || '');
    setSocZip(soc.zip || '');
    setSocPhone(soc.phone || '');
    setSocMobile(soc.mobile || '');
    setSocOpeningHours(soc.opening_hours || '');
    setSocLogo(soc.logo || '');
    setSocDisciplines(soc.disciplines ? soc.disciplines.split(',') : []);
    setSocLat(soc.lat?.toString() || '');
    setSocLng(soc.lng?.toString() || '');
    setShowSocietyForm(true);
  };

  const handleDeleteSociety = (id: number) => {
    triggerConfirm(
      t('delete_society_title'),
      t('confirm_delete_society'),
      async () => {
        try {
          const res = await fetch(`/api/admin/societies/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error(t('delete_error'));
          fetchSocieties();
          triggerToast?.(t('society_deleted_success'), 'success');
        } catch (err: any) {
          setError(err.message);
        }
      },
      t('delete'),
      'danger'
    );
  };

  const handleExportSocietiesExcel = () => {
    const exportData = societies.map(s => ({
      [t('name')]: s.name,
      [t('society_code')]: s.code,
      [t('email')]: s.email,
      [t('website_label')]: s.website,
      [t('address_label')]: s.address,
      [t('city_label')]: s.city,
      [t('region_label')]: s.region,
      [t('zip_label')]: s.zip,
      [t('landline_label')]: s.phone,
      [t('mobile_label')]: s.mobile,
      [t('available_disciplines_label')]: s.disciplines,
      [t('latitude_label')]: s.lat,
      [t('longitude_label')]: s.lng
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('societies'));
    XLSX.writeFile(wb, 'societa_clay_tracker.xlsx');
  };

  const handleImportSocietiesExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const importedSocieties = data.map((row: any) => ({
          name: row[t('name')] || row.Nome || row.name,
          code: row[t('society_code')] || row.Codice || row.code,
          email: row[t('email')] || row.Email || row.email,
          website: row[t('website_label')] || row.Sito || row.website,
          address: row[t('address_label')] || row.Indirizzo || row.address,
          city: row[t('city_label')] || row.Città || row.city,
          region: row[t('region_label')] || row.Regione || row.region,
          zip: row[t('zip_label')] || row.CAP || row.zip,
          phone: row[t('landline_label')] || row.Telefono || row.phone,
          mobile: row[t('mobile_label')] || row.Cellulare || row.mobile,
          disciplines: row[t('available_disciplines_label')] || row.Discipline || row.disciplines,
          lat: row[t('latitude_label')] || row.Latitudine || row.lat,
          lng: row[t('longitude_label')] || row.Longitudine || row.lng
        }));

        triggerConfirm(
          t('import_societies_title'),
          t('import_societies_confirm').replace('{{count}}', String(importedSocieties.length)),
          async () => {
            try {
              const res = await fetch('/api/admin/societies/import', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ societies: importedSocieties })
              });
              
              if (!res.ok) throw new Error(t('import_error_msg'));
              
              const data = await res.json();
              fetchSocieties();
              
              triggerToast?.(
                t('import_completed')
                  .replace('{{created}}', String(data.created))
                  .replace('{{updated}}', String(data.updated))
                  .replace('{{errors}}', String(data.errors)),
                'success'
              );
            } catch (err) {
              console.error('Error importing societies:', err);
              setError(t('import_error_msg'));
            }
          },
          t('import'),
          'primary'
        );
      } catch (err) {
        console.error('Error reading Excel file:', err);
        setError(t('excel_read_error'));
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleUpdateSocietiesCodesExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const updates = data.map((row: any) => ({
          name: row[t('name')] || row.Nome || row.name,
          code: row[t('society_code')] || row.Codice || row.code
        })).filter(u => u.name && u.code);

        triggerConfirm(
          t('update_codes'),
          t('update_society_codes_confirm').replace('{{count}}', String(updates.length)),
          async () => {
            try {
              const res = await fetch('/api/admin/societies/update-codes', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ updates })
              });
              
              if (!res.ok) throw new Error(t('update_error_msg'));
              
              fetchSocieties();
              triggerToast?.(t('update_completed'), 'success');
            } catch (err) {
              console.error('Error updating society codes:', err);
              setError(t('update_error_msg'));
            }
          },
          t('update'),
          'primary'
        );
      } catch (err) {
        console.error('Error reading Excel file:', err);
        setError(t('excel_read_error'));
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="sticky top-16 z-30 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-2 sm:py-3 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex flex-col gap-2 sm:gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <i className="fas fa-shield-alt text-orange-600"></i>
              {t('society_tav_title')}
              {(loading || backgroundLoading) && <i className="fas fa-circle-notch fa-spin text-orange-500 text-xs ml-2"></i>}
            </h2>
            <div className="flex items-center gap-2">
              <div className="bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 border-l-orange-600">
                <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{t('societies')}</p>
                <p className="text-xs font-black text-white">{societies.length} <span className="text-[8px] text-slate-500 uppercase">{t('societies_count_total')}</span></p>
              </div>
              {currentUser?.role === 'admin' && !showSocietyForm && (
                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide scroll-shadows">
                  <button 
                    onClick={handleExportSocietiesExcel}
                    className="px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 shrink-0"
                    title={t('export_label')}
                  >
                    <i className="fas fa-file-excel"></i>
                    <span className="hidden sm:inline">{t('export_label')}</span>
                  </button>
                  <label className="px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 cursor-pointer shrink-0" title={t('update_codes_desc')}>
                    <i className="fas fa-sync-alt"></i>
                    <span className="hidden sm:inline">{t('update_codes')}</span>
                    <input type="file" accept=".xlsx, .xls" onChange={handleUpdateSocietiesCodesExcel} className="hidden" />
                  </label>
                  <label className="px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-700 cursor-pointer shrink-0" title={t('import_label')}>
                    <i className="fas fa-file-import"></i>
                    <span className="hidden sm:inline">{t('import_label')}</span>
                    <input type="file" accept=".xlsx, .xls" onChange={handleImportSocietiesExcel} className="hidden" />
                  </label>
                </div>
              )}
            </div>
          </div>

          {!showSocietyForm && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 bg-slate-950/30 p-4 rounded-3xl border border-slate-800/50 backdrop-blur-xl animate-in flip-in-x duration-500">
              <div className="relative flex-1">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 text-xs"></i>
                <input 
                  type="text" 
                  placeholder={t('search_society_placeholder')} 
                  value={societySearch}
                  onChange={(e) => setSocietySearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-10 py-3 text-white text-xs font-bold focus:border-orange-500/50 outline-none transition-all placeholder:text-slate-600"
                />
                {societySearch && (
                  <button 
                    onClick={() => setSocietySearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-full transition-all"
                    title={t('clean_search')}
                  >
                    <i className="fas fa-times-circle"></i>
                  </button>
                )}
              </div>
              <div className="relative flex-1">
                <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 text-xs"></i>
                <input 
                  type="text" 
                  placeholder={t('search_region_placeholder')} 
                  value={societyRegionSearch}
                  onChange={(e) => setSocietyRegionSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-10 py-3 text-white text-xs font-bold focus:border-orange-500/50 outline-none transition-all placeholder:text-slate-600"
                />
                {societyRegionSearch && (
                  <button 
                    onClick={() => setSocietyRegionSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-full transition-all"
                    title={t('clean_search')}
                  >
                    <i className="fas fa-times-circle"></i>
                  </button>
                )}
              </div>
              <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 shrink-0 shadow-inner">
                <button
                  onClick={() => { setSocietyViewMode('list'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${societyViewMode === 'list' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <i className="fas fa-list text-[10px]"></i> {t('list_view_label')}
                </button>
                <button
                  onClick={() => { setSocietyViewMode('map'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${societyViewMode === 'map' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <i className="fas fa-map-marked-alt text-[10px]"></i> {t('map_view_label')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 text-red-500 p-3 rounded-xl text-sm mb-4 border border-red-900/50 flex items-center gap-2">
          <i className="fas fa-exclamation-circle"></i>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-white"><i className="fas fa-times"></i></button>
        </div>
      )}

      <div className="pt-4">
        {showSocietyForm && createPortal(
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1200] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
              <div className="p-6 sm:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <i className="fas fa-building text-orange-500"></i>
                  {editingSociety ? t('edit_society_title') : t('new_society_title')}
                </h3>
                <button 
                  onClick={() => { setShowSocietyForm(false); setEditingSociety(null); resetSocietyForm(); }}
                  className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg border border-slate-700"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
                <form id="society-form" onSubmit={handleSocietySubmit} className="space-y-6">
                  <div className="flex flex-col items-center mb-6">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-800 overflow-hidden flex items-center justify-center mb-2">
                        {socLogo ? (
                          <img src={socLogo} alt={t('club_logo_label')} className="w-full h-full object-cover" />
                        ) : (
                          <i className="fas fa-building text-4xl text-slate-500"></i>
                        )}
                      </div>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                        <i className="fas fa-camera text-white text-xl"></i>
                        <input type="file" accept="image/*" className="hidden" onChange={handleSocietyLogoChange} />
                      </label>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('club_logo_hint')}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('club_name_label')}</label>
                      <input type="text" required value={socName} onChange={e => setSocName(e.target.value)} disabled={currentUser?.role === 'society'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('club_code_label')}</label>
                      <input type="text" required value={socCode} onChange={e => setSocCode(e.target.value)} disabled={currentUser?.role === 'society'} className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all ${currentUser?.role === 'society' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('email')}</label>
                      <input type="email" value={socEmail} onChange={e => setSocEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('website_label')}</label>
                      <input type="url" value={socWebsite} onChange={e => setSocWebsite(e.target.value)} placeholder="https://..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('maps_link_label')}</label>
                      <input type="url" value={socGoogleMapsLink} onChange={e => setSocGoogleMapsLink(e.target.value)} placeholder="https://goo.gl/maps/..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('contact_name_label')}</label>
                      <input type="text" value={socContactName} onChange={e => setSocContactName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('address_label')}</label>
                      <input type="text" value={socAddress} onChange={e => setSocAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('city_label')}</label>
                        <input type="text" value={socCity} onChange={e => setSocCity(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('region_label')}</label>
                        <input type="text" value={socRegion} onChange={e => setSocRegion(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('zip_label')}</label>
                        <input type="text" value={socZip} onChange={e => setSocZip(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('landline_label')}</label>
                      <input type="tel" value={socPhone} onChange={e => setSocPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('mobile_label')}</label>
                      <input type="tel" value={socMobile} onChange={e => setSocMobile(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('opening_hours_label')}</label>
                      <input type="text" value={socOpeningHours} onChange={e => setSocOpeningHours(e.target.value)} placeholder={t('opening_hours_placeholder')} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    </div>
                    
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">{t('available_disciplines_label')}</label>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {Object.keys(Discipline).filter(k => k !== 'TRAINING').map(key => (
                          <label key={key} className={`flex flex-col items-center justify-center p-2 rounded-xl border cursor-pointer transition-all ${socDisciplines.includes(key) ? 'bg-orange-600/20 border-orange-600 text-orange-500' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                            <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={socDisciplines.includes(key)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSocDisciplines([...socDisciplines, key]);
                                } else {
                                  setSocDisciplines(socDisciplines.filter(d => d !== key));
                                }
                              }}
                            />
                            <span className="text-xs font-black">{key}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('latitude_label')}</label>
                      <input type="text" value={socLat} onChange={e => setSocLat(e.target.value)} placeholder="Es: 41.9028" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('longitude_label')}</label>
                      <input type="text" value={socLng} onChange={e => setSocLng(e.target.value)} placeholder="Es: 12.4964" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:border-orange-600 outline-none transition-all" />
                    </div>
                  </div>
                </form>
              </div>
              <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm py-4 border-t border-slate-800 mt-8 flex justify-end gap-3 shrink-0 px-6 sm:px-8">
                <button type="button" onClick={() => { setShowSocietyForm(false); setEditingSociety(null); resetSocietyForm(); }} className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-slate-800 text-white hover:bg-slate-700">
                  {t('cancel_label')}
                </button>
                <button type="submit" form="society-form" className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-600/20">
                  {editingSociety ? t('save') : t('create')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {societyViewMode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSocieties.map(soc => (
            <SocietyCard 
              key={soc.id} 
              soc={soc} 
              currentUser={currentUser} 
              onSelect={setSelectedSociety} 
            />
          ))}
          {filteredSocieties.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-600 italic text-sm">
              {t('no_societies_found')}
            </div>
          )}
        </div>
      ) : (
        <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-slate-800 relative z-0">
          <MapContainer 
            center={[41.9028, 12.4964]} // Center on Rome
            zoom={6} 
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <MapResizer />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filteredSocieties.filter(s => s.lat && s.lng).map(soc => {
              const isMySoc = currentUser?.society?.trim().toLowerCase() === soc.name.trim().toLowerCase();
              return (
                <Marker 
                  key={soc.id} 
                  position={[parseFloat(soc.lat), parseFloat(soc.lng)]}
                  icon={isMySoc ? redIcon : orangeIcon}
                >
                  <Popup className="custom-popup">
                  <div className="text-center">
                    <h3 className="font-black text-white">{soc.name} {soc.code ? <span className="text-orange-500 font-bold ml-1">({soc.code})</span> : ''}</h3>
                    <p className="text-xs text-slate-400 mt-1">{soc.city} {soc.region ? `(${soc.region})` : ''}</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                       <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedSociety(soc); }}
                        className="text-xs font-bold text-orange-500 hover:underline"
                      >
                        {t('view_details_label')}
                      </button>
                      {(soc.google_maps_link || (soc.lat && soc.lng)) && (
                        <a 
                          href={soc.google_maps_link || `https://www.google.com/maps/dir/?api=1&destination=${soc.lat},${soc.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-bold text-blue-400 hover:underline flex items-center gap-1"
                          title={t('open_in_google_maps')}
                        >
                          <i className="fas fa-directions"></i> {t('navigate_label')}
                        </a>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          </MapContainer>
          {filteredSocieties.filter(s => !s.lat || !s.lng).length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-xl p-3 text-xs text-slate-400 text-center z-[400]">
              <i className="fas fa-info-circle text-orange-500 mr-2"></i>
              {t('map_info_desc').replace('{{count}}', String(filteredSocieties.filter(s => !s.lat || !s.lng).length))}
            </div>
          )}
        </div>
      )}

      {selectedSociety && (
        <SocietyDetailModal
          society={selectedSociety}
          onClose={() => setSelectedSociety(null)}
          currentUser={currentUser}
          onCreateAccount={currentUser?.role === 'admin' && !selectedSociety.has_account ? (soc) => {
            setSelectedSociety(null);
            setActiveTab('users');
            setShowUserForm(true);
            setEditingUser(null);
            setName(soc.name);
            setSurname('TAV');
            setEmail(soc.email || '');
            setRole('society');
            setSociety(soc.name);
            setShooterCode(soc.code || '');
            setPassword('');
            setCategory('');
            setQualification('');
            setUserAvatar(soc.logo || '');
            setBirthDate('');
          } : undefined}
          onEdit={(currentUser?.role === 'admin' || (currentUser?.role === 'society' && currentUser?.society === selectedSociety.name)) ? (soc) => {
            setSelectedSociety(null);
            handleEditSociety(soc);
          } : undefined}
          onDelete={currentUser?.role === 'admin' ? (id) => {
            setSelectedSociety(null);
            handleDeleteSociety(id);
          } : undefined}
        />
      )}
      </div>
    </div>
  );
};

export default SocietyManagement;
