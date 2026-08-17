import api from './api';
import type { ApiResponse, AuthResponse, User } from '../types';

export const authService = {
  async login(credentials: { username: string; password: string }): Promise<AuthResponse> {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
    return response.data.data;
  },
  async getProfile(): Promise<User> {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    return response.data.data;
  }
};
