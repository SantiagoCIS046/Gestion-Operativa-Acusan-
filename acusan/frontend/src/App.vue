<template>
  <div class="app-layout">
    <!-- Top Navbar -->
    <header class="app-header">
      <div class="header-container">
        <div class="brand-section">
          <div class="logo-badge">
            <span class="logo-icon">💧</span>
          </div>
          <div class="brand-text">
            <h2 class="brand-title">ACUASAN E.S.P.</h2>
            <span class="brand-subtitle">Sistema de Gestión Operativa & Administrativa</span>
          </div>
        </div>

        <nav class="nav-links">
          <div class="nav-group">
            <span class="group-label">Permisos</span>
            <router-link to="/permisos/encargado" class="nav-item" active-class="active">
              <span class="nav-icon">📝</span>
              <span>Encargado OCR</span>
            </router-link>
            <router-link to="/permisos/gerencia" class="nav-item" active-class="active">
              <span class="nav-icon">⚖</span>
              <span>Gerencia</span>
            </router-link>
          </div>

          <div class="nav-divider"></div>

          <div class="nav-group">
            <span class="group-label">Operaciones</span>
            <router-link to="/horas-extras/gerencia" class="nav-item" active-class="active">
              <span class="nav-icon">⏱</span>
              <span>Horas Extras</span>
            </router-link>
            <router-link to="/pqr/gestion" class="nav-item" active-class="active">
              <span class="nav-icon">📨</span>
              <span>Gestión PQR</span>
            </router-link>
          </div>
        </nav>

        <div class="user-profile">
          <div class="user-avatar">AD</div>
          <div class="user-details">
            <span class="user-name">Administración</span>
            <span class="user-role">San Gil, Santander</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <main class="main-content">
      <router-view />
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <p>Acuasan E.S.P. — Empresa de Acueducto, Alcantarillado y Aseo de San Gil &copy; 2026</p>
    </footer>
  </div>
</template>

<script setup>
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f8fafc;
}

.app-header {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 24px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-badge {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 8px rgba(2, 132, 199, 0.35);
}

.logo-icon {
  font-size: 1.4rem;
}

.brand-title {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #0f172a;
  margin: 0;
  line-height: 1.1;
}

.brand-subtitle {
  font-size: 0.75rem;
  font-weight: 500;
  color: #64748b;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #94a3b8;
  margin-right: 4px;
  letter-spacing: 0.5px;
}

.nav-divider {
  width: 1px;
  height: 24px;
  background: #e2e8f0;
}

.nav-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  text-decoration: none;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.nav-item.active {
  background: #e0f2fe;
  color: #0284c7;
}

.nav-icon {
  font-size: 0.95rem;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #0284c7;
  font-weight: 700;
  font-size: 0.85rem;
  border: 2px solid #e0f2fe;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
}

.user-role {
  font-size: 0.72rem;
  color: #64748b;
}

.main-content {
  flex: 1;
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
  box-sizing: border-box;
}

.app-footer {
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  padding: 16px 24px;
  text-align: center;
  font-size: 0.8rem;
  color: #94a3b8;
}
</style>
