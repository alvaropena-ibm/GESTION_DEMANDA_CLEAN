# Corrección de claimModal.js para Cognito

## Funciones que necesitan corrección:

1. ✅ `loadProjectsForClaim()` - CORREGIDA
2. ⚠️ `loadModulesForClaim()` - Línea 118
3. ⚠️ `loadTasksForProject()` - Línea 177
4. ⚠️ `saveClaim()` - Línea 367
5. ⚠️ `loadTimeEntries()` - Línea 428
6. ⚠️ `editTimeEntry()` - Línea 756
7. ⚠️ `deleteTimeEntry()` - Línea 806

## Patrón de corrección:

```javascript
// ANTES:
const awsAccessKey = sessionStorage.getItem('aws_access_key');

// DESPUÉS:
const authType = sessionStorage.getItem('auth_type');
let awsAccessKey;

if (authType === 'cognito') {
    awsAccessKey = sessionStorage.getItem('cognito_access_token');
} else {
    awsAccessKey = sessionStorage.getItem('aws_access_key');
}

// Y en headers:
'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey
```

## Estado:
- Solo se corrigió `loadProjectsForClaim()`
- Faltan 6 funciones más por corregir

## Recomendación:
Debido a la cantidad de cambios necesarios, sería más eficiente reescribir el archivo completo con todas las correcciones aplicadas.