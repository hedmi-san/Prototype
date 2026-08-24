<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { employeeService, salaryService } from '../../services/admin-reports.service';
import type {
  Employee,
  EmployeeStatus,
  EmployeePerformanceMetrics,
  Sale,
  SalaryRecord,
} from '../../types';
import type { ComputedPeriodRange } from '../../utils/periodNavigator';
import { formatCurrency, formatDate } from '../../utils/formatters';
import AppPeriodNavigator from '../../components/common/AppPeriodNavigator.vue';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';

const route = useRoute();
const router = useRouter();
const warehouseStore = useWarehouseStore();

const employeeId = computed(() => Number(route.params.id));

const employee = ref<Employee | null>(null);
const performance = ref<EmployeePerformanceMetrics | null>(null);
const sales = ref<Sale[]>([]);
const salaries = ref<SalaryRecord[]>([]);

const loadingProfile = ref(true);
const loadingPerformance = ref(false);
const loadingSales = ref(false);
const loadingSalaries = ref(false);

const activeTab = ref<'sales' | 'salaries' | 'details'>('sales');

// Period Navigator State
const currentPeriodRange = ref<ComputedPeriodRange | null>(null);

// Edit Modal State
const showEditModal = ref(false);
const editForm = ref({
  warehouseId: 0,
  fullName: '',
  nationalId: '',
  position: '',
  phone: '',
  hireDate: '',
  baseSalary: 0,
  status: 'ACTIVE' as EmployeeStatus,
});
const saving = ref(false);
const editErrorMessage = ref('');

// Status change dropdown state
const updatingStatus = ref(false);

const statusOptions: { value: EmployeeStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Actif (En poste)' },
  { value: 'ON_LEAVE', label: 'En congé / Absent' },
  { value: 'SUSPENDED', label: 'Suspendu' },
  { value: 'TERMINATED', label: 'Inactif / Licencié' },
];

onMounted(async () => {
  await loadEmployeeData();
});

watch(
  () => route.params.id,
  async (newId) => {
    if (newId) {
      await loadEmployeeData();
    }
  }
);

async function loadEmployeeData() {
  if (!employeeId.value || isNaN(employeeId.value)) {
    router.push('/employees');
    return;
  }

  loadingProfile.value = true;
  try {
    const data = await employeeService.getEmployee(employeeId.value);
    employee.value = data;
    await Promise.all([
      fetchPerformance(),
      fetchSales(),
      fetchSalaries(),
    ]);
  } catch (err) {
    console.error('Failed to load employee profile', err);
    router.push('/employees');
  } finally {
    loadingProfile.value = false;
  }
}

async function fetchPerformance() {
  if (!employeeId.value) return;
  loadingPerformance.value = true;
  try {
    const params: any = {};
    if (currentPeriodRange.value) {
      params.startDate = currentPeriodRange.value.startDate;
      params.endDate = currentPeriodRange.value.endDate;
      params.granularity = currentPeriodRange.value.granularity;
    } else {
      params.preset = 'thisMonth';
    }
    performance.value = await employeeService.getEmployeePerformance(employeeId.value, params);
  } catch (err) {
    console.error('Failed to load performance metrics', err);
  } finally {
    loadingPerformance.value = false;
  }
}

async function fetchSales() {
  if (!employeeId.value) return;
  loadingSales.value = true;
  try {
    const params: any = { limit: 50 };
    if (currentPeriodRange.value) {
      params.startDate = currentPeriodRange.value.startDate;
      params.endDate = currentPeriodRange.value.endDate;
    }
    const res = await employeeService.getEmployeeSales(employeeId.value, params);
    sales.value = res.items || [];
  } catch (err) {
    console.error('Failed to load employee sales', err);
  } finally {
    loadingSales.value = false;
  }
}

async function fetchSalaries() {
  if (!employeeId.value) return;
  loadingSalaries.value = true;
  try {
    salaries.value = await employeeService.getEmployeeSalaries(employeeId.value);
  } catch (err) {
    console.error('Failed to load salary history', err);
  } finally {
    loadingSalaries.value = false;
  }
}

function onPeriodChange(range: ComputedPeriodRange) {
  currentPeriodRange.value = range;
  fetchPerformance();
  fetchSales();
}

