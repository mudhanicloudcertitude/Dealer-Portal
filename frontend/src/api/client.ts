import axios from 'axios';

const API = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' 
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('dp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('dp_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default API;
