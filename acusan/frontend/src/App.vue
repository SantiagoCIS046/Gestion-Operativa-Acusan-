<template>
  <div class="app-shell">
    <!-- Dark Navy Corporate Sidebar -->
    <aside class="sidebar">
      <!-- Brand & Official Acuasan Logo -->
      <div class="sidebar-brand">
        <div class="acuasan-emblem-wrapper">
          <img src="/logo-acuasan.svg" alt="Acuasan 100% Sangileña" class="acuasan-logo-img" />
        </div>

        <div class="brand-info">
          <h2 class="brand-title">ACUASAN</h2>
          <span class="brand-sub">GESTIÓN OPERATIVA</span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="sidebar-nav">
        <router-link to="/permisos/encargado" class="nav-btn" active-class="active">
          <span class="nav-icon">📄</span>
          <span class="nav-text">Permisos</span>
          <span class="active-indicator-dot"></span>
        </router-link>

        <router-link to="/horas-extras/gerencia" class="nav-btn" active-class="active">
          <span class="nav-icon">⏱️</span>
          <span class="nav-text">Horas Extras</span>
          <span class="active-indicator-dot"></span>
        </router-link>
      </nav>

      <!-- User Profile at bottom -->
      <div class="sidebar-footer">
        <div class="user-avatar-circle">JS</div>
        <div class="user-info">
          <span class="user-name">Juan Supervisor</span>
          <span class="user-role">Recursos Humanos</span>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="main-wrapper">
      <!-- Acuasan Brand Top Stripe -->
      <div class="brand-color-stripe"></div>

      <!-- Top Header Bar -->
      <header class="top-header">
        <div class="header-left">
          <div class="pending-pill">
            <span class="dot"></span>
            <span class="pending-text">3 Pendientes</span>
          </div>
        </div>

        <div class="header-right">
          <button class="icon-btn" title="Notificaciones">
            <span class="icon">🔔</span>
            <span class="notification-dot"></span>
          </button>
          <button class="icon-btn" title="Configuración">
            <span class="icon">⚙️</span>
          </button>
        </div>
      </header>

      <!-- Dynamic Page View -->
      <main class="page-content">
        <div class="content-container">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  background-color: #f0f4f8;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* === SIDEBAR === */
.sidebar {
  width: 220px;
  min-width: 220px;
  background: #02203d;
  background: linear-gradient(180deg, #021f3a 0%, #011427 100%);
  display: flex;
  flex-direction: column;
  color: #ffffff;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 100;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
  border-right: 1px solid rgba(115, 190, 40, 0.15);
}

.sidebar-brand {
  padding: 20px 16px 18px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.acuasan-emblem-wrapper {
  width: 56px;
  height: 56px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
  transition: transform 0.2s ease;
}

.acuasan-emblem-wrapper:hover {
  transform: scale(1.05);
}

.acuasan-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-title {
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: 1px;
  color: #ffffff;
  margin: 0;
}

.brand-sub {
  font-size: 0.65rem;
  font-weight: 700;
  color: #73be28; /* Acuasan Lime Green */
  letter-spacing: 0.8px;
  margin-top: 2px;
}

.sidebar-nav {
  flex: 1;
  padding: 18px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  color: #cbd5e1;
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.2s ease;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.03);
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(115, 190, 40, 0.4);
  color: #ffffff;
}

.nav-btn.active {
  background: #004884; /* Acuasan Blue */
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 3px 10px rgba(0, 72, 132, 0.45);
  border: 1px solid #005fa8;
  border-left: 4px solid #73be28; /* Acuasan Lime Green Accent */
}

.active-indicator-dot {
  margin-left: auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #73be28;
  display: none;
}

.nav-btn.active .active-indicator-dot {
  display: block;
}

.nav-icon {
  font-size: 1rem;
}

.sidebar-footer {
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.25);
}

.user-avatar-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #004884;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid #73be28;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.user-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.user-role {
  font-size: 0.7rem;
  color: #8fa7be;
}

/* === MAIN WRAPPER === */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Acuasan Brand Stripe (Green -> Cyan -> Amber) */
.brand-color-stripe {
  height: 3px;
  width: 100%;
  background: linear-gradient(90deg, #73be28 0%, #00a3e0 50%, #f59e0b 100%);
}

/* === TOP HEADER === */
.top-header {
  height: 52px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.pending-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f0fdf4;
  color: #166534;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 700;
  border: 1px solid #bbf7d0;
}

.pending-pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #73be28;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease;
}

.icon-btn:hover {
  background: #f1f5f9;
}

.icon-btn .icon {
  font-size: 1rem;
  color: #475569;
}

.notification-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  background: #73be28;
  border-radius: 50%;
  border: 1.5px solid #ffffff;
}

/* === PAGE CONTENT === */
.page-content {
  flex: 1;
  padding: 20px 24px 32px 24px;
  box-sizing: border-box;
}

.content-container {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}
</style>
