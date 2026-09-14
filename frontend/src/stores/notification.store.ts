import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
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

  // Concurrency and race-condition guards
  const pendingReadIds = ref<Set<number>>(new Set());
  const locallyReadIds = ref<Set<number>>(new Set());
  const isMarkingAllRead = ref<boolean>(false);
  let fetchSequence = 0;

  const hasDesktopPermission = ref<boolean>(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  let pollingInterval: any = null;
  let isPollingStarted = false;

  // Clear local read tracking and reload when active warehouse context switches
  watch(
    () => authStore.activeWarehouseId,
    () => {
      pendingReadIds.value.clear();
      locallyReadIds.value.clear();
      knownNotificationIds.value.clear();
      fetchNotifications();
    }
  );

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
      if (isMarkingAllRead.value) {
        unreadCount.value = 0;
      } else {
        unreadCount.value = counts.unreadCount;
      }
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

    const currentSeq = ++fetchSequence;
    loading.value = true;
    try {
      const activeWh = authStore.activeWarehouseId || undefined;
      const res = await notificationService.getNotifications({
        limit: 20,
        warehouseId: activeWh,
      });

      // Discard stale responses if a newer fetch was initiated
      if (currentSeq < fetchSequence) {
        return;
      }

      // Detect newly arrived unread notifications
      const isInitial = knownNotificationIds.value.size === 0;
      for (const item of res.items) {
        if (!knownNotificationIds.value.has(item.id)) {
          if (!isInitial && !item.isRead && document.hidden) {
            emitDesktopNotification(item);
          }
          knownNotificationIds.value.add(item.id);
        }

        // Apply concurrency guards: preserve read status for items pending or read locally
        if (
          isMarkingAllRead.value ||
          pendingReadIds.value.has(item.id) ||
          locallyReadIds.value.has(item.id)
        ) {
          item.isRead = true;
        }
      }

      notifications.value = res.items;
      await fetchCounts();
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      if (currentSeq === fetchSequence) {
        loading.value = false;
      }
    }
  }

  async function markAsRead(id: number): Promise<boolean> {
    const target = notifications.value.find((n) => n.id === id);
    const wasUnread = target ? !target.isRead : true;

    // Optimistic UI state update
    if (target && wasUnread) {
      target.isRead = true;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
    pendingReadIds.value.add(id);

    const activeWh = authStore.activeWarehouseId || undefined;
    try {
      const success = await notificationService.markAsRead(id, activeWh);
      if (!success) {
        // Rollback optimistic update on failure
        if (target && wasUnread) {
          target.isRead = false;
          unreadCount.value += 1;
        }
        pendingReadIds.value.delete(id);
        console.warn(`[Notification] Failed to mark notification ${id} as read for warehouse ${activeWh}`);
        return false;
      }

      // Confirmed by backend
      pendingReadIds.value.delete(id);
      locallyReadIds.value.add(id);
      return true;
    } catch (err) {
      // Rollback optimistic update on error
      if (target && wasUnread) {
        target.isRead = false;
        unreadCount.value += 1;
      }
      pendingReadIds.value.delete(id);
      console.error('Failed to mark notification as read', err);
      return false;
    }
  }

  async function markAllAsRead(): Promise<number> {
    const previousUnreadCount = unreadCount.value;
    const previouslyUnreadIds: number[] = [];

    // Optimistic UI state update
    notifications.value.forEach((n) => {
      if (!n.isRead) {
        previouslyUnreadIds.push(n.id);
        n.isRead = true;
      }
    });
    unreadCount.value = 0;
    isMarkingAllRead.value = true;

    const activeWh = authStore.activeWarehouseId || undefined;
    try {
      const count = await notificationService.markAllAsRead(activeWh);
      previouslyUnreadIds.forEach((id) => locallyReadIds.value.add(id));
      return count;
    } catch (err) {
      // Rollback optimistic update on failure
      notifications.value.forEach((n) => {
        if (previouslyUnreadIds.includes(n.id)) {
          n.isRead = false;
        }
      });
      unreadCount.value = previousUnreadCount;
      console.error('Failed to mark all notifications as read', err);
      return 0;
    } finally {
      isMarkingAllRead.value = false;
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
