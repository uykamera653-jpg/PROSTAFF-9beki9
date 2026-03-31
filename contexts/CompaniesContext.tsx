import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { Company } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AddOrderParams {
  userId: string;
  companyId: string;
  companyName: string;
  serviceType: string;
  customerName: string;
  phoneNumber: string;
  location: string;
  additionalNotes: string;
}

interface CompaniesContextType {
  companies: Company[];
  getCompanyOrders: (companyId: string) => any[];
  getUserOrders: (userId: string) => any[];
  addOrder: (params: AddOrderParams) => Promise<void>;
  refetch: () => Promise<void>;
}

export const CompaniesContext = createContext<CompaniesContextType | undefined>(undefined);

export function CompaniesProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Delay initial fetch to speed up app loading
    const timer = setTimeout(() => {
      fetchCompanies();
      setIsInitialized(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

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
          fetchCompanies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isInitialized]);

  const fetchCompanies = async () => {
    try {
      // Fetch only online companies
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_online', true)
        .order('rating', { ascending: false });

      if (error) {
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
          avatarUrl: company.avatar_url || null,
        }));

        setCompanies(mappedCompanies);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const getCompanyOrders = (companyId: string) => {
    return [];
  };

  const getUserOrders = (userId: string) => {
    return [];
  };

  const addOrder = async (params: AddOrderParams) => {
    const { userId, companyId, serviceType, customerName, phoneNumber, location, additionalNotes } = params;

    // Get any available category to satisfy NOT NULL constraint
    const { data: categories } = await supabase
      .from('categories')
      .select('id')
      .limit(1);

    const categoryId = categories?.[0]?.id;
    if (!categoryId) throw new Error("Kategoriya topilmadi");

    const { error } = await supabase.from('orders').insert({
      customer_id: userId,
      target_company_id: companyId,
      order_type: 'company',
      category_id: categoryId,
      title: serviceType || 'Xizmat buyurtmasi',
      description: additionalNotes || 'Xizmat buyurtmasi',
      location: location,
      customer_phone: phoneNumber,
      status: 'pending',
    });

    if (error) throw error;
  };

  return (
    <CompaniesContext.Provider
      value={{
        companies,
        getCompanyOrders,
        getUserOrders,
        addOrder,
        refetch: fetchCompanies,
      }}
    >
      {children}
    </CompaniesContext.Provider>
  );
}
