import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, RoleType, AuthResponse } from '../types';
import { authService } from '../services/auth.service';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<User | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  );
  const selectedWarehouseId = ref<number | null>(
    localStorage.getItem('selectedWarehouseId') ? Number(localStorage.getItem('selectedWarehouseId')) : null
  );

  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const role = computed<RoleType | null>(() => user.value?.role || null);
  const isAdmin = computed(() => role.value === 'ADMIN');
  const isSuperManager = computed(() => role.value === 'SUPER_MANAGER');
  const isManager = computed(() => role.value === 'MANAGER');
  const isAccountant = computed(() => role.value === 'ACCOUNTANT');
  const canSwitchWarehouse = computed(() => isAdmin.value || isSuperManager.value);

  // Active warehouse context (for filtering)
  const activeWarehouseId = computed(() => {
    if (isAdmin.value || isSuperManager.value) {
      return selectedWarehouseId.value;
    }
    return user.value?.warehouseId || null;
  });

  async function login(credentials: { username: string; password: string }) {
    const res: AuthResponse = await authService.login(credentials);
    token.value = res.token;
    localStorage.setItem('token', res.token);

    const currentUser: User = {
      id: res.userId,
      username: res.username,
      fullName: res.fullName,
      role: res.role,
      warehouseId: res.warehouseId,
      warehouseName: res.warehouseName,
      active: true,
      createdAt: '',
      updatedAt: '',
    };
    user.value = currentUser;
    localStorage.setItem('user', JSON.stringify(currentUser));

    if (currentUser.warehouseId) {
      selectedWarehouseId.value = currentUser.warehouseId;
      localStorage.setItem('selectedWarehouseId', String(currentUser.warehouseId));
    } else {
      selectedWarehouseId.value = null;
      localStorage.removeItem('selectedWarehouseId');
    }
  }

  function setWarehouseContext(warehouseId: number | null) {
    if (canSwitchWarehouse.value) {
      selectedWarehouseId.value = warehouseId;
      if (warehouseId !== null) {
        localStorage.setItem('selectedWarehouseId', String(warehouseId));
      } else {
        localStorage.removeItem('selectedWarehouseId');
      }
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    selectedWarehouseId.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedWarehouseId');
  }

  return {
    token,
    user,
    role,
    isAuthenticated,
    isAdmin,
    isSuperManager,
    isManager,
    isAccountant,
    canSwitchWarehouse,
    selectedWarehouseId,
    activeWarehouseId,
    login,
    setWarehouseContext,
    logout,
  };
});
