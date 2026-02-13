<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RefreshCcw, Search } from 'lucide-vue-next';
import { AdminService, type AdminOverviewResponse, type AdminUsersResponse, type AdminUserItem } from '../services/AdminService';

const loadingOverview = ref(false);
const loadingUsers = ref(false);
const errorMessage = ref<string | null>(null);

const overview = ref<AdminOverviewResponse | null>(null);
const usersData = ref<AdminUsersResponse | null>(null);

const page = ref(1);
const limit = ref(10);
const includeGuests = ref(true);
const searchDraft = ref('');
const appliedSearch = ref('');

const hasUsers = computed(() => (usersData.value?.users || []).length > 0);
const totalPages = computed(() => usersData.value?.totalPages || 1);

const metricCards = computed(() => {
  const widgets = overview.value?.widgets;
  if (!widgets) {
    return [];
  }

  return [
    {
      key: 'totalUsers',
      title: 'Usuarios totais',
      value: formatInteger(widgets.totalUsers),
      hint: 'Todos os perfis no sistema'
    },
    {
      key: 'totalRegisteredUsers',
      title: 'Contas registradas',
      value: formatInteger(widgets.totalRegisteredUsers),
      hint: 'Usuarios com login e senha'
    },
    {
      key: 'totalGuestUsers',
      title: 'Convidados',
      value: formatInteger(widgets.totalGuestUsers),
      hint: 'Contas guest sem cadastro'
    },
    {
      key: 'totalPremiumUsers',
      title: 'Premium ativo',
      value: formatInteger(widgets.totalPremiumUsers),
      hint: 'Usuarios com assinatura vigente'
    },
    {
      key: 'totalFreeUsers',
      title: 'Plano free',
      value: formatInteger(widgets.totalFreeUsers),
      hint: 'Registrados sem assinatura'
    },
    {
      key: 'activeUsers30d',
      title: 'Ativos em 30 dias',
      value: formatInteger(widgets.activeUsers30d),
      hint: 'Com qualquer atividade recente'
    },
    {
      key: 'newUsersToday',
      title: 'Novos hoje',
      value: formatInteger(widgets.newUsersToday),
      hint: 'Cadastros nas ultimas 24h'
    },
    {
      key: 'generationsToday',
      title: 'Geracoes hoje',
      value: formatInteger(widgets.generationsToday),
      hint: 'Uso de IA registrado hoje'
    },
    {
      key: 'creditsInWallets',
      title: 'Creditos em carteira',
      value: formatCredits(widgets.creditsInWallets),
      hint: 'Saldo total disponivel'
    },
    {
      key: 'consumedCredits',
      title: 'Creditos consumidos',
      value: formatCredits(widgets.consumedCredits),
      hint: `Conversao premium: ${formatPercent(widgets.conversionRate)}`
    }
  ];
});

async function loadOverview() {
  loadingOverview.value = true;
  try {
    overview.value = await AdminService.getOverview();
  } finally {
    loadingOverview.value = false;
  }
}

async function loadUsers() {
  loadingUsers.value = true;
  try {
    usersData.value = await AdminService.listUsers({
      page: page.value,
      limit: limit.value,
      search: appliedSearch.value || undefined,
      includeGuests: includeGuests.value
    });
  } finally {
    loadingUsers.value = false;
  }
}

async function reloadAll() {
  errorMessage.value = null;
  try {
    await Promise.all([loadOverview(), loadUsers()]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar painel admin.';
    errorMessage.value = message;
  }
}

function applyFilters() {
  appliedSearch.value = searchDraft.value.trim();
  page.value = 1;
  void loadUsers();
}

function nextPage() {
  if (page.value >= totalPages.value) {
    return;
  }
  page.value += 1;
}

function previousPage() {
  if (page.value <= 1) {
    return;
  }
  page.value -= 1;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value || 0);
}

function formatCredits(value: number): string {
  return `${formatInteger(Math.round(value || 0))} cr`;
}

function formatPercent(value: number): string {
  return `${(value || 0).toFixed(2)}%`;
}

