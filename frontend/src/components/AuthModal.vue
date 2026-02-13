<script setup lang="ts">
import { ref, computed } from 'vue';
import { AuthService } from '../services/AuthService';
import { X, Mail, Lock, LogIn, Loader2, AlertCircle, CheckCircle2 } from 'lucide-vue-next';

const props = defineProps<{
    isOpen: boolean;
    initialMode?: 'login' | 'register';
}>();

const emit = defineEmits(['close', 'success']);

const mode = ref<'login' | 'register'>(props.initialMode || 'register');
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const isEmailValid = computed(() => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.value);
});

const isPasswordValid = computed(() => {
    return password.value.length >= 6;
});

const isFormValid = computed(() => {
    if (mode.value === 'register') {
        return isEmailValid.value && isPasswordValid.value;
    }
    return email.value.length > 0 && password.value.length > 0;
});

const handleSubmit = async () => {
    if (!isFormValid.value) return;
    
    loading.value = true;
    error.value = '';
    try {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const guestId = currentUser.isGuest ? currentUser.id : undefined;

        if (mode.value === 'register') {
            await AuthService.register(email.value, password.value, guestId);
        } else {
            await AuthService.login(email.value, password.value);
        }
        emit('success');
        emit('close');
    } catch (err: any) {
        error.value = err.response?.data?.error || 'Erro ao processar solicitação. Tente novamente.';
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
        <div class="auth-card glass-card animate-zoom">
            <button class="close-btn" @click="emit('close')"><X :size="20" /></button>
            
            <div class="auth-header">
                <div class="brand-badge">
                    <CheckCircle2 v-if="mode === 'register'" :size="16" />
                    <LogIn v-else :size="16" />
                    <span>{{ mode === 'register' ? 'PREMIUM ACCESS' : 'MEMBER LOGIN' }}</span>
                </div>
                <h2>{{ mode === 'register' ? 'Crie sua conta' : 'Bem-vindo de volta' }}</h2>
                <p>{{ mode === 'register' ? 'Junte-se a consultores que já economizam horas com IA.' : 'Continue de onde parou em seu painel.' }}</p>
            </div>

            <form @submit.prevent="handleSubmit" class="auth-form">
                <div class="input-wrapper">
                    <label>E-mail Corporativo ou Pessoal</label>
                    <div class="input-group" :class="{ 'error': email && !isEmailValid, 'success': isEmailValid }">
                        <Mail :size="18" class="input-icon" />
                        <input v-model="email" type="email" placeholder="exemplo@email.com" required autocomplete="email" />
                    </div>
                </div>

                <div class="input-wrapper">
                    <label>Senha de Acesso</label>
                    <div class="input-group" :class="{ 'error': password && !isPasswordValid && mode === 'register', 'success': isPasswordValid && mode === 'register' }">
                        <Lock :size="18" class="input-icon" />
                        <input v-model="password" type="password" placeholder="••••••••" required autocomplete="current-password" />
                    </div>
                    <span v-if="mode === 'register'" class="hint">Mínimo de 6 caracteres</span>
                </div>

                <div v-if="error" class="error-banner">
                    <AlertCircle :size="18" />
                    <span>{{ error }}</span>
                </div>

                <button type="submit" :disabled="loading || !isFormValid" class="submit-btn action-btn">
                    <Loader2 v-if="loading" class="spin" />
                    <template v-else>
                        <span>{{ mode === 'register' ? 'Começar Gratuitamente' : 'Entrar na Plataforma' }}</span>
                    </template>
                </button>
            </form>

            <div class="auth-footer">
                <p>{{ mode === 'login' ? 'Ainda não é membro?' : 'Já possui uma conta?' }}</p>
                <button @click="mode = mode === 'login' ? 'register' : 'login'" class="toggle-link">
                    {{ mode === 'login' ? 'Criar conta agora' : 'Fazer login' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(2, 6, 23, 0.85);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.auth-card {
    width: 90%;
    max-width: 440px;
    padding: 48px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.close-btn {
    position: absolute;
    top: 16px; right: 16px;
    background: rgba(255,255,255,0.05); 
    border: none; 
    color: var(--text-muted);
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
}
.close-btn:hover { background: rgba(255,255,255,0.1); color: white; }

.auth-header { text-align: center; margin-bottom: 32px; }

.brand-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(99, 102, 241, 0.1);
    color: var(--primary);
    padding: 6px 12px;
    border-radius: 99px;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    margin-bottom: 16px;
}

.auth-header h2 { font-size: 2rem; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.02em; }
.auth-header p { color: var(--text-muted); font-size: 1rem; line-height: 1.5; }

.auth-form { display: flex; flex-direction: column; gap: 20px; }

.input-wrapper { display: flex; flex-direction: column; gap: 8px; }
.input-wrapper label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }

.input-group {
    position: relative;
    display: flex;
    align-items: center;
    transition: all 0.2s;
}

.input-icon {
    position: absolute;
    left: 16px;
    color: var(--text-muted);
}

.input-group input {
    width: 100%;
    padding: 14px 16px 14px 48px;
    background: rgba(2, 6, 23, 0.5);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    outline: none;
    transition: all 0.2s;
}

.input-group.success input { border-color: rgba(16, 185, 129, 0.4); }
.input-group.error input { border-color: rgba(239, 68, 68, 0.4); }
.input-group input:focus { border-color: var(--primary); background: rgba(2, 6, 23, 0.8); }

.hint { font-size: 0.75rem; color: var(--text-muted); padding-left: 4px; }

.submit-btn {
    margin-top: 12px;
    height: 52px;
    font-size: 1.05rem;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4);
}

.submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    filter: grayscale(1);
    box-shadow: none;
}

.error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    padding: 12px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--accent-error);
    font-size: 0.9rem;
}

.auth-footer { margin-top: 32px; text-align: center; border-top: 1px solid var(--glass-border); padding-top: 24px; }
.auth-footer p { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 8px; }
.toggle-link {
    background: none; border: none; color: var(--primary);
    font-weight: 700; font-size: 1rem; cursor: pointer;
}
.toggle-link:hover { text-decoration: underline; }

.animate-zoom { animation: zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes zoom { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>
