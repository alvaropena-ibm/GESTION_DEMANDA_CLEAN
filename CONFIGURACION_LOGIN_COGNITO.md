# Configuración del Login con Cognito

## Cambios Realizados

Se ha actualizado el sistema de autenticación para usar la función Lambda `login-authorization-service` correctamente.

## Archivos Modificados

### 1. `frontend/js/services/authService.js`

**Cambios principales:**

1. **URL de autenticación actualizada:**
   ```javascript
   this.AUTH_API_URL = 'https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/auth/login';
   ```

2. **Formato de request actualizado:**
   - Cambio de `email` a `username`
   - Cambio de `password` a `password`
   - Soporte para `newPasswordRequired` en cambio de contraseña

3. **Manejo de respuesta mejorado:**
   - Soporte para formato de respuesta de AWS Cognito (PascalCase)
   - Extracción de `custom:team` del token
   - Manejo de grupos de Cognito

4. **Headers de autenticación:**
   - Añadido automáticamente el header `x-user-team` cuando está disponible
   - Soporte para autenticación Bearer con JWT

## Estructura de la Respuesta de Login

La función Lambda `login-authorization-service` devuelve:

```json
{
  "IdToken": "eyJhbGc...",
  "AccessToken": "eyJhbGc...",
  "RefreshToken": "eyJhbGc...",
  "ExpiresIn": 3600
}
```

O en caso de requerir cambio de contraseña:

```json
{
  "ChallengeName": "NEW_PASSWORD_REQUIRED",
  "Session": "session-token..."
}
```

## Flujo de Autenticación

### 1. Login Normal

```
Usuario → login-new.html → authService.loginWithCognito()
    ↓
POST /auth/login
    {
      "username": "user@example.com",
      "password": "password123"
    }
    ↓
Lambda: login-authorization-service
    ↓
Cognito User Pool
    ↓
Respuesta con tokens JWT
    ↓
sessionStorage:
    - auth_type: 'cognito'
    - id_token: JWT
    - access_token: JWT
    - refresh_token: JWT
    - user_email: email del usuario
    - user_team: custom:team del token
    - cognito_groups: grupos del usuario
    ↓
Redirección a index-modular.html
```

### 2. Cambio de Contraseña Requerido

```
Usuario → login-new.html → authService.loginWithCognito()
    ↓
POST /auth/login
    ↓
Respuesta: ChallengeName = "NEW_PASSWORD_REQUIRED"
    ↓
Modal de cambio de contraseña
    ↓
authService.changePassword()
    ↓
POST /auth/login
    {
      "username": "user@example.com",
      "password": "newPassword123",
      "session": "session-token",
      "newPasswordRequired": true
    }
    ↓
Login exitoso con nueva contraseña
```

## Configuración Requerida en AWS

### 1. API Gateway

Debe tener configurado el endpoint:
- **Path:** `/auth/login`
- **Método:** POST
- **Lambda:** `login-authorization-service`
- **CORS:** Habilitado

### 2. Lambda Function: login-authorization-service

Debe estar configurada con:
- **Runtime:** Python 3.x
- **Variables de entorno:**
  - `USER_POOL_ID`: ID del User Pool de Cognito
  - `CLIENT_ID`: ID del App Client de Cognito
  - `REGION`: eu-west-1

### 3. Cognito User Pool

Debe tener:
- **Custom attributes:**
  - `custom:team` (String) - Para identificar el equipo del usuario
- **App Client:**
  - Auth flows habilitados: USER_PASSWORD_AUTH
  - Sin secret (para aplicaciones web públicas)

## Testing

### 1. Verificar URL de la Lambda

```bash
# Obtener la URL del endpoint
aws apigateway get-rest-apis --region eu-west-1

# Verificar que existe el recurso /auth/login
aws apigateway get-resources --rest-api-id [API-ID] --region eu-west-1
```

### 2. Test Manual

1. Abrir `login-new.html` en el navegador
2. Seleccionar tab "Email / Password"
3. Introducir credenciales de un usuario de prueba
4. Verificar en la consola del navegador:
   - Request a `/auth/login`
   - Respuesta con tokens
   - Almacenamiento en sessionStorage
   - Redirección a index-modular.html

### 3. Verificar Tokens

En la consola del navegador:
```javascript
// Ver tokens almacenados
console.log('ID Token:', sessionStorage.getItem('id_token'));
console.log('Access Token:', sessionStorage.getItem('access_token'));
console.log('User Team:', sessionStorage.getItem('user_team'));
console.log('Groups:', sessionStorage.getItem('cognito_groups'));
```

## Troubleshooting

### Error: "CORS policy"
- Verificar que CORS está habilitado en API Gateway
- Verificar que la Lambda devuelve headers CORS correctos

### Error: "Invalid credentials"
- Verificar que el usuario existe en Cognito
- Verificar que la contraseña es correcta
- Verificar que el App Client ID es correcto

### Error: "Token expired"
- El token JWT expira en 1 hora
- Implementar refresh token automático

### No se extrae el team
- Verificar que el usuario tiene el atributo `custom:team` configurado
- Verificar que el atributo está incluido en el ID token

## Próximos Pasos

1. ✅ Actualizar authService.js con nueva URL y formato
2. ⏳ Desplegar cambios en el frontend
3. ⏳ Crear usuarios de prueba en Cognito con `custom:team`
4. ⏳ Probar login completo
5. ⏳ Activar login-new.html como login principal

## Notas Importantes

- **NO eliminar** `login.html` hasta verificar que `login-new.html` funciona correctamente
- El sistema mantiene compatibilidad con autenticación IAM (Access Keys)
- Los tokens se almacenan en `sessionStorage` (se borran al cerrar el navegador)
- El refresh token permite renovar la sesión sin volver a hacer login

## Contacto

Para dudas sobre la configuración de Cognito o la Lambda, contactar con el equipo de desarrollo.

---

**Última actualización:** 09/03/2026
**Versión:** 1.0