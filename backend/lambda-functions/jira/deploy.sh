#!/bin/bash

# Script para desplegar la función Lambda de Jira
# Uso: ./deploy.sh

set -e

echo "🚀 Desplegando función Lambda de Jira..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Nombre de la función Lambda
FUNCTION_NAME="gestion-demanda-jira-handler"

# Verificar que estamos en el directorio correcto
if [ ! -f "jiraHandler.js" ]; then
    echo "❌ Error: Debes ejecutar este script desde el directorio backend/lambda-functions/jira"
    exit 1
fi

# Crear el paquete ZIP
echo -e "${YELLOW}📦 Creando paquete ZIP...${NC}"
zip -r function.zip . -x "*.git*" "deploy.sh" "*.md" "function.zip"

echo -e "${GREEN}✅ Paquete creado${NC}"
echo ""

# Desplegar a AWS Lambda
echo -e "${YELLOW}☁️  Desplegando a AWS Lambda...${NC}"
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip

echo ""
echo -e "${GREEN}✅ Función Lambda desplegada exitosamente${NC}"
echo ""

# Esperar a que la función esté actualizada
echo -e "${YELLOW}⏳ Esperando a que la función se actualice...${NC}"
aws lambda wait function-updated --function-name $FUNCTION_NAME

echo -e "${GREEN}✅ Función actualizada y lista${NC}"
echo ""

# Mostrar información de la función
echo -e "${YELLOW}ℹ️  Información de la función:${NC}"
aws lambda get-function --function-name $FUNCTION_NAME --query 'Configuration.[FunctionName,Runtime,LastModified,CodeSize]' --output table

echo ""
echo -e "${GREEN}🎉 Deployment completado exitosamente${NC}"