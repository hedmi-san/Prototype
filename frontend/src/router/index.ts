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
          meta: { title: 'Connexion' },
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
          meta: { title: 'Tableau de bord' },
        },
        {
          path: 'products',
          name: 'products',
          component: () => import('../views/products/ProductListView.vue'),
          meta: { title: 'Catalogue Produits' },
        },
        {
          path: 'inventory',
          name: 'inventory',
          component: () => import('../views/inventory/StockView.vue'),
          meta: { title: 'Gestion des Stocks' },
        },
        {
          path: 'movements',
          name: 'movements',
          component: () => import('../views/inventory/StockMovementsView.vue'),
          meta: { title: 'Mouvements de Stock' },
        },
        {
          path: 'sales',
          name: 'sales',
          component: () => import('../views/sales/SalesListView.vue'),
          meta: { title: 'Historique des Ventes' },
        },
        {
          path: 'sales/new',
          name: 'create-sale',
          component: () => import('../views/sales/CreateSaleView.vue'),
          meta: { title: 'Nouvelle Vente (Caisse)' },
        },
        {
          path: 'transfers',
          name: 'transfers',
          component: () => import('../views/transfers/TransferListView.vue'),
          meta: { title: 'Transferts Inter-Entrepôts' },
        },
        {
          path: 'expenses',
          name: 'expenses',
          component: () => import('../views/expenses/ExpenseListView.vue'),
          meta: { title: 'Gestion des Dépenses' },
        },
        {
          path: 'employees',
          name: 'employees',
          component: () => import('../views/employees/EmployeeListView.vue'),
          meta: { title: 'Gestion du Personnel' },
        },
        {
          path: 'employees/:id',
          name: 'employee-detail',
          component: () => import('../views/employees/EmployeeDetailView.vue'),
          meta: { title: 'Profil Employé & Activité' },
        },
        {
          path: 'salaries',
          name: 'salaries',
          component: () => import('../views/salaries/SalaryManagementView.vue'),
          meta: { title: 'Gestion des Salaires' },
        },
        {
          path: 'reports/valuation',
          name: 'stock-valuation',
          component: () => import('../views/reports/StockValuationView.vue'),
          meta: { title: 'Valorisation des Stocks' },
        },
        {
          path: 'reports/financial',
          name: 'financial-reports',
          component: () => import('../views/reports/FinancialReportsView.vue'),
          meta: { title: 'Rapports Financiers' },
        },
        {
          path: 'admin/audit-logs',
          name: 'audit-logs',
          component: () => import('../views/admin/AuditLogsView.vue'),
          meta: { requiresAdmin: true, title: 'Journaux d\'Audit' },
        },
        {
          path: 'admin/users',
          name: 'admin-users',
          component: () => import('../views/admin/UsersView.vue'),
          meta: { requiresAdmin: true, title: 'Gestion des Utilisateurs' },
        },
        {
          path: 'admin/warehouses',
          name: 'admin-warehouses',
          component: () => import('../views/admin/WarehousesView.vue'),
          meta: { requiresAdmin: true, title: 'Gestion des Entrepôts' },
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

router.afterEach((to) => {
  const title = (to.meta?.title as string) || 'DISTRI-TOOLS DZ';
  document.title = `${title} | DISTRI-TOOLS DZ`;
});

export default router;
