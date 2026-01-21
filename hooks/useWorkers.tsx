import { useContext } from 'react';
import { WorkersContext } from '../contexts/WorkersContext';

export function useWorkers() {
  const context = useContext(WorkersContext);
  if (!context) {
    throw new Error('useWorkers must be used within WorkersProvider');
  }
  return context;
}