async function updateStatus(newStatus: EmployeeStatus) {
  if (!employee.value || employee.value.status === newStatus) return;
  updatingStatus.value = true;
  try {
    const updated = await employeeService.updateEmployee(employee.value.id, {
      status: newStatus,
    });
    employee.value.status = updated.status;
    employee.value.active = updated.active;
  } catch (err) {
    console.error('Failed to update status', err);
  } finally {
    updatingStatus.value = false;
  }
}

function openEditModal() {
  if (!employee.value) return;
  editForm.value = {
    warehouseId: employee.value.warehouseId,
    fullName: employee.value.fullName,
    nationalId: employee.value.nationalId || '',
    position: employee.value.position,
    phone: employee.value.phone || '',
    hireDate: employee.value.hireDate ? employee.value.hireDate.substring(0, 10) : '',
    baseSalary: employee.value.baseSalary || 0,
    status: employee.value.status || 'ACTIVE',
  };
  editErrorMessage.value = '';
  showEditModal.value = true;
}

async function handleSaveEdit() {
  if (!editForm.value.fullName.trim()) {
    editErrorMessage.value = 'Le nom complet est obligatoire';
    return;
  }
  saving.value = true;
  editErrorMessage.value = '';
  try {
    const updated = await employeeService.updateEmployee(employeeId.value, editForm.value);
    employee.value = updated;
    showEditModal.value = false;
    await fetchPerformance();
  } catch (err: any) {
    editErrorMessage.value = err.response?.data?.message || 'Erreur lors de la mise à jour';
  } finally {
    saving.value = false;
  }
}

function getStatusBadge(status?: EmployeeStatus | string) {
  switch (status) {
    case 'ACTIVE':
      return { variant: 'success' as const, label: 'Actif (En poste)' };
    case 'ON_LEAVE':
      return { variant: 'warning' as const, label: 'En congé' };
    case 'SUSPENDED':
      return { variant: 'neutral' as const, label: 'Suspendu' };
    case 'TERMINATED':
      return { variant: 'danger' as const, label: 'Inactif / Licencié' };
    default:
      return { variant: 'neutral' as const, label: status || 'Actif' };
  }
}

const seniorityFormatted = computed(() => {
  if (!employee.value?.hireDate) return '—';
  const hire = new Date(employee.value.hireDate);
  const now = new Date();
  const diffMonths = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
  if (diffMonths < 1) return 'Moins d\'un mois';
  if (diffMonths < 12) return `${diffMonths} mois`;
  const years = Math.floor(diffMonths / 12);
  const remMonths = diffMonths % 12;
  return remMonths > 0 ? `${years} an(s) et ${remMonths} mois` : `${years} an(s)`;
});

const totalSalaryLifetime = computed(() => {
  return salaries.value.reduce((sum, s) => sum + s.totalAmount, 0);
});
</script>

