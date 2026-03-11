# 🔧 Solución: Error DNS en Navegador

## ❌ Problema

El navegador muestra el error:
```
ERR_NAME_NOT_RESOLVED
POST https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/auth/login
```

## ✅ Causa

El endpoint **funciona correctamente** (verificado con curl), pero el **navegador tiene el DNS en caché** y no puede resolver el dominio del API Gateway.

## 🎯 Soluciones

### Solución 1: Limpiar Caché DNS del Navegador (Recomendado)

#### **Chrome/Edge:**
1. Abrir una nueva pestaña
2. Ir a: `chrome://net-internals/#dns`
3. Click en "Clear host cache"
4. Recargar la página de login (Ctrl+Shift+R / Cmd+Shift+R)

#### **Firefox:**
1. Cerrar completamente Firefox
2. Abrir de nuevo
3. Recargar la página de login (Ctrl+Shift+R / Cmd+Shift+R)

#### **Safari:**
1. Menú Safari → Preferencias → Avanzado
2. Marcar "Mostrar menú Desarrollo"
3. Menú Desarrollo → Vaciar cachés
4. Recargar la página de login (Cmd+Shift+R)

---

### Solución 2: Limpiar Caché DNS del Sistema

#### **macOS:**
```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

#### **Windows:**
```cmd
ipconfig /flushdns
```

#### **Linux:**
```bash
sudo systemd-resolve --flush-caches
```

Después de limpiar el caché, **reiniciar el navegador** y probar de nuevo.

---

### Solución 3: Modo Incógnito/Privado

1. Abrir ventana de incógnito/privado
2. Ir a `login-new.html`
3. Probar el login

El modo incógnito no usa caché DNS, por lo que debería funcionar inmediatamente.

---

### Solución 4: Esperar Propagación DNS (Última opción)

Si acabas de crear el API Gateway, puede tardar unos minutos en propagarse:
- Esperar 5-10 minutos
- Limpiar caché del navegador
- Intentar de nuevo

---

## ✅ Verificación

### 1. **Verificar que el endpoint funciona (Terminal):**
```bash
curl -X POST https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

**Respuesta esperada:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email o contraseña incorrectos"
  }
}
```

✅ Si ves esta respuesta, el endpoint funciona correctamente.

### 2. **Verificar DNS (Terminal):**
```bash
nslookup xrqo2gedpl.execute-api.eu-west-1.amazonaws.com
```

**Respuesta esperada:**
```
Server:		8.8.8.8
Address:	8.8.8.8#53

Non-authoritative answer:
Name:	xrqo2gedpl.execute-api.eu-west-1.amazonaws.com
Address: 18.202.159.33
Name:	xrqo2gedpl.execute-api.eu-west-1.amazonaws.com
Address: 52.209.225.151
Name:	xrqo2gedpl.execute-api.eu-west-1.amazonaws.com
Address: 34.249.219.227
```

✅ Si ves IPs, el DNS funciona correctamente.

---

## 🎯 Resumen

| Problema | Causa | Solución |
|----------|-------|----------|
| ERR_NAME_NOT_RESOLVED | Caché DNS del navegador | Limpiar caché DNS del navegador |
| Funciona en terminal | DNS del sistema OK | Usar modo incógnito o limpiar caché |
| No funciona en ningún navegador | Propagación DNS | Esperar 5-10 minutos |

---

## 📝 Pasos Rápidos

1. **Limpiar caché DNS del navegador** (chrome://net-internals/#dns)
2. **Recargar página** (Ctrl+Shift+R / Cmd+Shift+R)
3. **Si no funciona**: Probar en modo incógnito
4. **Si no funciona**: Limpiar caché DNS del sistema
5. **Si no funciona**: Esperar 10 minutos y reintentar

---

## ✅ Estado Actual

- ✅ API Gateway existe: `xrqo2gedpl`
- ✅ Recurso `/auth/login` configurado
- ✅ Stage `prod` desplegado
- ✅ Lambda conectada: `login-authorization-service`
- ✅ DNS resuelve correctamente desde terminal
- ✅ Endpoint responde correctamente
- ⚠️ Navegador tiene DNS en caché

**El problema es solo de caché del navegador, no del sistema.**