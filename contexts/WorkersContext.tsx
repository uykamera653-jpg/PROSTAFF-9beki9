import React, { createContext, useState, ReactNode } from 'react';
import { Worker, HiredWorker } from '../types';

interface WorkersContextType {
  getWorkersByCategory: (category: string) => Worker[];
  hiredWorkers: HiredWorker[];
  hireWorkers: (workers: Omit<HiredWorker, 'id' | 'hiredAt' | 'status'>[]) => Promise<void>;
  getUserHiredWorkers: (userId: string) => HiredWorker[];
  updateWorkerStatus: (workerId: string, status: 'pending' | 'confirmed' | 'completed') => Promise<void>;
  rateWorker: (workerId: string, rating: number) => Promise<void>;
}

export const WorkersContext = createContext<WorkersContextType | undefined>(undefined);

// Demo ishchilar ma'lumotlari
const demoWorkers: Worker[] = [
  // Bog' ishlari
  { id: '1', name: 'Aziz Karimov', age: 35, category: 'gardenWork', dailyRate: 150000, phoneNumber: '+998901234567', arrivalTime: '30-45', rating: 4.8, experience: '5 yil tajriba', photoUrl: 'https://i.pravatar.cc/150?img=12' },
  { id: '2', name: 'Javohir Saidov', age: 28, category: 'gardenWork', dailyRate: 120000, phoneNumber: '+998901234568', arrivalTime: '20-30', rating: 4.5, experience: '3 yil tajriba', photoUrl: 'https://i.pravatar.cc/150?img=13' },
  { id: '3', name: 'Sherzod Toshev', age: 42, category: 'gardenWork', dailyRate: 180000, phoneNumber: '+998901234569', arrivalTime: '40-60', rating: 4.9, experience: '10 yil tajriba', photoUrl: 'https://i.pravatar.cc/150?img=33' },
  { id: '4', name: 'Bobur Aliyev', age: 31, category: 'gardenWork', dailyRate: 140000, phoneNumber: '+998901234570', arrivalTime: '25-35', rating: 4.6, experience: '4 yil tajriba', photoUrl: 'https://i.pravatar.cc/150?img=14' },
  
  // Yuk ortish-tushirish
  { id: '5', name: 'Rustam Yuldashev', age: 26, category: 'loading', dailyRate: 100000, phoneNumber: '+998901234571', arrivalTime: '15-25', rating: 4.7, experience: '2 yil tajriba' },
  { id: '6', name: 'Jamshid Ergashev', age: 33, category: 'loading', dailyRate: 130000, phoneNumber: '+998901234572', arrivalTime: '30-40', rating: 4.8, experience: '5 yil tajriba' },
  { id: '7', name: 'Dilshod Rahimov', age: 29, category: 'loading', dailyRate: 110000, phoneNumber: '+998901234573', arrivalTime: '20-30', rating: 4.5, experience: '3 yil tajriba' },
  { id: '8', name: 'Otabek Nurmatov', age: 24, category: 'loading', dailyRate: 95000, phoneNumber: '+998901234574', arrivalTime: '15-20', rating: 4.4, experience: '1 yil tajriba' },
  
  // Uy/xona tozalash
  { id: '9', name: 'Malika Hamidova', age: 38, category: 'roomCleaning', dailyRate: 80000, phoneNumber: '+998901234575', arrivalTime: '25-35', rating: 4.9, experience: '7 yil tajriba' },
  { id: '10', name: 'Nodira Azimova', age: 32, category: 'roomCleaning', dailyRate: 70000, phoneNumber: '+998901234576', arrivalTime: '20-30', rating: 4.7, experience: '4 yil tajriba' },
  { id: '11', name: 'Zilola Karimova', age: 45, category: 'roomCleaning', dailyRate: 90000, phoneNumber: '+998901234577', arrivalTime: '30-40', rating: 5.0, experience: '12 yil tajriba' },
  { id: '12', name: 'Gulnora Salimova', age: 28, category: 'roomCleaning', dailyRate: 65000, phoneNumber: '+998901234578', arrivalTime: '15-25', rating: 4.6, experience: '2 yil tajriba' },
  
  // Qurilishdan keyingi tozalash
  { id: '13', name: 'Shohruh Mahmudov', age: 34, category: 'postRepairCleaning', dailyRate: 120000, phoneNumber: '+998901234579', arrivalTime: '35-45', rating: 4.8, experience: '6 yil tajriba' },
  { id: '14', name: 'Jasur Ismoilov', age: 29, category: 'postRepairCleaning', dailyRate: 110000, phoneNumber: '+998901234580', arrivalTime: '25-35', rating: 4.6, experience: '3 yil tajriba' },
  { id: '15', name: 'Sardor Nurullayev', age: 41, category: 'postRepairCleaning', dailyRate: 140000, phoneNumber: '+998901234581', arrivalTime: '40-50', rating: 4.9, experience: '9 yil tajriba' },
  { id: '16', name: 'Akmal Husanov', age: 27, category: 'postRepairCleaning', dailyRate: 100000, phoneNumber: '+998901234582', arrivalTime: '20-30', rating: 4.5, experience: '2 yil tajriba' },
  
  // Bazmga yordamchi
  { id: '17', name: 'Farruh Sharipov', age: 25, category: 'partyHelper', dailyRate: 90000, phoneNumber: '+998901234583', arrivalTime: '20-30', rating: 4.7, experience: '2 yil tajriba' },
  { id: '18', name: 'Kamol Tursunov', age: 30, category: 'partyHelper', dailyRate: 100000, phoneNumber: '+998901234584', arrivalTime: '25-35', rating: 4.8, experience: '4 yil tajriba' },
  { id: '19', name: 'Anvar Abdullayev', age: 22, category: 'partyHelper', dailyRate: 80000, phoneNumber: '+998901234585', arrivalTime: '15-25', rating: 4.5, experience: '1 yil tajriba' },
  { id: '20', name: 'Timur Saidov', age: 28, category: 'partyHelper', dailyRate: 95000, phoneNumber: '+998901234586', arrivalTime: '20-30', rating: 4.6, experience: '3 yil tajriba' },
  
  // Bola parvarishi
  { id: '21', name: 'Dilnoza Rahmonova', age: 35, category: 'childCare', dailyRate: 100000, phoneNumber: '+998901234587', arrivalTime: '30-40', rating: 4.9, experience: '8 yil tajriba' },
  { id: '22', name: 'Sevara Yusupova', age: 28, category: 'childCare', dailyRate: 85000, phoneNumber: '+998901234588', arrivalTime: '20-30', rating: 4.7, experience: '4 yil tajriba' },
  { id: '23', name: 'Munisa Akramova', age: 42, category: 'childCare', dailyRate: 120000, phoneNumber: '+998901234589', arrivalTime: '35-45', rating: 5.0, experience: '15 yil tajriba' },
  { id: '24', name: 'Feruza Musayeva', age: 31, category: 'childCare', dailyRate: 95000, phoneNumber: '+998901234590', arrivalTime: '25-35', rating: 4.8, experience: '5 yil tajriba' },
  
  // Qurish va buzish
  { id: '25', name: 'Bahrom Juraev', age: 38, category: 'construction', dailyRate: 160000, phoneNumber: '+998901234591', arrivalTime: '40-50', rating: 4.8, experience: '10 yil tajriba' },
  { id: '26', name: 'Ulugbek Mirzayev', age: 32, category: 'construction', dailyRate: 140000, phoneNumber: '+998901234592', arrivalTime: '30-40', rating: 4.7, experience: '6 yil tajriba' },
  { id: '27', name: 'Sanjar Holmatov', age: 45, category: 'construction', dailyRate: 180000, phoneNumber: '+998901234593', arrivalTime: '45-60', rating: 4.9, experience: '15 yil tajriba' },
  { id: '28', name: 'Farhod Mamatov', age: 29, category: 'construction', dailyRate: 130000, phoneNumber: '+998901234594', arrivalTime: '25-35', rating: 4.6, experience: '4 yil tajriba' },
  
  // Oshpaz
  { id: '29', name: 'Dilmurod Ahmedov', age: 40, category: 'cook', dailyRate: 200000, phoneNumber: '+998901234595', arrivalTime: '35-45', rating: 4.9, experience: '12 yil tajriba' },
  { id: '30', name: 'Komil Ergashev', age: 33, category: 'cook', dailyRate: 170000, phoneNumber: '+998901234596', arrivalTime: '30-40', rating: 4.7, experience: '7 yil tajriba' },
  { id: '31', name: 'Shavkat Olimov', age: 28, category: 'cook', dailyRate: 150000, phoneNumber: '+998901234597', arrivalTime: '25-35', rating: 4.6, experience: '4 yil tajriba' },
  { id: '32', name: 'Azamat Ibragimov', age: 36, category: 'cook', dailyRate: 180000, phoneNumber: '+998901234598', arrivalTime: '30-40', rating: 4.8, experience: '9 yil tajriba' },
  
  // Ofitsant
  { id: '33', name: 'Jahongir Umarov', age: 24, category: 'waiter', dailyRate: 70000, phoneNumber: '+998901234599', arrivalTime: '15-25', rating: 4.6, experience: '2 yil tajriba' },
  { id: '34', name: 'Nodir Hakimov', age: 27, category: 'waiter', dailyRate: 80000, phoneNumber: '+998901234600', arrivalTime: '20-30', rating: 4.7, experience: '3 yil tajriba' },
  { id: '35', name: 'Bekzod Solijonov', age: 22, category: 'waiter', dailyRate: 65000, phoneNumber: '+998901234601', arrivalTime: '15-20', rating: 4.5, experience: '1 yil tajriba' },
  { id: '36', name: 'Mirjalol Qodirov', age: 29, category: 'waiter', dailyRate: 85000, phoneNumber: '+998901234602', arrivalTime: '20-30', rating: 4.8, experience: '4 yil tajriba' },
  
  // Idish yuvuvchi
  { id: '37', name: 'Sarvar Toshmatov', age: 21, category: 'dishwasher', dailyRate: 50000, phoneNumber: '+998901234603', arrivalTime: '15-20', rating: 4.4, experience: '1 yil tajriba' },
  { id: '38', name: 'Behruz Nazarov', age: 25, category: 'dishwasher', dailyRate: 60000, phoneNumber: '+998901234604', arrivalTime: '20-25', rating: 4.6, experience: '2 yil tajriba' },
  { id: '39', name: 'Jasurbek Ashurov', age: 23, category: 'dishwasher', dailyRate: 55000, phoneNumber: '+998901234605', arrivalTime: '15-25', rating: 4.5, experience: '1 yil tajriba' },
  { id: '40', name: 'Davron Sultonov', age: 26, category: 'dishwasher', dailyRate: 65000, phoneNumber: '+998901234606', arrivalTime: '20-30', rating: 4.7, experience: '3 yil tajriba' },
  
  // Boshqa xizmatlar
  { id: '41', name: 'Odil Sharifov', age: 35, category: 'other', dailyRate: 120000, phoneNumber: '+998901234607', arrivalTime: '30-40', rating: 4.7, experience: '6 yil tajriba' },
  { id: '42', name: 'Ravshan Turgunov', age: 30, category: 'other', dailyRate: 110000, phoneNumber: '+998901234608', arrivalTime: '25-35', rating: 4.6, experience: '4 yil tajriba' },
  { id: '43', name: 'Zafar Nosirjanov', age: 28, category: 'other', dailyRate: 100000, phoneNumber: '+998901234609', arrivalTime: '20-30', rating: 4.5, experience: '3 yil tajriba' },
  { id: '44', name: 'Oybek Rahmatov', age: 33, category: 'other', dailyRate: 130000, phoneNumber: '+998901234610', arrivalTime: '30-40', rating: 4.8, experience: '5 yil tajriba' },
];

