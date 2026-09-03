import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Business } from '../lib/types';
import { getBusinessById, getBusinessesForUser } from '../lib/database';

interface BusinessContextType {
  business: Business | null;
  isLoading: boolean;
  selectBusiness: (id: string) => Promise<void>;
  loadBusinesses: (userId: string) => Promise<Business[]>;
  clearBusiness: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

const BUSINESS_KEY = 'storeflow_active_business_id';

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBusiness();
  }, []);

  async function loadBusiness() {
    try {
      const id = await AsyncStorage.getItem(BUSINESS_KEY);
      if (id) {
        const b = await getBusinessById(id);
        if (b) setBusiness(b);
      }
    } catch (e) {
      console.error('Business load error', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function selectBusiness(id: string) {
    const b = await getBusinessById(id);
    if (b) {
      setBusiness(b);
      await AsyncStorage.setItem(BUSINESS_KEY, id);
    }
  }

  async function loadBusinesses(userId: string): Promise<Business[]> {
    return await getBusinessesForUser(userId);
  }

  async function clearBusiness() {
    setBusiness(null);
    await AsyncStorage.removeItem(BUSINESS_KEY);
  }

  return (
    <BusinessContext.Provider value={{ business, isLoading, selectBusiness, loadBusinesses, clearBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be inside BusinessProvider');
  return ctx;
}
