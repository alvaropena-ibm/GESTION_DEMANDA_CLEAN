# 👥 Equipos y Grupos - Mapeo de Cognito

## 📋 Equipos Disponibles

El sistema reconoce **3 equipos específicos** más un equipo especial para administradores:

| Equipo | Grupo Cognito | Team Code | Descripción |
|--------|---------------|-----------|-------------|
| **Darwin** | `lcs-sdlc-dar-group` | `DARWIN` | Equipo Darwin |
| **Mulesoft** | `lcs-sdlc-mule-group` | `MULESOFT` | Equipo Mulesoft |
| **SAP-ISU** | `lcs-sdlc-sisu-group` | `SAP-ISU` | Equipo SAP-ISU |
| **Todos** | Otros grupos | `ALL` | Ver todos los proyectos |

---

## 🔍 Lógica de Extracción del Team

### Reglas de Mapeo:

```javascript
// Grupo Cognito → Team Code

'lcs-sdlc-dar-group'   → 'DARWIN'
'lcs-sdlc-mule-group'  → 'MULESOFT'
'lcs-sdlc-sisu-group'  → 'SAP-ISU'
'global_admin'         → 'ALL'
'lcs-sdlc-gen-group'   → 'ALL'
Cualquier otro         → 'ALL'
```

### Algoritmo:

1. **Obtener el primer grupo** del usuario desde Cognito
2. **Convertir a minúsculas** para comparación
3. **Buscar coincidencias**:
   - Si contiene `'dar'` → Team: `DARWIN`
   - Si contiene `'mule'` → Team: `MULESOFT`
   - Si contiene `'sisu'` → Team: `SAP-ISU`
   - Si contiene `'admin'` o `'global'` → Team: `ALL`
   - **Si no coincide con ninguno** → Team: `ALL`

---

## 📊 Ejemplos de Mapeo

### Ejemplo 1: Usuario Darwin
```json
{
  "groups": ["lcs-sdlc-dar-group"],
  "team": "DARWIN"
}
```
**Resultado:** Ve solo proyectos del equipo Darwin

### Ejemplo 2: Usuario Mulesoft
```json
{
  "groups": ["lcs-sdlc-mule-group"],
  "team": "MULESOFT"
}
```
**Resultado:** Ve solo proyectos del equipo Mulesoft

### Ejemplo 3: Usuario SAP-ISU
```json
{
  "groups": ["lcs-sdlc-sisu-group"],
  "team": "SAP-ISU"
}
```
**Resultado:** Ve solo proyectos del equipo SAP-ISU

### Ejemplo 4: Administrador Global
```json
{
  "groups": ["global_admin"],
  "team": "ALL"
}
```
**Resultado:** Ve proyectos de todos los equipos

### Ejemplo 5: Usuario Genérico
```json
{
  "groups": ["lcs-sdlc-gen-group"],
  "team": "ALL"
}
```
**Resultado:** Ve proyectos de todos los equipos

### Ejemplo 6: Usuario con Grupo No Reconocido
```json
{
  "groups": ["some-other-group"],
  "team": "ALL"
}
```
**Resultado:** Ve proyectos de todos los equipos

---

## 🎯 Comportamiento del Sistema

### Filtrado de Proyectos:

| Team | Proyectos Visibles |
|------|-------------------|
| `DARWIN` | Solo proyectos con `team = 'DARWIN'` |
| `MULESOFT` | Solo proyectos con `team = 'MULESOFT'` |
| `SAP-ISU` | Solo proyectos con `team = 'SAP-ISU'` |
| `ALL` | **Todos los proyectos** de todos los equipos |

### Casos Especiales:

1. **Usuario sin grupos**: Team = `ALL`
2. **Usuario con múltiples grupos**: Se usa el primer grupo
3. **Administradores**: Siempre Team = `ALL`
4. **Grupos no reconocidos**: Team = `ALL` (por seguridad, mostrar todo)

---

## 🔧 Implementación en el Código

### En `authService.js`:

```javascript
// Extraer team del grupo
let team = 'ALL'; // Por defecto, mostrar todos los proyectos

if (groups.length > 0) {
    const firstGroup = groups[0].toLowerCase();
    
    // Mapeo de grupos a equipos
    if (firstGroup.includes('dar')) {
        team = 'DARWIN';
    } else if (firstGroup.includes('mule')) {
        team = 'MULESOFT';
    } else if (firstGroup.includes('sisu')) {
        team = 'SAP-ISU';
    } else if (firstGroup.includes('admin') || firstGroup.includes('global')) {
        team = 'ALL';
    }
    // Si no coincide con ninguno, team = 'ALL' (valor por defecto)
}

sessionStorage.setItem('user_team', team);
```

