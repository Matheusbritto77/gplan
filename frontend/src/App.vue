<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { 
  Sparkles, Download, FileSpreadsheet, Loader2, 
  MessageSquare, ChevronRight, History, Trash2,
  CheckCircle2, Info
} from 'lucide-vue-next';

// Configurações e Estados
const prompt = ref('');
const loading = ref(false);
const showPreview = ref(false);
const askingMoreInfo = ref(false);
const question = ref('');
const suggestions = ref<string[]>([]);
const currentSchema = ref<any>(null);
const history = ref<any[]>([]);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

// Carregar Histórico Local
onMounted(() => {
  const saved = localStorage.getItem('sheet_history');
  if (saved) history.value = JSON.parse(saved);
});

const saveToHistory = (schema: any) => {
  const item = { 
    id: Date.now(), 
    title: schema.title, 
    date: new Date().toLocaleString(),
    schema: schema 
  };
  history.value = [item, ...history.value].slice(0, 5);
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

    currentSchema.value = data.schema;
    question.value = data.followUp;
    suggestions.value = data.suggestions || [];
    showPreview.value = true;
    askingMoreInfo.value = true; // Agora exibimos as perguntas logo abaixo da planilha
    saveToHistory(data.schema);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    loading.value = false;
  }
};

const useSuggestion = (text: string) => {
  prompt.value += ` (${text})`;
  processPrompt();
};

const loadFromHistory = (item: any) => {
  currentSchema.value = item.schema;
  showPreview.value = true;
  askingMoreInfo.value = false;
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

const clearHistory = () => {
  history.value = [];
  localStorage.removeItem('sheet_history');
};
</script>

<template>
  <div class="app-layout">
    <!-- Navegação Lateral (Histórico) -->
    <aside class="sidebar glass-card">
      <div class="sidebar-header">
        <History :size="20" />
        <span>Recentes</span>
      </div>
      <div class="history-list">
        <div 
          v-for="item in history" 
          :key="item.id" 
          class="history-item"
          @click="loadFromHistory(item)"
        >
          <div class="item-icon"><FileSpreadsheet :size="16" /></div>
          <div class="item-details">
            <span class="item-title">{{ item.title }}</span>
            <span class="item-date">{{ item.date }}</span>
          </div>
        </div>
        <div v-if="history.length === 0" class="empty-history">
          Sem gerações recentes
        </div>
      </div>
      <button v-if="history.length > 0" @click="clearHistory" class="clear-btn">
        <Trash2 :size="14" /> Limpar tudo
      </button>
    </aside>

    <!-- Área Principal -->
    <main class="main-content">
      <header class="hero-section">
        <div class="badge animate-float">
          <Sparkles :size="14" />
          <span>Powered by Gemini 2.0 Flash</span>
        </div>
        <h1 class="gradient-text">SheetAI.app</h1>
        <p>Transforme ideias em planilhas estruturadas instantaneamente.</p>
      </header>

      <!-- Input Principal -->
      <section class="generator-area glass-card">
        <textarea 
          v-model="prompt" 
          placeholder="Descreva a planilha que você precisa... (ex: Fluxo de caixa para e-commerce com dashboard de ROI)"
          class="premium-input"
          @keydown.enter.ctrl="processPrompt()"
        ></textarea>
        
        <div class="controls">
          <div class="hint">
            <Info :size="14" />
            Pressione Ctrl + Enter para gerar
          </div>
          <button @click="processPrompt()" :disabled="loading" class="generate-btn">
            <Loader2 v-if="loading" class="spin" />
            <Sparkles v-else :size="18" />
            <span>{{ loading ? 'IA está pensando...' : 'Criar Planilha' }}</span>
          </button>
        </div>
      </section>

      <!-- Refinamento / Perguntas -->
      <transition name="slide-up">
        <section v-if="askingMoreInfo" class="more-info-area glass-card">
          <div class="question-header">
            <MessageSquare class="icon-pulse" />
            <h3>O que achou? Gostaria de ajustar algo?</h3>
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

      <!-- Preview e Download -->
      <transition name="fade">
        <section v-if="showPreview" class="results-area glass-card">
          <div class="results-header">
            <div class="title-meta">
              <div class="status-badge"><CheckCircle2 :size="16" /> Pronta para uso</div>
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
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  padding: 24px;
  gap: 24px;
}

.sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 24px;
  max-height: calc(100vh - 48px);
  position: sticky;
  top: 24px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 24px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--primary);
  transform: translateX(4px);
}

.item-icon {
  color: var(--primary);
  margin-top: 2px;
}

.item-details { display: flex; flex-direction: column; }
.item-title { font-size: 0.9rem; font-weight: 500; color: var(--text-main); }
.item-date { font-size: 0.75rem; color: var(--text-muted); }

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.hero-section {
  text-align: center;
  padding: 40px 0;
}

.hero-section h1 { font-size: 4rem; font-weight: 900; margin: 16px 0; }

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  padding: 8px 16px;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid rgba(99, 102, 241, 0.3);
}

.generator-area {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.generator-area textarea {
  min-height: 140px;
  font-size: 1.1rem;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.generate-btn {
  background: var(--primary);
  padding: 14px 32px;
  border-radius: 14px;
  border: none;
  color: white;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.5);
}

.generate-btn:hover {
  transform: scale(1.05) translateY(-2px);
  background: var(--primary-hover);
}

.more-info-area {
  padding: 24px;
  border-left: 4px solid var(--primary);
}

.question-header {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--primary);
  margin-bottom: 12px;
}

.suggestions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.suggestion-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  padding: 8px 16px;
  border-radius: 10px;
  color: var(--text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.suggestion-chip:hover {
  background: var(--primary);
  border-color: var(--primary);
  transform: translateY(-2px);
}

.results-area { padding: 32px; }

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  gap: 24px;
}

.status-badge {
  color: #10b981;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.download-actions { display: flex; gap: 12px; }

.btn-dl {
  padding: 12px 20px;
  border-radius: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  cursor: pointer;
}

.xlsx { background: #10b981; color: white; }
.csv { background: #64748b; color: white; }

.preview-container {
  overflow-x: auto;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--glass-border);
}

table { width: 100%; border-collapse: collapse; }
th { 
  background: rgba(15, 23, 42, 0.8);
  padding: 16px;
  text-align: left;
}
.th-content { display: flex; flex-direction: column; gap: 4px; }
.type-tag { font-size: 0.65rem; background: var(--primary); padding: 2px 6px; border-radius: 4px; width: fit-content; text-transform: uppercase; }

td { padding: 16px; border-bottom: 1px solid var(--glass-border); color: var(--text-muted); }

.clear-btn { 
  margin-top: 16px; 
  background: none; 
  border: none; 
  color: var(--text-muted); 
  cursor: pointer; 
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Animations */
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.4s ease; }
.slide-up-enter-from { opacity: 0; transform: translateY(20px); }
.fade-enter-active { transition: opacity 0.6s ease; }
.fade-enter-from { opacity: 0; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
.icon-pulse { animation: pulse 2s infinite; }

@media (max-width: 1024px) {
  .app-layout { flex-direction: column; }
  .sidebar { width: 100%; position: static; max-height: none; }
  .hero-section h1 { font-size: 2.5rem; }
}
</style>
