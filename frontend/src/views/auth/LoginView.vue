<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.store';
import AppInput from '../../components/common/AppInput.vue';
import AppButton from '../../components/common/AppButton.vue';

const router = useRouter();
const authStore = useAuthStore();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  if (!username.value || !password.value) {
    error.value = 'Veuillez saisir votre identifiant et votre mot de passe';
    return;
  }

  loading.value = true;
  try {
    await authStore.login({
      username: username.value,
      password: password.value,
    });
    router.push('/dashboard');
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Identifiants invalides. Veuillez réessayer.';
  } finally {
    loading.value = false;
  }
}

function quickLogin(user: string, pass: string) {
  username.value = user;
  password.value = pass;
  handleLogin();
}
</script>

<template>
  <div class="login-view">
    <div class="login-header">
      <h2>Bienvenue</h2>
      <p class="text-muted">Connectez-vous à votre portail de distribution</p>
    </div>

    <form class="login-form" @submit.prevent="handleLogin">
      <div v-if="error" class="login-alert">
        {{ error }}
      </div>

      <AppInput
        v-model="username"
        label="Nom d'utilisateur"
        placeholder="ex. admin ou manager_algiers"
        required
      />

      <AppInput
        v-model="password"
        type="password"
        label="Mot de passe"
        placeholder="••••••••"
        required
      />

      <AppButton
        type="submit"
        variant="primary"
        size="lg"
        :loading="loading"
      >
        Se connecter
      </AppButton>
    </form>

    <div class="quick-login-section">
      <div class="quick-title">
        <span>ACCÈS RAPIDE DÉMO</span>
      </div>
      <div class="quick-grid">
        <button
          type="button"
          class="quick-btn"
          @click="quickLogin('admin', 'AdminPass123!')"
        >
          <strong>Administrateur</strong>
          <span>Accès Global</span>
        </button>

        <button
          type="button"
          class="quick-btn"
          @click="quickLogin('manager_algiers', 'ManagerPass123!')"
        >
          <strong>Responsable</strong>
          <span>Hub d'Alger</span>
        </button>

        <button
          type="button"
          class="quick-btn"
          @click="quickLogin('super_oran', 'SuperPass123!')"
        >
          <strong>Super Gestionnaire</strong>
          <span>Hub d'Oran</span>
        </button>

        <button
          type="button"
          class="quick-btn"
          @click="quickLogin('accountant_constantine', 'AccountantPass123!')"
        >
          <strong>Comptable</strong>
          <span>Hub de Constantine</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.login-header {
  text-align: center;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-alert {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.quick-login-section {
  margin-top: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.quick-title {
  text-align: center;
  margin-bottom: 12px;
}

.quick-title span {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-secondary);
  letter-spacing: 0.08em;
}

.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quick-btn {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: all var(--transition-fast);
}

.quick-btn:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-primary);
}

.quick-btn strong {
  font-size: 12px;
  color: var(--color-primary);
}

.quick-btn span {
  font-size: 11px;
  color: var(--color-text-secondary);
}
</style>
