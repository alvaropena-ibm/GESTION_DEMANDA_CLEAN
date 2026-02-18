#!/bin/bash

# Script para invalidar la caché de CloudFront
# Uso: ./invalidate-cloudfront.sh [DISTRIBUTION_ID]

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Invalidación de Caché de CloudFront ===${NC}\n"

# Verificar si se proporcionó el Distribution ID
if [ -z "$1" ]; then
    echo -e "${RED}Error: Debes proporcionar el CloudFront Distribution ID${NC}"
    echo "Uso: ./invalidate-cloudfront.sh DISTRIBUTION_ID"
    echo ""
    echo "Para encontrar tu Distribution ID:"
    echo "  aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName]' --output table"
    exit 1
fi

DISTRIBUTION_ID=$1

echo -e "${YELLOW}Distribution ID:${NC} $DISTRIBUTION_ID"
echo ""

# Crear invalidación para todos los archivos
echo -e "${YELLOW}Creando invalidación para todos los archivos...${NC}"

INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --output json 2>&1)

if [ $? -eq 0 ]; then
    INVALIDATION_ID=$(echo "$INVALIDATION_OUTPUT" | grep -o '"Id": "[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Invalidación creada exitosamente${NC}"
    echo -e "${YELLOW}Invalidation ID:${NC} $INVALIDATION_ID"
    echo ""
    echo -e "${YELLOW}Puedes verificar el estado con:${NC}"
    echo "  aws cloudfront get-invalidation --distribution-id $DISTRIBUTION_ID --id $INVALIDATION_ID"
    echo ""
    echo -e "${GREEN}La invalidación puede tardar varios minutos en completarse.${NC}"
else
    echo -e "${RED}✗ Error al crear la invalidación:${NC}"
    echo "$INVALIDATION_OUTPUT"
    exit 1
fi

# Invalidación específica para archivos críticos
echo ""
echo -e "${YELLOW}Creando invalidación específica para archivos críticos...${NC}"

CRITICAL_PATHS=(
    "/html/index-modular.html"
    "/css/tables.css"
    "/js/components/calendarView.js"
    "/js/components/resourceCapacity.js"
    "/js/main.js"
)

for path in "${CRITICAL_PATHS[@]}"; do
    echo "  - $path"
done

CRITICAL_INVALIDATION=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "${CRITICAL_PATHS[@]}" \
    --output json 2>&1)

if [ $? -eq 0 ]; then
    CRITICAL_ID=$(echo "$CRITICAL_INVALIDATION" | grep -o '"Id": "[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Invalidación de archivos críticos creada${NC}"
    echo -e "${YELLOW}Invalidation ID:${NC} $CRITICAL_ID"
else
    echo -e "${YELLOW}⚠ No se pudo crear invalidación específica (puede que ya exista una en proceso)${NC}"
fi

echo ""
echo -e "${GREEN}=== Proceso completado ===${NC}"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo "1. Espera 5-10 minutos para que la invalidación se complete"
echo "2. Limpia la caché de tu navegador (Ctrl+Shift+R o Cmd+Shift+R)"
echo "3. Accede a la aplicación con: https://tu-dominio.cloudfront.net/html/clear_cache.html"
echo "4. Haz clic en 'Limpiar Caché y Recargar'"
echo ""