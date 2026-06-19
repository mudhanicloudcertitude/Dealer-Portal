import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/client';

interface AuthContextType {
  user: any;
  account: any;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('dp_token');
    if (token) {
      API.get('/auth/me').then(res => {
        setUser(res.data.user);
        setAccount(res.data.account);
      }).catch(() => localStorage.removeItem('dp_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await API.post('/auth/login', { email, password });
    localStorage.setItem('dp_token', res.data.token);
    setUser(res.data.user);
    setAccount(res.data.user?.account ?? res.data.account);
  };

  const logout = () => {
    localStorage.removeItem('dp_token');
    setUser(null);
    setAccount(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, account, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
