#!/bin/bash

# Script para desplegar las lambdas actualizadas después de la migración a jira_tasks
# Fecha: 2026-03-13
# Fase 2: Backend - Despliegue

set -e  # Exit on error

echo "=========================================="
echo "  DESPLIEGUE DE LAMBDAS ACTUALIZADAS"
echo "  Migración a jira_tasks - Fase 2"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to deploy a lambda
deploy_lambda() {
    local lambda_name=$1
    local lambda_dir=$2
    local function_name=$3
    
    echo -e "${BLUE}📦 Desplegando ${lambda_name}...${NC}"
    echo "   Directorio: ${lambda_dir}"
    echo "   Función: ${function_name}"
    echo ""
    
    # Navigate to lambda directory
    cd "${lambda_dir}"
    
    # Install dependencies if package.json exists
    if [ -f "package.json" ]; then
        echo "   📥 Instalando dependencias..."
        npm install --production > /dev/null 2>&1
        echo -e "   ${GREEN}✓${NC} Dependencias instaladas"
    fi
    
    # Create deployment package
    echo "   📦 Creando paquete de despliegue..."
    zip -r function.zip . -x "*.git*" "node_modules/.cache/*" > /dev/null 2>&1
    echo -e "   ${GREEN}✓${NC} Paquete creado: function.zip"
    
    # Get zip file size
    local zip_size=$(du -h function.zip | cut -f1)
    echo "   📊 Tamaño del paquete: ${zip_size}"
    
    # Deploy to AWS Lambda
    echo "   ☁️  Desplegando a AWS Lambda..."
    aws lambda update-function-code \
        --function-name "${function_name}" \
        --zip-file fileb://function.zip \
        --no-cli-pager > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} Lambda desplegada exitosamente"
    else
        echo -e "   ${RED}✗${NC} Error al desplegar lambda"
        return 1
    fi
    
    # Clean up
    rm function.zip
    echo -e "   ${GREEN}✓${NC} Limpieza completada"
    echo ""
    
    # Return to root directory
    cd - > /dev/null
}

# Start deployment
echo -e "${YELLOW}Iniciando despliegue de 3 lambdas...${NC}"
echo ""

# Counter for successful deployments
SUCCESS_COUNT=0
TOTAL_COUNT=3

# 1. Deploy assignmentsHandler
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1/3 - ASSIGNMENTS HANDLER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if deploy_lambda "assignmentsHandler" \
    "backend/lambda-functions/assignments" \
    "gestiondemanda_assignmentsHandler"; then
    ((SUCCESS_COUNT++))
fi

# 2. Deploy conceptTasksHandler
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2/3 - CONCEPT TASKS HANDLER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if deploy_lambda "conceptTasksHandler" \
    "backend/lambda-functions/concept-tasks" \
    "gestiondemanda_conceptTasksHandler"; then
    ((SUCCESS_COUNT++))
fi

# 3. Deploy jiraTasksHandler
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3/3 - JIRA TASKS HANDLER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if deploy_lambda "jiraTasksHandler" \
    "backend/lambda-functions/jira-tasks" \
    "jira-tasks-handler"; then
    ((SUCCESS_COUNT++))
fi

# Summary
echo "=========================================="
echo "  RESUMEN DEL DESPLIEGUE"
echo "=========================================="
echo ""
echo -e "Lambdas desplegadas: ${GREEN}${SUCCESS_COUNT}${NC}/${TOTAL_COUNT}"
echo ""

if [ ${SUCCESS_COUNT} -eq ${TOTAL_COUNT} ]; then
    echo -e "${GREEN}✓ DESPLIEGUE COMPLETADO EXITOSAMENTE${NC}"
    echo ""
    echo "Próximos pasos:"
    echo "  1. Verificar que las lambdas funcionan correctamente"
    echo "  2. Probar los endpoints actualizados"
    echo "  3. Continuar con Fase 3: Frontend"
    echo ""
    exit 0
else
    echo -e "${RED}✗ ALGUNOS DESPLIEGUES FALLARON${NC}"
    echo ""
    echo "Por favor revisa los errores anteriores"
    echo ""
    exit 1
fi