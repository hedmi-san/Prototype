<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { productService } from '../../services/catalog.service';
import type { Product, ProductSortBy, SortOrder } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';
import AppPagination from '../../components/common/AppPagination.vue';

const authStore = useAuthStore();
const products = ref<Product[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const selectedBrand = ref('');
const sortBy = ref<ProductSortBy>('name');
const sortOrder = ref<SortOrder>('asc');

// Pagination state
const page = ref(1);
const limit = ref(25);
const total = ref(0);
const totalPages = ref(1);

// Brands list
const brands = ref<string[]>([]);
const loadingBrands = ref(false);

// Stale request tracking
let lastRequestId = 0;

// Product Create/Edit Modal State
const showProductModal = ref(false);
const editingProduct = ref<Product | null>(null);
const productForm = ref({
  reference: '',
  name: '',
  brand: 'KRAFT',
  purchasePrice: 0,
  salePrice: 0,
  unit: 'PIECE',
  boxSize: 0,
});
const saving = ref(false);
const exporting = ref(false);

onMounted(async () => {
  window.addEventListener('focus', handleWindowFocus);
  document.addEventListener('visibilitychange', handleWindowFocus);
  await Promise.all([fetchProducts(), fetchBrands()]);
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', handleWindowFocus);
  document.removeEventListener('visibilitychange', handleWindowFocus);
  clearTimeout(searchTimeout);
});

function handleWindowFocus() {
  if (document.visibilityState === 'visible' && !showProductModal.value) {
    fetchProducts(false);
    fetchBrands();
  }
}

async function fetchBrands() {
  loadingBrands.value = true;
  try {
    brands.value = await productService.getBrands();
  } catch (err) {
    console.error('Failed to load brands', err);
  } finally {
    loadingBrands.value = false;
  }
}

async function fetchProducts(showLoading = true) {
  if (showLoading) loading.value = true;
  const currentReqId = ++lastRequestId;

  try {
    const res = await productService.getProducts({
      page: page.value,
      limit: limit.value,
      search: searchQuery.value.trim() || undefined,
      brand: selectedBrand.value || undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    });

    if (currentReqId !== lastRequestId) return;

    products.value = res.items;
    total.value = res.pagination.total;
    totalPages.value = res.pagination.totalPages;
    page.value = res.pagination.page;
  } catch (err) {
    if (currentReqId === lastRequestId) {
      console.error('Failed to load products', err);
    }
  } finally {
    if (currentReqId === lastRequestId) {
      loading.value = false;
    }
  }
}

let searchTimeout: any = null;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    page.value = 1;
    await fetchProducts();
  }, 300);
}

function clearSearch() {
  searchQuery.value = '';
  page.value = 1;
  fetchProducts();
}

watch(selectedBrand, async () => {
  page.value = 1;
  await fetchProducts();
});

function onSortDropdownChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  const [newSortBy, newSortOrder] = value.split('_') as [ProductSortBy, SortOrder];
  sortBy.value = newSortBy;
  sortOrder.value = newSortOrder;
  page.value = 1;
  fetchProducts();
}

function toggleSort(column: ProductSortBy) {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = column;
    sortOrder.value = 'asc';
  }
  page.value = 1;
  fetchProducts();
}

function onPageChange(payload: { page: number; limit: number }) {
  page.value = payload.page;
  limit.value = payload.limit;
  fetchProducts();
}

function resetFilters() {
  searchQuery.value = '';
  selectedBrand.value = '';
  sortBy.value = 'name';
  sortOrder.value = 'asc';
  page.value = 1;
  fetchProducts();
}

async function handleExportCsv() {
  exporting.value = true;
  try {
    await productService.exportProductsCsv({
      search: searchQuery.value.trim() || undefined,
      brand: selectedBrand.value || undefined,
    });
  } catch (err) {
    console.error('Failed to export products CSV', err);
  } finally {
    exporting.value = false;
  }
}

function openCreateModal() {
  editingProduct.value = null;
  productForm.value = {
    reference: '',
    name: '',
    brand: brands.value[0] || 'KRAFT',
    purchasePrice: 0,
    salePrice: 0,
    unit: 'PIECE',
    boxSize: 0,
  };
  showProductModal.value = true;
}

function openEditModal(product: Product) {
  editingProduct.value = product;
  productForm.value = {
    reference: product.reference,
    name: product.name,
    brand: product.brand,
    purchasePrice: product.purchasePrice,
    salePrice: product.salePrice,
    unit: product.unit,
    boxSize: product.boxSize || 0,
  };
  showProductModal.value = true;
}

