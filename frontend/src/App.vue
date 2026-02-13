<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api, AuthService } from './services/AuthService';
import AuthModal from './components/AuthModal.vue';
import { 
  Sparkles, Download, Loader2, 
  MessageSquare, ChevronRight,
  CheckCircle2, Info,
  CreditCard, LogOut, Wallet
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
        <Sparkles class="logo-icon" />
        <span class="gradient-text">SheetAI.online</span>
      </div>

      <div class="nav-right">
        <div class="credit-badge" @click="handleSubscribe">
          <Wallet :size="16" />
          <span>{{ credits }} créditos</span>
          <button class="add-btn" :disabled="mpLoading">
            <Loader2 v-if="mpLoading" class="spin" :size="12" />
            <span v-else>+</span>
          </button>
        </div>

        <div v-if="user && !isGuest" class="user-profile">
          <div class="user-info">
            <span class="email">{{ user.email }}</span>
            <span class="plan">Membro Premium</span>
          </div>
          <button @click="logout" class="icon-btn" title="Sair"><LogOut :size="18" /></button>
        </div>
        <div v-else class="auth-btns">
          <button @click="authMode = 'login'; showAuth = true" class="btn-text">Logar</button>
          <button @click="authMode = 'register'; showAuth = true" class="btn-primary">Registrar</button>
        </div>
      </div>
    </nav>

    <main class="main-content">
      <header class="hero-section">
        <div class="badge animate-float">
          <Sparkles :size="14" />
          <span>Inteligência Artificial de Planilhas</span>
        </div>
        <h1 class="gradient-text">Gere planilhas em segundos</h1>
        <p>A ferramenta definitiva para consultores, gestores e analistas.</p>
      </header>

      <section class="generator-area glass-card">
        <div class="input-wrapper">
          <textarea 
            v-model="prompt" 
            placeholder="Descreva a planilha que você precisa... (ex: Gestão de estoque com cálculo de markup e aviso de reposição)"
            class="premium-input"
            @keydown.enter.ctrl="processPrompt()"
          ></textarea>
        </div>
        
        <div class="controls">
          <div class="hint">
            <Info :size="14" />
            Vários créditos disponíveis para teste grátis.
          </div>
          <button @click="processPrompt()" :disabled="loading" class="generate-btn">
            <Loader2 v-if="loading" class="spin" />
            <Sparkles v-else :size="18" />
            <span>{{ loading ? 'IA Criando...' : 'Gerar Tabela' }}</span>
          </button>
        </div>
      </section>

      <section v-if="credits < 10 && !loading" class="subscription-cta glass-card">
        <div class="cta-content">
          <div class="cta-icon"><CreditCard :size="32" /></div>
          <div class="cta-text">
            <h3>Seus créditos estão acabando!</h3>
            <p>Assine hoje por apenas <b>R$ 30,00/mês</b> e receba 600 créditos mensais para gerar planilhas infinitas.</p>
          </div>
        </div>
        <button @click="handleSubscribe" class="btn-subscribe" :disabled="mpLoading">
           <Loader2 v-if="mpLoading" class="spin" />
           <span v-else>Assinar Agora (Pix ou Cartão)</span>
        </button>
      </section>

      <transition name="fade">
        <section v-if="showPreview" class="results-area glass-card">
          <div class="results-header">
            <div class="title-meta">
              <div class="status-badge"><CheckCircle2 :size="16" /> Estrutura Pronta</div>
              <h2>{{ currentSchema.title }}</h2>
              <p>{{ currentSchema.description }}</p>
            </div>
            <div class="download-actions">
              <button @click="downloadSpreadsheet('xlsx')" class="btn-dl xlsx">
                <Download :size="18" /> Excel (.xlsx)
              </button>
              <button @click="downloadSpreadsheet('csv')" class="btn-dl csv">
                <Download :size="18" /> CSV
              </button>
            </div>
          </div>

          <div class="preview-container" :style="{ borderColor: currentSchema.theme?.borderColor }">
            <table>
              <thead>
                <tr :style="{ backgroundColor: currentSchema.theme?.headerBg, color: currentSchema.theme?.headerText }">
                  <th v-for="col in currentSchema.sheets[0].columns" :key="col.key">
                    <div class="th-content">
                      {{ col.header }}
                      <span class="type-tag">{{ col.type || col.format || 'text' }}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in currentSchema.sheets[0].rows" :key="idx"
                    :style="{ backgroundColor: Number(idx) % 2 === 0 ? currentSchema.theme?.rowEvenBg : currentSchema.theme?.rowOddBg }">
                  <td v-for="col in currentSchema.sheets[0].columns" :key="col.key"
                      :style="{ borderColor: currentSchema.theme?.borderColor, textAlign: col.alignment || 'left' }">
                    {{ typeof row[col.key] === 'object' && row[col.key]?.formula ? `fx: ${row[col.key].formula}` : row[col.key] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </transition>

      <transition name="slide-up">
        <section v-if="askingMoreInfo" class="more-info-area glass-card">
          <div class="question-header">
            <MessageSquare class="icon-pulse" />
            <h3>Refine sua planilha com a IA</h3>
          </div>
          <p class="question-body">{{ question }}</p>
          <div class="suggestions-grid">
            <button 
              v-for="sug in suggestions" 
              :key="sug" 
              @click="useSuggestion(sug)"
              class="suggestion-chip"
            >
              {{ sug }}
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
  gap: 24px;
  background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.1), transparent);
}