<template>
  <div class="employee-detail-view">
    <!-- Breadcrumb & Top Bar -->
    <div class="top-nav-bar">
      <button class="back-link-btn" @click="router.push('/employees')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Retour au Personnel
      </button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loadingProfile" class="profile-card loading-state">
      <p class="text-muted">Chargement du profil employé...</p>
    </div>

    <!-- Profile Header Card -->
    <div v-else-if="employee" class="profile-card">
      <div class="profile-main-info">
        <div class="profile-avatar">
          {{ employee.fullName.charAt(0).toUpperCase() }}
        </div>
        <div class="profile-meta">
          <div class="name-status-row">
            <h1 class="employee-name">{{ employee.fullName }}</h1>
            <div class="status-dropdown-wrapper">
              <select
                :value="employee.status"
                :disabled="updatingStatus"
                class="status-select-badge"
                :class="'status-' + (employee.status || 'ACTIVE').toLowerCase()"
                @change="updateStatus(($event.target as HTMLSelectElement).value as EmployeeStatus)"
              >
                <option v-for="st in statusOptions" :key="st.value" :value="st.value">
                  {{ st.label }}
                </option>
              </select>
            </div>
          </div>
          <div class="employee-submeta">
            <span class="meta-tag position-tag">{{ employee.position }}</span>
            <span class="meta-tag warehouse-tag">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              {{ employee.warehouseName }} ({{ employee.warehouseCode || 'WH' }})
            </span>
            <span v-if="employee.phone" class="meta-tag font-mono">
              📞 {{ employee.phone }}
            </span>
            <span v-if="employee.nationalId" class="meta-tag font-mono">
              CNI: {{ employee.nationalId }}
            </span>
          </div>
        </div>
      </div>

      <div class="profile-actions">
        <AppButton variant="secondary" @click="openEditModal">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Modifier le Profil
        </AppButton>
      </div>
    </div>

    <!-- Period Navigator Section -->
    <div class="period-section">
      <div class="period-header">
        <h2 class="section-title">Activité & Performance du Collaborateur</h2>
        <span class="text-caption text-muted">
          Période analysée : <strong>{{ currentPeriodRange?.label || 'Ce Mois-ci' }}</strong>
        </span>
      </div>
      <AppPeriodNavigator
        initial-granularity="month"
        @change="onPeriodChange"
      />
    </div>

    <!-- Metric KPI Cards -->
    <div class="kpi-grid">
      <!-- 1. Sales Count -->
      <div class="kpi-card">
        <div class="kpi-icon-wrap icon-sales">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Ventes Réalisées</span>
          <div class="kpi-val-row">
            <span class="kpi-value font-mono font-bold">
              {{ performance?.metrics.salesCount ?? 0 }}
            </span>
            <span
              v-if="performance?.metrics.salesGrowthPct !== undefined"
              class="growth-tag"
              :class="performance.metrics.salesGrowthPct >= 0 ? 'growth-pos' : 'growth-neg'"
            >
              {{ performance.metrics.salesGrowthPct >= 0 ? '+' : '' }}{{ performance.metrics.salesGrowthPct }}%
            </span>
          </div>
          <span class="kpi-subtext text-muted">factures complétées</span>
        </div>
      </div>

      <!-- 2. Total Revenue -->
      <div class="kpi-card">
        <div class="kpi-icon-wrap icon-revenue">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Chiffre d'Affaires</span>
          <div class="kpi-val-row">
            <span class="kpi-value font-mono font-bold text-primary">
              {{ formatCurrency(performance?.metrics.totalRevenue ?? 0) }}
            </span>
            <span
              v-if="performance?.metrics.revenueGrowthPct !== undefined"
              class="growth-tag"
              :class="performance.metrics.revenueGrowthPct >= 0 ? 'growth-pos' : 'growth-neg'"
            >
              {{ performance.metrics.revenueGrowthPct >= 0 ? '+' : '' }}{{ performance.metrics.revenueGrowthPct }}%
            </span>
          </div>
          <span class="kpi-subtext text-muted">généré sur la période</span>
        </div>
      </div>

      <!-- 3. Units Sold -->
      <div class="kpi-card">
        <div class="kpi-icon-wrap icon-units">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Articles / Unités</span>
          <div class="kpi-val-row">
            <span class="kpi-value font-mono font-bold">
              {{ performance?.metrics.totalUnitsSold ?? 0 }}
            </span>
          </div>
          <span class="kpi-subtext text-muted">outils & pièces distribués</span>
        </div>
      </div>

      <!-- 4. Average Basket -->
      <div class="kpi-card">
        <div class="kpi-icon-wrap icon-basket">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Panier Moyen</span>
          <div class="kpi-val-row">
            <span class="kpi-value font-mono font-bold">
              {{ formatCurrency(performance?.metrics.averageBasket ?? 0) }}
            </span>
          </div>
          <span class="kpi-subtext text-muted">montant moyen par vente</span>
        </div>
      </div>
    </div>

    <!-- Compensation & Top Products Banner -->
    <div class="insights-grid">
      <!-- Compensation Overview Card -->
      <div class="insight-card salary-overview-card">
        <div class="card-header-clean">
          <div class="card-title-group">
            <h3 class="card-title">Rémunération & Salaire Actuel</h3>
            <span class="text-caption text-muted">Données contractuelles et historique des versements</span>
          </div>
          <AppButton size="sm" variant="secondary" @click="router.push('/salaries')">
            Verser un salaire
          </AppButton>
        </div>

        <div class="salary-metrics-row">
          <div class="salary-box">
            <span class="salary-box-label">Salaire de Base Actuel</span>
            <strong class="salary-box-val font-mono font-bold text-primary">
              {{ formatCurrency(employee?.baseSalary ?? 0) }}
            </strong>
            <span class="salary-box-sub">taux mensuel enregistré</span>
          </div>

          <div class="salary-box">
            <span class="salary-box-label">Total Rémunération Versée</span>
            <strong class="salary-box-val font-mono font-bold text-success">
              {{ formatCurrency(totalSalaryLifetime) }}
            </strong>
            <span class="salary-box-sub">{{ salaries.length }} versement(s) effectué(s)</span>
          </div>

          <div class="salary-box">
            <span class="salary-box-label">Ancienneté</span>
            <strong class="salary-box-val">
              {{ seniorityFormatted }}
            </strong>
            <span class="salary-box-sub">depuis le {{ formatDate(employee?.hireDate) }}</span>
          </div>
        </div>
      </div>

      <!-- Top Sold Products by Worker -->
      <div class="insight-card top-products-card">
        <div class="card-header-clean">
          <h3 class="card-title">Top Produits Vendus</h3>
          <span class="text-caption text-muted">sur la période sélectionnée</span>
        </div>

        <div v-if="!performance?.topProducts.length" class="empty-compact text-muted">
          Aucune vente enregistrée pour cette période.
        </div>
        <div v-else class="top-products-list">
          <div v-for="(p, idx) in performance.topProducts" :key="p.productId" class="top-product-item">
            <div class="rank-badge">{{ idx + 1 }}</div>
            <div class="prod-info">
              <span class="prod-name">{{ p.productName }}</span>
              <span class="prod-ref font-mono text-muted">{{ p.productReference }} ({{ p.productBrand }})</span>
            </div>
            <div class="prod-stats font-mono">
              <span class="prod-qty font-bold">x{{ p.quantitySold }}</span>
              <span class="prod-amt text-muted">{{ formatCurrency(p.totalAmount) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- History Tabs -->
    <div class="tabs-container">
      <div class="tab-header">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'sales' }"
          @click="activeTab = 'sales'"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          Ventes & Factures Assignées ({{ sales.length }})
        </button>

        <button
          class="tab-btn"
          :class="{ active: activeTab === 'salaries' }"
          @click="activeTab = 'salaries'"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          Historique des Salaires ({{ salaries.length }})
        </button>

        <button
          class="tab-btn"
          :class="{ active: activeTab === 'details' }"
          @click="activeTab = 'details'"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Informations & Contrat RH
        </button>
      </div>

      <!-- Tab 1: Sales History -->
      <div v-if="activeTab === 'sales'" class="tab-pane">
        <AppTable
          :loading="loadingSales"
          :empty="!sales.length"
          empty-text="Aucune vente assignée à ce collaborateur pour la période sélectionnée"
          :columns-count="6"
        >
          <template #header>
            <th>N° Facture</th>
            <th>Date Vente</th>
            <th>Client</th>
            <th>Articles Vendus</th>
            <th>Montant Total</th>
            <th>Statut</th>
          </template>
          <template #body>
            <tr v-for="sale in sales" :key="sale.id">
              <td>
                <strong class="font-mono">{{ sale.invoiceNumber }}</strong>
              </td>
              <td class="font-mono text-caption">{{ formatDate(sale.saleDate) }}</td>
              <td>
                <div>{{ sale.customerName || 'Client Standard' }}</div>
                <div v-if="sale.customerPhone" class="text-caption text-muted font-mono">{{ sale.customerPhone }}</div>
              </td>
              <td>
                <div v-if="sale.items && sale.items.length" class="line-items-summary">
                  <span v-for="item in sale.items.slice(0, 2)" :key="item.id" class="line-item-badge">
                    {{ item.productName }} (x{{ item.quantity }})
                  </span>
                  <span v-if="sale.items.length > 2" class="text-caption text-muted">
                    +{{ sale.items.length - 2 }} autre(s)
                  </span>
                </div>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="font-mono font-bold">{{ formatCurrency(sale.totalAmount) }}</td>
              <td>
                <AppBadge :variant="sale.status === 'COMPLETED' ? 'success' : 'danger'" size="sm">
                  {{ sale.status === 'COMPLETED' ? 'Complété' : 'Annulé' }}
                </AppBadge>
              </td>
            </tr>
          </template>
        </AppTable>
      </div>

      <!-- Tab 2: Salary History -->
      <div v-if="activeTab === 'salaries'" class="tab-pane">
        <AppTable
          :loading="loadingSalaries"
          :empty="!salaries.length"
          empty-text="Aucun versement de salaire enregistré pour cet employé"
          :columns-count="7"
        >
          <template #header>
            <th>Période (Mois)</th>
            <th>Entrepôt</th>
            <th>Salaire de Base</th>
            <th>Prime Performance</th>
            <th>Prime Congé / Supp.</th>
            <th>Total Net Versé</th>
            <th>Date Paiement</th>
          </template>
          <template #body>
            <tr v-for="sal in salaries" :key="sal.id">
              <td class="font-mono font-bold">{{ sal.period }}</td>
              <td>{{ sal.warehouseName }}</td>
              <td class="font-mono">{{ formatCurrency(sal.baseSalary) }}</td>
              <td class="font-mono text-muted">{{ formatCurrency(sal.bonus1) }}</td>
              <td class="font-mono text-muted">{{ formatCurrency(sal.bonus2) }}</td>
              <td class="font-mono font-bold text-success">{{ formatCurrency(sal.totalAmount) }}</td>
              <td class="font-mono text-caption">{{ formatDate(sal.paymentDate) }}</td>
            </tr>
          </template>
        </AppTable>
      </div>

      <!-- Tab 3: Detailed Dossier -->
      <div v-if="activeTab === 'details'" class="tab-pane">
        <div class="dossier-grid">
          <div class="dossier-card">
            <h4 class="dossier-title">Identité & Contact</h4>
            <div class="dossier-row">
              <span class="dossier-label">Nom et Prénom</span>
              <strong class="dossier-val">{{ employee?.fullName }}</strong>
            </div>
            <div class="dossier-row">
              <span class="dossier-label">Numéro CNI / Identifiant</span>
              <strong class="dossier-val font-mono">{{ employee?.nationalId || 'Non renseigné' }}</strong>
            </div>
            <div class="dossier-row">
              <span class="dossier-label">Téléphone</span>
              <strong class="dossier-val font-mono">{{ employee?.phone || 'Non renseigné' }}</strong>
            </div>
          </div>

          <div class="dossier-card">
            <h4 class="dossier-title">Affectation & Contrat</h4>
            <div class="dossier-row">
              <span class="dossier-label">Entrepôt Actuel</span>
              <strong class="dossier-val">{{ employee?.warehouseName }} ({{ employee?.warehouseCode }})</strong>
            </div>
            <div class="dossier-row">
              <span class="dossier-label">Poste / Fonction</span>
              <strong class="dossier-val">{{ employee?.position }}</strong>
            </div>
            <div class="dossier-row">
              <span class="dossier-label">Date d'Embauche</span>
              <strong class="dossier-val font-mono">{{ formatDate(employee?.hireDate) }}</strong>
            </div>
            <div class="dossier-row">
              <span class="dossier-label">Salaire de Base Actuel</span>
              <strong class="dossier-val font-mono text-primary">{{ formatCurrency(employee?.baseSalary ?? 0) }}</strong>
            </div>
            <div class="dossier-row">
              <span class="dossier-label">Statut RH</span>
              <div>
                <AppBadge :variant="getStatusBadge(employee?.status).variant" size="sm">
                  {{ getStatusBadge(employee?.status).label }}
                </AppBadge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Profile Modal -->
    <AppModal
      v-model="showEditModal"
      title="Modifier le Profil du Collaborateur"
      max-width="540px"
    >
      <div v-if="editErrorMessage" class="modal-error mb-3">
        {{ editErrorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSaveEdit">
        <div class="form-row">
          <div class="app-input-group">
            <label class="input-label">Entrepôt d'Affectation</label>
            <select v-model.number="editForm.warehouseId" class="app-select" required>
              <option v-for="w in warehouseStore.allWarehousesFormatted" :key="w.id" :value="w.id">
                {{ w.label }} ({{ w.code }})
              </option>
            </select>
          </div>

          <div class="app-input-group">
            <label class="input-label">Statut RH</label>
            <select v-model="editForm.status" class="app-select" required>
              <option v-for="st in statusOptions" :key="st.value" :value="st.value">
                {{ st.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <AppInput
            v-model="editForm.fullName"
            label="Nom & Prénom Complet"
            placeholder="Mohamed Larbi"
            required
          />
          <AppInput
            v-model="editForm.nationalId"
            label="N° CNI / Identifiant National"
            placeholder="1985160100..."
          />
        </div>

        <div class="form-row">
          <AppInput
            v-model="editForm.position"
            label="Poste / Fonction"
            placeholder="Cariste / Magasinier"
            required
          />
          <AppInput
            v-model="editForm.phone"
            label="Téléphone de Contact"
            placeholder="+213 550 11 22 33"
          />
        </div>

        <div class="form-row">
          <AppInput
            v-model="editForm.hireDate"
            type="date"
            label="Date d'Embauche"
            required
          />
          <AppInput
            v-model.number="editForm.baseSalary"
            type="number"
            label="Salaire Mensuel de Base (DA)"
            placeholder="55000"
            required
          />
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showEditModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveEdit">
          Enregistrer les modifications
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.employee-detail-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.top-nav-bar {
  display: flex;
  align-items: center;
}

.back-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px 0;
  transition: color var(--transition-fast);
}

.back-link-btn:hover {
  color: var(--color-primary);
}

.profile-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.loading-state {
  justify-content: center;
  padding: 40px;
}

.profile-main-info {
  display: flex;
  align-items: center;
  gap: 18px;
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, #1e40af 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
  flex-shrink: 0;
}

.profile-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name-status-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.employee-name {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--color-text-primary);
}

.status-dropdown-wrapper {
  position: relative;
}

.status-select-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid transparent;
  cursor: pointer;
  outline: none;
  transition: all var(--transition-fast);
}

.status-active {
  background-color: #dcfce7;
  color: #15803d;
  border-color: #bbf7d0;
}
.status-on_leave {
  background-color: #fef9c3;
  color: #a16207;
  border-color: #fef08a;
}
.status-suspended {
  background-color: #f1f5f9;
  color: #475569;
  border-color: #cbd5e1;
}
.status-terminated {
  background-color: #fee2e2;
  color: #b91c1c;
  border-color: #fecaca;
}

.employee-submeta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-tag {
  font-size: 12px;
  color: var(--color-text-secondary);
  background-color: var(--color-bg);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.position-tag {
  font-weight: 600;
  color: var(--color-text-primary);
}

.period-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px 20px;
}

.period-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.kpi-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.kpi-icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-sales { background-color: #eff6ff; color: #2563eb; }
.icon-revenue { background-color: #ecfdf5; color: #059669; }
.icon-units { background-color: #f5f3ff; color: #7c3aed; }
.icon-basket { background-color: #fff7ed; color: #ea580c; }

.kpi-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.kpi-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.kpi-val-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.kpi-value {
  font-size: 20px;
  color: var(--color-text-primary);
}

.growth-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
}

.growth-pos { background-color: #dcfce7; color: #16a34a; }
.growth-neg { background-color: #fee2e2; color: #dc2626; }

.kpi-subtext {
  font-size: 11px;
}

.insights-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
}

@media (max-width: 900px) {
  .insights-grid {
    grid-template-columns: 1fr;
  }
}

.insight-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-header-clean {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}

.salary-metrics-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.salary-box {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.salary-box-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  font-weight: 500;
}

.salary-box-val {
  font-size: 16px;
}

.salary-box-sub {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.top-products-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.top-product-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background-color: var(--color-bg);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.rank-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.prod-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.prod-name {
  font-size: 12px;
  font-weight: 600;
}

.prod-ref {
  font-size: 11px;
}

.prod-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 12px;
}

.prod-qty {
  color: var(--color-primary);
}

.empty-compact {
  font-size: 12px;
  padding: 20px 0;
  text-align: center;
}

.tabs-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tab-header {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  background-color: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.tab-btn.active {
  background-color: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-primary);
  font-weight: 600;
}

.tab-pane {
  display: flex;
  flex-direction: column;
}

.line-items-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.line-item-badge {
  font-size: 11px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 1px 6px;
  border-radius: 4px;
}

.dossier-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .dossier-grid {
    grid-template-columns: 1fr;
  }
}

.dossier-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dossier-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
  margin: 0;
}

.dossier-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.dossier-label {
  color: var(--color-text-secondary);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.app-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
  text-transform: uppercase;
}

.app-select {
  width: 100%;
  height: 38px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  font-size: 13px;
}

.modal-error {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.mb-3 { margin-bottom: 12px; }
</style>
