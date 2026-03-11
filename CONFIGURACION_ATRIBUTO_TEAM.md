# Configuración del Atributo Team en Cognito

## Problema Identificado

Los usuarios de Cognito necesitan tener el atributo `custom:Team` configurado con el valor correcto del equipo al que pertenecen. Este valor es diferente del grupo de Cognito al que pertenecen.

## Ejemplo

- **Usuario**: alvaro.pena@ibm.com
- **Grupo de Cognito**: capacity_planning_application
- **Atributo Team**: team_darwin_group ← Este es el valor que necesitamos

## Cambios Realizados

### 1. Creado nuevo atributo personalizado en Cognito

Se creó el atributo `custom:Team` en el User Pool:

```bash
aws cognito-idp add-custom-attributes \
  --user-pool-id eu-west-1_zrEOVk483 \
  --custom-attributes Name=Team,AttributeDataType=String,Mutable=true \
  --region eu-west-1
```

### 2. Actualizado código de la Lambda

Modificado `cognito_service.py` para buscar primero en `custom:Team`:

```python
# Extraer team del usuario (el atributo se llama 'custom:Team')
team = user_info.get('custom:Team') or user_info.get('custom:equipo') or user_info.get('custom:team') or user_info.get('Team') or user_info.get('team')
```

**Orden de búsqueda:**
1. `custom:Team` ← Prioridad principal
2. `custom:equipo` ← Fallback para usuarios antiguos
3. `custom:team` ← Fallback alternativo
4. `Team` ← Atributo estándar (si existe)
5. `team` ← Atributo estándar (si existe)

### 3. Actualizado usuario de prueba

```bash
aws cognito-idp admin-update-user-attributes \
  --user-pool-id eu-west-1_zrEOVk483 \
  --username alvaro.pena@ibm.com \
  --user-attributes Name=custom:Team,Value=team_darwin_group \
  --region eu-west-1
```

### 4. Desplegada Lambda actualizada

```
Function: auth-login-service
Status: Active
Last Update: 2026-02-26T15:07:40
```

## Atributos Personalizados Disponibles

El User Pool ahora tiene los siguientes atributos personalizados:

- `custom:id_externo` - ID externo del usuario
- `custom:id_interno` - ID interno del usuario
- `custom:equipo` - Equipo (antiguo, para compatibilidad)
- `custom:Team` - **Equipo del usuario (nuevo, prioritario)**

## Cómo Actualizar Usuarios

### Actualizar un usuario individual

```bash
aws cognito-idp admin-update-user-attributes \
  --user-pool-id eu-west-1_zrEOVk483 \
  --username <EMAIL_USUARIO> \
  --user-attributes Name=custom:Team,Value=<VALOR_TEAM> \
  --region eu-west-1
```

### Verificar el atributo de un usuario

```bash
aws cognito-idp admin-get-user \
  --user-pool-id eu-west-1_zrEOVk483 \
  --username <EMAIL_USUARIO> \
  --region eu-west-1 \
  --query 'UserAttributes[?Name==`custom:Team`]'
```

### Listar usuarios de un grupo

```bash
aws cognito-idp list-users-in-group \
  --user-pool-id eu-west-1_zrEOVk483 \
  --group-name capacity_planning_application \
  --region eu-west-1
```

## Mapeo de Grupos a Teams

Basándome en la información proporcionada:

| Grupo de Cognito | Valor de custom:Team |
|------------------|---------------------|
| capacity_planning_application | team_darwin_group |
| lcorp-ned-gen (atributo custom:equipo) | lcorp-ned-gen |
| ... | ... |

**NOTA**: Este mapeo debe ser completado con los valores correctos para cada grupo.

## Script para Actualizar Usuarios en Lote

Crear un archivo `update-team-attributes.sh`:

```bash
#!/bin/bash

USER_POOL_ID="eu-west-1_zrEOVk483"
REGION="eu-west-1"

# Función para actualizar un usuario
update_user() {
    local email=$1
    local team=$2
    
    echo "Actualizando $email con team=$team"
    aws cognito-idp admin-update-user-attributes \
        --user-pool-id $USER_POOL_ID \
        --username "$email" \
        --user-attributes Name=custom:Team,Value="$team" \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo "✓ $email actualizado correctamente"
    else
        echo "✗ Error actualizando $email"
    fi
}

# Actualizar usuarios del grupo capacity_planning_application
echo "=== Actualizando usuarios del grupo capacity_planning_application ==="
update_user "alvaro.pena@ibm.com" "team_darwin_group"
update_user "carlos.tamarit@viewnext.com" "team_darwin_group"

# Añadir más usuarios según sea necesario
# update_user "otro.usuario@example.com" "team_otro_grupo"

echo ""
echo "=== Actualización completada ==="
```

Ejecutar:

```bash
chmod +x update-team-attributes.sh
./update-team-attributes.sh
```

## Verificación

Después de actualizar los usuarios, verificar que el login funciona correctamente:

1. **Hacer login** en la aplicación con un usuario actualizado
2. **Abrir consola del navegador** y ejecutar:

```javascript
console.log('Team:', sessionStorage.getItem('user_team'));
```

3. **Verificar que aparece el valor correcto**, por ejemplo: `team_darwin_group`

## Flujo Completo

```
1. Usuario hace login
   ↓
2. Lambda auth-login-service autentica con Cognito
   ↓
3. Lambda obtiene atributos del usuario
   ↓
4. Lambda busca 'custom:Team' (prioritario)
   ↓
5. Si no existe, busca 'custom:equipo' (fallback)
   ↓
6. Si no existe, usa el primer grupo (último fallback)
   ↓
7. Lambda devuelve el team en la respuesta
   ↓
8. Frontend guarda en sessionStorage.user_team
   ↓
9. Aplicación usa el team para filtros y permisos
```

## Estado Actual

✅ Atributo `custom:Team` creado en User Pool  
✅ Lambda actualizada para buscar `custom:Team` primero  
✅ Usuario alvaro.pena@ibm.com actualizado con `team_darwin_group`  
✅ Lambda desplegada y funcionando  

## Próximos Pasos

1. **Identificar el mapeo completo** de grupos a teams
2. **Actualizar todos los usuarios** con el atributo `custom:Team` correcto
3. **Probar el login** con diferentes usuarios
4. **Verificar que los filtros y permisos** funcionan correctamente con el nuevo atributo

## Notas Importantes

- El atributo `custom:Team` (con T mayúscula) es ahora el atributo prioritario
- El atributo `custom:equipo` se mantiene como fallback para compatibilidad
- Si ningún atributo existe, se usa el primer grupo del usuario como último fallback
- Los grupos de Cognito (como `capacity_planning_application`) son diferentes del team del usuario
