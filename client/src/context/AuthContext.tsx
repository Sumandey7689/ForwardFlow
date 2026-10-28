import React, { createContext, useContext, useState, useEffect } from 'react';
import { Admin } from '../types/index.js';
import { api } from '../api/client.js';

interface AuthContextType {
  admin: Admin | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await api.get<{ admin: Admin }>('/auth/me');
      setAdmin(data.admin);
    } catch {
      setAdmin(null);
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const data = await api.post<{ admin: Admin; token: string }>('/auth/login', {
      email,
      password,
    });
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    setAdmin(data.admin);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Continue cleanup regardless
    }
    localStorage.removeItem('token');
    setAdmin(null);
  };

  const updateProfile = async (updateData: { name?: string; currentPassword?: string; newPassword?: string }) => {
    const data = await api.patch<{ admin: Admin }>('/auth/profile', updateData);
    setAdmin(data.admin);
  };

  return (
    <AuthContext.Provider value={{ admin, isLoading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
