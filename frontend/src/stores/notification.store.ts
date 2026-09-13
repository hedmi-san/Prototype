import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AppNotification } from '../types';
import { notificationService } from '../services/notification.service';
import { useAuthStore } from './auth.store';

export const useNotificationStore = defineStore('notification', () => {
  const authStore = useAuthStore();

  const notifications = ref<AppNotification[]>([]);
  const unreadCount = ref<number>(0);
  const pendingTransfersCount = ref<number>(0);
  const pendingPickupsCount = ref<number>(0);
  const loading = ref<boolean>(false);
  const knownNotificationIds = ref<Set<number>>(new Set());

  const hasDesktopPermission = ref<boolean>(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  let pollingInterval: any = null;
  let isPollingStarted = false;

  async function requestDesktopPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      hasDesktopPermission.value = true;
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      hasDesktopPermission.value = permission === 'granted';
      return hasDesktopPermission.value;
    }
    return false;
  }

  function emitDesktopNotification(n: AppNotification) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const notif = new Notification(n.title, {
        body: n.message,
        icon: '/favicon.ico',
      });

      notif.onclick = () => {
        window.focus();
        if (n.link) {
          window.location.href = n.link;
        }
      };
    } catch (e) {
      console.warn('Could not display desktop notification:', e);
    }
  }

  async function fetchCounts() {
    if (authStore.isAdmin) {
      unreadCount.value = 0;
      pendingTransfersCount.value = 0;
      pendingPickupsCount.value = 0;
      return;
    }

    try {
      const counts = await notificationService.getCounts(authStore.activeWarehouseId || undefined);
      unreadCount.value = counts.unreadCount;
      pendingTransfersCount.value = counts.pendingTransfersCount;
      pendingPickupsCount.value = counts.pendingPickupsCount;
    } catch (err) {
      console.error('Failed to fetch notification counts', err);
    }
  }

  async function fetchNotifications() {
    if (authStore.isAdmin) {
      notifications.value = [];
      return;
    }

    loading.value = true;
    try {
      const res = await notificationService.getNotifications({
        limit: 20,
        warehouseId: authStore.activeWarehouseId || undefined,
      });

      // Detect newly arrived unread notifications
      const isInitial = knownNotificationIds.value.size === 0;
      for (const item of res.items) {
        if (!knownNotificationIds.value.has(item.id)) {
          if (!isInitial && !item.isRead && document.hidden) {
            emitDesktopNotification(item);
          }
          knownNotificationIds.value.add(item.id);
        }
      }

      notifications.value = res.items;
      await fetchCounts();
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      loading.value = false;
    }
  }

  async function markAsRead(id: number) {
    try {
      await notificationService.markAsRead(id);
      const target = notifications.value.find((n) => n.id === id);
      if (target && !target.isRead) {
        target.isRead = true;
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  }

  async function markAllAsRead() {
    try {
      await notificationService.markAllAsRead();
      notifications.value.forEach((n) => {
        n.isRead = true;
      });
      unreadCount.value = 0;
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  }

  function onWindowFocus() {
    fetchNotifications();
  }

  function startPolling() {
    if (isPollingStarted) return;
    isPollingStarted = true;

    fetchNotifications();

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onWindowFocus);
      pollingInterval = setInterval(() => {
        fetchNotifications();
      }, 20000);
    }
  }

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onWindowFocus);
    }
    isPollingStarted = false;
  }

  return {
    notifications,
    unreadCount,
    pendingTransfersCount,
    pendingPickupsCount,
    loading,
    hasDesktopPermission,
    requestDesktopPermission,
    fetchNotifications,
    fetchCounts,
    markAsRead,
    markAllAsRead,
    startPolling,
    stopPolling,
  };
});