.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  position: sticky;
  top: 10px;
  z-index: 1000;
  margin: 10px 24px 0;
}

.logo { display: flex; align-items: center; gap: 12px; }
.logo-icon { color: var(--primary); width: 28px; height: 28px; }
.logo span { font-size: 1.5rem; font-weight: 800; }

.nav-right { display: flex; align-items: center; gap: 24px; }

.credit-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 16px;
  border-radius: 99px;
  border: 1px solid var(--glass-border);
  cursor: pointer;
  transition: all 0.2s;
}
.credit-badge:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-1px); }

.add-btn {
  background: var(--primary);
  width: 20px; height: 20px;
  border-radius: 50%;
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  cursor: pointer;
}

.user-profile { display: flex; align-items: center; gap: 16px; }
.user-info { display: flex; flex-direction: column; text-align: right; }
.email { font-size: 0.85rem; font-weight: 600; }
.plan { font-size: 0.7rem; color: var(--primary); font-weight: 700; text-transform: uppercase; }

.auth-btns { display: flex; gap: 12px; }
.btn-text { background: none; border: none; color: white; cursor: pointer; font-weight: 600; }
.btn-primary { background: var(--primary); padding: 8px 20px; border-radius: 10px; border: none; color: white; cursor: pointer; font-weight: 700; }

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  padding: 20px;
}

.hero-section { text-align: center; padding: 20px 0; }
.hero-section h1 { font-size: 3.5rem; font-weight: 900; margin: 16px 0; line-height: 1.1; }

.generator-area { padding: 32px; }
.premium-input { 
  min-height: 160px;
}

.controls { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
.generate-btn { padding: 16px 40px; border-radius: 16px; font-size: 1.1rem; }

.subscription-cta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
  border: 1px solid rgba(99, 102, 241, 0.4);
}

.cta-content { display: flex; align-items: center; gap: 20px; }
.cta-icon { color: var(--primary); }
.cta-text h3 { margin-bottom: 4px; font-size: 1.2rem; }
.cta-text p { color: var(--text-muted); font-size: 0.9rem; }

.btn-subscribe {
  background: #f59e0b;
  color: white;
  padding: 14px 24px;
  border-radius: 12px;
  border: none;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 10px 20px -5px rgba(245, 158, 11, 0.4);
}
.btn-subscribe:hover { transform: translateY(-2px); filter: brightness(1.1); }

.results-area { padding: 32px; }
.preview-container { margin-top: 24px; border-radius: 12px; overflow: hidden; }

.more-info-area { padding: 32px; border-left: 6px solid var(--primary); }

.icon-pulse { animation: pulse 2s infinite; }
.spin { animation: spin 1s linear infinite; }

@media (max-width: 768px) {
  .top-nav { margin: 8px; padding: 12px 16px; }
  .nav-right .email { display: none; }
  .hero-section h1 { font-size: 2.2rem; }
  .subscription-cta { flex-direction: column; gap: 20px; text-align: center; }
  .cta-content { flex-direction: column; }
}
</style>
