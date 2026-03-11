# 🚀 GUÍA DE DESPLIEGUE - AUTENTICACIÓN COGNITO

## ✅ Estado Actual

Las Lambda Functions ya están desplegadas:
- ✅ `auth-login-service` - Lambda de login
- ✅ `lambda-auth-authorizer` - Lambda authorizer

**Configuración verificada**:
- User Pool ID: `eu-west-1_zrEOVk483`
- Client ID: `1kp54ebtb2npa4eukpbp1tn1ff`
- Región: `eu-west-1`

---

## 📋 PASOS PARA COMPLETAR LA INTEGRACIÓN

### PASO 1: Verificar/Crear API Gateway

#### Opción A: Usar API Gateway Existente

Si ya tienes un API Gateway para la aplicación:

```bash
# Listar APIs
aws apigateway get-rest-apis --region eu-west-1

# Buscar el API ID de tu aplicación
# Ejemplo: xrqo2gedpl (el que está en API_CONFIG.BASE_URL)
```

#### Opción B: Crear Nuevo API Gateway para Auth

```bash
# Crear API
aws apigateway create-rest-api \
  --name "capacity-planning-auth-api" \
  --description "API de autenticación para Capacity Planning" \
  --region eu-west-1
```

---

### PASO 2: Configurar Endpoint /auth/login (Público)

Este endpoint NO debe tener Lambda Authorizer (es público).

#### 2.1 Crear recurso /auth

```bash
# Obtener root resource ID
aws apigateway get-resources \
  --rest-api-id [TU-API-ID] \
  --region eu-west-1

# Crear recurso /auth
aws apigateway create-resource \
  --rest-api-id [TU-API-ID] \
  --parent-id [ROOT-RESOURCE-ID] \
  --path-part "auth" \
  --region eu-west-1
```

#### 2.2 Crear recurso /auth/login

```bash
aws apigateway create-resource \
  --rest-api-id [TU-API-ID] \
  --parent-id [AUTH-RESOURCE-ID] \
  --path-part "login" \
  --region eu-west-1
```

#### 2.3 Crear método POST en /auth/login

```bash
# Crear método POST
aws apigateway put-method \
  --rest-api-id [TU-API-ID] \
  --resource-id [LOGIN-RESOURCE-ID] \
  --http-method POST \
  --authorization-type NONE \
  --region eu-west-1

# Integrar con Lambda auth-login-service
aws apigateway put-integration \
  --rest-api-id [TU-API-ID] \
  --resource-id [LOGIN-RESOURCE-ID] \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:eu-west-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-1:[ACCOUNT-ID]:function:auth-login-service/invocations" \
  --region eu-west-1
```

#### 2.4 Dar permisos a API Gateway para invocar Lambda

```bash
aws lambda add-permission \
  --function-name auth-login-service \
  --statement-id apigateway-auth-login \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:eu-west-1:[ACCOUNT-ID]:[API-ID]/*/*/auth/login" \
  --region eu-west-1
```

#### 2.5 Configurar CORS para /auth/login

```bash
# Crear método OPTIONS
aws apigateway put-method \
  --rest-api-id [TU-API-ID] \
  --resource-id [LOGIN-RESOURCE-ID] \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region eu-west-1

# Configurar respuesta CORS
aws apigateway put-method-response \
  --rest-api-id [TU-API-ID] \
  --resource-id [LOGIN-RESOURCE-ID] \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
  --region eu-west-1

# Configurar integración MOCK
aws apigateway put-integration \
  --rest-api-id [TU-API-ID] \
  --resource-id [LOGIN-RESOURCE-ID] \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region eu-west-1

# Configurar respuesta de integración
aws apigateway put-integration-response \
  --rest-api-id [TU-API-ID] \
  --resource-id [LOGIN-RESOURCE-ID] \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,Authorization'\''","method.response.header.Access-Control-Allow-Methods":"'\''POST,OPTIONS'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}'  \
  --region eu-west-1
```

---

### PASO 3: Configurar Lambda Authorizer

#### 3.1 Crear Lambda Authorizer en API Gateway

```bash
aws apigateway create-authorizer \
  --rest-api-id [TU-API-ID] \
  --name "cognito-jwt-authorizer" \
  --type TOKEN \
  --authorizer-uri "arn:aws:apigateway:eu-west-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-1:[ACCOUNT-ID]:function:lambda-auth-authorizer/invocations" \
  --identity-source "method.request.header.Authorization" \
  --authorizer-result-ttl-in-seconds 300 \
  --region eu-west-1
```

#### 3.2 Dar permisos a API Gateway para invocar Lambda Authorizer

```bash
aws lambda add-permission \
  --function-name lambda-auth-authorizer \
  --statement-id apigateway-authorizer \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:eu-west-1:[ACCOUNT-ID]:[API-ID]/authorizers/*" \
  --region eu-west-1
```

#### 3.3 Aplicar Authorizer a endpoints /api/*

Para cada endpoint existente (projects, resources, assignments, etc.):

