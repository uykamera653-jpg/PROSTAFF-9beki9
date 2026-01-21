import React, { createContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Review } from '../types';

interface ReviewsContextType {
  reviews: Review[];
  addReview: (review: Omit<Review, 'id' | 'createdAt'>) => Promise<void>;
  getCompanyReviews: (companyId: string) => Review[];
  getAverageRating: (companyId: string) => number;
}

export const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

export function ReviewsProvider({ children }: { children: ReactNode }) {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      const reviewsJson = await AsyncStorage.getItem('reviews');
      if (reviewsJson) {
        setReviews(JSON.parse(reviewsJson));
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  };

  const addReview = async (reviewData: Omit<Review, 'id' | 'createdAt'>) => {
    try {
      const newReview: Review = {
        ...reviewData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };

      const updatedReviews = [newReview, ...reviews];
      setReviews(updatedReviews);
      await AsyncStorage.setItem('reviews', JSON.stringify(updatedReviews));
    } catch (error) {
      console.error('Failed to add review:', error);
      throw error;
    }
  };

  const getCompanyReviews = (companyId: string) => {
    return reviews.filter((review) => review.companyId === companyId);
  };

  const getAverageRating = (companyId: string) => {
    const companyReviews = getCompanyReviews(companyId);
    if (companyReviews.length === 0) return 0;
    const sum = companyReviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / companyReviews.length;
  };

  return (
    <ReviewsContext.Provider
      value={{
        reviews,
        addReview,
        getCompanyReviews,
        getAverageRating,
      }}
    >
      {children}
    </ReviewsContext.Provider>
  );
}
