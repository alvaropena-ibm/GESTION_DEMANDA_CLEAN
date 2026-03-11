# 🎯 SIGUIENTE PASO - CONFIGURACIÓN API GATEWAY

## ✅ Lo que hemos completado

Has completado exitosamente las **Fases 2 y 3** de la integración de AWS Cognito:

- ✅ Servicio de autenticación (`authService.js`)
- ✅ Interceptor de API (`api.js`)
- ✅ Página de login dual (`login-new.html`)
- ✅ Estilos completos (`login-styles.css`)
- ✅ Lógica de login (`login.js`)
- ✅ Lambda Functions verificadas en AWS

**Total**: ~1,900 líneas de código + documentación completa

---

## 🚀 OPCIÓN 1: Configuración Rápida (Recomendada)

### Paso 1: Ejecutar script de configuración

```bash
python3 configure-api-gateway.py
```

Este script te ayudará a:
- Listar tus APIs de API Gateway
- Seleccionar el API correcto
- Obtener el API ID
- Generar la configuración

### Paso 2: Actualizar frontend

Edita `frontend/js/config/data.js`:

```javascript
export const API_CONFIG = {
    BASE_URL: 'https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod',
    // Actualizar con el API ID del paso anterior:
    AUTH_API_URL: 'https://[TU-API-ID].execute-api.eu-west-1.amazonaws.com/prod/auth',
    // ...
};
```

### Paso 3: Configurar API Gateway manualmente

Sigue la guía detallada en `GUIA_DESPLIEGUE_COGNITO.md` para:
- Crear recurso `/auth/login`
- Integrar con Lambda `auth-login-service`
- Configurar CORS
- Crear Lambda Authorizer
- Aplicar Authorizer a endpoints `/api/*`

### Paso 4: Crear usuario de prueba

```bash
aws cognito-idp admin-create-user \
  --user-pool-id eu-west-1_zrEOVk483 \
  --username test@naturgy.com \
  --user-attributes Name=email,Value=test@naturgy.com Name=email_verified,Value=true \
  --temporary-password "TempPassword123!" \
  --region eu-west-1

aws cognito-idp admin-add-user-to-group \
  --user-pool-id eu-west-1_zrEOVk483 \
  --username test@naturgy.com \
  --group-name gadea \
  --region eu-west-1
```

### Paso 5: Activar nuevo login

```bash
cd frontend/html
mv login.html login-old.html
mv login-new.html login.html
```

### Paso 6: Probar

```bash
# Iniciar servidor local
cd frontend/html
python3 -m http.server 8000

# Abrir en navegador
open http://localhost:8000/login.html
```

---

## 🔧 OPCIÓN 2: Configuración Manual Completa

Si prefieres hacerlo todo manualmente, sigue la guía completa:

📖 **Ver**: `GUIA_DESPLIEGUE_COGNITO.md`

Esta guía incluye:
- Comandos AWS CLI completos
- Configuración paso a paso
- Troubleshooting
- Testing

---

## 📚 DOCUMENTACIÓN DISPONIBLE

1. **`GUIA_DESPLIEGUE_COGNITO.md`** - Guía completa de despliegue
2. **`RESUMEN_FINAL_INTEGRACION.md`** - Resumen de todo lo completado
3. **`COGNITO_INTEGRATION_PROGRESS.md`** - Progreso general
4. **`FASE_3_COMPLETADA.md`** - Detalles de la Fase 3

---

## 🧪 TESTING RÁPIDO

Una vez configurado, prueba:

### Test 1: Login con Cognito
```
1. Abrir http://localhost:8000/login.html
2. Tab "Email / Password"
3. Email: test@naturgy.com
4. Password: TempPassword123!
5. Cambiar contraseña cuando se solicite
6. Verificar redirección a dashboard
```

### Test 2: API Call
```javascript
// En la consola del navegador (después de login)
fetch('https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/projects', {
    headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('cognito_access_token')}`
    }
})
.then(r => r.json())
.then(console.log)
```

---

## ⚠️ IMPORTANTE

### Antes de ir a producción:

1. ✅ Probar login con Cognito
2. ✅ Probar login con IAM (compatibilidad)
3. ✅ Verificar refresh de tokens
4. ✅ Verificar autorización por grupos
5. ✅ Probar todos los endpoints de API
6. ✅ Verificar CORS
7. ✅ Revisar logs de CloudWatch
8. ✅ Crear usuarios de producción
9. ✅ Documentar proceso de migración

---

## 🆘 AYUDA

### Si algo no funciona:

1. **Verificar Lambdas**:
   ```bash
   aws lambda list-functions --region eu-west-1 | grep auth
   ```

2. **Ver logs de Lambda**:
   ```bash
   aws logs tail /aws/lambda/auth-login-service --follow --region eu-west-1
   ```

3. **Verificar Cognito**:
   ```bash
   aws cognito-idp list-users --user-pool-id eu-west-1_zrEOVk483 --region eu-west-1
   ```

4. **Consultar documentación**:
   - Ver `GUIA_DESPLIEGUE_COGNITO.md` sección Troubleshooting

---

## 📞 CONTACTO

Si necesitas ayuda adicional:
- Revisa la documentación generada
- Consulta los logs de CloudWatch
- Verifica la configuración de Cognito

---

**¡Estás a solo unos pasos de completar la integración!** 🎉

El trabajo más difícil (desarrollo del frontend) ya está hecho.
Solo falta la configuración de infraestructura.

**Tiempo estimado restante**: 1-2 horas
