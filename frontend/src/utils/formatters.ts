import type {
  RoleType,
  SaleStatus,
  TransferStatus,
  ExpenseCategory,
  SalaryStatus,
  StockMovementType,
} from '../types';

/**
 * Format a numeric amount as currency (French locale: space for thousands, comma for decimals)
 */
export function formatCurrency(amount: number | null | undefined, currency: string = 'DA'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `0,00 ${currency}`;
  }
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
}

/**
 * Format a number with French thousand separators
 */
export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format an ISO date string or Date into French short date (DD/MM/YYYY)
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Format an ISO date string or Date into French date and time (DD/MM/YYYY HH:mm)
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format an ISO date into a French long date string (e.g. 17 août 2026)
 */
export function formatLongDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Map RoleType to localized French label
 */
export function formatRole(role: RoleType | string | null | undefined): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrateur';
    case 'SUPER_MANAGER':
      return 'Super Gestionnaire';
    case 'MANAGER':
      return 'Responsable d\'entrepôt';
    case 'ACCOUNTANT':
      return 'Comptable';
    default:
      return role || 'Utilisateur';
  }
}

/**
 * Map SaleStatus to localized French label
 */
export function formatSaleStatus(status: SaleStatus | string | null | undefined): string {
  switch (status) {
    case 'COMPLETED':
      return 'Terminée';
    case 'CANCELLED':
      return 'Annulée';
    default:
      return status || '-';
  }
}

/**
 * Map TransferStatus to localized French label
 */
export function formatTransferStatus(status: TransferStatus | string | null | undefined): string {
  switch (status) {
    case 'REQUESTED':
      return 'Demandé';
    case 'APPROVED':
      return 'Approuvé';
    case 'CONFIRMED':
      return 'Confirmé (Reçu)';
    case 'DECLINED':
      return 'Refusé';
    case 'CANCELLED':
      return 'Annulé';
    default:
      return status || '-';
  }
}

/**
 * Map ExpenseCategory to localized French label
 */
export function formatExpenseCategory(cat: ExpenseCategory | string | null | undefined): string {
  switch (cat) {
    case 'ELECTRICITY':
      return 'Électricité';
    case 'WATER':
      return 'Eau';
    case 'RENT':
      return 'Loyer';
    case 'FUEL':
      return 'Carburant';
    case 'MAINTENANCE':
      return 'Entretien & Maintenance';
    case 'OTHER':
      return 'Autre charge';
    default:
      return cat || '-';
  }
}

/**
 * Map SalaryStatus to localized French label
 */
export function formatSalaryStatus(status: SalaryStatus | string | null | undefined): string {
  switch (status) {
    case 'PAID':
      return 'Payé';
    case 'PENDING':
      return 'En attente';
    default:
      return status || '-';
  }
}

/**
 * Map StockMovementType to localized French label
 */
export function formatMovementType(type: StockMovementType | string | null | undefined): string {
  switch (type) {
    case 'INITIAL_STOCK':
      return 'Stock initial';
    case 'SALE':
      return 'Sortie Vente';
    case 'TRANSFER_IN':
      return 'Transfert entrant';
    case 'TRANSFER_OUT':
      return 'Transfert sortant';
    case 'ADJUSTMENT':
      return 'Ajustement inventaire';
    default:
      return type || '-';
  }
}

/**
 * Map Audit Log actions and entity types to French
 */
export function formatAuditAction(action: string | null | undefined): string {
  if (!action) return '-';
  switch (action.toUpperCase()) {
    case 'CREATE':
      return 'Création';
    case 'UPDATE':
      return 'Modification';
    case 'DELETE':
      return 'Suppression';
    case 'LOGIN':
      return 'Connexion';
    case 'LOGOUT':
      return 'Déconnexion';
    case 'APPROVE':
      return 'Approbation';
    case 'CONFIRM':
      return 'Confirmation';
    case 'CANCEL':
      return 'Annulation';
    default:
      return action;
  }
}

export function formatEntityType(entity: string | null | undefined): string {
  if (!entity) return '-';
  switch (entity.toUpperCase()) {
    case 'PRODUCT':
      return 'Produit';
    case 'STOCK':
      return 'Stock';
    case 'SALE':
      return 'Vente';
    case 'TRANSFER':
      return 'Transfert';
    case 'EXPENSE':
      return 'Dépense';
    case 'SALARY':
      return 'Salaire';
    case 'EMPLOYEE':
      return 'Employé';
    case 'USER':
      return 'Utilisateur';
    case 'WAREHOUSE':
      return 'Entrepôt';
    default:
      return entity;
  }
}
