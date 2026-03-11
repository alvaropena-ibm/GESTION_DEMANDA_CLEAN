import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Base URLs de las APIs - SOLO Lambda (sin fallback a localhost)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const AUTH_API_BASE_URL = import.meta.env.VITE_AUTH_API_URL;

// Validar que las variables de entorno estén configuradas
if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL no está configurada en las variables de entorno');
}
if (!AUTH_API_BASE_URL) {
  throw new Error('VITE_AUTH_API_URL no está configurada en las variables de entorno');
}

// Cliente para autenticación (API pública, sin Lambda Authorizer)
export const authApiClient = axios.create({
  baseURL: AUTH_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
  withCredentials: false,
});

// Cliente para Identity Management (API protegida, con Lambda Authorizer)
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
  withCredentials: false,
});

// Variables para controlar la renovación de tokens
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

// Procesar cola de peticiones después de renovar token
const processQueue = (error: any = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Verificar si el token está próximo a expirar (5 minutos antes)
const isTokenExpiringSoon = (): boolean => {
  const expiresAt = sessionStorage.getItem('token_expires_at');
  if (!expiresAt) return false;
  
  const expirationTime = new Date(expiresAt).getTime();
  const currentTime = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  return (expirationTime - currentTime) < fiveMinutes;
};

// Renovar token automáticamente
const refreshToken = async (): Promise<string | null> => {
  const refreshToken = sessionStorage.getItem('cognito_refresh_token');
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${AUTH_API_BASE_URL}/refresh`, {
      refresh_token: refreshToken
    });

    const data = response.data;
    if (data.success && data.tokens) {
      sessionStorage.setItem('cognito_access_token', data.tokens.access_token);
      sessionStorage.setItem('cognito_id_token', data.tokens.id_token);
      sessionStorage.setItem('token_expires_at', 
        new Date(Date.now() + data.tokens.expires_in * 1000).toISOString()
      );
      
      console.log('✅ Token renovado automáticamente');
      return data.tokens.access_token;
    }
  } catch (error) {
    console.error('❌ Error al renovar token:', error);
    sessionStorage.clear();
    window.location.href = '/login';
  }
  
  return null;
};

// Interceptor para añadir token y renovarlo si es necesario
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const authType = sessionStorage.getItem('auth_type');
    
    if (authType === 'cognito') {
      // Verificar si el token está próximo a expirar
      if (isTokenExpiringSoon() && !isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshToken();
        isRefreshing = false;
        
        if (newToken && config.headers) {
          config.headers.Authorization = `Bearer ${newToken}`;
        }
      } else {
        const token = sessionStorage.getItem('cognito_access_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } else if (authType === 'iam') {
      const accessKey = sessionStorage.getItem('aws_access_key');
      if (accessKey && config.headers) {
        config.headers['X-AWS-Access-Key'] = accessKey;
      }
    } else {
      // Fallback a localStorage
      const token = localStorage.getItem('auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejo centralizado de errores
apiClient.interceptors.response.use(
  (response) => {
    // Si la respuesta es exitosa, simplemente retornarla
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Manejo de errores comunes
    if (error.response) {
      // El servidor respondió con un código de estado fuera del rango 2xx
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 401:
          // No autorizado - intentar renovar token si es Cognito
          const authType = sessionStorage.getItem('auth_type');
          
          if (authType === 'cognito' && !originalRequest._retry) {
            if (isRefreshing) {
              // Si ya se está renovando, agregar a la cola
              return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
              }).then(() => {
                const newToken = sessionStorage.getItem('cognito_access_token');
                if (newToken && originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${newToken}`;
                }
                return apiClient(originalRequest);
              }).catch(err => {
                return Promise.reject(err);
              });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
              const newToken = await refreshToken();
              if (newToken && originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                processQueue(null);
                return apiClient(originalRequest);
              }
            } catch (refreshError) {
              processQueue(refreshError);
              sessionStorage.clear();
              window.location.href = '/login';
              return Promise.reject(refreshError);
            } finally {
              isRefreshing = false;
            }
          } else {
            // No es Cognito o ya se intentó renovar
            console.error('No autorizado. Por favor, inicia sesión nuevamente.');
            localStorage.removeItem('auth_token');
            sessionStorage.clear();
            window.location.href = '/login';
          }
          break;
        case 403:
          // Prohibido - el usuario no tiene permisos
          console.error('No tienes permisos para realizar esta acción.');
          break;
        case 404:
          // No encontrado
          console.error('Recurso no encontrado.');
          break;
        case 422:
          // Error de validación
          console.error('Error de validación:', data.detail || data.message);
          break;
        case 500:
          // Error interno del servidor
          console.error('Error interno del servidor. Por favor, intenta más tarde.');
          break;
        default:
          console.error(`Error ${status}:`, data.message || 'Error desconocido');
      }
    } else if (error.request) {
      // La petición fue hecha pero no se recibió respuesta
      console.error('No se pudo conectar con el servidor. Verifica tu conexión.');
    } else {
      // Algo sucedió al configurar la petición
      console.error('Error al realizar la petición:', error.message);
    }

    return Promise.reject(error);
  }
);

// Tipos para respuestas de API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedApiResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Funciones helper para manejo de errores
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    if (axiosError.response?.data?.detail) {
      return axiosError.response.data.detail;
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Error desconocido';
};

export default apiClient;
