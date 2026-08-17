<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';
import { useWarehouseStore } from '../stores/warehouse.store';
import AppBadge from '../components/common/AppBadge.vue';
import AppButton from '../components/common/AppButton.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const isSidebarOpen = ref(true);

onMounted(async () => {
  if (warehouseStore.warehouses.length === 0) {
    await warehouseStore.fetchWarehouses();
  }
});

function handleWarehouseChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  const val = target.value === '' ? null : Number(target.value);
  authStore.setWarehouseContext(val);
  // Reload current route data by reloading or re-triggering watch
  router.go(0);
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>

<template>
  <div class="app-layout">
    <!-- Top Header -->
    <header class="top-header">
      <div class="header-left">
        <button class="menu-toggle" @click="isSidebarOpen = !isSidebarOpen">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div class="brand">
          <div class="brand-mark" />
          <span class="brand-title">DISTRI-TOOLS</span>
        </div>
      </div>

      <div class="header-right">
        <!-- Warehouse Context Selector -->
        <div v-if="authStore.canSwitchWarehouse" class="warehouse-switcher">
          <label class="switcher-label">Warehouse Scope:</label>
          <select
            class="warehouse-select"
            :value="authStore.selectedWarehouseId || ''"
            @change="handleWarehouseChange"
          >
            <option value="">All Warehouses (Consolidated)</option>
            <option
              v-for="w in warehouseStore.warehouses"
              :key="w.id"
              :value="w.id"
            >
              {{ w.name }} ({{ w.code }})
            </option>
          </select>
        </div>
        <div v-else class="warehouse-badge-scope">
          <span class="scope-label">Warehouse:</span>
          <span class="scope-val">{{ authStore.user?.warehouseName || 'Assigned' }}</span>
        </div>

        <!-- User Profile Pill -->
        <div class="user-pill">
          <div class="user-avatar">
            {{ authStore.user?.fullName ? authStore.user.fullName.charAt(0) : 'U' }}
          </div>
          <div class="user-info">
            <span class="user-name">{{ authStore.user?.fullName }}</span>
            <AppBadge size="sm" :variant="authStore.isAdmin ? 'neutral' : 'info'">
              {{ authStore.role }}
            </AppBadge>
          </div>
          <button class="logout-btn" title="Logout" @click="handleLogout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div class="app-body">
      <!-- Left Sidebar Navigation -->
      <aside :class="['sidebar', { 'is-collapsed': !isSidebarOpen }]">
        <nav class="nav-list">
          <div class="nav-section-title">CORE OPERATIONS</div>
          <router-link to="/dashboard" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
            <span>Dashboard</span>
          </router-link>

          <router-link to="/inventory" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
            <span>Inventory Stock</span>
          </router-link>

          <router-link to="/movements" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span>Stock Movements</span>
          </router-link>

          <router-link to="/sales" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            <span>Sales & Invoices</span>
          </router-link>

          <router-link to="/transfers" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.19" />
              <line x1="23" y1="13" x2="23" y2="11" />
              <polyline points="11 6 7 2 3 6" />
              <polyline points="13 18 17 22 21 18" />
            </svg>
            <span>Inter-Warehouse Transfers</span>
          </router-link>

          <div class="nav-section-title">MANAGEMENT & HR</div>
          <router-link to="/products" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span>Product Catalog</span>
          </router-link>

          <router-link to="/expenses" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>Operating Expenses</span>
          </router-link>

          <router-link to="/employees" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Employees (HR)</span>
          </router-link>

          <router-link to="/salaries" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>Salary Disbursements</span>
          </router-link>

          <div class="nav-section-title">REPORTS & ANALYTICS</div>
          <router-link to="/reports/valuation" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            <span>Stock Valuation</span>
          </router-link>

          <router-link to="/reports/financial" class="nav-item" active-class="active">
            <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
            <span>Financial Statements</span>
          </router-link>

          <template v-if="authStore.isAdmin">
            <div class="nav-section-title">ADMINISTRATION</div>
            <router-link to="/admin/audit-logs" class="nav-item" active-class="active">
              <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Audit Logs</span>
            </router-link>

            <router-link to="/admin/users" class="nav-item" active-class="active">
              <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>User Accounts</span>
            </router-link>

            <router-link to="/admin/warehouses" class="nav-item" active-class="active">
              <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 21h18" />
                <path d="M9 8h1" />
                <path d="M9 12h1" />
                <path d="M9 16h1" />
                <path d="M14 8h1" />
                <path d="M14 12h1" />
                <path d="M14 16h1" />
                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
              </svg>
              <span>Warehouses</span>
            </router-link>
          </template>
        </nav>
      </aside>

      <!-- Main Content Stage -->
      <main class="main-content">
        <div class="content-container">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #fafafa;
}

/* Top Header */
.top-header {
  height: 60px;
  background-color: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.menu-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-primary);
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
}

.menu-toggle:hover {
  background-color: var(--color-surface);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-mark {
  width: 20px;
  height: 20px;
  background-color: var(--color-primary);
  border-radius: 4px;
}

.brand-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.warehouse-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switcher-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.warehouse-select {
  height: 32px;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  outline: none;
}

.warehouse-select:focus {
  border-color: var(--color-primary);
}

.warehouse-badge-scope {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background-color: var(--color-surface);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.scope-label {
  color: var(--color-text-secondary);
}

.scope-val {
  font-weight: 600;
  color: var(--color-primary);
}

.user-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 12px;
  border-left: 1px solid var(--color-border);
}

.user-avatar {
  width: 28px;
  height: 28px;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
}

.logout-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  margin-left: 4px;
}

.logout-btn:hover {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

/* App Body & Sidebar */
.app-body {
  display: flex;
  flex: 1;
}

.sidebar {
  width: 240px;
  background-color: var(--color-bg);
  border-right: 1px solid var(--color-border);
  padding: 16px 8px;
  transition: width var(--transition-normal);
  overflow-y: auto;
  min-height: calc(100vh - 60px);
}

.sidebar.is-collapsed {
  width: 0;
  padding: 0;
  border-right: none;
  overflow: hidden;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-section-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-secondary);
  letter-spacing: 0.08em;
  padding: 12px 10px 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  text-decoration: none;
  transition: all var(--transition-fast);
}

.nav-item:hover {
  background-color: var(--color-surface);
}

.nav-item.active {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.nav-icon {
  flex-shrink: 0;
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.content-container {
  max-width: var(--container-max-width);
  margin: 0 auto;
}
</style>
