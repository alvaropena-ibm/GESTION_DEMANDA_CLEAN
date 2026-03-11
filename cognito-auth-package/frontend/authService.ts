/**
 * Servicio de autenticación
 * Maneja login con Cognito y con Access Keys IAM
 */
import { authApiClient } from './api';

export interface CognitoLoginRequest {
  email: string;
  password: string;
}

export interface IAMLoginRequest {
  access_key: string;
  secret_key: string;
}

export interface LoginResponse {
  success: boolean;
  auth_type: 'cognito' | 'iam';
  user: {
    email?: string;
    name?: string;
    team?: string;
    id_interno?: string;
    id_externo?: string;
    permissions?: string[];
    cognito_status?: string;
    username?: string;
    account?: string;
    arn?: string;
    access_key?: string;
    requires_password_change?: boolean;
  };
  tokens?: {
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  message: string;
}

class AuthService {
  /**
   * Login con usuario Cognito (email + password)
   */
  async loginWithCognito(credentials: CognitoLoginRequest): Promise<LoginResponse> {
    const response = await authApiClient.post<LoginResponse>('/login', credentials);
    const data = response.data;
    
    if (data.success && data.auth_type === 'cognito') {
      // Guardar información de autenticación
      this.storeCognitoAuth(data);
    }
    
    return data;
  }

  /**
   * Login con Access Keys IAM
   */
  async loginWithIAM(credentials: IAMLoginRequest): Promise<LoginResponse> {
    const response = await authApiClient.post<LoginResponse>('/api/auth/iam-login', credentials);
    const data = response.data;
    
    if (data.success && data.auth_type === 'iam') {
      // Guardar información de autenticación
      this.storeIAMAuth(data, credentials);
    }
    
    return data;
  }

  /**
   * Cambiar contraseña de Cognito
   */
  async changePassword(email: string, oldPassword: string, newPassword: string): Promise<LoginResponse> {
    const response = await authApiClient.post<LoginResponse>('/change-password', {
      email,
      old_password: oldPassword,
      new_password: newPassword
    });
    const data = response.data;
    
    if (data.success && data.tokens) {
      // Guardar información de autenticación
      this.storeCognitoAuth(data);
    }
    
    return data;
  }

  /**
   * Refrescar tokens de Cognito
   */
  async refreshCognitoToken(refreshToken: string): Promise<LoginResponse> {
    const response = await authApiClient.post<LoginResponse>('/refresh', {
      refresh_token: refreshToken
    });
    const data = response.data;
    
    if (data.success && data.tokens) {
      // Actualizar tokens
      sessionStorage.setItem('cognito_access_token', data.tokens.access_token);
      sessionStorage.setItem('cognito_id_token', data.tokens.id_token);
      sessionStorage.setItem('token_expires_at', 
        new Date(Date.now() + data.tokens.expires_in * 1000).toISOString()
      );
    }
    
    return data;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await authApiClient.post('/logout');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      this.clearAuth();
    }
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return sessionStorage.getItem('user_authenticated') === 'true';
  }

  /**
   * Obtener tipo de autenticación actual
   */
  getAuthType(): 'cognito' | 'iam' | null {
    return sessionStorage.getItem('auth_type') as 'cognito' | 'iam' | null;
  }

  /**
   * Obtener información del usuario actual
   */
  getCurrentUser(): any {
    const authType = this.getAuthType();
    
    if (authType === 'cognito') {
      return {
        email: sessionStorage.getItem('user_email'),
        name: sessionStorage.getItem('user_full_name'),
        team: sessionStorage.getItem('user_team'),
        permissions: JSON.parse(sessionStorage.getItem('user_permissions') || '[]'),
        auth_type: 'cognito'
      };
    } else if (authType === 'iam') {
      return {
        username: sessionStorage.getItem('username'),
        account: sessionStorage.getItem('user_account'),
        arn: sessionStorage.getItem('user_arn'),
        auth_type: 'iam'
      };
    }
    
    return null;
  }

  /**
   * Obtener token de acceso de Cognito
   */
  getCognitoAccessToken(): string | null {
    return sessionStorage.getItem('cognito_access_token');
  }

  /**
   * Verificar si el token ha expirado
   */
  isTokenExpired(): boolean {
    const expiresAt = sessionStorage.getItem('token_expires_at');
    if (!expiresAt) return true;
    
    return new Date(expiresAt) <= new Date();
  }

  /**
   * Almacenar autenticación Cognito
   */
  private storeCognitoAuth(response: LoginResponse): void {
    sessionStorage.setItem('user_authenticated', 'true');
    sessionStorage.setItem('auth_type', 'cognito');
    sessionStorage.setItem('user_email', response.user.email || '');
    sessionStorage.setItem('user_full_name', response.user.name || '');
    sessionStorage.setItem('user_team', response.user.team || '');
    sessionStorage.setItem('user_permissions', JSON.stringify(response.user.permissions || []));
    // IMPORTANTE: Guardar grupos de Cognito para control de acceso
    // Los grupos vienen en response.user.groups (no en permissions)
    const groups = (response.user as any).groups || response.user.permissions || [];
    sessionStorage.setItem('cognito_groups', JSON.stringify(groups));
    sessionStorage.setItem('login_timestamp', new Date().toISOString());
    
    if (response.tokens) {
      sessionStorage.setItem('cognito_access_token', response.tokens.access_token);
      sessionStorage.setItem('cognito_id_token', response.tokens.id_token);
      if (response.tokens.refresh_token) {
        sessionStorage.setItem('cognito_refresh_token', response.tokens.refresh_token);
      }
      sessionStorage.setItem('token_expires_at', 
        new Date(Date.now() + response.tokens.expires_in * 1000).toISOString()
      );
    }
  }

  /**
   * Almacenar autenticación IAM
   */
  private storeIAMAuth(response: LoginResponse, credentials: IAMLoginRequest): void {
    sessionStorage.setItem('user_authenticated', 'true');
    sessionStorage.setItem('auth_type', 'iam');
    sessionStorage.setItem('aws_access_key', credentials.access_key);
    sessionStorage.setItem('aws_region', 'eu-west-1');
    sessionStorage.setItem('username', response.user.username || credentials.access_key);
    sessionStorage.setItem('user_account', response.user.account || '');
    sessionStorage.setItem('user_arn', response.user.arn || '');
    sessionStorage.setItem('login_timestamp', new Date().toISOString());
    
    if (response.user.email) {
      sessionStorage.setItem('user_email', response.user.email);
    }
  }

  /**
   * Verificar si el usuario tiene acceso a Identity Management
   * Requiere tener el grupo 'global_admin' o 'credentials_management_application'
   */
  hasAccessToIdentityManagement(): boolean {
    const groups = this.getCognitoGroups();
    
    // Si no hay grupos, denegar acceso
    if (!groups || groups.length === 0) {
      return false;
    }
    
    // Verificar si tiene global_admin o credentials_management_application
    return groups.includes('global_admin') || groups.includes('credentials_management_application');
  }

  /**
   * Obtener grupos de Cognito del usuario actual
   */
  getCognitoGroups(): string[] {
    try {
      const groupsStr = sessionStorage.getItem('cognito_groups');
      return groupsStr ? JSON.parse(groupsStr) : [];
    } catch (error) {
      console.error('Error parsing cognito groups:', error);
      return [];
    }
  }

  /**
   * Limpiar autenticación
   */
  private clearAuth(): void {
    // Limpiar todo el sessionStorage
    sessionStorage.clear();
  }
}

export const authService = new AuthService();
export default authService;