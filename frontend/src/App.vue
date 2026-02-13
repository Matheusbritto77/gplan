<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { api, AuthService } from './services/AuthService';
import AuthModal from './components/AuthModal.vue';
import AdminDashboard from './components/AdminDashboard.vue';
import SpreadsheetPreview from './components/SpreadsheetPreview.vue';
import { 
  Sparkles, Download, Loader2, 
  MessageSquare, ChevronRight,
  Info,
  CreditCard, LogOut, Wallet, Star, LayoutDashboard
} from 'lucide-vue-next';
import { AnalyticsService } from './services/AnalyticsService';

// Configurações e Estados
const prompt = ref('');
const loading = ref(false);
const showPreview = ref(false);
const askingMoreInfo = ref(false);
const question = ref('');
const suggestions = ref<string[]>([]);
const currentSchema = ref<any>(null);
const history = ref<any[]>([]);
const toast = ref<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
const authModalTitle = ref('');
const authModalSubtitle = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const CREDITS_PER_GENERATION = 20;

// Estados de Autenticação e Créditos
const user = ref<any>(null);
const showAuth = ref(false);
const authMode = ref<'login' | 'register'>('register');
const mpLoading = ref(false);

const isGuest = computed(() => user.value?.isGuest);
const credits = computed(() => user.value?.credits || 0);
const isAuthenticated = computed(() => Boolean(user.value?.id) && !isGuest.value);
const isPremium = computed(() => user.value?.plan === 'PREMIUM');
const isAdmin = computed(() => Boolean(user.value?.isAdmin));
const currentPlan = computed(() => isPremium.value ? 'PREMIUM' : 'FREE');
const hasPreviewSheets = computed(() => (currentSchema.value?.sheets?.length || 0) > 0);
const activeView = ref<'generator' | 'admin'>('generator');

const pushToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  toast.value = { message, type };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 3500);
};

