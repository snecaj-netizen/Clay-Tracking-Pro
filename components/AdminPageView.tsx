import React from 'react';
import AdminPanel from './AdminPanel';
import { useUI } from '../contexts/UIContext';

interface AdminPageViewProps {
  user: any;
  token: string;
  competitions: any[];
  cartridges: any[];
  cartridgeTypes: any[];
  societies: any[];
  onEditCompetition: any;
  onDeleteCompetition: any;
  handleImport: any;
  handleCloseSocietyDetail: any;
  handleUserUpdate: any;
  setShowTour: any;
  appSettings: any;
  fetchSettings: any;
  title: string;
  icon: string;
  initialTab: any;
  kpi1?: { label: string; value: string | number; color: string };
  kpi2?: { label: string; value: string | number; color: string };
  hideHeader?: boolean;
  initialEventViewMode?: 'list' | 'calendar' | 'results' | 'managed';
  onToggleFAB?: (hide: boolean) => void;
}

const AdminPageView: React.FC<AdminPageViewProps> = ({
  user, token, competitions, cartridges, cartridgeTypes, societies,
  onEditCompetition, onDeleteCompetition,
  handleImport, handleCloseSocietyDetail, handleUserUpdate, setShowTour,
  appSettings, fetchSettings, title, icon, initialTab, kpi1, kpi2, hideHeader,
  initialEventViewMode, onToggleFAB
}) => {
  const { triggerConfirm, triggerToast } = useUI();
  return (
    <div className="space-y-4">
      {/* Sticky Header Section */}
      {!hideHeader && (
        <div className="sticky top-16 sm:top-[104px] z-40 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-2 sm:py-3 space-y-2 sm:space-y-3 border-b border-slate-900/50 shadow-2xl transition-all">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <i className={`fas ${icon} text-orange-600`}></i>
              {title}
            </h2>
            <div className="flex gap-2">
              {kpi1 && (
                <div className={`bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 ${kpi1.color}`}>
                  <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{kpi1.label}</p>
                  <p className="text-xs font-black text-white">{kpi1.value}</p>
                </div>
              )}
              {kpi2 && (
                <div className={`bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800 border-l-2 ${kpi2.color}`}>
                  <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{kpi2.label}</p>
                  <p className="text-xs font-black text-white">{kpi2.value}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={hideHeader ? "" : "pt-2"}>
        <AdminPanel 
          user={user}
          token={token}
          competitions={competitions}
          cartridges={cartridges}
          cartridgeTypes={cartridgeTypes}
          clientId=""
          onClientIdChange={() => {}}
          onImport={handleImport}
          isDriveConnected={false}
          onConnectDrive={() => {}}
          onDisconnectDrive={() => {}}
          onSaveDrive={() => {}}
          onLoadDrive={() => {}}
          syncStatus="idle"
          lastSync={null}
          onEditCompetition={onEditCompetition}
          onDeleteCompetition={onDeleteCompetition}
          initialTab={initialTab}
          onCloseSocietyDetail={handleCloseSocietyDetail}
          onUserUpdate={handleUserUpdate}
          societies={societies}
          hideTabs={true}
          onReplayTour={setShowTour}
          appSettings={appSettings}
          onSettingsUpdate={fetchSettings}
          initialEventViewMode={initialEventViewMode}
          onToggleFAB={onToggleFAB}
        />
      </div>
    </div>
  );
};

export default AdminPageView;
