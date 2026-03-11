import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Lock as LockIcon,
  Email as EmailIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  
  // Cognito login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Common state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isPasswordChangeRequired, setIsPasswordChangeRequired] = useState(false);
  const [passwordChangeSession, setPasswordChangeSession] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Check if already logged in
    if (sessionStorage.getItem('user_authenticated') === 'true') {
      navigate('/');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Por favor, introduce tu email y contraseña');
      return;
    }

    if (!email.includes('@')) {
      setError('Por favor, introduce un email válido');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.loginWithCognito({
        email,
        password,
      });

      // Check if password change is required
      if (response.user && response.user.requires_password_change) {
        setShowPasswordChange(true);
        setIsPasswordChangeRequired(true);
        setPasswordChangeSession((response as any).session || '');
        setError('');
        setLoading(false);
        return;
      }

      if (response.success) {
        // Verificar acceso a Identity Management
        const groups = JSON.parse(sessionStorage.getItem('cognito_groups') || '[]');
        const hasAccess = groups.includes('credentials_management_application');
        
        if (!hasAccess) {
          sessionStorage.clear();
          setError('❌ Acceso Denegado: Tu usuario no tiene permisos para acceder a Identity Management.');
          setLoading(false);
          return;
        }
        
        refreshAuth();
        setTimeout(() => navigate('/', { replace: true }), 100);
      } else {
        setError(response.message || 'Error de autenticación');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      let errorMessage = 'Error al iniciar sesión';
      
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMessage = detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      if (errorMessage.toLowerCase().includes('incorrectos') || 
          errorMessage.toLowerCase().includes('inválid') ||
          errorMessage.toLowerCase().includes('unauthorized')) {
        setPassword('');
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setError('');
    setLoading(true);
    
    try {
      const response = await authService.loginWithCognito({
        email,
        new_password: newPassword,
        session: passwordChangeSession
      });
      
      if (response.success) {
        setShowPasswordChange(false);
        setIsPasswordChangeRequired(false);
        setPasswordChangeSession('');
        setNewPassword('');
        setConfirmPassword('');
        setPassword('');
        setSuccessMessage('Contraseña actualizada correctamente. Por favor, inicia sesión con tu nueva contraseña.');
      } else {
        setError(response.message || 'Error al cambiar contraseña');
      }
    } catch (err: any) {
      console.error('Password change error:', err);
      let errorMessage = 'Error al cambiar contraseña';
      
      if (err.response?.data?.detail) {
        errorMessage = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail);
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      if (errorMessage.includes('Invalid code/session') || errorMessage.includes('session provided')) {
        setError('Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.');
        setShowPasswordChange(false);
        setPasswordChangeSession('');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2
      }}
    >
      <Container maxWidth="sm">
        <Card sx={{ borderRadius: 4, boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)' }}>
          {/* Header */}
          <Box
            sx={{
              background: 'linear-gradient(135deg, #319795 0%, #2c7a7b 100%)',
              color: 'white',
              padding: 4,
              textAlign: 'center'
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
              Gestión de Identidades
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Sistema de Gestión de Identidades y Credenciales AWS
            </Typography>
          </Box>

          {/* Content */}
          <CardContent sx={{ padding: 4 }}>
            {successMessage && (
              <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
                {successMessage}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            {!showPasswordChange ? (
              <>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                  Iniciar Sesión
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Introduce tu email y contraseña para acceder al sistema.
                </Typography>

                <Box component="form" onSubmit={handleLogin}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                    autoFocus
                    required
                    sx={{ mb: 2 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    type={showPassword ? 'text' : 'password'}
                    label="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    required
                    sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    sx={{
                      background: 'linear-gradient(135deg, #319795 0%, #2c7a7b 100%)',
                      borderRadius: 50,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 500,
                      boxShadow: '0 4px 15px rgba(49, 151, 149, 0.3)',
                    }}
                  >
                    {loading ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                        Autenticando...
                      </>
                    ) : (
                      <>
                        <EmailIcon sx={{ mr: 1 }} />
                        Iniciar Sesión
                      </>
                    )}
                  </Button>
                </Box>
              </>
            ) : (
              <Box>
                {isPasswordChangeRequired && (
                  <Alert severity="warning" sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      ⚠️ Cambio de Contraseña Requerido
                    </Typography>
                    <Typography variant="body2">
                      Tu contraseña actual es temporal. Por favor, cámbiala por una contraseña segura.
                    </Typography>
                  </Alert>
                )}

                <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
                  Cambiar Contraseña
                </Typography>

                <TextField
                  fullWidth
                  label="Email"
                  value={email}
                  disabled
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  type={showNewPassword ? 'text' : 'password'}
                  label="Nueva Contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end">
                          {showNewPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  type={showConfirmPassword ? 'text' : 'password'}
                  label="Confirmar Nueva Contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  sx={{ mb: 3 }}
                  error={confirmPassword !== '' && newPassword !== confirmPassword}
                  helperText={confirmPassword !== '' && newPassword !== confirmPassword ? 'Las contraseñas no coinciden' : ''}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  onClick={handlePasswordChange}
                  sx={{
                    background: 'linear-gradient(135deg, #319795 0%, #2c7a7b 100%)',
                    borderRadius: 50,
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    mb: 2
                  }}
                >
                  {loading ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                      Cambiando Contraseña...
                    </>
                  ) : (
                    <>
                      <LockIcon sx={{ mr: 1 }} />
                      Cambiar Contraseña
                    </>
                  )}
                </Button>

                <Button
                  fullWidth
                  variant="text"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setIsPasswordChangeRequired(false);
                    setPasswordChangeSession('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                  }}
                >
                  Cancelar
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Login;