function formatDate(input: string | null): string {
  if (!input) {
    return '-';
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function planLabel(user: AdminUserItem): string {
  if (user.plan === 'PREMIUM') {
    return 'PREMIUM';
  }
  return user.isGuest ? 'GUEST' : 'FREE';
}

watch([page, includeGuests], () => {
  void loadUsers();
});

onMounted(async () => {
  await reloadAll();
});
</script>

<template>
  <section class="admin-root">
    <header class="admin-header glass-card">
      <div>
        <h2>Painel Administrativo</h2>
        <p>Visao consolidada de usuarios, uso e creditos.</p>
      </div>
      <button class="refresh-btn" :disabled="loadingOverview || loadingUsers" @click="reloadAll">
        <RefreshCcw :size="16" :class="{ spin: loadingOverview || loadingUsers }" />
        Atualizar
      </button>
    </header>

    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>

    <section class="widgets-grid">
      <article v-for="card in metricCards" :key="card.key" class="widget-card glass-card">
        <span class="widget-title">{{ card.title }}</span>
        <strong class="widget-value">{{ card.value }}</strong>
        <small class="widget-hint">{{ card.hint }}</small>
      </article>
    </section>

    <section class="users-card glass-card">
      <div class="users-head">
        <div class="users-title-wrap">
          <h3>Usuarios registrados</h3>
          <p>Total: {{ formatInteger(usersData?.total || 0) }}</p>
        </div>

        <form class="filters" @submit.prevent="applyFilters">
          <label class="search-box" for="search-users">
            <Search :size="14" />
            <input id="search-users" v-model="searchDraft" type="text" placeholder="Buscar por e-mail" />
          </label>

          <label class="toggle-guests">
            <input v-model="includeGuests" type="checkbox" />
            Incluir guests
          </label>

          <button type="submit" class="filter-btn">Filtrar</button>
        </form>
      </div>

      <div class="users-table-wrapper">
        <table class="users-table">
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Plano</th>
              <th>Creditos</th>
              <th>Geracoes</th>
              <th>Consumidos</th>
              <th>Comprados</th>
              <th>Criado em</th>
              <th>Ultima atividade</th>
              <th>Assinatura ate</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingUsers">
              <td colspan="9">Carregando usuarios...</td>
            </tr>
            <tr v-else-if="!hasUsers">
              <td colspan="9">Nenhum usuario encontrado para o filtro aplicado.</td>
            </tr>
            <tr v-for="item in usersData?.users || []" :key="item.id">
              <td>{{ item.email || 'guest@local' }}</td>
              <td>
                <span class="plan-pill" :class="planLabel(item).toLowerCase()">
                  {{ planLabel(item) }}
                </span>
              </td>
              <td>{{ formatInteger(item.credits) }}</td>
              <td>{{ formatInteger(item.generations) }}</td>
              <td>{{ formatInteger(item.consumedCredits) }}</td>
              <td>{{ formatInteger(item.purchasedCredits) }}</td>
              <td>{{ formatDate(item.createdAt) }}</td>
              <td>{{ formatDate(item.lastActivityAt) }}</td>
              <td>{{ formatDate(item.subscriptionEndsAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="pagination">
        <button class="pager-btn" :disabled="page <= 1 || loadingUsers" @click="previousPage">
          Anterior
        </button>
        <span>Pagina {{ page }} de {{ totalPages }}</span>
        <button class="pager-btn" :disabled="page >= totalPages || loadingUsers" @click="nextPage">
          Proxima
        </button>
      </footer>
    </section>
  </section>
</template>

<style scoped>
.admin-root {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.admin-header h2 {
  font-size: 1.45rem;
  letter-spacing: -0.01em;
}

.admin-header p {
  color: var(--text-muted);
  font-size: 0.92rem;
}

.refresh-btn {
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-main);
  min-height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.refresh-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.error-banner {
  border: 1px solid rgba(239, 68, 68, 0.55);
  background: rgba(127, 29, 29, 0.35);
  color: #fecaca;
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 600;
  font-size: 0.9rem;
}

.widgets-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.widget-card {
  padding: 16px;
  min-height: 126px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.widget-title {
  font-size: 0.78rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.widget-value {
  font-size: 1.6rem;
  line-height: 1.1;
}

.widget-hint {
  font-size: 0.82rem;
  color: #cbd5e1;
}

.users-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.users-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.users-title-wrap h3 {
  font-size: 1.2rem;
}

.users-title-wrap p {
  color: var(--text-muted);
  font-size: 0.86rem;
}

.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--glass-border);
  background: rgba(15, 23, 42, 0.55);
  border-radius: 10px;
  min-height: 38px;
  padding: 0 10px;
}

.search-box input {
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-main);
  min-width: 220px;
  font-size: 0.9rem;
}

.toggle-guests {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  color: var(--text-muted);
  font-weight: 600;
}

.filter-btn {
  min-height: 38px;
  border: 1px solid rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.2);
  color: #e0e7ff;
  border-radius: 10px;
  padding: 0 14px;
  font-weight: 700;
  cursor: pointer;
}

.users-table-wrapper {
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}

.users-table th,
.users-table td {
  padding: 11px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  font-size: 0.86rem;
}

.users-table thead th {
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  font-weight: 700;
}

.plan-pill {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}

.plan-pill.premium {
  background: rgba(245, 158, 11, 0.2);
  color: #fde68a;
}

.plan-pill.free {
  background: rgba(56, 189, 248, 0.18);
  color: #bae6fd;
}

.plan-pill.guest {
  background: rgba(148, 163, 184, 0.2);
  color: #e2e8f0;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.pager-btn {
  min-height: 36px;
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
  border-radius: 10px;
  padding: 0 12px;
  font-weight: 700;
  cursor: pointer;
}

.pager-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 1100px) {
  .widgets-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .admin-header {
    flex-direction: column;
    align-items: stretch;
  }

  .widgets-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .users-head {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box input {
    min-width: 0;
    width: 100%;
  }

  .filters {
    width: 100%;
  }

  .search-box {
    flex: 1;
    min-width: 0;
  }
}

@media (max-width: 480px) {
  .widgets-grid {
    grid-template-columns: 1fr;
  }

  .users-card {
    padding: 14px;
  }
}
</style>
