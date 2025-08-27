// src/services/api.js
import axios from 'axios';

const API_BASE_URL = 'https://api.steinhq.com/v1/storages/68ad1d03affba40a62f25e10';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Erro na requisição API:', error);
    throw error;
  }
);

export const authAPI = {
  login: (email) => api.get(`/login?email=${encodeURIComponent(email)}`),
  register: (userData) => api.post('/login', [userData]),
  // Nova função para verificar se e-mail já existe
  checkEmail: (email) => api.get(`/login?email=${encodeURIComponent(email)}`)
};