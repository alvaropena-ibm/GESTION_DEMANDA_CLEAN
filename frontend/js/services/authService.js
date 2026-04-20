/**
 * Servicio de Autenticación
 * Maneja login con AWS Cognito (email/password)
 */

import { API_CONFIG } from '../config/data.js';

class AuthService {
    constructor() {
        this.authType = 'cognito';
    }

    /**
     * Login con Cognito (email + password)
     * @param {string} email - Email del usuario
     * @param {string} password - Contraseña
     * @returns {Promise<Object>} Resultado del login
     */
    async loginWithCognito(email, password) {
        try {
            console.log('Attempting Cognito login for:', email);
            
            const response = await fetch(`${API_CONFIG.AUTH_API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            console.log('DEBUG - Response from Lambda:', JSON.stringify(data, null, 2));

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Error de autenticación');
            }

            // Manejar estructura de respuesta: puede venir en data.data o directamente en data
            const responseData = data.data || data;

            // Login exitoso con token (estructura nueva)
            if (responseData.success && responseData.token) {
                console.log('DEBUG - User data before storing:', JSON.stringify(responseData.user, null, 2));
                // Adaptar estructura para storeCognitoAuth
                const adaptedData = {
                    tokens: {
                        access_token: responseData.token,
                        id_token: responseData.token,
                        refresh_token: responseData.token,
                        expires_in: 3600
                    },
                    user: responseData.user,
                    permissions: responseData.permissions
                };
                this.storeCognitoAuth(adaptedData);
                console.log('DEBUG - Team stored in sessionStorage:', sessionStorage.getItem('user_team'));
                console.log('Cognito login successful');
                return { 
                    success: true, 
                    user: responseData.user,
                    requiresPasswordChange: false
                };
            }

            // Login exitoso con tokens (estructura antigua)
            if (data.success && data.tokens) {
                console.log('DEBUG - User data before storing:', JSON.stringify(data.user, null, 2));
                this.storeCognitoAuth(data);
                console.log('DEBUG - Team stored in sessionStorage:', sessionStorage.getItem('user_team'));
                console.log('Cognito login successful');
                return { 
                    success: true, 
                    user: data.user,
                    requiresPasswordChange: false
                };
            }

            // Requiere cambio de contraseña
            if (data.challenge === 'NEW_PASSWORD_REQUIRED') {
                console.log('Password change required');
                return {
                    success: false,
                    requiresPasswordChange: true,
                    session: data.session,
                    user: data.user
                };
            }

            throw new Error(data.message || 'Error desconocido');

        } catch (error) {
            console.error('Cognito login error:', error);
            throw error;
        }
    }


    /**
     * Cambiar contraseña de Cognito (para usuarios nuevos o cambio forzado)
     * @param {string} email - Email del usuario
     * @param {string} newPassword - Nueva contraseña
     * @param {string} session - Session token de Cognito
     * @returns {Promise<Object>} Resultado del cambio
     */
    async changePassword(email, newPassword, session) {
        try {
            console.log('Attempting password change for:', email);
            
            const response = await fetch(`${API_CONFIG.AUTH_API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    new_password: newPassword,
                    session
                })
            });

            const data = await response.json();

            if (data.success && data.tokens) {
                this.storeCognitoAuth(data);
                console.log('Password changed successfully');
                return { success: true };
            }

