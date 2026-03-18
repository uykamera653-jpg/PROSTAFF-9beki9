import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { Company } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface CompaniesContextType {
  companies: Company[];
  getCompanyOrders: (companyId: string) => any[];
  getUserOrders: (userId: string) => any[];
  refetch: () => Promise<void>;
}

export const CompaniesContext = createContext<CompaniesContextType | undefined>(undefined);

export function CompaniesProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    fetchCompanies();

    // Real-time subscription for company updates
    const channel = supabase
      .channel('companies_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'companies',
        },
        () => {
          console.log('Companies data changed, refetching...');
          fetchCompanies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCompanies = async () => {
    try {
      // Fetch only online companies
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_online', true)
        .order('rating', { ascending: false });

      if (error) {
        console.error('Failed to fetch companies:', error);
        return;
      }

      if (data) {
        const mappedCompanies: Company[] = data.map((company) => ({
          id: company.id,
          name: company.company_name,
          serviceType: 'Services',
          description: company.description || '',
          phoneNumber: company.phone,
          address: 'Tashkent',
          photoUrls: company.images || [],
          services: [],
          workingHours: '9:00 - 18:00',
          experience: '0 yil',
          rating: parseFloat(company.rating) || 0,
        }));

        setCompanies(mappedCompanies);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const getCompanyOrders = (companyId: string) => {
    return [];
  };

  const getUserOrders = (userId: string) => {
    return [];
  };

  return (
    <CompaniesContext.Provider
      value={{
        companies,
        getCompanyOrders,
        getUserOrders,
        refetch: fetchCompanies,
      }}
    >
      {children}
    </CompaniesContext.Provider>
  );
}
