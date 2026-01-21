import React, { createContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { JobAd } from '../types';

interface JobsContextType {
  jobs: JobAd[];
  isLoading: boolean;
  addJob: (job: Omit<JobAd, 'id' | 'createdAt' | 'status'>) => Promise<JobAd>;
  getUserJobs: (userId: string) => JobAd[];
}

export const JobsContext = createContext<JobsContextType | undefined>(undefined);

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<JobAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const jobsJson = await AsyncStorage.getItem('jobs');
      if (jobsJson) {
        setJobs(JSON.parse(jobsJson));
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addJob = async (jobData: Omit<JobAd, 'id' | 'createdAt' | 'status'>) => {
    try {
      const newJob: JobAd = {
        ...jobData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: 'active',
      };
      const updatedJobs = [newJob, ...jobs];
      await AsyncStorage.setItem('jobs', JSON.stringify(updatedJobs));
      setJobs(updatedJobs);
      console.log('Job added successfully:', newJob);
      console.log('Total jobs:', updatedJobs.length);
      return newJob;
    } catch (error) {
      console.error('Failed to add job:', error);
      throw error;
    }
  };

  const getUserJobs = (userId: string) => {
    return jobs.filter(job => job.userId === userId);
  };

  return (
    <JobsContext.Provider
      value={{
        jobs,
        isLoading,
        addJob,
        getUserJobs,
      }}
    >
      {children}
    </JobsContext.Provider>
  );
}