            throw new Error(data.message || data.error || 'Error al cambiar contraseña');

        } catch (error) {
            console.error('Change password error:', error);
            throw error;
        }
    }

    /**
     * Refrescar token de Cognito automáticamente
     * @returns {Promise<string>} Nuevo access token
     */
    async refreshToken() {
        const refreshToken = sessionStorage.getItem('cognito_refresh_token');
        
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            console.log('Refreshing Cognito token...');
            
            const response = await fetch(`${API_CONFIG.AUTH_API_URL}/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            const data = await response.json();

            if (data.access_token) {
                // Actualizar tokens en sessionStorage
                sessionStorage.setItem('cognito_access_token', data.access_token);
                sessionStorage.setItem('cognito_id_token', data.id_token);
                sessionStorage.setItem('token_expires_at',
                    new Date(Date.now() + data.expires_in * 1000).toISOString()
                );
                
                console.log('Token refreshed successfully');
                return data.access_token;
            }

            throw new Error('Failed to refresh token');

        } catch (error) {
            console.error('Refresh token error:', error);
            // Si falla el refresh, hacer logout
            this.logout();
            throw error;
        }
    }

    /**
     * Logout - Limpiar sesión y redirigir a login
     */
    async logout() {
        const authType = sessionStorage.getItem('auth_type');
        
        // Si es Cognito, intentar invalidar el refresh token en el servidor
        if (authType === 'cognito') {
            const accessToken = sessionStorage.getItem('cognito_access_token');
            if (accessToken) {
                try {
                    await fetch(`${API_CONFIG.AUTH_API_URL}/logout`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ access_token: accessToken })
                    });
                } catch (error) {
                    console.error('Logout error:', error);
                    // Continuar con el logout local aunque falle el servidor
                }
            }
        }

        // Limpiar sessionStorage
        sessionStorage.clear();
        
        // Redirigir a login
        window.location.href = 'login-new.html';
    }

    /**
     * Verificar si el usuario está autenticado
     * @returns {boolean}
     */
    isAuthenticated() {
        return sessionStorage.getItem('user_authenticated') === 'true';
    }

    /**
     * Obtener tipo de autenticación actual
     * @returns {string} 'cognito'
     */
    getAuthType() {
        return 'cognito';
    }

    /**
     * Obtener información del usuario actual
     * @returns {Object|null}
     */
    getCurrentUser() {
        return {
            email: sessionStorage.getItem('user_email'),
            name: sessionStorage.getItem('user_full_name'),
            team: sessionStorage.getItem('user_team'),
            groups: JSON.parse(sessionStorage.getItem('cognito_groups') || '[]'),
            app_permissions: JSON.parse(sessionStorage.getItem('app_permissions') || '[]'),
            auth_type: 'cognito'
        };
    }

    /**
     * Obtener headers de autenticación para API calls
     * @returns {Object} Headers con Authorization
     */
    getAuthHeaders() {
        const token = sessionStorage.getItem('cognito_access_token');
        const team = sessionStorage.getItem('user_team');
        
        if (!token) {
            throw new Error('No token found');
        }
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        // Añadir x-user-team si existe
        if (team) {
            headers['x-user-team'] = team;
        }
        
        return headers;
    }

    /**
     * Verificar si el token de Cognito está próximo a expirar (5 minutos)
     * @returns {boolean}
     */
    isTokenExpiringSoon() {
        const expiresAt = sessionStorage.getItem('token_expires_at');
        if (!expiresAt) return false;

        const expirationTime = new Date(expiresAt).getTime();
        const currentTime = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        return (expirationTime - currentTime) < fiveMinutes;
    }

    /**
     * Verificar si el token de Cognito ha expirado
     * @returns {boolean}
     */
    isTokenExpired() {
        const expiresAt = sessionStorage.getItem('token_expires_at');
        if (!expiresAt) return true;
        
        return new Date(expiresAt) <= new Date();
    }

    /**
     * Decodificar JWT para extraer información
     * @param {string} token - JWT token
     * @returns {Object} Payload del token
     */
    decodeJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Error decoding JWT:', error);
            return {};
        }
    }

    /**
     * Almacenar autenticación Cognito en sessionStorage
     * @private
     */
    storeCognitoAuth(response) {
        sessionStorage.setItem('user_authenticated', 'true');
        sessionStorage.setItem('auth_type', 'cognito');
        
        // Almacenar tokens
        if (response.tokens) {
            sessionStorage.setItem('cognito_access_token', response.tokens.access_token);
            sessionStorage.setItem('cognito_id_token', response.tokens.id_token);
            if (response.tokens.refresh_token) {
                sessionStorage.setItem('cognito_refresh_token', response.tokens.refresh_token);
            }
            sessionStorage.setItem('token_expires_at',
                new Date(Date.now() + response.tokens.expires_in * 1000).toISOString()
            );
            
            // Decodificar el ID token para extraer información adicional
            const idTokenPayload = this.decodeJWT(response.tokens.id_token);
            console.log('DEBUG - ID Token Payload:', idTokenPayload);
            
            // Extraer información del usuario del token
            sessionStorage.setItem('user_email', idTokenPayload.email || response.user?.email || '');
            sessionStorage.setItem('user_full_name', idTokenPayload.name || response.user?.name || idTokenPayload.email || '');
            sessionStorage.setItem('user_sub', idTokenPayload.sub || '');
            
            // Extraer grupos del token (pueden venir en diferentes formatos)
            const groups = idTokenPayload.groups || idTokenPayload['cognito:groups'] || response.user?.groups || [];
            sessionStorage.setItem('cognito_groups', JSON.stringify(groups));
            
            // Extraer team del grupo
            // Buscar grupo que empiece por 'lcs' o 'lcorp'
            let team = null;
            
            if (groups.length > 0) {
                // Buscar el primer grupo que empiece por 'lcs' o 'lcorp'
                const validGroup = groups.find(g => {
                    const groupLower = g.toLowerCase();
                    return groupLower.startsWith('lcs') || groupLower.startsWith('lcorp');
                });
                
                if (validGroup) {
                    // Usar el grupo tal cual, sin transformaciones
                    team = validGroup;
                }
            }
            
            // Si no se encontró un grupo válido, lanzar error
            if (!team) {
                throw new Error('No se encontró un grupo válido (debe empezar por "lcs" o "lcorp")');
            }
            
            sessionStorage.setItem('user_team', team);
            
            // Extraer permisos de aplicación si existen
            const appPermissions = idTokenPayload.app_permissions || response.user?.app_permissions || [];
            sessionStorage.setItem('app_permissions', JSON.stringify(appPermissions));
            
            console.log('DEBUG - Extracted data:', {
                email: idTokenPayload.email,
                name: idTokenPayload.name,
                groups: groups,
                team: team,
                app_permissions: appPermissions
            });
        } else {
            // Fallback si no hay tokens (no debería ocurrir)
            const userGroups = response.user?.groups || [];
            const validGroup = userGroups.find(g => {
                const groupLower = g.toLowerCase();
                return groupLower.startsWith('lcs') || groupLower.startsWith('lcorp');
            });
            
            if (!validGroup) {
                throw new Error('No se encontró un grupo válido (debe empezar por "lcs" o "lcorp")');
            }
            
            sessionStorage.setItem('user_email', response.user?.email || '');
            sessionStorage.setItem('user_full_name', response.user?.name || response.user?.email || '');
            sessionStorage.setItem('user_team', validGroup);
            sessionStorage.setItem('cognito_groups', JSON.stringify(userGroups));
            sessionStorage.setItem('app_permissions', JSON.stringify(response.user?.app_permissions || []));
        }
        
        sessionStorage.setItem('login_timestamp', new Date().toISOString());
    }


    /**
     * Obtener grupos de Cognito del usuario actual
     * @returns {Array<string>}
     */
    getCognitoGroups() {
        try {
            const groupsStr = sessionStorage.getItem('cognito_groups');
            return groupsStr ? JSON.parse(groupsStr) : [];
        } catch (error) {
            console.error('Error parsing cognito groups:', error);
            return [];
        }
    }

    /**
     * Obtener permisos de aplicación del usuario actual
     * @returns {Array<Object>}
     */
    getAppPermissions() {
        try {
            const permsStr = sessionStorage.getItem('app_permissions');
            return permsStr ? JSON.parse(permsStr) : [];
        } catch (error) {
            console.error('Error parsing app permissions:', error);
            return [];
        }
    }

    /**
     * Verificar si el usuario tiene un grupo específico
     * @param {string} groupName - Nombre del grupo
     * @returns {boolean}
     */
    hasGroup(groupName) {
        const groups = this.getCognitoGroups();
        return groups.some(g => g.toLowerCase().includes(groupName.toLowerCase()));
    }

    /**
     * Verificar si el usuario tiene permiso para una aplicación específica
     * @param {string} appName - Nombre de la aplicación
     * @param {string} minPermissionType - Tipo mínimo de permiso requerido ('read', 'write', 'admin')
     * @returns {boolean}
     */
    hasAppPermission(appName, minPermissionType = 'read') {
        const permissions = this.getAppPermissions();
        const permissionLevels = { 'read': 1, 'write': 50, 'admin': 100 };
        const minLevel = permissionLevels[minPermissionType] || 1;
        
        return permissions.some(perm => 
            perm.app_name === appName && perm.permission_level >= minLevel
        );
    }

    /**
     * Verificar si el usuario tiene un grupo válido (lcs* o lcorp*)
     * @returns {boolean}
     */
    hasValidGroup() {
        const groups = this.getCognitoGroups();
        return groups.some(g => {
            const groupLower = g.toLowerCase();
            return groupLower.startsWith('lcs') || groupLower.startsWith('lcorp');
        });
    }
}

// Exportar instancia singleton
const authService = new AuthService();
export default authService;