export function WorkersProvider({ children }: { children: ReactNode }) {
  const [hiredWorkers, setHiredWorkers] = useState<HiredWorker[]>([]);

  const getWorkersByCategory = (category: string): Worker[] => {
    const workers = demoWorkers.filter(worker => worker.category === category);
    // Har safar 4 ta tasodifiy ishchini qaytarish
    const shuffled = [...workers].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
  };

  const hireWorkers = async (workersData: Omit<HiredWorker, 'id' | 'hiredAt' | 'status'>[]) => {
    try {
      const newHiredWorkers = workersData.map(data => ({
        ...data,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        hiredAt: new Date().toISOString(),
        status: 'pending' as const,
      }));
      setHiredWorkers(prev => [...newHiredWorkers, ...prev]);
    } catch (error) {
      console.error('Failed to hire workers:', error);
      throw error;
    }
  };

  const getUserHiredWorkers = (userId: string) => {
    return hiredWorkers.filter(worker => worker.userId === userId);
  };

  const updateWorkerStatus = async (workerId: string, status: 'pending' | 'confirmed' | 'completed') => {
    try {
      setHiredWorkers(prev => prev.map(worker => 
        worker.id === workerId ? { ...worker, status } : worker
      ));
    } catch (error) {
      console.error('Failed to update worker status:', error);
      throw error;
    }
  };

  const rateWorker = async (workerId: string, rating: number) => {
    try {
      // In real app, this would save to database
      console.log(`Worker ${workerId} rated ${rating} stars`);
    } catch (error) {
      console.error('Failed to rate worker:', error);
      throw error;
    }
  };

  return (
    <WorkersContext.Provider
      value={{
        getWorkersByCategory,
        hiredWorkers,
        hireWorkers,
        getUserHiredWorkers,
        updateWorkerStatus,
        rateWorker,
      }}
    >
      {children}
    </WorkersContext.Provider>
  );
}
