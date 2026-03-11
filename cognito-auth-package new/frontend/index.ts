// ============================================================================
// TYPE DEFINITIONS - Gestor de Identidades
// ============================================================================
// IMPORTANTE: Estos tipos coinciden EXACTAMENTE con el esquema PostgreSQL
// documentado en IMPLEMENTACION_TRACKING.md
// NO modificar los nombres de campos - deben coincidir con la base de datos
// ============================================================================

// User Management Types
export interface User {
  id: number; // Primary key (UUID en BD, pero se maneja como string)
  iam_username: string;
  email: string;
  person: string;
  team: string;
  iam_groups: string[] | null; // Array de grupos IAM (puede ser null)
  monthly_quota_usd: number;
  daily_limit_usd: number;
  daily_request_limit: number;
  daily_requests: number; // Uso actual (puede no estar disponible)
  user_status: 'active' | 'blocked' | 'suspended';
  is_active: boolean;
  administrative_safe: boolean;
  jwt_auto_renewal_enabled: boolean;
  api_keys_bedrock_auto_renewal_enabled: boolean;
  default_inference_profile: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  iam_username: string;
  iam_groups: string[]; // Array de grupos IAM
  person: string;
  email: string;
  team: string;
  monthly_quota_usd?: number;
  daily_limit_usd?: number;
  daily_request_limit?: number;
  jwt_auto_renewal_enabled?: boolean;
  api_keys_bedrock_auto_renewal_enabled?: boolean;
  default_inference_profile?: string;
}

export interface UpdateUserRequest {
  person?: string;
  email?: string;
  team?: string;
  iam_groups?: string[];
  monthly_quota_usd?: number;
  daily_limit_usd?: number;
  daily_request_limit?: number;
  jwt_auto_renewal_enabled?: boolean;
  api_keys_bedrock_auto_renewal_enabled?: boolean;
  administrative_safe?: boolean;
  default_inference_profile?: string;
}

// Access Key Types (AWS IAM - no se almacenan en BD)
export interface AccessKey {
  access_key_id: string;
  status: 'Active' | 'Inactive';
  create_date: string;
  last_used_date?: string;
  last_used_service?: string;
  last_used_region?: string;
}

export interface CreateAccessKeyResponse {
  iam_username: string;
  access_key_id: string;
  secret_access_key: string;
  created_date: string;
}

// JWT Token Types
export interface JWTToken {
  token_id: number | string;
  user_id: number | string;
  jti: string;
  token_hash?: string;
  created_at: string;
  expires_at: string;
  is_revoked: boolean;
  revoked_at: string | null;
  revocation_reason: string | null;
  models?: BedrockModel[];
  authorized_models?: string[];  // Array de nombres de modelos
}

export interface JWTPayload {
  iam_username: string;
  email: string;
  person: string;
  team: string;
  permissions: {
    models: string[];
    actions: string[];
  };
  iat: number;
  exp: number;
  jti: string;
}

export interface CreateTokenRequest {
  user_id: string; // Email del usuario (el backend lo usa para buscar)
  model_ids: string[]; // IDs de modelos Bedrock autorizados (strings)
  duration_days: number; // Duración en días
}

export interface CreateTokenResponse {
  token: string;
  jti: string;
  expires_at: string;
  models: BedrockModel[];
}

