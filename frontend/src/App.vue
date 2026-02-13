<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api, AuthService } from './services/AuthService';
import AuthModal from './components/AuthModal.vue';
import { 
  Sparkles, Download, Loader2, 
  MessageSquare, ChevronRight,
  Info,
  CreditCard, LogOut, Wallet, Star
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

// Estados de Autenticação e Créditos
const user = ref<any>(null);
const showAuth = ref(false);
const authMode = ref<'login' | 'register'>('register');
const mpLoading = ref(false);

const isGuest = computed(() => user.value?.isGuest);
const credits = computed(() => user.value?.credits || 0);

// Inicialização
onMounted(async () => {
  AnalyticsService.pageView();
  
  const savedToken = localStorage.getItem('token');
  try {
    if (savedToken) {
      user.value = await AuthService.getMe();
    } else {
      const guest = await AuthService.getGuestToken();
      user.value = guest.user;
    }
  } catch (e) {
    AuthService.logout();
    const guest = await AuthService.getGuestToken();
    user.value = guest.user;
  }

  const saved = localStorage.getItem('sheet_history');
  if (saved) history.value = JSON.parse(saved);

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    alert('Pagamento aprovado! Seus 600 créditos serão adicionados em instantes.');
    window.history.replaceState({}, document.title, window.location.pathname);
    user.value = await AuthService.getMe();
  }
});

const handleAuthSuccess = async () => {
  user.value = await AuthService.getMe();
};

const logout = () => {
  AuthService.logout();
  window.location.reload();
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
    
    user.value.credits -= 1;
  } catch (error: any) {
    console.error('Error:', error);
    if (error.response?.status === 402) {
      if (isGuest.value) {
        authMode.value = 'register';
        showAuth.value = true;
      } else {
        alert('Créditos insuficientes! Assine o plano premium para obter mais.');
      }
    } else {
      alert(error.response?.data?.error || 'Erro ao processar sua solicitação');
    }
  } finally {
    loading.value = false;
  }
};

const handleSubscribe = async () => {
  if (isGuest.value) {
    authMode.value = 'register';
    showAuth.value = true;
    return;
  }

  mpLoading.value = true;
  try {
    const pref = await AuthService.createCheckoutPreference();
    window.location.href = pref.init_point;
  } catch (e) {
    alert('Erro ao iniciar checkout');
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
    alert('Erro ao baixar arquivo');
  }
};
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
        <div class="credit-pill" :class="{ 'warning': credits < 5 }" @click="handleSubscribe">
          <Wallet :size="16" />
          <span class="credit-count">{{ credits }}</span>
          <span class="credit-label">créditos</span>
          <div class="add-circle" :class="{ 'spinning': mpLoading }">
            <Loader2 v-if="mpLoading" :size="12" class="spin" />
            <span v-else>+</span>
          </div>
        </div>

        <div v-if="user && !isGuest" class="user-profile">
          <div class="user-info">
            <span class="email">{{ user.email }}</span>
            <div class="plan-badge">
              <Star :size="10" />
              <span>PREMIUM</span>
            </div>
          </div>
          <button @click="logout" class="icon-btn logout-btn" title="Sair"><LogOut :size="18" /></button>
        </div>
        <div v-else class="auth-group">
          <button @click="authMode = 'login'; showAuth = true" class="btn-ghost">Logar</button>
          <button @click="authMode = 'register'; showAuth = true" class="btn-primary small">Começar Grátis</button>
        </div>
      </div>
    </nav>

    <main class="main-content">
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

      <div v-if="credits < 10 && !loading" class="floating-promo animate-slide-in">
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
        <section v-if="showPreview" class="preview-section glass-card">
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

          <div class="table-wrapper" :style="{ borderColor: currentSchema.theme?.borderColor }">
            <table>
              <thead>
                <tr :style="{ background: currentSchema.theme?.headerBg, color: currentSchema.theme?.headerText }">
                  <th v-for="col in currentSchema.sheets[0].columns" :key="col.key">
                    <div class="th-inner">
                      {{ col.header }}
                      <span class="type-badge">{{ col.type || col.format || 'text' }}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in currentSchema.sheets[0].rows" :key="idx"
                    :style="{ background: Number(idx) % 2 === 0 ? currentSchema.theme?.rowEvenBg : currentSchema.theme?.rowOddBg }">
                  <td v-for="col in currentSchema.sheets[0].columns" :key="col.key"
                      :style="{ borderColor: currentSchema.theme?.borderColor, textAlign: col.alignment || 'left' }">
                    <span v-if="typeof row[col.key] === 'object' && row[col.key]?.formula" class="formula-pill">
                       {{ row[col.key].formula }}
                    </span>
                    <span v-else>{{ row[col.key] }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
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
    </main>

    <AuthModal 
      :is-open="showAuth" 
      :initial-mode="authMode"
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
    color: #fbbf24; font-size: 0.65rem; font-weight: 900; 
}

.logout-btn { 
    background: rgba(239, 68, 68, 0.1); 
    color: var(--accent-error); 
    border-radius: 10px;
    padding: 10px;
}

.auth-group { display: flex; gap: 12px; }
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

.table-wrapper { border-radius: 16px; overflow: hidden; border: 1px solid; margin-top: 10px; }
table { width: 100%; border-collapse: collapse; }
th { padding: 16px; text-align: left; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; }
.th-inner { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.type-badge { font-size: 0.6rem; opacity: 0.7; padding: 2px 6px; border: 1px solid currentColor; border-radius: 4px; }
td { padding: 14px 16px; font-size: 0.95rem; border-bottom: 1px solid var(--glass-border); }

.formula-pill { 
    font-family: monospace; font-size: 0.8rem; background: rgba(15, 23, 42, 0.4);
    padding: 4px 8px; border-radius: 6px; color: var(--primary);
}

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

@media (max-width: 768px) {
  .top-nav { margin: 8px; padding: 12px 16px; }
  .nav-right .email { display: none; }
  .hero-section h1 { font-size: 2.5rem; }
  .main-content { padding-top: 20px; }
  .generator-container { padding: 20px; }
  .floating-promo { flex-direction: column; gap: 20px; text-align: center; }
  .preview-header { flex-direction: column; gap: 24px; }
  .header-right { width: 100%; }
  .btn-action { flex: 1; }
}
</style>
