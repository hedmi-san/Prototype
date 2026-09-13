<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '../../stores/notification.store';
import { useAuthStore } from '../../stores/auth.store';
import type { AppNotification } from '../../types';

const router = useRouter();
const notifStore = useNotificationStore();
const authStore = useAuthStore();

const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const unreadCount = computed(() => notifStore.unreadCount);
const notifications = computed(() => notifStore.notifications);

function toggleMenu() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    notifStore.fetchNotifications();
  }
}

function closeMenu() {
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    closeMenu();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
  if (!authStore.isAdmin) {
    notifStore.startPolling();
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
  notifStore.stopPolling();
});

async function handleItemClick(item: AppNotification) {
  if (!item.isRead) {
    await notifStore.markAsRead(item.id);
  }
  closeMenu();
  if (item.link) {
    router.push(item.link);
  }
}

async function markAllAsRead() {
  await notifStore.markAllAsRead();
}

async function requestPermission() {
  await notifStore.requestDesktopPermission();
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "À l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function getIconClass(type: string): string {
  switch (type) {
    case 'TRANSFER_REQUESTED':
      return 'icon-transfer-req';
    case 'TRANSFER_APPROVED':
    case 'TRANSFER_CONFIRMED':
    case 'SALE_PICKUP_COMPLETED':
      return 'icon-success';
    case 'TRANSFER_DECLINED':
    case 'TRANSFER_CANCELLED':
    case 'SALE_PICKUP_CANCELLED':
      return 'icon-danger';
    case 'SALE_PICKUP_PENDING':
      return 'icon-pickup-req';
    default:
      return 'icon-default';
  }
}
</script>