// Bedrock Model Types
export interface BedrockModel {
  model_id: number;
  bedrock_model_id: string; // ID del modelo en AWS Bedrock
  model_name: string;
  provider: string;
  description: string | null;
  input_cost_per_1k: number; // Costo por 1000 tokens de entrada
  output_cost_per_1k: number; // Costo por 1000 tokens de salida
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBedrockModelRequest {
  bedrock_model_id: string;
  model_name: string;
  provider: string;
  description?: string;
  input_cost_per_1k?: number;
  output_cost_per_1k?: number;
  is_active?: boolean;
}

export interface UpdateBedrockModelRequest {
  model_name?: string;
  provider?: string;
  description?: string;
  input_cost_per_1k?: number;
  output_cost_per_1k?: number;
  is_active?: boolean;
}

// Application Profile Types (formerly Action Profile)
export interface ActionProfile {
  id: string; // Formato: {modelo}_{grupo}_{componente}_profile
  profile_name: string;
  arn: string;
  group_name: string; // sdlc, production, development, etc.
  component: string;
  model: string; // Model ID de Bedrock (UN SOLO modelo)
  max_requests_per_day: number;
  max_tokens_per_request: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateActionProfileRequest {
  id: string;
  profile_name: string;
  arn: string;
  group_name: string;
  component: string;
  model: string;
  max_requests_per_day?: number;
  max_tokens_per_request?: number;
  description?: string;
  is_active?: boolean;
}

export interface UpdateActionProfileRequest {
  profile_name?: string;
  arn?: string;
  group_name?: string;
  component?: string;
  model?: string;
  max_requests_per_day?: number;
  max_tokens_per_request?: number;
  description?: string;
  is_active?: boolean;
}

// Token Model Permissions Types
export interface TokenModelPermission {
  permission_id: number;
  token_id: number;
  model_id: number;
  granted_at: string;
}

// Application Access Types
export interface Application {
  id: number;
  name: string;
  description: string | null;
  arn_prefix: string;
  created_at: string;
  updated_at: string;
  modules?: ApplicationModule[];
  // Nuevos campos agregados
  iam_identifier?: string;
  has_modules?: boolean;
  display_order?: number;
  url?: string | null;
  is_active?: boolean;
}

export interface ApplicationModule {
  id: number;
  application_id: number;
  name: string;
  description: string | null;
  arn_suffix: string;
  created_at: string;
  updated_at: string;
}

export interface UserApplicationPermission {
  permission_id: number;
  user_id: number;
  application_id: number | null;
  module_id: number | null;
  actions: string[]; // JSON array: ["custom:Access", "custom:Read", "custom:Write"]
  effect: 'Allow' | 'Deny';
  iam_policy_arn: string;
  iam_policy_name: string;
  assigned_at: string;
  assigned_by: number | null;
  application?: Application;
  module?: ApplicationModule;
}

export interface AssignPermissionRequest {
  user_id: number;
  application_id?: number;
  module_id?: number;
  actions: string[]; // ["custom:Access", "custom:Read", "custom:Write"]
  effect?: 'Allow' | 'Deny';
}

// Quota Usage Types
export interface QuotaUsage {
  quota_id: number;
  user_id: number;
  month: string; // Formato: YYYY-MM
  total_cost_usd: number;
  total_requests: number;
  last_updated: string;
}

// Request Metrics Types (tabla particionada)
export interface RequestMetric {
  metric_id: number;
  user_id: number;
  token_id: number | null;
  model_id: number | null;
  request_timestamp: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number | null;
  status_code: number;
  error_message: string | null;
}

// User Blocking Status Types
export interface UserBlockingStatus {
  blocking_id: number;
  user_id: number;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_until: string | null;
  blocked_reason: string | null;
  blocked_by: number | null;
  unblocked_at: string | null;
  unblocked_reason: string | null;
  unblocked_by: number | null;
  last_updated: string;
}

// Audit Log Types
export interface AuditLog {
  log_id: number;
  user_id: number | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null; // JSON
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
  user?: User;
}

export interface AuditLogFilter {
  user_id?: number;
  action?: string;
  resource_type?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

// Notification Types
export interface Notification {
  notification_id: number;
  user_id: number;
  type: string;
  subject: string;
  body: string;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

// Dashboard Statistics Types
export interface DashboardStats {
  total_users: number;
  active_users: number;
  blocked_users: number;
  total_tokens: number;
  active_tokens: number;
  expiring_soon_tokens: number;
  total_access_keys: number;
  total_applications: number;
  recent_activities: AuditLog[];
}

export interface UsageStats {
  user_id: number;
  iam_username: string;
  person: string;
  daily_requests: number;
  daily_request_limit: number;
  daily_cost_usd: number;
  daily_limit_usd: number;
  monthly_requests: number;
  monthly_cost_usd: number;
  monthly_quota_usd: number;
  usage_percentage: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Form Types
export interface FormErrors {
  [key: string]: string;
}

// Filter and Sort Types
export interface TableFilter {
  search?: string;
  status?: string;
  group?: string;
  provider?: string;
  team?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Notification Context Types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationMessage {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

// Cognito User Types
export type TeamType = string;  // Ahora es texto libre

export interface CognitoUser {
  email: string; // Primary key
  name: string;
  team: TeamType;
  id_interno: string; // Auto-generated (e.g., "sdlc0001")
  id_externo: string | null; // Optional IAM user email
  is_active: boolean;
  cognito_status: string; // CONFIRMED, FORCE_CHANGE_PASSWORD, etc.
  created_at: string;
  updated_at: string;
  created_by: string | null;
  permissions: string[]; // Cognito Groups/permissions assigned to user
}

export interface CreateCognitoUserRequest {
  email: string;
  name: string;
  team: TeamType;
  password: string;
  id_externo?: string; // Optional IAM user email
  permissions?: string[]; // Cognito Groups to assign
}

export interface UpdateCognitoUserRequest {
  name?: string;
  team?: TeamType;
  id_externo?: string;
  is_active?: boolean;
}

export interface CognitoUserFilter {
  team?: TeamType;
  is_active?: boolean;
}

// Auth Context Types (for future implementation)
export interface AuthUser {
  user_id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
}

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

// Cognito Login Types
export interface CognitoLoginRequest {
  email: string;
  password?: string;
  new_password?: string;
  session?: string;
}

export interface CognitoLoginResponse {
  success: boolean;
  message?: string;
  user?: {
    email: string;
    sub?: string;
    groups?: string[];
    email_verified?: boolean;
    requires_password_change?: boolean;
  };
  tokens?: {
    access_token: string;
    id_token: string;
    refresh_token: string;
    expires_in: number;
  };
  challenge?: string;
  session?: string;
  auth_type?: string;
  access_token?: string;  // Para compatibilidad con respuestas antiguas
  id_token?: string;
  refresh_token?: string;
}
