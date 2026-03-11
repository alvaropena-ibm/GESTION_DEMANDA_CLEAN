import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '@/services';

interface User {
  username: string;
  email?: string;
  fullName?: string;
  account?: string;
  arn?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  logout: () => void;
  checkAuth: () => boolean;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const checkAuth = (): boolean => {
    const authenticated = sessionStorage.getItem('user_authenticated') === 'true';
    
    // Si está autenticado, verificar acceso a Identity Management
    if (authenticated) {
      const authType = sessionStorage.getItem('auth_type');
      
      // Si es Cognito, verificar grupos
      if (authType === 'cognito') {
        const hasAccess = authService.hasAccessToIdentityManagement();
        
        if (!hasAccess) {
          // Usuario autenticado pero sin acceso a Identity Management
          console.warn('Usuario sin acceso a Identity Management');
          sessionStorage.clear();
          return false;
        }
      }
      // Si es IAM, permitir acceso (compatibilidad)
    }
    
    return authenticated;
  };

  const loadUserData = () => {
    const authenticated = checkAuth();
    setIsAuthenticated(authenticated);

    if (authenticated) {
      setUser({
        username: sessionStorage.getItem('username') || '',
        email: sessionStorage.getItem('user_email') || undefined,
        fullName: sessionStorage.getItem('user_full_name') || undefined,
        account: sessionStorage.getItem('user_account') || undefined,
        arn: sessionStorage.getItem('user_arn') || undefined
      });
    } else {
      setUser(null);
    }
  };

  const refreshAuth = () => {
    loadUserData();
  };

  useEffect(() => {
    // Check authentication status on mount and location change
    loadUserData();
  }, [location.pathname]);

  const logout = () => {
    // Clear all session storage
    sessionStorage.clear();
    setIsAuthenticated(false);
    setUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, logout, checkAuth, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
