<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
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
import ProductDocumentModal from '../../components/products/ProductDocumentModal.vue';

const authStore = useAuthStore();
const products = ref<Product[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const selectedBrand = ref('');
const sortBy = ref<ProductSortBy>('name');
const sortOrder = ref<SortOrder>('asc');

// Selection state
const selectedProductIds = ref<Set<number>>(new Set());

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

// Document Preview Modal State
const showDocModal = ref(false);
const activeDocType = ref<'price_list' | 'catalog'>('price_list');
const docProducts = ref<Product[]>([]);
const docScopeText = ref('');
const preparingDoc = ref(false);

// Computed selection helpers
const selectedCount = computed(() => selectedProductIds.value.size);

const isAllCurrentPageSelected = computed(() => {
  if (!products.value.length) return false;
  return products.value.every((p) => selectedProductIds.value.has(p.id));
});

const isSomeCurrentPageSelected = computed(() => {
  if (!products.value.length) return false;
  const count = products.value.filter((p) => selectedProductIds.value.has(p.id)).length;
  return count > 0 && count < products.value.length;
});

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

// Selection handlers
function toggleSelectProduct(id: number) {
  const next = new Set(selectedProductIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedProductIds.value = next;
}

function toggleSelectAllCurrentPage() {
  const next = new Set(selectedProductIds.value);
  if (isAllCurrentPageSelected.value) {
    products.value.forEach((p) => next.delete(p.id));
  } else {
    products.value.forEach((p) => next.add(p.id));
  }
  selectedProductIds.value = next;
}

function clearSelection() {
  selectedProductIds.value = new Set();
}

// Retrieve dataset for exports & document generation for an explicit scope.
// 'selection' → only the checked products; 'all' → every product matching the active filters.
async function getTargetProductsForAction(
  scope: 'all' | 'selection',
): Promise<{ items: Product[]; scopeText: string }> {
  const allRes = await productService.getAllProducts({
    search: searchQuery.value.trim() || undefined,
    brand: selectedBrand.value || undefined,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  });

  if (scope === 'selection' && selectedProductIds.value.size > 0) {
    const selectedItems = allRes.filter((p) => selectedProductIds.value.has(p.id));
    const items = selectedItems.length
      ? selectedItems
      : products.value.filter((p) => selectedProductIds.value.has(p.id));
    return {
      items,
      scopeText: `Sélection : ${items.length} ${items.length > 1 ? 'produits' : 'produit'}`,
    };
  }

  return {
    items: allRes,
    scopeText: `Tous les produits filtrés (${allRes.length})`,
  };
}

async function handleOpenDocument(type: 'price_list' | 'catalog', scope: 'all' | 'selection') {
  preparingDoc.value = true;
  try {
    activeDocType.value = type;
    const { items, scopeText } = await getTargetProductsForAction(scope);
    docProducts.value = items;
    docScopeText.value = scopeText;
    showDocModal.value = true;
  } catch (err) {
    console.error('Failed to prepare document products', err);
  } finally {
    preparingDoc.value = false;
  }
}

async function handleExportCsv(scope: 'all' | 'selection') {
  exporting.value = true;
  try {
    const ids =
      scope === 'selection' && selectedProductIds.value.size > 0
        ? Array.from(selectedProductIds.value)
        : undefined;
    await productService.exportProductsCsv({
      search: searchQuery.value.trim() || undefined,
      brand: selectedBrand.value || undefined,
      ids,
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
        <!-- Catalogue-wide exports: always act on ALL filtered products -->
        <AppButton
          variant="secondary"
          :loading="exporting"
          title="Exporter tout le catalogue filtré au format CSV"
          @click="handleExportCsv('all')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter CSV
        </AppButton>

        <!-- Generate Devis / Price List PDF Button -->
        <AppButton
          variant="secondary"
          :loading="preparingDoc"
          title="Générer un devis PDF de tout le catalogue filtré"
          @click="handleOpenDocument('price_list', 'all')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Devis PDF
        </AppButton>

        <!-- Generate Reference Catalog PDF Button -->
        <AppButton
          variant="secondary"
          :loading="preparingDoc"
          title="Générer le catalogue PDF de tous les produits filtrés"
          @click="handleOpenDocument('catalog', 'all')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Catalogue PDF
        </AppButton>

        <!-- New Product Button (Admins only) -->
        <AppButton v-if="authStore.isAdmin" variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouveau Produit
        </AppButton>
      </div>
    </div>

    <!-- Contextual Selection Action Bar -->
    <div v-if="selectedCount > 0" class="selection-action-bar">
      <div class="selection-info">
        <span class="selection-badge">{{ selectedCount }}</span>
        <span class="selection-text">
          {{ selectedCount > 1 ? 'produits sélectionnés' : 'produit sélectionné' }}
        </span>
      </div>
      <div class="selection-actions">
        <button
          class="selection-btn"
          :disabled="exporting"
          title="Exporter uniquement les produits sélectionnés au format CSV"
          @click="handleExportCsv('selection')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter CSV ({{ selectedCount }})
        </button>
        <button
          class="selection-btn"
          :disabled="preparingDoc"
          title="Générer un devis PDF des produits sélectionnés"
          @click="handleOpenDocument('price_list', 'selection')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Devis PDF ({{ selectedCount }})
        </button>
        <button
          class="selection-btn"
          :disabled="preparingDoc"
          title="Générer un catalogue PDF des produits sélectionnés"
          @click="handleOpenDocument('catalog', 'selection')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Catalogue PDF ({{ selectedCount }})
        </button>
        <button class="selection-btn btn-clear" title="Désélectionner tous les produits" @click="clearSelection">
          ✕ Désélectionner
        </button>
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
    <AppTable :loading="loading" :empty="!products.length" empty-text="Aucun produit trouvé" :columns-count="8">
      <template #header>
        <th class="col-checkbox">
          <input
            type="checkbox"
            class="custom-checkbox"
            :checked="isAllCurrentPageSelected"
            :indeterminate.prop="isSomeCurrentPageSelected"
            title="Tout sélectionner / désélectionner sur cette page"
            @change="toggleSelectAllCurrentPage"
          />
        </th>
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
        <tr
          v-for="product in products"
          :key="product.id"
          :class="{ 'row-selected': selectedProductIds.has(product.id) }"
        >
          <td class="col-checkbox">
            <input
              type="checkbox"
              class="custom-checkbox"
              :checked="selectedProductIds.has(product.id)"
              @change="toggleSelectProduct(product.id)"
            />
          </td>
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

    <!-- Document Print / PDF Preview Modal -->
    <ProductDocumentModal
      v-model="showDocModal"
      v-model:document-type="activeDocType"
      :products="docProducts"
      :scope-text="docScopeText"
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
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Contextual Selection Action Bar */
.selection-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #1e293b, #0f172a);
  color: #ffffff;
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  animation: slideDown 0.2s ease;
  flex-wrap: wrap;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.selection-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: var(--color-primary, #3b82f6);
  color: #ffffff;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-mono, monospace);
}

.selection-text {
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.selection-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.selection-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  cursor: pointer;
  transition: all var(--transition-fast, 0.15s ease);
}

.selection-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-1px);
}

.selection-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.selection-btn.btn-clear {
  background-color: transparent;
  border-color: transparent;
  color: #94a3b8;
}

.selection-btn.btn-clear:hover {
  color: #f87171;
  background-color: rgba(239, 68, 68, 0.15);
}

/* Checkboxes */
.col-checkbox {
  width: 38px;
  text-align: center;
  padding-left: 14px !important;
  padding-right: 6px !important;
}

.custom-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary, #2563eb);
  vertical-align: middle;
}

:deep(tbody tr.row-selected) {
  background-color: #f0f7ff !important;
}

:deep(tbody tr.row-selected:hover) {
  background-color: #e0effe !important;
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
