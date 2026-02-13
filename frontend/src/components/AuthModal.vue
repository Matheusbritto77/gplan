<script setup lang="ts">
import { ref } from 'vue';
import { AuthService } from '../services/AuthService';
import { X, Mail, Lock, UserPlus, LogIn, Loader2 } from 'lucide-vue-next';

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

const handleSubmit = async () => {
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
        error.value = err.response?.data?.error || 'Erro ao processar solicitação';
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
                <h2>{{ mode === 'register' ? 'Criar Conta Premium' : 'Entrar na Conta' }}</h2>
                <p>{{ mode === 'register' ? 'Salve suas planilhas e ganhe créditos mensais!' : 'Acesse seu painel estruturado.' }}</p>
            </div>

            <form @submit.prevent="handleSubmit" class="auth-form">
                <div class="input-group">
                    <Mail :size="18" class="input-icon" />
                    <input v-model="email" type="email" placeholder="Seu e-mail" required />
                </div>

                <div class="input-group">
                    <Lock :size="18" class="input-icon" />
                    <input v-model="password" type="password" placeholder="Sua senha" required />
                </div>

                <div v-if="error" class="error-msg">{{ error }}</div>

                <button type="submit" :disabled="loading" class="submit-btn">
                    <Loader2 v-if="loading" class="spin" />
                    <template v-else>
                        <UserPlus v-if="mode === 'register'" :size="18" />
                        <LogIn v-else :size="18" />
                        <span>{{ mode === 'register' ? 'Registrar Agora' : 'Entrar' }}</span>
                    </template>
                </button>
            </form>

            <div class="auth-footer">
                <button @click="mode = mode === 'login' ? 'register' : 'login'" class="toggle-btn">
                    {{ mode === 'login' ? 'Não tem conta? Registre-se' : 'Já tem conta? Entre aqui' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.auth-card {
    width: 100%;
    max-width: 400px;
    padding: 40px;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.close-btn {
    position: absolute;
    top: 20px; right: 20px;
    background: none; border: none; color: var(--text-muted);
    cursor: pointer;
}

.auth-header { text-align: center; margin-bottom: 30px; }
.auth-header h2 { font-size: 1.8rem; margin-bottom: 8px; color: var(--primary); }
.auth-header p { color: var(--text-muted); font-size: 0.9rem; }

.auth-form { display: flex; flex-direction: column; gap: 16px; }

.input-group {
    position: relative;
    display: flex;
    align-items: center;
}

.input-icon {
    position: absolute;
    left: 14px;
    color: var(--text-muted);
}

.input-group input {
    width: 100%;
    padding: 14px 14px 14px 44px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    color: white;
    outline: none;
    transition: border-color 0.2s;
}

.input-group input:focus {
    border-color: var(--primary);
}

.submit-btn {
    background: var(--primary);
    color: white;
    padding: 14px;
    border-radius: 12px;
    border: none;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    margin-top: 10px;
}

.error-msg {
    color: #ef4444;
    font-size: 0.85rem;
    text-align: center;
}

.auth-footer { margin-top: 24px; text-align: center; }
.toggle-btn {
    background: none; border: none; color: var(--text-muted);
    font-size: 0.9rem; cursor: pointer;
}
.toggle-btn:hover { color: var(--primary); }

.animate-zoom {
    animation: zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes zoom {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
