<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { productService } from '../../services/catalog.service';
import type { Product } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';

const authStore = useAuthStore();
const products = ref<Product[]>([]);
const loading = ref(true);
const searchQuery = ref('');

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
});

// Price Update Modal State
const showPriceModal = ref(false);
const priceUpdatingProduct = ref<Product | null>(null);
const priceForm = ref({
  purchasePrice: 0,
  salePrice: 0,
});
const saving = ref(false);
const exporting = ref(false);

onMounted(async () => {
  await fetchProducts();
});

async function fetchProducts() {
  loading.value = true;
  try {
    products.value = await productService.getProducts();
  } catch (err) {
    console.error('Failed to load products', err);
  } finally {
    loading.value = false;
  }
}

async function handleExportCsv() {
  exporting.value = true;
  try {
    await productService.exportProductsCsv({ search: searchQuery.value });
  } catch (err) {
    console.error('Failed to export products CSV', err);
  } finally {
    exporting.value = false;
  }
}

const filteredProducts = computed(() => {
  if (!searchQuery.value.trim()) return products.value;
  const q = searchQuery.value.toLowerCase();
  return products.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.reference.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
  );
});

function openCreateModal() {
  editingProduct.value = null;
  productForm.value = {
    reference: '',
    name: '',
    brand: 'KRAFT',
    purchasePrice: 0,
    salePrice: 0,
    unit: 'PIECE',
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
  };
  showProductModal.value = true;
}

function openPriceModal(product: Product) {
  priceUpdatingProduct.value = product;
  priceForm.value = {
    purchasePrice: product.purchasePrice,
    salePrice: product.salePrice,
  };
  showPriceModal.value = true;
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
    await fetchProducts();
  } catch (err) {
    console.error('Failed to save product', err);
  } finally {
    saving.value = false;
  }
}

async function handleUpdatePrice() {
  if (!priceUpdatingProduct.value) return;
  saving.value = true;
  try {
    await productService.updatePrice(priceUpdatingProduct.value.id, priceForm.value);
    showPriceModal.value = false;
    await fetchProducts();
  } catch (err) {
    console.error('Failed to update price', err);
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

    <!-- Search & Filters -->
    <div class="filter-bar">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher par référence, désignation ou marque..."
          class="search-input"
        />
      </div>
      <div class="count-badge text-muted font-mono">
        {{ filteredProducts.length }} {{ filteredProducts.length > 1 ? 'produits' : 'produit' }}
      </div>
    </div>

    <!-- Products Table -->
    <AppTable :loading="loading" :empty="!filteredProducts.length" empty-text="Aucun produit trouvé" :columns-count="7">
      <template #header>
        <th>Référence</th>
        <th>Désignation Produit</th>
        <th>Marque</th>
        <th>Prix d'Achat</th>
        <th>Prix de Vente</th>
        <th>Marge Brute</th>
        <th>Actions</th>
      </template>
      <template #body>
        <tr v-for="product in filteredProducts" :key="product.id">
          <td class="font-mono font-bold">{{ product.reference }}</td>
          <td>
            <strong>{{ product.name }}</strong>
            <span class="text-caption" style="display: block;">Unité : {{ product.unit }}</span>
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
                class="icon-action-btn"
                title="Mettre à jour le tarif"
                @click="openPriceModal(product)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Tarif
              </button>
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
          placeholder="ex. KRAFT"
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
        <AppInput
          v-model="productForm.unit"
          label="Unité de Mesure"
          placeholder="PIECE, JEU, BOITE"
          required
        />
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="showProductModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveProduct">
          {{ editingProduct ? 'Enregistrer les modifications' : 'Créer le produit' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- Update Price Modal -->
    <AppModal
      v-model="showPriceModal"
      :title="`Mise à jour tarifaire : ${priceUpdatingProduct?.name || ''}`"
      max-width="440px"
    >
      <div class="price-update-box">
        <p class="text-caption text-muted mb-3">
          Référence : <strong class="font-mono">{{ priceUpdatingProduct?.reference }}</strong>
        </p>
        <div class="form-row">
          <AppInput
            v-model="priceForm.purchasePrice"
            type="number"
            label="Prix d'Achat (DA)"
            hint="Pour la valorisation des stocks"
          />
          <AppInput
            v-model="priceForm.salePrice"
            type="number"
            label="Prix de Vente (DA)"
            hint="Prix de facturation par défaut"
          />
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="showPriceModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleUpdatePrice">
          Mettre à jour les tarifs
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
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 480px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 8px 12px 8px 36px;
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

.price-update-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
