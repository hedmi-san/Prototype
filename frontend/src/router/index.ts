import { createRouter, createWebHistory } from 'vue-router';
import AuthLayout from '../layouts/AuthLayout.vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';
import { useAuthStore } from '../stores/auth.store';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/auth',
      component: AuthLayout,
      children: [
        {
          path: '/login',
          name: 'login',
          component: () => import('../views/auth/LoginView.vue'),
        },
      ],
    },
    {
      path: '/',
      component: DashboardLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('../views/dashboard/DashboardView.vue'),
        },
        {
          path: 'products',
          name: 'products',
          component: () => import('../views/products/ProductListView.vue'),
        },
        {
          path: 'inventory',
          name: 'inventory',
          component: () => import('../views/inventory/StockView.vue'),
        },
        {
          path: 'movements',
          name: 'movements',
          component: () => import('../views/inventory/StockMovementsView.vue'),
        },
        {
          path: 'sales',
          name: 'sales',
          component: () => import('../views/sales/SalesListView.vue'),
        },
        {
          path: 'sales/new',
          name: 'create-sale',
          component: () => import('../views/sales/CreateSaleView.vue'),
        },
        {
          path: 'transfers',
          name: 'transfers',
          component: () => import('../views/transfers/TransferListView.vue'),
        },
        {
          path: 'expenses',
          name: 'expenses',
          component: () => import('../views/expenses/ExpenseListView.vue'),
        },
        {
          path: 'employees',
          name: 'employees',
          component: () => import('../views/employees/EmployeeListView.vue'),
        },
        {
          path: 'salaries',
          name: 'salaries',
          component: () => import('../views/salaries/SalaryManagementView.vue'),
        },
        {
          path: 'reports/valuation',
          name: 'stock-valuation',
          component: () => import('../views/reports/StockValuationView.vue'),
        },
        {
          path: 'reports/financial',
          name: 'financial-reports',
          component: () => import('../views/reports/FinancialReportsView.vue'),
        },
        {
          path: 'admin/audit-logs',
          name: 'audit-logs',
          component: () => import('../views/admin/AuditLogsView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/users',
          name: 'admin-users',
          component: () => import('../views/admin/UsersView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/warehouses',
          name: 'admin-warehouses',
          component: () => import('../views/admin/WarehousesView.vue'),
          meta: { requiresAdmin: true },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  if (to.meta.requiresAuth && !token) {
    next({ name: 'login' });
  } else if (to.name === 'login' && token) {
    next({ name: 'dashboard' });
  } else if (to.meta.requiresAdmin && user?.role !== 'ADMIN') {
    next({ name: 'dashboard' });
  } else {
    next();
  }
});

export default router;
