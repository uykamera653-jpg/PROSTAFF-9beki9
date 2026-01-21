import React, { createContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Favorite } from '../types';

interface FavoritesContextType {
  favorites: Favorite[];
  addFavorite: (itemId: string, itemType: 'company' | 'worker', userId: string) => Promise<void>;
  removeFavorite: (itemId: string, userId: string) => Promise<void>;
  isFavorite: (itemId: string, userId: string) => boolean;
  getUserFavorites: (userId: string, itemType?: 'company' | 'worker') => Favorite[];
}

export const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const favoritesJson = await AsyncStorage.getItem('favorites');
      if (favoritesJson) {
        setFavorites(JSON.parse(favoritesJson));
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  const addFavorite = async (itemId: string, itemType: 'company' | 'worker', userId: string) => {
    try {
      const newFavorite: Favorite = {
        id: Date.now().toString(),
        userId,
        itemId,
        itemType,
        createdAt: new Date().toISOString(),
      };

      const updatedFavorites = [newFavorite, ...favorites];
      setFavorites(updatedFavorites);
      await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));
    } catch (error) {
      console.error('Failed to add favorite:', error);
      throw error;
    }
  };

  const removeFavorite = async (itemId: string, userId: string) => {
    try {
      const updatedFavorites = favorites.filter(
        (fav) => !(fav.itemId === itemId && fav.userId === userId)
      );
      setFavorites(updatedFavorites);
      await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      throw error;
    }
  };

  const isFavorite = (itemId: string, userId: string) => {
    return favorites.some((fav) => fav.itemId === itemId && fav.userId === userId);
  };

  const getUserFavorites = (userId: string, itemType?: 'company' | 'worker') => {
    return favorites.filter(
      (fav) => fav.userId === userId && (!itemType || fav.itemType === itemType)
    );
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        addFavorite,
        removeFavorite,
        isFavorite,
        getUserFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}
