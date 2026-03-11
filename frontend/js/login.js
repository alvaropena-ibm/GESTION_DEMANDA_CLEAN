/**
 * Login Page Logic
 * Maneja autenticación con Cognito e IAM
 */

import authService from './services/authService.js';

// Variables globales para el modal de cambio de contraseña
let passwordChangeSession = null;
let passwordChangeEmail = null;

/**
 * Cambiar entre tabs de autenticación
 */
window.switchTab = function(tab) {
    // Actualizar botones de tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    // Actualizar formularios
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById(`${tab}-form`).classList.add('active');
    
    // Limpiar mensajes
    hideError();
    hideSuccess();
    
    // Focus en primer campo
    if (tab === 'cognito') {
        document.getElementById('cognito-email').focus();
    } else {
        document.getElementById('access-key').focus();
    }
};

/**
 * Login con Cognito
 */
window.loginWithCognito = async function() {
    const email = document.getElementById('cognito-email').value.trim();
    const password = document.getElementById('cognito-password').value.trim();
    const loginBtn = document.getElementById('cognito-login-btn');
    
    // Validación
    if (!email || !password) {
        showError('Por favor, introduce tu email y contraseña');
        return;
    }
    
    if (!email.includes('@')) {
        showError('Por favor, introduce un email válido');
        return;
    }
    
    // Mostrar loading
    setButtonLoading(loginBtn, true);
    hideError();
    
    try {
        const result = await authService.loginWithCognito(email, password);
        
        if (result.requiresPasswordChange) {
            // Mostrar modal de cambio de contraseña
            passwordChangeEmail = email;
            passwordChangeSession = result.session;
            showPasswordChangeModal(email);
            setButtonLoading(loginBtn, false);
        } else if (result.success) {
            // Login exitoso
            setButtonSuccess(loginBtn);
            setTimeout(() => {
                window.location.href = 'index-modular.html';
            }, 1000);
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Error al iniciar sesión. Verifica tus credenciales.');
        setButtonLoading(loginBtn, false);
        // Limpiar contraseña
        document.getElementById('cognito-password').value = '';
    }
};

/**
 * Login con IAM
 */
window.loginWithIAM = async function() {
    const accessKey = document.getElementById('access-key').value.trim();
    const secretKey = document.getElementById('secret-key').value.trim();
    const loginBtn = document.getElementById('iam-login-btn');
    
    // Validación
    if (!accessKey || !secretKey) {
        showError('Por favor, introduce tus credenciales de AWS');
        return;
    }
    
    // Mostrar loading
    setButtonLoading(loginBtn, true);
    hideError();
    
    try {
        const result = await authService.loginWithIAM(accessKey, secretKey);
        
        if (result.success) {
            // Login exitoso
            setButtonSuccess(loginBtn);
            setTimeout(() => {
                window.location.href = 'index-modular.html';
            }, 1000);
        }
    } catch (error) {
        console.error('IAM login error:', error);
        showError(error.message || 'Error al iniciar sesión. Verifica tus credenciales de AWS.');
        setButtonLoading(loginBtn, false);
    }
};

/**
 * Mostrar modal de cambio de contraseña
 */
function showPasswordChangeModal(email) {
    document.getElementById('change-email').value = email;
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    document.getElementById('password-change-modal').style.display = 'flex';
}

/**
 * Cancelar cambio de contraseña
 */
window.cancelPasswordChange = function() {
    document.getElementById('password-change-modal').style.display = 'none';
    passwordChangeSession = null;
    passwordChangeEmail = null;
};

/**
 * Enviar cambio de contraseña
 */
window.submitPasswordChange = async function() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Validación
    if (!newPassword || !confirmPassword) {
        showError('Por favor, introduce la nueva contraseña');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showError('Las contraseñas no coinciden');
        return;
    }
    
    if (newPassword.length < 8) {
        showError('La contraseña debe tener al menos 8 caracteres');
        return;
    }
    
    // Validar complejidad
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        showError('La contraseña debe incluir mayúsculas, minúsculas, números y símbolos');
        return;
    }
    
    hideError();
    
    try {
        const result = await authService.changePassword(
            passwordChangeEmail,
            newPassword,
            passwordChangeSession
        );
        
        if (result.success) {
            // Cerrar modal
            document.getElementById('password-change-modal').style.display = 'none';
            
            // Mostrar mensaje de éxito
            showSuccess('Contraseña cambiada correctamente. Redirigiendo...');
            
            // Redirigir al dashboard
            setTimeout(() => {
                window.location.href = 'index-modular.html';
            }, 2000);
        }
    } catch (error) {
        console.error('Password change error:', error);
        showError(error.message || 'Error al cambiar la contraseña');
    }
};

/**
 * Mostrar mensaje de error
 */
function showError(message) {
    const errorElement = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    errorText.textContent = message;
    errorElement.style.display = 'flex';
}

/**
 * Ocultar mensaje de error
 */
function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

/**
 * Mostrar mensaje de éxito
 */
function showSuccess(message) {
    const successElement = document.getElementById('success-message');
    const successText = document.getElementById('success-text');
    
    successText.textContent = message;
    successElement.style.display = 'flex';
}

/**
 * Ocultar mensaje de éxito
 */
function hideSuccess() {
    document.getElementById('success-message').style.display = 'none';
}

/**
 * Establecer estado de loading en botón
 */
function setButtonLoading(button, loading) {
    if (loading) {
        button.disabled = true;
        button.innerHTML = `
            <div class="loading-spinner"></div>
            Autenticando...
        `;
    } else {
        button.disabled = false;
        // Restaurar contenido original según el botón
        if (button.id === 'cognito-login-btn') {
            button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Iniciar Sesión
            `;
        } else {
            button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
                Iniciar Sesión
            `;
        }
    }
}

/**
 * Establecer estado de éxito en botón
 */
function setButtonSuccess(button) {
    button.disabled = true;
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        ¡Autenticación Exitosa!
    `;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Verificar si ya está autenticado
    if (authService.isAuthenticated()) {
        window.location.href = 'index-modular.html';
        return;
    }
    
    // Focus en primer campo
    document.getElementById('cognito-email').focus();
    
    // Enter key en formulario de Cognito
    document.getElementById('cognito-email').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('cognito-password').focus();
        }
    });
    
    document.getElementById('cognito-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginWithCognito();
        }
    });
    
    // Enter key en formulario de IAM
    document.getElementById('access-key').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('secret-key').focus();
        }
    });
    
    document.getElementById('secret-key').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginWithIAM();
        }
    });
    
    // Limpiar errores al escribir
    document.getElementById('cognito-email').addEventListener('input', hideError);
    document.getElementById('cognito-password').addEventListener('input', hideError);
    document.getElementById('access-key').addEventListener('input', hideError);
    document.getElementById('secret-key').addEventListener('input', hideError);
    
    // Enter key en modal de cambio de contraseña
    document.getElementById('new-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('confirm-password').focus();
        }
    });
    
    document.getElementById('confirm-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            submitPasswordChange();
        }
    });
});
