import api from './api';
import type { ApiResponse, AppNotification, NotificationCounts } from '../types';

export interface GetNotificationsParams {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
  warehouseId?: number;
}

export interface NotificationsListResponse {
  items: AppNotification[];
  total: number;
  page: number;
  limit: number;
}

export const notificationService = {
  async getNotifications(params: GetNotificationsParams = {}): Promise<NotificationsListResponse> {
    const res = await api.get<ApiResponse<NotificationsListResponse>>('/notifications', { params });
    return res.data.data;
  },

  async getCounts(warehouseId?: number): Promise<NotificationCounts> {
    const res = await api.get<ApiResponse<NotificationCounts>>('/notifications/counts', {
      params: warehouseId ? { warehouseId } : undefined,
    });
    return res.data.data;
  },

  async markAsRead(id: number, warehouseId?: number): Promise<boolean> {
    const res = await api.patch<ApiResponse<{ success: boolean }>>(
      `/notifications/${id}/read`,
      warehouseId ? { warehouseId } : {},
      { params: warehouseId ? { warehouseId } : undefined }
    );
    return res.data.data.success;
  },

  async markAllAsRead(warehouseId?: number): Promise<number> {
    const res = await api.post<ApiResponse<{ count: number }>>(
      '/notifications/read-all',
      warehouseId ? { warehouseId } : {},
      { params: warehouseId ? { warehouseId } : undefined }
    );
    return res.data.data.count;
  },
};
