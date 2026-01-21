import React, { createContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Company, ServiceOrder } from '../types';

interface CompaniesContextType {
  companies: Company[];
  orders: ServiceOrder[];
  addOrder: (order: Omit<ServiceOrder, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  getUserOrders: (userId: string) => ServiceOrder[];
  getCompanyById: (id: string) => Company | undefined;
}

export const CompaniesContext = createContext<CompaniesContextType | undefined>(undefined);

// Demo firmalar ma'lumotlari
const mockCompanies: Company[] = [
  {
    id: '1',
    name: 'Gaz Servis Profi',
    serviceType: 'Yoqilg\'i yetkazish',
    description: 'Propan, metan va boshqa gaz turlarini shahar bo\'ylab tezkor yetkazib berish xizmati. 24/7 ish rejimi.',
    phoneNumber: '+998901234567',
    address: 'Toshkent sh., Yunusobod tumani, Amir Temur 123',
    photoUrls: ['https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=800', 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800'],
    services: ['Propan yetkazish', 'Metan yetkazish', 'Gaz ballonlari', '24/7 yetkazish'],
    workingHours: '24/7',
    experience: '8 yil',
    rating: 4.9,
  },
  {
    id: '2',
    name: 'Eshik Professional',
    serviceType: 'Eshik va rom o\'rnatish',
    description: 'Metall, yog\'och va plastik eshiklar, derazalar hamda romlarni professional o\'rnatish. Kafolat bilan.',
    phoneNumber: '+998901234568',
    address: 'Toshkent sh., Chilonzor tumani, Bunyodkor 45',
    photoUrls: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'],
    services: ['Metall eshik', 'Yog\'och eshik', 'Deraza o\'rnatish', 'Rom yasash'],
    workingHours: '9:00 - 19:00',
    experience: '12 yil',
    rating: 4.8,
  },
  {
    id: '3',
    name: 'Lingua Master',
    serviceType: 'Tarjimonlik',
    description: 'Professional tarjimonlik xizmatlari. Ingliz, rus, xitoy va arab tillarida og\'zaki va yozma tarjima.',
    phoneNumber: '+998901234569',
    address: 'Toshkent sh., Mirobod tumani, Sharof Rashidov 78',
    photoUrls: ['https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800', 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800'],
    services: ['Og\'zaki tarjima', 'Yozma tarjima', 'Notarial tarjima', 'Sinxron tarjima'],
    workingHours: '9:00 - 18:00',
    experience: '10 yil',
    rating: 5.0,
  },
  {
    id: '4',
    name: 'Cool Tech Service',
    serviceType: 'Konditsioner o\'rnatish',
    description: 'Barcha turdagi konditsionerlarni o\'rnatish, ta\'mirlash va texnik xizmat ko\'rsatish. Tez va sifatli.',
    phoneNumber: '+998901234570',
    address: 'Toshkent sh., Yakkasaroy tumani, Bobur 92',
    photoUrls: ['https://images.unsplash.com/photo-1631545806609-c1c8e57b0b92?w=800', 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800'],
    services: ['O\'rnatish', 'Ta\'mirlash', 'Tozalash', 'Texnik xizmat'],
    workingHours: '8:00 - 20:00',
    experience: '7 yil',
    rating: 4.7,
  },
  {
    id: '5',
    name: 'Clean Carpet Pro',
    serviceType: 'Gilam yuvish',
    description: 'Professional gilam yuvish xizmati. Zamonaviy texnologiyalar va ekologik toza vositalar bilan.',
    phoneNumber: '+998901234571',
    address: 'Toshkent sh., Sergeli tumani, Furqat 156',
    photoUrls: ['https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800', 'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800'],
    services: ['Gilam yuvish', 'Divan tozalash', 'Avtomobil tozalash', 'Yetkazib berish'],
    workingHours: '9:00 - 18:00',
    experience: '6 yil',
    rating: 4.6,
  },
];

export function CompaniesProvider({ children }: { children: ReactNode }) {
  const [companies] = useState<Company[]>(mockCompanies);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const ordersJson = await AsyncStorage.getItem('service_orders');
      if (ordersJson) {
        setOrders(JSON.parse(ordersJson));
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const addOrder = async (orderData: Omit<ServiceOrder, 'id' | 'createdAt' | 'status'>) => {
    try {
      const newOrder: ServiceOrder = {
        ...orderData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      const updatedOrders = [newOrder, ...orders];
      setOrders(updatedOrders);
      await AsyncStorage.setItem('service_orders', JSON.stringify(updatedOrders));
    } catch (error) {
      console.error('Failed to add order:', error);
      throw error;
    }
  };

  const getUserOrders = (userId: string) => {
    return orders.filter(order => order.userId === userId);
  };

  const getCompanyById = (id: string) => {
    return companies.find(company => company.id === id);
  };

  return (
    <CompaniesContext.Provider
      value={{
        companies,
        orders,
        addOrder,
        getUserOrders,
        getCompanyById,
      }}
    >
      {children}
    </CompaniesContext.Provider>
  );
}