<template>
  <div v-if="!authStore.isAdmin" ref="dropdownRef" class="notif-menu-wrapper">
    <!-- Bell Trigger Button -->
    <button
      class="notif-trigger-btn"
      :class="{ 'has-unread': unreadCount > 0, 'is-active': isOpen }"
      title="Centre de notifications"
      aria-label="Notifications"
      :aria-expanded="isOpen"
      @click="toggleMenu"
    >
      <svg class="bell-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      <span v-if="unreadCount > 0" class="notif-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Popover Dropdown Panel -->
    <transition name="dropdown-fade">
      <div v-if="isOpen" class="notif-dropdown">
        <!-- Header -->
        <div class="dropdown-header">
          <div class="header-title-area">
            <h3 class="header-title">Notifications</h3>
            <span v-if="unreadCount > 0" class="unread-pill">
              {{ unreadCount }} non lue{{ unreadCount > 1 ? 's' : '' }}
            </span>
          </div>
          <div class="header-actions">
            <button
              v-if="unreadCount > 0"
              class="action-btn text-link"
              @click="markAllAsRead"
            >
              Tout marquer lu
            </button>
          </div>
        </div>

        <!-- Desktop Permission Banner (if not yet granted) -->
        <div v-if="!notifStore.hasDesktopPermission" class="desktop-banner">
          <span>Activer les alertes sur le bureau ?</span>
          <button class="banner-btn" @click="requestPermission">Activer</button>
        </div>

        <!-- Notification List -->
        <div class="dropdown-body">
          <div v-if="notifStore.loading && notifications.length === 0" class="loading-state">
            <div class="spinner"></div>
            <span>Chargement des alertes...</span>
          </div>

          <div v-else-if="notifications.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </div>
            <p class="empty-text">Aucune notification pour cet entrepôt</p>
            <span class="empty-sub">Les demandes de transfert et de retrait apparaîtront ici.</span>
          </div>

          <ul v-else class="notif-list">
            <li
              v-for="item in notifications"
              :key="item.id"
              :class="['notif-item', { 'is-unread': !item.isRead }]"
              @click="handleItemClick(item)"
            >
              <div :class="['notif-icon-wrap', getIconClass(item.type)]">
                <!-- Transfer Request Icon -->
                <svg v-if="item.type === 'TRANSFER_REQUESTED'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.19" />
                  <line x1="23" y1="13" x2="23" y2="11" />
                  <polyline points="11 6 7 2 3 6" />
                  <polyline points="13 18 17 22 21 18" />
                </svg>

                <!-- Pickup Request Icon -->
                <svg v-else-if="item.type === 'SALE_PICKUP_PENDING'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>

                <!-- Success / Confirmed Icon -->
                <svg v-else-if="item.type === 'TRANSFER_APPROVED' || item.type === 'TRANSFER_CONFIRMED' || item.type === 'SALE_PICKUP_COMPLETED'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>

                <!-- Decline / Cancelled Icon -->
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>

              <div class="notif-content">
                <div class="notif-top-row">
                  <strong class="notif-title">{{ item.title }}</strong>
                  <span class="notif-time">{{ formatRelativeTime(item.createdAt) }}</span>
                </div>
                <p class="notif-message">{{ item.message }}</p>
              </div>

              <span v-if="!item.isRead" class="unread-dot" title="Non lu"></span>
            </li>
          </ul>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.notif-menu-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.notif-trigger-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--color-border, #e2e8f0);
  background: var(--color-surface, #ffffff);
  color: var(--color-text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.notif-trigger-btn:hover,
.notif-trigger-btn.is-active {
  background: var(--color-surface-hover, #f8fafc);
  color: var(--color-primary, #0ea5e9);
  border-color: var(--color-primary, #0ea5e9);
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.15);
}

.notif-trigger-btn.has-unread .bell-icon {
  animation: bell-subtle 4s ease-in-out infinite;
}

@keyframes bell-subtle {
  0%, 90%, 100% { transform: rotate(0); }
  92% { transform: rotate(10deg); }
  94% { transform: rotate(-10deg); }
  96% { transform: rotate(6deg); }
  98% { transform: rotate(-6deg); }
}

.notif-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ef4444;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-surface, #ffffff);
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
}

/* Dropdown Window */
.notif-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 380px;
  max-width: 90vw;
  max-height: 520px;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 14px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  background: var(--color-surface, #ffffff);
}

.header-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text, #1e293b);
}

.unread-pill {
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(14, 165, 233, 0.12);
  color: #0284c7;
  font-size: 11px;
  font-weight: 600;
}

.action-btn.text-link {
  background: none;
  border: none;
  color: #0284c7;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background 0.15s;
}

.action-btn.text-link:hover {
  background: rgba(14, 165, 233, 0.1);
}

.desktop-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f0f9ff;
  border-bottom: 1px solid #bae6fd;
  font-size: 12px;
  color: #0369a1;
}

.banner-btn {
  background: #0284c7;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.banner-btn:hover {
  background: #0369a1;
}

.dropdown-body {
  overflow-y: auto;
  max-height: 420px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  gap: 12px;
  color: var(--color-text-secondary, #64748b);
  font-size: 13px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(14, 165, 233, 0.2);
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-surface-hover, #f1f5f9);
  color: var(--color-text-secondary, #94a3b8);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text, #334155);
  margin: 0 0 4px 0;
}

.empty-sub {
  font-size: 12px;
  color: var(--color-text-secondary, #94a3b8);
}

.notif-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-light, #f1f5f9);
  cursor: pointer;
  transition: background 0.15s ease;
  position: relative;
}

.notif-item:hover {
  background: var(--color-surface-hover, #f8fafc);
}

.notif-item.is-unread {
  background: rgba(14, 165, 233, 0.04);
}

.notif-icon-wrap {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.icon-transfer-req {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
}

.icon-pickup-req {
  background: rgba(99, 102, 241, 0.15);
  color: #4f46e5;
}

.icon-success {
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
}

.icon-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}

.icon-default {
  background: rgba(100, 116, 139, 0.15);
  color: #475569;
}

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-top-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
}

.notif-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-time {
  font-size: 11px;
  color: var(--color-text-secondary, #94a3b8);
  white-space: nowrap;
}

.notif-message {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary, #475569);
  line-height: 1.4;
  word-break: break-word;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0ea5e9;
  flex-shrink: 0;
  margin-top: 6px;
}

/* Dropdown Animation */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