async function handleSaveProduct() {
  saving.value = true;
  try {
    if (editingProduct.value) {
      await productService.updateProduct(editingProduct.value.id, productForm.value);
    } else {
      await productService.createProduct(productForm.value);
    }
    showProductModal.value = false;
    await Promise.all([fetchProducts(), fetchBrands()]);
  } catch (err) {
    console.error('Failed to save product', err);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="products-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Catalogue Produits</h1>
        <p class="text-muted">Référentiel des outillages industriels & grille tarifaire</p>
      </div>
      <div class="header-actions">
        <AppButton variant="secondary" :loading="exporting" @click="handleExportCsv">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter CSV
        </AppButton>
        <AppButton v-if="authStore.isAdmin" variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouveau Produit
        </AppButton>
      </div>
    </div>

    <!-- Search & Filters Control Bar -->
    <div class="filter-bar">
      <div class="filter-controls-left">
        <!-- Search Box -->
        <div class="search-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Rechercher par référence, désignation..."
            class="search-input"
            @input="onSearchInput"
          />
          <button
            v-if="searchQuery"
            class="clear-search-btn"
            title="Effacer la recherche"
            @click="clearSearch"
          >
            ✕
          </button>
        </div>

        <!-- Brand Filter Dropdown -->
        <div class="select-wrapper">
          <select v-model="selectedBrand" class="filter-select">
            <option value="">Toutes les marques</option>
            <option v-for="b in brands" :key="b" :value="b">
              {{ b }}
            </option>
          </select>
        </div>

        <!-- Quick Sort Dropdown -->
        <div class="select-wrapper">
          <select :value="`${sortBy}_${sortOrder}`" class="filter-select sort-select" @change="onSortDropdownChange">
            <option value="name_asc">Nom : A ➔ Z</option>
            <option value="name_desc">Nom : Z ➔ A</option>
            <option value="salePrice_asc">Prix Vente : Moins cher ➔ Plus cher</option>
            <option value="salePrice_desc">Prix Vente : Plus cher ➔ Moins cher</option>
            <option value="purchasePrice_asc">Prix Achat : Moins cher ➔ Plus cher</option>
            <option value="purchasePrice_desc">Prix Achat : Plus cher ➔ Moins cher</option>
            <option value="reference_asc">Référence : A ➔ Z</option>
            <option value="reference_desc">Référence : Z ➔ A</option>
            <option value="createdAt_desc">Plus récents d'abord</option>
          </select>
        </div>

        <button
          v-if="searchQuery || selectedBrand || sortBy !== 'name' || sortOrder !== 'asc'"
          class="reset-filters-btn"
          title="Réinitialiser les filtres et le tri"
          @click="resetFilters"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Réinitialiser
        </button>
      </div>

      <div class="count-badge text-muted font-mono">
        {{ total }} {{ total > 1 ? 'produits' : 'produit' }}
      </div>
    </div>

    <!-- Products Table -->
    <AppTable :loading="loading" :empty="!products.length" empty-text="Aucun produit trouvé" :columns-count="7">
      <template #header>
        <th>
          <button class="th-sort-btn" @click="toggleSort('reference')">
            <span>Référence</span>
            <span class="sort-indicator">
              <template v-if="sortBy === 'reference'">
                {{ sortOrder === 'asc' ? '▲' : '▼' }}
              </template>
              <template v-else>▲▼</template>
            </span>
          </button>
        </th>
        <th>
          <button class="th-sort-btn" @click="toggleSort('name')">
            <span>Désignation Produit</span>
            <span class="sort-indicator">
              <template v-if="sortBy === 'name'">
                {{ sortOrder === 'asc' ? '▲' : '▼' }}
              </template>
              <template v-else>▲▼</template>
            </span>
          </button>
        </th>
        <th>
          <button class="th-sort-btn" @click="toggleSort('brand')">
            <span>Marque</span>
            <span class="sort-indicator">
              <template v-if="sortBy === 'brand'">
                {{ sortOrder === 'asc' ? '▲' : '▼' }}
              </template>
              <template v-else>▲▼</template>
            </span>
          </button>
        </th>
        <th>
          <button class="th-sort-btn" @click="toggleSort('purchasePrice')">
            <span>Prix d'Achat</span>
            <span class="sort-indicator">
              <template v-if="sortBy === 'purchasePrice'">
                {{ sortOrder === 'asc' ? '▲' : '▼' }}
              </template>
              <template v-else>▲▼</template>
            </span>
          </button>
        </th>
        <th>
          <button class="th-sort-btn" @click="toggleSort('salePrice')">
            <span>Prix de Vente</span>
            <span class="sort-indicator">
              <template v-if="sortBy === 'salePrice'">
                {{ sortOrder === 'asc' ? '▲' : '▼' }}
              </template>
              <template v-else>▲▼</template>
            </span>
          </button>
        </th>
        <th>Marge Brute</th>
        <th>Actions</th>
      </template>
      <template #body>
        <tr v-for="product in products" :key="product.id">
          <td class="font-mono font-bold">{{ product.reference }}</td>
          <td>
            <strong>{{ product.name }}</strong>
            <span class="text-caption text-muted" style="display: block;">
              Unité : {{ product.unit }}
              <template v-if="product.boxSize && product.boxSize > 0">
                • <strong>Colisage : {{ product.boxSize }} pcs/ctn</strong>
              </template>
              <template v-else>
                • Colisage : —
              </template>
            </span>
          </td>
          <td>
            <AppBadge variant="neutral" size="sm">{{ product.brand }}</AppBadge>
          </td>
          <td class="font-mono">{{ formatCurrency(product.purchasePrice) }}</td>
          <td class="font-mono font-bold">{{ formatCurrency(product.salePrice) }}</td>
          <td class="font-mono text-success">
            +{{ formatCurrency(product.salePrice - product.purchasePrice) }}
          </td>
          <td>
            <div class="action-buttons">
              <button
                v-if="authStore.isAdmin"
                class="icon-action-btn"
                title="Modifier la fiche produit"
                @click="openEditModal(product)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Modifier
              </button>
            </div>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Standard Reusable Pagination Component -->
    <AppPagination
      :page="page"
      :limit="limit"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @update:page="page = $event"
      @update:limit="limit = $event"
      @change="onPageChange"
    />

    <!-- Create/Edit Product Modal -->
    <AppModal
      v-model="showProductModal"
      :title="editingProduct ? 'Modifier la Fiche Produit' : 'Ajouter un Nouveau Produit'"
      max-width="500px"
    >
      <form class="modal-form" @submit.prevent="handleSaveProduct">
        <AppInput
          v-model="productForm.reference"
          label="Référence Produit / SKU"
          placeholder="ex. DRILL-HD-850"
          :disabled="!!editingProduct"
          required
        />
        <AppInput
          v-model="productForm.name"
          label="Désignation du Produit"
          placeholder="ex. Marteau Perforateur Professionnel 850W"
          required
        />
        <AppInput
          v-model="productForm.brand"
          label="Marque / Fabricant"
          placeholder="WEHAND"
          required
        />
        <div class="form-row">
          <AppInput
            v-model="productForm.purchasePrice"
            type="number"
            label="Prix d'Achat (DA)"
            placeholder="0.00"
            required
          />
          <AppInput
            v-model="productForm.salePrice"
            type="number"
            label="Prix de Vente (DA)"
            placeholder="0.00"
            required
          />
        </div>
        <div class="form-row">
          <AppInput
            v-model="productForm.unit"
            label="Unité de Mesure"
            placeholder="PIECE, JEU, BOITE"
            required
          />
          <AppInput
            v-model="productForm.boxSize"
            type="number"
            label="Colisage (Pièces / Carton)"
            placeholder="0"
            hint="0 si pièce vendue seule"
          />
        </div>
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="showProductModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveProduct">
          {{ editingProduct ? 'Enregistrer les modifications' : 'Créer le produit' }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.products-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-controls-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 240px;
  max-width: 380px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.clear-search-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
}

.clear-search-btn:hover {
  color: var(--color-text-primary);
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 8px 32px 8px 36px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
  transition: all var(--transition-fast);
}

.search-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.select-wrapper {
  position: relative;
}

.filter-select {
  height: 38px;
  padding: 8px 12px;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-text-primary);
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.sort-select {
  min-width: 220px;
}

.reset-filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background-color: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.reset-filters-btn:hover {
  color: var(--color-danger);
  border-color: var(--color-danger-border);
  background-color: var(--color-danger-bg);
}

.th-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  cursor: pointer;
  text-transform: inherit;
  letter-spacing: inherit;
}

.th-sort-btn:hover {
  color: var(--color-primary);
}

.sort-indicator {
  font-size: 10px;
  color: var(--color-text-secondary);
  opacity: 0.7;
}

.th-sort-btn:hover .sort-indicator {
  opacity: 1;
  color: var(--color-primary);
}

.font-bold {
  font-weight: 600;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.icon-action-btn:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-dark);
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
</style>

