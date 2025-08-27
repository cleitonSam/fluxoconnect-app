// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');

  useEffect(() => {
    const userData = localStorage.getItem('fluxConnectUser');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Erro ao analisar dados do usuário:', error);
        localStorage.removeItem('fluxConnectUser');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await authAPI.login(email);
      
      if (response.data && response.data.length > 0) {
        const users = response.data;
        const foundUser = users.find(u => u.email === email && u.senha === password);
        
        if (foundUser) {
          localStorage.setItem('fluxConnectUser', JSON.stringify(foundUser));
          setUser(foundUser);
          return foundUser;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Função para verificar se e-mail já existe
  const checkEmailExists = async (email) => {
    try {
      const response = await authAPI.checkEmail(email);
      return response.data && response.data.length > 0 && 
             response.data.some(user => user.email === email);
    } catch (error) {
      console.error('Erro ao verificar e-mail:', error);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      
      // Verificar se o e-mail já existe
      const emailExists = await checkEmailExists(userData.email);
      if (emailExists) {
        throw new Error('E-mail já cadastrado');
      }
      
      const response = await authAPI.register(userData);
      
      if (response.status === 200) {
        localStorage.setItem('fluxConnectUser', JSON.stringify(userData));
        setUser(userData);
        return userData;
      }
      
      return null;
    } catch (error) {
      console.error('Erro no registro:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('fluxConnectUser');
    setUser(null);
  };

  const switchAuthMode = (mode) => {
    setAuthMode(mode);
  };

  return { user, loading, authMode, login, register, logout, switchAuthMode };
};