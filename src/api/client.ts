import axios, { type AxiosError } from 'axios';
import { API_BASE_URL } from '../config/env';
import { getStoredToken, clearAuthStorage } from '../auth/storage';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await clearAuthStorage();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export default client;
