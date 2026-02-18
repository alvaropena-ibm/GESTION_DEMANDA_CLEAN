#!/bin/bash

# Script para redesplegar la función Lambda de projects
# Uso: ./deploy.sh

set -e

echo "🚀 Desplegando función Lambda de projects..."

# Nombre de la función Lambda
FUNCTION_NAME="projects-handler"

# Crear archivo ZIP con el código
echo "📦 Creando archivo ZIP..."
zip -r function.zip . -x "*.sh" "*.md" "node_modules/*" "*.git*"

# Actualizar código de la función Lambda
echo "⬆️  Subiendo código a AWS Lambda..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip

# Esperar a que la función esté actualizada
echo "⏳ Esperando a que la función se actualice..."
aws lambda wait function-updated --function-name $FUNCTION_NAME

# Limpiar archivo ZIP
echo "🧹 Limpiando archivos temporales..."
rm function.zip

echo "✅ Función Lambda desplegada correctamente!"
echo ""
echo "Para verificar el despliegue, ejecuta:"
echo "aws lambda get-function --function-name $FUNCTION_NAME --query 'Configuration.[FunctionName,LastModified,Runtime]'"