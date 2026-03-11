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
    echo ""
}

echo "=========================================="
echo "  ACTUALIZACIÓN DE ATRIBUTO custom:Team"
echo "=========================================="
echo ""

# Actualizar usuarios del grupo capacity_planning_application (team darwin)
echo "=== Grupo: capacity_planning_application → Team: team_darwin_group ==="
update_user "alvaro.pena@ibm.com" "team_darwin_group"
update_user "carlos.tamarit@viewnext.com" "team_darwin_group"

# Añadir más usuarios según sea necesario
# Ejemplo:
# echo "=== Grupo: otro_grupo → Team: team_otro ==="
# update_user "usuario1@example.com" "team_otro"
# update_user "usuario2@example.com" "team_otro"

echo "=========================================="
echo "  ✅ ACTUALIZACIÓN COMPLETADA"
echo "=========================================="
echo ""
echo "Para verificar un usuario:"
echo "aws cognito-idp admin-get-user --user-pool-id $USER_POOL_ID --username <EMAIL> --region $REGION --query 'UserAttributes[?Name==\`custom:Team\`]'"
