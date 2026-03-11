# 🚀 Guía Rápida - Configuración Login con Cognito

## ✅ Resumen de Cambios

El sistema de autenticación ahora apunta a la función Lambda `login-authorization-service` correctamente.

## 📋 Pasos para Activar el Nuevo Login

### 1. Configurar API Gateway (Automático)

```bash
# Dar permisos de ejecución al script
chmod +x configure-cognito-login.sh

# Ejecutar configuración automática
./configure-cognito-login.sh
```

**El script hace:**
- ✅ Crea el recurso `/auth/login` en API Gateway
- ✅ Configura el método POST
- ✅ Conecta con la Lambda `login-authorization-service`
- ✅ Configura CORS (OPTIONS)
- ✅ Despliega la API

### 2. Actualizar Configuración del Frontend

Editar `frontend/js/config/data.js`:

```javascript
export const API_CONFIG = {
    BASE_URL: 'https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod',
    
    // AÑADIR ESTA LÍNEA:
    AUTH_API_URL: 'https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/auth',
    
    // ... resto de configuración
};
```

### 3. Crear Usuario de Prueba en Cognito

```bash
cd "cognito-auth-package new/lambda-auth-authorizer"
python create_test_user.py
```

Cuando te pregunte, introduce:
- **Email:** tu-email@naturgy.com
- **Password:** TempPassword123!
- **Team:** LCS (o el equipo que corresponda)

### 4. Probar el Login

1. Abrir `frontend/html/login-new.html` en el navegador
2. Seleccionar tab "Email / Password"
3. Introducir las credenciales del usuario de prueba
4. Si es la primera vez, te pedirá cambiar la contraseña
5. Después del cambio, deberías ser redirigido a la aplicación

### 5. Activar el Nuevo Login (Cuando esté probado)

```bash
cd frontend/html

# Hacer backup del login antiguo
mv login.html login-old.html

# Activar el nuevo login
mv login-new.html login.html
```

## 🔍 Verificación

### Verificar que la Lambda existe:

```bash
aws lambda get-function \
    --function-name login-authorization-service \
    --region eu-west-1
```

### Verificar el endpoint en API Gateway:

```bash
# Obtener API ID
API_ID=$(aws apigateway get-rest-apis \
    --region eu-west-1 \
    --query "items[?name=='gestion-demanda-api'].id" \
    --output text)

# Ver recursos
aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region eu-west-1 \
    --query "items[?path=='/auth/login']"
```

### Probar el endpoint manualmente:

```bash
curl -X POST \
  https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@naturgy.com",
    "password": "YourPassword123!"
  }'
```

## 🐛 Troubleshooting

### Error: "Lambda not found"

La Lambda `login-authorization-service` no está desplegada. Desplegarla:

```bash
cd "cognito-auth-package new/lambda-auth-login"
python deploy_simple.py
```

### Error: "CORS policy"

Ejecutar de nuevo el script de configuración:

```bash
./configure-cognito-login.sh
```

### Error: "Invalid credentials"

Verificar que el usuario existe en Cognito:

```bash
cd "cognito-auth-package new/lambda-auth-authorizer"
python list_users.py
```

### El login no redirige a la aplicación

Verificar en la consola del navegador (F12):
1. Que el request a `/auth/login` es exitoso (200)
2. Que se almacenan los tokens en sessionStorage
3. Que `user_team` tiene un valor

## 📊 Estructura de la Respuesta

La Lambda devuelve:

```json
{
  "success": true,
  "auth_type": "cognito",
  "user": {
    "email": "user@naturgy.com",
    "sub": "uuid-del-usuario",
    "groups": ["LCS"],
    "team": "LCS",
    "requires_password_change": false
  },
  "tokens": {
    "access_token": "eyJhbGc...",
    "id_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "expires_in": 3600
  }
}
```

## 🔐 Seguridad

- ✅ Tokens JWT validados por Cognito
- ✅ Tokens almacenados en sessionStorage (no localStorage)
- ✅ Tokens expiran en 1 hora
- ✅ Refresh token para renovar sesión
- ✅ HTTPS obligatorio
- ✅ CORS configurado correctamente

## 📝 Notas Importantes

1. **NO eliminar** `login.html` hasta verificar que el nuevo funciona
2. El sistema mantiene compatibilidad con IAM (Access Keys)
3. Los usuarios deben tener el atributo `custom:team` en Cognito
4. La primera vez que un usuario hace login, debe cambiar su contraseña

## 🎯 Checklist de Activación

- [ ] Ejecutar `configure-cognito-login.sh`
- [ ] Actualizar `frontend/js/config/data.js`
- [ ] Crear usuario de prueba
- [ ] Probar login en `login-new.html`
- [ ] Verificar redirección a la aplicación
- [ ] Verificar que se cargan los datos correctamente
- [ ] Activar `login-new.html` como `login.html`

---

**Última actualización:** 09/03/2026  
**Versión:** 1.0