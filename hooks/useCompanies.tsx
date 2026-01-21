import { useContext } from 'react';
import { CompaniesContext } from '../contexts/CompaniesContext';

export function useCompanies() {
  const context = useContext(CompaniesContext);
  if (!context) {
    throw new Error('useCompanies must be used within CompaniesProvider');
  }
  return context;
}