---

## 📝 Crear Usuarios de Prueba

### Usuario Darwin:
```bash
cd "cognito-auth-package new/lambda-auth-authorizer"
python3 -c "
import boto3
client = boto3.client('cognito-idp', region_name='eu-west-1')
username = 'darwin@example.com'
password = 'Darwin123!'

client.admin_create_user(
    UserPoolId='eu-west-1_zrEOVk483',
    Username=username,
    UserAttributes=[
        {'Name': 'email', 'Value': username},
        {'Name': 'email_verified', 'Value': 'true'}
    ],
    TemporaryPassword=password,
    MessageAction='SUPPRESS'
)

client.admin_set_user_password(
    UserPoolId='eu-west-1_zrEOVk483',
    Username=username,
    Password=password,
    Permanent=True
)

client.admin_add_user_to_group(
    UserPoolId='eu-west-1_zrEOVk483',
    Username=username,
    GroupName='lcs-sdlc-dar-group'
)

print(f'✅ Usuario Darwin creado: {username} / {password}')
"
```

### Usuario Mulesoft:
```bash
python3 -c "
import boto3
client = boto3.client('cognito-idp', region_name='eu-west-1')
username = 'mulesoft@example.com'
password = 'Mulesoft123!'

client.admin_create_user(
    UserPoolId='eu-west-1_zrEOVk483',
    Username=username,
    UserAttributes=[
        {'Name': 'email', 'Value': username},
        {'Name': 'email_verified', 'Value': 'true'}
    ],
    TemporaryPassword=password,
    MessageAction='SUPPRESS'
)

client.admin_set_user_password(
    UserPoolId='eu-west-1_zrEOVk483',
    Username=username,
    Password=password,
    Permanent=True
)

client.admin_add_user_to_group(
    UserPoolId='eu-west-1_zrEOVk483',
    Username=username,
    GroupName='lcs-sdlc-mule-group'
)

print(f'✅ Usuario Mulesoft creado: {username} / {password}')
"
```

### Usuario SAP-ISU:
```bash
python3 -c "
import boto3
client = boto3.client('cognito-idp', region_name='eu-west-1')
username = 'sapisu@example.com'
password = 'SapIsu123!'

client.admin_create_user(
    UserPoolId='eu-west-1_zrEOVk483',
    Username=username,
    UserAttributes=[
        {'Name': 'email', 'Value': username},
        {'Name': 'email_verified', 'Value': 'true'}
    ],
    TemporaryPassword=password,
    MessageAction='SUPPRESS'
)

client.admin_set_user_password(
    UserPoolId='eu-west-1_zrEOVk483',
    Username=username,
    Password=password,
    Permanent=True
)

client.admin_add_user_to_group(
    UserPoolId='eu-west-1_zrEOVk483',
    Username=username,
    GroupName='lcs-sdlc-sisu-group'
)

print(f'✅ Usuario SAP-ISU creado: {username} / {password}')
"
```

---

## ✅ Verificación

### Verificar Team en Consola:
```javascript
// Después del login
console.log('Team:', sessionStorage.getItem('user_team'));
console.log('Groups:', sessionStorage.getItem('cognito_groups'));
```

### Resultados Esperados:

| Usuario | Grupo | Team Esperado |
|---------|-------|---------------|
| darwin@example.com | lcs-sdlc-dar-group | DARWIN |
| mulesoft@example.com | lcs-sdlc-mule-group | MULESOFT |
| sapisu@example.com | lcs-sdlc-sisu-group | SAP-ISU |
| alvaro.pena@ibm.com | lcs-sdlc-gen-group | ALL |
| test-admin@example.com | global_admin | ALL |

---

## 🎯 Resumen

- ✅ **3 equipos específicos**: Darwin, Mulesoft, SAP-ISU
- ✅ **Team "ALL"** para administradores y usuarios genéricos
- ✅ **Filtrado automático** de proyectos según el team
- ✅ **Comportamiento por defecto**: Mostrar todos los proyectos si no se reconoce el grupo
- ✅ **Seguridad**: Usuarios sin grupo reconocido ven todos los proyectos (no se les bloquea el acceso)