# CloudFront Deployment Checklist

## Problema Identificado
La tabla en la vista de calendario no se muestra en CloudFront pero funciona correctamente en local. Esto es típicamente causado por:
1. **Caché de CloudFront**: CloudFront mantiene versiones antiguas de los archivos
2. **Caché del navegador**: El navegador guarda versiones antiguas de CSS/JS
3. **Falta de cache-busting**: Los archivos no tienen parámetros de versión

## Solución Implementada

### 1. Cache-Busting en HTML
Se han añadido parámetros de versión (`?v=20260203`) a todos los archivos CSS y JS en `index-modular.html`:
- ✅ Archivos CSS con versión
- ✅ Archivos JS con versión

### 2. Página de Limpieza de Caché
Se ha creado `frontend/html/clear_cache.html` que permite:
- Limpiar localStorage y sessionStorage
- Limpiar service workers
- Limpiar cache storage del navegador
- Recargar con cache-busting

### 3. Script de Invalidación de CloudFront
Se ha creado `invalidate-cloudfront.sh` para invalidar la caché de CloudFront.

## Pasos para Desplegar

### Paso 1: Subir Cambios a S3
```bash
# Navega al directorio del proyecto
cd /Users/alvaro.pena/Desktop/GESTION-DEMANDA-V2/GESTION_DEMANDA_CLEAN

# Sincroniza los archivos con S3 (reemplaza YOUR_BUCKET con tu bucket)
aws s3 sync frontend/ s3://YOUR_BUCKET/ --delete

# O si tienes un script específico de deployment, úsalo
```

### Paso 2: Invalidar Caché de CloudFront
```bash
# Encuentra tu Distribution ID
aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName]' --output table

# Ejecuta el script de invalidación
./invalidate-cloudfront.sh YOUR_DISTRIBUTION_ID
```

### Paso 3: Verificar en el Navegador
1. Espera 5-10 minutos para que la invalidación se complete
2. Accede a: `https://tu-dominio.cloudfront.net/html/clear_cache.html`
3. Haz clic en "Limpiar Caché y Recargar"
4. Verifica que la tabla se muestre correctamente

### Paso 4: Limpieza Manual del Navegador (si es necesario)
Si aún no se ve la tabla:
- **Chrome/Edge**: Ctrl+Shift+Delete (Windows) o Cmd+Shift+Delete (Mac)
- **Firefox**: Ctrl+Shift+Delete (Windows) o Cmd+Shift+Delete (Mac)
- **Safari**: Cmd+Option+E

## Comandos Útiles

### Ver estado de invalidación
```bash
aws cloudfront get-invalidation --distribution-id YOUR_DISTRIBUTION_ID --id INVALIDATION_ID
```

### Listar invalidaciones recientes
```bash
aws cloudfront list-invalidations --distribution-id YOUR_DISTRIBUTION_ID
```

### Verificar archivos en S3
```bash
aws s3 ls s3://YOUR_BUCKET/html/ --recursive
aws s3 ls s3://YOUR_BUCKET/css/ --recursive
aws s3 ls s3://YOUR_BUCKET/js/ --recursive
```

## Prevención Futura

### Actualizar Versión en Cada Deploy
Cada vez que hagas cambios, actualiza el parámetro de versión en `index-modular.html`:
```html
<!-- Cambiar de -->
<link rel="stylesheet" href="../css/tables.css?v=20260203">

<!-- A -->
<link rel="stylesheet" href="../css/tables.css?v=20260204">
```

### Configurar Headers de Caché en S3
Considera configurar headers de caché apropiados en S3:
```bash
# Para archivos HTML (no cachear)
aws s3 cp frontend/html/ s3://YOUR_BUCKET/html/ \
  --recursive \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata-directive REPLACE

# Para archivos CSS/JS (cachear con versión)
aws s3 cp frontend/css/ s3://YOUR_BUCKET/css/ \
  --recursive \
  --cache-control "public, max-age=31536000" \
  --metadata-directive REPLACE
```

## Troubleshooting

### La tabla aún no se ve
1. Verifica que los archivos se subieron correctamente a S3
2. Verifica que la invalidación de CloudFront se completó
3. Abre las DevTools del navegador (F12) y verifica:
   - ¿Hay errores en la consola?
   - ¿Se cargan todos los archivos CSS/JS?
   - ¿Qué versión de los archivos se está cargando?
4. Verifica el Network tab para ver si hay errores 404 o 403

### Errores comunes
- **403 Forbidden**: Verifica los permisos del bucket S3
- **404 Not Found**: Verifica que los archivos existen en S3
- **CORS errors**: Verifica la configuración CORS del bucket S3

## Contacto
Si el problema persiste, documenta:
1. URL de CloudFront
2. Capturas de pantalla de la consola del navegador
3. Capturas de pantalla del Network tab
4. Resultado de las invalidaciones de CloudFront