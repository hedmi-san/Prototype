<template>
  <div class="auth-layout">
    <div class="auth-box">
      <div class="brand-header">
        <div class="brand-logo">
          <img class="logo-mark" src="../assets/images/logo.png" alt="Logo" />
          <span class="logo-text">BOUSFOR HOSNA</span>
        </div>
        <p class="brand-tagline">Gestion Multi-Entrepôts de Distribution d'Outillage Industriel</p>
      </div>
      <div class="auth-card">
        <router-view />
      </div>
      <div class="auth-footer">
        <span>© 2026 ERUL BOUSFOR GEN TRADING IMP & EXP. Tous droits réservés.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fafafa;
  padding: 24px;
}

.auth-box {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.brand-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-mark {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-primary);
}

.brand-tagline {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.auth-card {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 32px 28px;
  box-shadow: var(--shadow-md);
}

.auth-footer {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
