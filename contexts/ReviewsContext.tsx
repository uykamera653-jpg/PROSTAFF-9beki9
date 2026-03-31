import React, { createContext, useState, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface CompanyReview {
  id: string;
  company_id: string;
  customer_id: string;
  order_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

interface ReviewsContextType {
  submitReview: (
    companyId: string,
    orderId: string,
    rating: number,
    comment: string
  ) => Promise<void>;
  getCompanyReviews: (companyId: string) => Promise<CompanyReview[]>;
  checkReviewExists: (orderId: string) => Promise<boolean>;
}

export const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

export function ReviewsProvider({ children }: { children: ReactNode }) {
  const submitReview = useCallback(
    async (companyId: string, orderId: string, rating: number, comment: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Foydalanuvchi topilmadi');

      const { error } = await supabase.from('company_reviews').upsert(
        {
          company_id: companyId,
          customer_id: user.id,
          order_id: orderId,
          rating,
          comment: comment.trim() || null,
        },
        { onConflict: 'order_id,customer_id' }
      );

      if (error) throw error;
    },
    []
  );

  const getCompanyReviews = useCallback(async (companyId: string): Promise<CompanyReview[]> => {
    const { data, error } = await supabase
      .from('company_reviews')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }, []);

  const checkReviewExists = useCallback(async (orderId: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('company_reviews')
      .select('id')
      .eq('order_id', orderId)
      .eq('customer_id', user.id)
      .maybeSingle();

    return !!data;
  }, []);

  return (
    <ReviewsContext.Provider value={{ submitReview, getCompanyReviews, checkReviewExists }}>
      {children}
    </ReviewsContext.Provider>
  );
}