```bash
# Ejemplo para /projects
aws apigateway update-method \
  --rest-api-id [TU-API-ID] \
  --resource-id [PROJECTS-RESOURCE-ID] \
  --http-method GET \
  --patch-operations op=replace,path=/authorizationType,value=CUSTOM \
  --region eu-west-1

aws apigateway update-method \
  --rest-api-id [TU-API-ID] \
  --resource-id [PROJECTS-RESOURCE-ID] \
  --http-method GET \
  --patch-operations op=replace,path=/authorizerId,value=[AUTHORIZER-ID] \
  --region eu-west-1
```

---

### PASO 4: Desplegar API Gateway

```bash
aws apigateway create-deployment \
  --rest-api-id [TU-API-ID] \
  --stage-name prod \
  --description "Deploy with Cognito authentication" \
  --region eu-west-1
```

---

### PASO 5: Obtener URL del API

```bash
# La URL será:
https://[TU-API-ID].execute-api.eu-west-1.amazonaws.com/prod
```

---

### PASO 6: Actualizar Configuración Frontend

Editar `frontend/js/config/data.js`:

```javascript
export const API_CONFIG = {
    BASE_URL: 'https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod',
    // Actualizar con el API ID real:
    AUTH_API_URL: 'https://[TU-API-ID].execute-api.eu-west-1.amazonaws.com/prod/auth',
    IAM_AUTH_URL: 'https://lupjqx01jf.execute-api.eu-west-1.amazonaws.com/prod/auth/login',
    // ...
};
```

---

### PASO 7: Crear Usuarios de Prueba en Cognito

```bash
cd cognito-auth-package/lambda-auth-authorizer

# Crear usuario
python create_test_user.py
```

O manualmente:

```bash
# Crear usuario
aws cognito-idp admin-create-user \
  --user-pool-id eu-west-1_zrEOVk483 \
  --username test@naturgy.com \
  --user-attributes Name=email,Value=test@naturgy.com Name=email_verified,Value=true \
  --temporary-password "TempPassword123!" \
  --region eu-west-1

# Añadir usuario a grupo
aws cognito-idp admin-add-user-to-group \
  --user-pool-id eu-west-1_zrEOVk483 \
  --username test@naturgy.com \
  --group-name gadea \
  --region eu-west-1
```

---

### PASO 8: Activar Nuevo Login

```bash
cd frontend/html
mv login.html login-old.html
mv login-new.html login.html
```

---

### PASO 9: Probar el Login

1. Abrir `http://localhost:8000/login.html`
2. Seleccionar tab "Email / Password"
3. Introducir credenciales de prueba
4. Si es primera vez, cambiar contraseña
5. Verificar redirección a dashboard

---

## 🧪 TESTING

### Test 1: Login con Cognito

```bash
# Test directo a Lambda
aws lambda invoke \
  --function-name auth-login-service \
  --payload '{"body":"{\"email\":\"test@naturgy.com\",\"password\":\"YourPassword123!\"}"}' \
  --region eu-west-1 \
  response.json

cat response.json
```

### Test 2: Endpoint API Gateway

```bash
curl -X POST \
  https://[TU-API-ID].execute-api.eu-west-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@naturgy.com","password":"YourPassword123!"}'
```

### Test 3: Authorizer

```bash
# Obtener token del login anterior
TOKEN="eyJhbGc..."

# Probar endpoint protegido
curl -X GET \
  https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/projects \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📝 CHECKLIST DE DESPLIEGUE

- [ ] Verificar Lambdas desplegadas
- [ ] Crear/verificar API Gateway
- [ ] Configurar endpoint /auth/login (público)
- [ ] Configurar CORS en /auth/login
- [ ] Crear Lambda Authorizer
- [ ] Aplicar Authorizer a endpoints /api/*
- [ ] Desplegar API Gateway
- [ ] Obtener URL del API
- [ ] Actualizar AUTH_API_URL en frontend
- [ ] Crear usuarios de prueba
- [ ] Activar nuevo login.html
- [ ] Probar login con Cognito
- [ ] Probar login con IAM (compatibilidad)
- [ ] Verificar refresh de tokens
- [ ] Verificar autorización por grupos

---

## 🔧 TROUBLESHOOTING

### Error: "Signature expired"
```bash
# Renovar credenciales AWS
aws configure
```

### Error: "Access Denied"
```bash
# Verificar permisos del usuario IAM
aws iam get-user
```

### Error: "Invalid token"
```bash
# Verificar configuración de Cognito en Lambda
aws lambda get-function-configuration \
  --function-name auth-login-service \
  --region eu-west-1
```

### Error: "CORS"
```bash
# Verificar configuración CORS en API Gateway
# Asegurarse de que OPTIONS está configurado
```

---

## 📚 RECURSOS

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [API Gateway Lambda Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)
- [JWT Tokens](https://jwt.io/)

---

**Última actualización**: Fase 1 en progreso
**Estado**: Lambdas desplegadas ✅ - Pendiente configuración API Gateway
