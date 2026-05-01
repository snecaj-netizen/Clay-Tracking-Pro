import React from 'react';
import NotificationsManager from './NotificationsManager';
import { useUI } from '../contexts/UIContext';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationsPageProps {
  token: string;
  userRole: string;
}

const NotificationsPage: React.FC<NotificationsPageProps> = ({ token, userRole }) => {
  const { triggerConfirm } = useUI();
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      {/* Sticky Header Section */}
      <div className="sticky top-16 z-40 bg-slate-950/95 backdrop-blur-xl -mx-4 px-4 py-2 sm:py-3 space-y-2 sm:space-y-3 border-b border-slate-900/50 shadow-2xl transition-all">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-bell text-orange-600"></i>
            {t('notifications_label')}
          </h2>
        </div>
      </div>

      <div className="pt-2">
        <NotificationsManager 
          token={token} 
          userRole={userRole} 
        />
      </div>
    </div>
  );
};

export default NotificationsPage;
