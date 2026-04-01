import React, { createContext, useState, ReactNode } from 'react';

interface WorkersContextType {
  placeholder: null;
}

export const WorkersContext = createContext<WorkersContextType | undefined>(undefined);

export function WorkersProvider({ children }: { children: ReactNode }) {
  return (
    <WorkersContext.Provider value={{ placeholder: null }}>
      {children}
    </WorkersContext.Provider>
  );
}