// Inicialização
onMounted(async () => {
  AnalyticsService.pageView();
  
  try {
    user.value = await AuthService.getMe();
  } catch (e) {
    user.value = null;
  }

  const saved = localStorage.getItem('sheet_history');
  if (saved) {
    try {
      history.value = JSON.parse(saved);
    } catch {
      history.value = [];
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    pushToast('Pagamento aprovado. Seus 600 créditos serão adicionados em instantes.', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      user.value = await AuthService.getMe();
    } catch {
      user.value = null;
    }
  } else if (urlParams.get('payment') === 'failure') {
    pushToast('Pagamento não concluído. Tente novamente.', 'error');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('payment') === 'pending') {
    pushToast('Pagamento pendente. Você receberá os créditos após aprovação.', 'info');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

const handleAuthSuccess = async () => {
  user.value = await AuthService.getMe();
  pushToast(`Login realizado. Você está no plano ${currentPlan.value} com ${credits.value} créditos.`, 'success');
};

const logout = async () => {
  await AuthService.logout();
  user.value = null;
  activeView.value = 'generator';
  showPreview.value = false;
  askingMoreInfo.value = false;
  pushToast('Sessão encerrada com sucesso.', 'info');
};

const toggleAdminView = () => {
  if (!isAdmin.value) return;
  activeView.value = activeView.value === 'admin' ? 'generator' : 'admin';
};

const openAuth = (
  mode: 'login' | 'register',
  title: string,
  subtitle: string
) => {
  authMode.value = mode;
  authModalTitle.value = title;
  authModalSubtitle.value = subtitle;
  showAuth.value = true;
};

const saveToHistory = (schema: any) => {
  const item = { 
    id: Date.now(), 
    title: schema.title, 
    date: new Date().toLocaleString(),
    schema: schema 
  };
  history.value = [item, ...history.value].slice(0, 10);
  localStorage.setItem('sheet_history', JSON.stringify(history.value));
};

const processPrompt = async (forcedPrompt?: string) => {
  const finalPrompt = forcedPrompt || prompt.value;
  if (!finalPrompt.trim() || loading.value) return;

  if (!isAuthenticated.value) {
    openAuth(
      'register',
      'Entre para gerar planilhas',
      'Crie sua conta ou faça login para liberar 100 créditos grátis e começar a gerar.'
    );
    pushToast('Faça login para gerar planilhas com IA.', 'info');
    return;
  }

  loading.value = true;
  askingMoreInfo.value = false;
  showPreview.value = false;

  try {
    const response = await api.post('/process', { prompt: finalPrompt });
    const data = response.data;

    AnalyticsService.sendEvent({ 
      eventName: 'Lead', 
      customData: { prompt: finalPrompt, schema_title: data.schema.title } 
    });

    currentSchema.value = data.schema;
    question.value = data.followUp;
    suggestions.value = data.suggestions || [];
    showPreview.value = true;
    askingMoreInfo.value = true;
    saveToHistory(data.schema);
    
    if (user.value?.credits !== undefined) {
      user.value.credits = Math.max(0, user.value.credits - CREDITS_PER_GENERATION);
    }
  } catch (error: any) {
    console.error('Error:', error);
    if (error.response?.status === 401) {
      user.value = null;
      openAuth(
        'login',
        'Sua sessão expirou',
        'Faça login novamente para continuar gerando suas planilhas.'
      );
      return;
    }

    if (error.response?.status === 402) {
      pushToast('Créditos insuficientes. Faça upgrade para o plano premium para continuar.', 'error');
    } else {
      pushToast(error.response?.data?.error || 'Erro ao processar sua solicitação', 'error');
    }
  } finally {
    loading.value = false;
  }
};

const handleSubscribe = async () => {
  if (!isAuthenticated.value) {
    openAuth(
      'register',
      'Crie sua conta para assinar',
      'Cadastre-se para liberar 100 créditos grátis e depois ativar o plano premium.'
    );
    return;
  }

  mpLoading.value = true;
  try {
    const pref = await AuthService.createCheckoutPreference();
    window.location.href = pref.init_point;
  } catch (e) {
    pushToast('Erro ao iniciar checkout.', 'error');
  } finally {
    mpLoading.value = false;
  }
};

const useSuggestion = (text: string) => {
  prompt.value += ` (${text})`;
  processPrompt();
};

const downloadSpreadsheet = async (format: 'xlsx' | 'csv') => {
  if (!currentSchema.value) return;
  try {
    const response = await api.post('/download', {
      schema: currentSchema.value,
      format: format
    }, { responseType: 'blob' });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentSchema.value.title.replace(/\s+/g, '_')}.${format}`;
    link.click();
  } catch (e) {
    pushToast('Erro ao baixar arquivo.', 'error');
  }
};

watch(isAdmin, (hasAdmin) => {
  if (!hasAdmin && activeView.value === 'admin') {
    activeView.value = 'generator';
  }
});
</script>

<template>
  <div class="app-layout">
    <nav class="top-nav glass-card">
      <div class="logo">
        <div class="logo-circle">
          <Sparkles class="logo-icon" />
        </div>
        <span class="gradient-text">SheetAI.online</span>
      </div>

      <div class="nav-right">
        <div class="credit-pill" :class="{ 'warning': credits < CREDITS_PER_GENERATION }" @click="handleSubscribe">
          <Wallet :size="16" />
          <span class="credit-count">{{ credits }}</span>
          <span class="credit-label">créditos</span>
          <div class="add-circle" :class="{ 'spinning': mpLoading }">
            <Loader2 v-if="mpLoading" :size="12" class="spin" />
            <span v-else>+</span>
          </div>
        </div>

        <button
          v-if="isAdmin"
          class="admin-toggle-btn"
          :class="{ active: activeView === 'admin' }"
          @click="toggleAdminView"
        >
          <LayoutDashboard :size="16" />
          <span>{{ activeView === 'admin' ? 'Modo Gerador' : 'Painel Admin' }}</span>
        </button>

        <div v-if="isAuthenticated" class="user-profile">
          <div class="user-info">
            <span class="email">{{ user.email }}</span>
            <div class="plan-badge" :class="{ premium: isPremium, free: !isPremium }">
              <Star :size="10" />
              <span>{{ currentPlan }}</span>
            </div>
          </div>
          <button @click="logout" class="icon-btn logout-btn" title="Sair" aria-label="Sair da conta"><LogOut :size="18" /></button>
        </div>
        <div v-else class="auth-group">
          <button
            @click="openAuth('login', 'Acesse sua conta', 'Faça login para continuar com seus créditos e histórico.')"
            class="btn-ghost"
          >
            Logar
          </button>
          <button
            @click="openAuth('register', 'Comece com 100 créditos grátis', 'Crie sua conta para desbloquear geração de planilhas.')"
            class="btn-primary small"
          >
            Começar Grátis
          </button>
        </div>
      </div>
    </nav>

    <main class="main-content">
      <template v-if="activeView === 'generator'">
        <header class="hero-section">
          <div class="hero-badge animate-float">
            <span>Nova era de produtividade</span>
          </div>
          <h1 class="gradient-text">Planilhas inteligentes em segundos.</h1>
          <p class="hero-desc">Descreva sua necessidade em linguagem natural e deixe nossa IA estruturar dados, fórmulas e design para você.</p>
        </header>

        <section class="generator-container glass-card">
          <div class="input-area">
            <textarea 
              v-model="prompt" 
              placeholder="Ex: Tabela de fluxo de caixa para petshop com soma automática e gráfico de barras..."
              class="premium-input main-input"
              @keydown.enter.ctrl="processPrompt()"
            ></textarea>
          </div>

          <div v-if="!isAuthenticated" class="auth-lock-banner">
            Faça login para gerar planilhas. Novas contas recebem 100 créditos grátis.
          </div>
          
          <div class="generator-footer">
            <div class="usage-hint">
               <Info :size="14" />
               <span>Pressione <b>Ctrl + Enter</b> para gerar</span>
            </div>
            <button @click="processPrompt()" :disabled="loading" class="btn-primary large">
              <Loader2 v-if="loading" class="spin" />
              <Sparkles v-else :size="20" />
              <span>{{ loading ? 'IA Estruturando...' : 'Gerar Estrutura Premium' }}</span>
            </button>
          </div>
        </section>

        <div v-if="isAuthenticated && !isPremium && credits < CREDITS_PER_GENERATION && !loading" class="floating-promo animate-slide-in">
          <div class="promo-content">
             <CreditCard class="promo-icon" />
             <div class="promo-text">
               <h4>Aumente seu limite</h4>
               <p>600 créditos mensais por apenas <b>R$ 30</b></p>
             </div>
          </div>
          <button @click="handleSubscribe" class="btn-promo-action" :disabled="mpLoading">
             <span v-if="!mpLoading">Atualizar Plano</span>
             <Loader2 v-else class="spin" />
          </button>
        </div>

        <transition name="preview-fade">
          <section v-if="showPreview && hasPreviewSheets" class="preview-section glass-card">
            <div class="preview-header">
              <div class="header-left">
                <div class="status-token">Pronta para Download</div>
                <h2>{{ currentSchema.title }}</h2>
                <p>{{ currentSchema.description }}</p>
              </div>
              <div class="header-right">
                <button @click="downloadSpreadsheet('xlsx')" class="btn-action xlsx">
                  <Download :size="18" /> Excel Full (.xlsx)
                </button>
                <button @click="downloadSpreadsheet('csv')" class="btn-action csv">
                   CSV
                </button>
              </div>
            </div>

            <div class="excel-preview-area">
              <SpreadsheetPreview :schema="currentSchema" />
            </div>
          </section>
        </transition>

        <transition name="refine-slide">
          <section v-if="askingMoreInfo" class="refinement-card glass-card">
            <div class="refine-header">
              <MessageSquare class="refine-icon" />
              <div class="refine-title">
                <h3>Refinamento Inteligente</h3>
                <p>{{ question }}</p>
              </div>
            </div>
            <div class="suggestions-list">
              <button 
                v-for="sug in suggestions" 
                :key="sug" 
                @click="useSuggestion(sug)"
                class="suggestion-item"
              >
                <span>{{ sug }}</span>
                <ChevronRight :size="14" />
              </button>
            </div>
          </section>
        </transition>
      </template>

      <template v-else>
        <AdminDashboard />
      </template>
    </main>

    <transition name="toast-fade">
      <div v-if="toast" class="toast" :class="toast.type" role="status" aria-live="polite">
        {{ toast.message }}
      </div>
    </transition>

    <AuthModal 
      :is-open="showAuth" 
      :initial-mode="authMode"
      :title="authModalTitle"
      :subtitle="authModalSubtitle"
      @close="showAuth = false" 
      @success="handleAuthSuccess"
    />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  gap: 32px;
  background: 
    radial-gradient(circle at 10% 10%, rgba(99, 102, 241, 0.05) 0%, transparent 40%),
    radial-gradient(circle at 90% 90%, rgba(168, 85, 247, 0.05) 0%, transparent 40%);
}

.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 32px;
  margin: 16px 24px 0;
  position: sticky;
  top: 16px;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.6);
}

.logo { display: flex; align-items: center; gap: 14px; }
.logo-circle {
    background: var(--primary);
    width: 38px; height: 38px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
.logo-icon { color: white; }
.logo span { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.03em; }

.nav-right { display: flex; align-items: center; gap: 24px; }

.admin-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    border-radius: 12px;
    border: 1px solid rgba(99, 102, 241, 0.35);
    background: rgba(99, 102, 241, 0.12);
    color: #c7d2fe;
    padding: 0 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
}

.admin-toggle-btn:hover {
    border-color: rgba(129, 140, 248, 0.7);
    background: rgba(99, 102, 241, 0.22);
}

.admin-toggle-btn.active {
    border-color: rgba(34, 197, 94, 0.55);
    background: rgba(34, 197, 94, 0.15);
    color: #86efac;
}

.credit-pill {
    display: flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.03);
    padding: 6px 6px 6px 14px;
    border-radius: 99px;
    border: 1px solid var(--glass-border);
    cursor: pointer;
    transition: all 0.3s;
}
.credit-pill:hover { background: rgba(255,255,255,0.07); transform: translateY(-1px); }
.credit-pill.warning { border-color: var(--accent-warning); }

.credit-count { font-weight: 800; color: var(--text-main); font-size: 1rem; }
.credit-label { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

.add-circle {
    width: 26px; height: 26px;
    background: var(--primary);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: 800;
}

.user-profile { display: flex; align-items: center; gap: 16px; }
.user-info { display: flex; flex-direction: column; text-align: right; }
.email { font-size: 0.85rem; font-weight: 700; color: var(--text-main); }
.plan-badge { 
    display: flex; align-items: center; gap: 4px; 
    font-size: 0.65rem; font-weight: 900; 
}
.plan-badge.premium {
    color: #fbbf24;
}
.plan-badge.free {
    color: #22d3ee;
}

.logout-btn { 
    background: rgba(239, 68, 68, 0.1); 
    color: var(--accent-error); 
    border-radius: 10px;
    padding: 10px;
}

.auth-group { display: flex; gap: 12px; }
.auth-group .btn-primary.small {
  min-height: 40px;
}
.btn-ghost { background: none; border: none; color: var(--text-muted); font-weight: 700; cursor: pointer; }
.btn-ghost:hover { color: white; }

.main-content {
  flex: 1;
  max-width: 1100px;
  width: 95%;
  margin: 0 auto;
  padding: 40px 0 80px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.hero-section { text-align: center; }
.hero-badge {
    display: inline-block;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    padding: 8px 16px;
    border-radius: 99px;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--primary);
    margin-bottom: 24px;
}
.hero-section h1 { font-size: 4rem; font-weight: 900; letter-spacing: -0.04em; margin-bottom: 16px; line-height: 1; }
.hero-desc { font-size: 1.25rem; color: var(--text-muted); max-width: 700px; margin: 0 auto; }

.generator-container { padding: 40px; }
.main-input { min-height: 180px; resize: none; font-size: 1.2rem; }
.auth-lock-banner {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px dashed rgba(99, 102, 241, 0.45);
  background: rgba(99, 102, 241, 0.12);
  color: #c7d2fe;
  font-size: 0.9rem;
  font-weight: 600;
}

.generator-footer {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 24px;
}
.usage-hint { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 0.85rem; }
.usage-hint b { color: var(--primary); }

.btn-primary.large { padding: 18px 48px; border-radius: 20px; font-size: 1.15rem; }

.floating-promo {
    display: flex; justify-content: space-between; align-items: center;
    padding: 24px 32px;
    background: linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15));
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 24px;
}
.promo-content { display: flex; gap: 20px; align-items: center; }
.promo-icon { color: #fbbf24; width: 40px; height: 40px; }
.promo-text h4 { font-size: 1.2rem; margin-bottom: 4px; }
.promo-text p { color: var(--text-muted); font-size: 0.95rem; }
.btn-promo-action {
    background: #f59e0b; color: white; border: none;
    padding: 14px 28px; border-radius: 12px; font-weight: 800;
    cursor: pointer; box-shadow: 0 10px 20px -5px rgba(245, 158, 11, 0.4);
}

.preview-section { padding: 40px; }
.preview-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
.status-token { 
    display: inline-block; background: rgba(16, 185, 129, 0.1); 
    color: var(--accent-success); padding: 4px 12px; border-radius: 99px;
    font-size: 0.75rem; font-weight: 800; margin-bottom: 12px;
}
.preview-header h2 { font-size: 2rem; margin-bottom: 8px; }
.preview-header p { color: var(--text-muted); }

.header-right { display: flex; gap: 12px; }
.btn-action { 
    padding: 12px 20px; border-radius: 12px; border: 1px solid var(--glass-border);
    font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;
    transition: all 0.2s;
}
.btn-action.xlsx { background: white; color: #020617; }
.btn-action.csv { background: rgba(255,255,255,0.05); color: white; }

.excel-preview-area { margin-top: 10px; }

.refinement-card { padding: 32px; border-left: 6px solid var(--primary); }
.refine-header { display: flex; gap: 20px; align-items: center; margin-bottom: 24px; }
.refine-icon { color: var(--primary); width: 32px; height: 32px; }
.refine-title h3 { font-size: 1.25rem; margin-bottom: 4px; }
.refine-title p { color: var(--text-muted); }

.suggestions-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.suggestion-item {
    background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border);
    padding: 14px 18px; border-radius: 14px; color: white;
    display: flex; justify-content: space-between; align-items: center;
    cursor: pointer; transition: all 0.2s; text-align: left;
}
.suggestion-item:hover { background: rgba(255,255,255,0.08); transform: translateX(4px); border-color: var(--primary); }

/* Transitions */
.preview-fade-enter-active, .preview-fade-leave-active { transition: opacity 0.5s, transform 0.5s; }
.preview-fade-enter-from { opacity: 0; transform: translateY(20px); }

.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  max-width: 420px;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  background: rgba(15, 23, 42, 0.95);
  color: var(--text-main);
  font-weight: 600;
  z-index: 1200;
  box-shadow: 0 15px 30px rgba(2, 6, 23, 0.45);
}
.toast.success {
  border-color: rgba(16, 185, 129, 0.5);
}
.toast.error {
  border-color: rgba(239, 68, 68, 0.5);
}
.toast.info {
  border-color: rgba(99, 102, 241, 0.5);
}
.toast-fade-enter-active, .toast-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 768px) {
  .top-nav {
    margin: 10px 10px 0;
    padding: 12px;
    gap: 12px;
    flex-direction: column;
    align-items: stretch;
    top: 8px;
  }

  .logo {
    justify-content: space-between;
    width: 100%;
  }

  .logo span {
    font-size: 1.2rem;
  }

  .nav-right {
    width: 100%;
    gap: 10px;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
  }

  .admin-toggle-btn {
    order: 3;
    width: 100%;
    justify-content: center;
  }

  .credit-pill {
    min-height: 42px;
    padding: 6px 8px 6px 12px;
  }

  .user-profile {
    flex: 1;
    justify-content: flex-end;
    min-width: 0;
  }

  .user-info {
    max-width: 130px;
    overflow: hidden;
  }

  .nav-right .email {
    display: none;
  }

  .auth-group {
    flex: 1;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn-ghost,
  .auth-group .btn-primary.small {
    min-height: 40px;
    padding: 0 14px;
    border-radius: 10px;
    white-space: nowrap;
  }

  .hero-section h1 {
    font-size: 2.25rem;
    line-height: 1.06;
  }

  .hero-desc {
    font-size: 1rem;
    padding: 0 4px;
  }

  .main-content {
    width: 94%;
    padding-top: 14px;
    gap: 26px;
  }

  .generator-container {
    padding: 16px;
  }

  .main-input {
    min-height: 150px;
    font-size: 1rem;
    padding: 16px;
  }

  .generator-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .usage-hint {
    justify-content: center;
    text-align: center;
  }

  .btn-primary.large {
    width: 100%;
    min-height: 52px;
    padding: 12px 18px;
    font-size: 1rem;
  }

  .floating-promo {
    flex-direction: column;
    gap: 16px;
    text-align: center;
    padding: 18px;
    border-radius: 18px;
  }

  .promo-content {
    gap: 12px;
  }

  .preview-section {
    padding: 16px;
  }

  .preview-header {
    flex-direction: column;
    gap: 18px;
    margin-bottom: 18px;
  }

  .preview-header h2 {
    font-size: 1.5rem;
    line-height: 1.1;
  }

  .header-right {
    width: 100%;
    flex-direction: column;
    gap: 8px;
  }

  .btn-action {
    width: 100%;
    justify-content: center;
    min-height: 44px;
  }

  .refinement-card {
    padding: 18px;
  }

  .refine-header {
    align-items: flex-start;
    gap: 12px;
  }

  .suggestions-list {
    grid-template-columns: 1fr;
  }

  .suggestion-item {
    min-height: 46px;
  }

  .toast {
    left: 12px;
    right: 12px;
    bottom: 12px;
    max-width: none;
    font-size: 0.92rem;
  }
}

@media (max-width: 420px) {
  .hero-section h1 {
    font-size: 2rem;
  }

  .logo-circle {
    width: 34px;
    height: 34px;
    border-radius: 10px;
  }

  .credit-label {
    display: none;
  }

  .auth-group {
    width: 100%;
    justify-content: stretch;
  }

  .auth-group .btn-ghost,
  .auth-group .btn-primary.small {
    flex: 1;
    justify-content: center;
    text-align: center;
  }

  .promo-text h4 {
    font-size: 1rem;
  }

  .promo-text p {
    font-size: 0.88rem;
  }
}
</style>
