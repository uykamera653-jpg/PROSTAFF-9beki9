import { useContext } from 'react';
import { NotificationSettingsContext } from '../contexts/NotificationSettingsContext';

export function useNotificationSettings() {
  const context = useContext(NotificationSettingsContext);
  
  if (!context) {
    throw new Error('useNotificationSettings must be used within NotificationSettingsProvider');
  }
  
  return context;
}
