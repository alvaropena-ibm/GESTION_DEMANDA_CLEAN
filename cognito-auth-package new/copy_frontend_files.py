import shutil
import os

# Archivos frontend a copiar
frontend_files = [
    ('frontend/src/pages/auth/Login.tsx', 'frontend/Login.tsx'),
    ('frontend/src/contexts/AuthContext.tsx', 'frontend/AuthContext.tsx'),
    ('frontend/src/services/authService.ts', 'frontend/authService.ts'),
    ('frontend/src/services/api.ts', 'frontend/api.ts'),
    ('frontend/src/types/index.ts', 'frontend/types.ts'),
]

# Copiar archivos
for src, dst in frontend_files:
    src_path = os.path.join('..', src)
    dst_path = dst
    
    if os.path.exists(src_path):
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        shutil.copy2(src_path, dst_path)
        print(f'✓ Copiado: {src} -> {dst}')
    else:
        print(f'✗ No encontrado: {src}')

print('\n✅ Archivos frontend copiados')