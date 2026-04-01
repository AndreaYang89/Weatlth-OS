import { useEffect } from 'react';
import { useAuthStore } from '@/store';

export function useAuth() {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error, 
    login, 
    register, 
    logout, 
    fetchUser,
    clearError 
  } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUser();
    }
  }, [isAuthenticated, user, fetchUser]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };
}
