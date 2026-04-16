# ReproductorPro — Documentación Técnica Completa

## Tabla de Contenidos

1. [Descripción del Proyecto](#1-descripción-del-proyecto)
2. [Arquitectura General](#2-arquitectura-general)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estructura de Archivos](#4-estructura-de-archivos)
5. [Backend — Servidor](#5-backend--servidor)
6. [Frontend — Admin y Player](#6-frontend--admin-y-player)
7. [API REST](#7-api-rest)
8. [Socket.IO — Comunicación en Tiempo Real](#8-socketio--comunicación-en-tiempo-real)
9. [Base de Datos](#9-base-de-datos)
10. [Configuración](#10-configuración)
11. [Instalación Local](#11-instalación-local)
12. [Deployment en Producción](#12-deployment-en-producción)
13. [Seguridad](#13-seguridad)
14. [Funcionamiento del Motor de Sincronización](#14-funcionamiento-del-motor-de-sincronización)

---

## 1. Descripción del Proyecto

ReproductorPro es un servidor de video sincronizado tipo "CyTube". Su propósito es permitir que múltiples usuarios vean el mismo video al mismo tiempo, como si estuvieran en una sala de cine o viendo una transmisión en vivo juntos.

### Características Principales

- **Reproducción sincronizada**: Todos los usuarios ven el video en el mismo momento
- **Control centralizado**: Solo el administrador puede controlar la reproducción (play, pause, skip, seek)
- **Usuarios pasivos**: Los espectadores no pueden agregar videos ni controlar la reproducción
- **Silenciar local**: Los usuarios pueden silenciar el audio solo para ellos mismos
- **Sin chat**: No hay funcionalidad de chat entre usuarios
- **Persistência**: La playlist y el estado de reproducción se guardan en base de datos

### Casos de Uso

- Transmisiones en vivo empresariales
- Clases virtuales sincronizadas
- Eventos y conferencias
- Reproducción de contenido educativo en grupo

---

## 2. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                         Navegador del Usuario                    │
│  ┌─────────────────┐              ┌─────────────────────────┐  │
│  │   Player Page   │◄────────────►│   Admin Dashboard       │  │
│  │  (solo lectura) │   Socket.IO  │  (control total)       │  │
│  └────────┬────────┘              └────────────┬────────────┘  │
└───────────┼─────────────────────────────────────┼───────────────┘
            │                                     │
            │         HTTP + Socket.IO            │
            └──────────────┬─────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Servidor Node.js (Puerto 3000)               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Express.js — API REST para administración               │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Socket.IO — Sincronización en tiempo real              │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Sync Engine — Controla reproducción y drift           │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Playlist Manager — Gestiona videos                     │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  SQLite (sql.js) — Persistencia de datos                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Modelo de Comunicación

- **Admin → Servidor**: HTTP REST (agregar videos, controlar reproducción)
- **Servidor → Todos**: Socket.IO broadcast (estado actualizado)
- **Player → Servidor**: Socket.IO (heartbeat,报告 de posición)
- **Servidor → Player**: Socket.IO (correcciones de drift)

---

## 3. Stack Tecnológico

### Backend

| Componente | Tecnología | Versión | Propósito |
|------------|------------|---------|-----------|
| Runtime | Node.js | >= 20.0.0 | Entorno de ejecución JavaScript |
| Framework HTTP | Express.js | 4.x | Servidor web y routing |
| WebSocket | Socket.IO | 4.x | Comunicación en tiempo real |
| Base de datos | sql.js | 1.x | SQLite en WebAssembly |
| Variables de entorno | dotenv | 16.x | Configuración externa |
| CORS | cors | 2.x | Control de acceso cruzado |

### Frontend

| Componente | Tecnología | Propósito |
|------------|------------|-----------|
| HTML5 | Vanilla | Estructura de las páginas |
| CSS3 | Vanilla | Estilos visuales |
| JavaScript | Vanilla | Lógica del cliente |
| YouTube IFrame API | Google | Reproducción de videos de YouTube |

### Deployment

| Componente | Tecnología | Propósito |
|------------|------------|-----------|
| Process Manager | PM2 | Gestión de procesos en producción |
| Web Server | Nginx | Proxy reverso y SSL |
| Cloud | Oracle Cloud Free Tier | Hosting del servidor |

---

## 4. Estructura de Archivos

```
Proyecto-ReproductorPro/
│
├── server/                          # Directorio principal del servidor
│   ├── src/                         # Código fuente del backend
│   │   ├── server.js                # Punto de entrada, validación y arranque
│   │   ├── app.js                   # Configuración de Express
│   │   │
│   │   ├── config/                  # Configuración
│   │   │   └── index.js             # Carga de variables de entorno
│   │   │
│   │   ├── db/                      # Capa de base de datos
│   │   │   ├── index.js             # Inicialización de sql.js y helpers
│   │   │   └── migrations/          # Archivos SQL de migración
│   │   │       └── 001_initial.sql # Schema inicial
│   │   │
│   │   ├── repositories/            # Acceso a datos
│   │   │   ├── playlist-repo.js     # Operaciones de playlist
│   │   │   └── playback-repo.js    # Estado de reproducción
│   │   │
│   │   ├── services/                # Lógica de negocio
│   │   │   ├── sync-engine.js       # Motor de sincronización
│   │   │   ├── playlist-manager.js  # Gestión de playlist
│   │   │   └── economic-service.js  # Datos económicos (opcional)
│   │   │
│   │   ├── routes/                  # Rutas HTTP
│   │   │   ├── admin-routes.js      # Endpoints de administración
│   │   │   └── public-routes.js     # Endpoints públicos
│   │   │
│   │   ├── middleware/              # Middleware de Express
│   │   │   ├── auth.js              # Autenticación de admin
│   │   │   └── validate.js         # Validación de datos
│   │   │
│   │   └── sockets/                 # Manejo de WebSockets
│   │       ├── socket-handler.js    # Eventos Socket.IO
│   │       └── client-registry.js   # Registro de clientes conectados
│   │
│   ├── public/                      # Archivos estáticos (frontend)
│   │   ├── admin/                  # Panel de administración
│   │   │   ├── index.html          # Página principal del admin
│   │   │   └── admin.js            # Lógica del admin
│   │   │
│   │   └── player/                  # Reproductor público
│   │       ├── index.html          # Página principal del player
│   │       └── player.js            # Lógica del player
│   │
│   ├── data/                        # Archivos de la base de datos
│   │   └── reproductor.db           # Base de datos SQLite
│   │
│   ├── package.json                # Dependencias de npm
│   ├── .env                        # Variables de entorno (NO commitear)
│   └── .env.example               # Plantilla de variables de entorno
│
├── deploy/                         # Archivos de deployment
│   ├── ecosystem.config.js         # Configuración de PM2
│   └── nginx.conf                 # Configuración de Nginx
│
├── .gitignore                      # Archivos ignorados por git
├── README.md                       # Este archivo
└── design.md                       # Decisiones de diseño
```

---

## 5. Backend — Servidor

### 5.1 Punto de Entrada (server.js)

El archivo `server.js` es el punto de entrada del servidor. Sus responsabilidades son:

1. **Validar configuración**: Verifica que `ADMIN_PASSWORD` esté configurado
2. **Inicializar base de datos**: Llama a `db.initDatabase()` antes de arrancar
3. **Crear servicios**: Instancia el SyncEngine, PlaylistManager, etc.
4. **Configurar Socket.IO**: Crea el servidor WebSocket
5. **Iniciar el motor de sincronización**: Arranca el loop de broadcast
6. **Manejar shutdown graceful**: Cierra correctamente al recibir SIGTERM o SIGINT

```javascript
// Orden de inicialización
async function start() {
  await db.initDatabase();           // 1. DB primero
  const io = new Server(server);     // 2. Socket.IO
  const syncEngine = new SyncEngine(io);  // 3. Motor con io
  const playlistManager = new PlaylistManager(syncEngine);
  const app = createApp(syncEngine, playlistManager);
  createSocketHandlers(io, syncEngine);
  syncEngine.start();                // 4. Arrancar sync
  server.listen(config.port);        // 5. Escuchar
}
```

### 5.2 Aplicación Express (app.js)

Configura el servidor Express con:

- **CORS**: Permite requests desde orígenes configurados
- **JSON parsing**: Para leer cuerpos de requests
- **Static files**: Serve el frontend desde `public/`
- **Routes**: Monta las rutas de admin y públicas

### 5.3 Motor de Sincronización (sync-engine.js)

El `SyncEngine` es el cerebro del sistema. Maneja:

- **Leader loop**: Cada 1 segundo actualiza la posición del video
- **Broadcast loop**: Cada 2 segundos envía el estado a todos los clientes
- **Persist loop**: Cada 5 segundos guarda el estado en la base de datos
- **Drift correction**: Detecta cuando un cliente se desincroniza y lo corrige

```javascript
class SyncEngine {
  start() {
    // Load persisted state from DB
    // Start 3 intervals:
    //   - _tick() cada 1000ms (actualizar posición)
    //   - _broadcastState() cada 2000ms (enviar a clientes)
    //   - _persistState() cada 5000ms (guardar en DB)
  }
}
```

### 5.4 Gestor de Playlist (playlist-manager.js)

Maneja las operaciones CRUD de la playlist:

- `addVideo()`: Agrega un video
- `updateVideo()`: Modifica metadata de un video
- `removeVideo()`: Elimina un video
- `reorderPlaylist()`: Cambia el orden de los videos
- `getPlaylist()`: Retorna todos los videos

Cada operación notifica al SyncEngine para actualizar la lista en memoria.

---

## 6. Frontend — Admin y Player

### 6.1 Panel de Administración (admin/)

Ubicación: `server/public/admin/`

El admin es el panel de control del reproductor. Solo accesible para quien tenga la contraseña.

**Funcionalidades:**
- Ver y gestionar la playlist
- Agregar videos (YouTube, Dailymotion, etc.)
- Reordenar videos con drag & drop
- Controlar reproducción: Play, Pause, Skip
- Buscar en la playlist
- Ver información de cada video

**Flujo de trabajo típico:**

1. Admin abre `/admin`
2. Ingresa la contraseña
3. Ve la playlist y el estado actual
4. Puede agregar videos, reordenar, o controlar reproducción
5. Los cambios se reflejan inmediatamente en todos los players

### 6.2 Reproductor Público (player/)

Ubicación: `server/public/player/`

El player es la página que ven los espectadores. Es de solo lectura.

**Funcionalidades:**
- Ver el video que está reproduciéndose actualmente
- Sincronización automática con el servidor
- Silenciar/activar audio localmente
- Ver información del video actual

**Flujo de trabajo típico:**

1. Usuario abre `/player`
2. Se conecta via Socket.IO
3. Recibe el estado actual del video
4. El video empieza a reproducirse automáticamente
5. Si hay drift, recibe correcciones del servidor

---

## 7. API REST

### Autenticación

Todas las rutas de API requieren autenticación basada en cookies HttpOnly tras el login.

```http
POST /api/auth/login
Content-Type: application/json

{ "password": "<CONTRASEÑA>" }
```

**Respuesta sin autenticación:**
```json
HTTP 401 Unauthorized
{ "error": "Unauthorized" }
```

---

### Endpoints Públicos

#### GET /api/state

Retorna el estado actual del reproductor.

**Respuesta:**
```json
{
  "video": {
    "id": 1,
    "title": "Video de Prueba",
    "source_url": "https://www.youtube.com/embed/...",
    "source_type": "youtube",
    "duration": 233
  },
  "position": 45.5,
  "isPlaying": true,
  "playlist": [...]
}
```

---

#### GET /api/playlist

Retorna la lista de videos en orden.

**Respuesta:**
```json
[
  {
    "id": 1,
    "title": "Video 1",
    "source_url": "...",
    "source_type": "youtube",
    "duration": 120,
    "order_index": 0
  },
  {
    "id": 2,
    "title": "Video 2",
    "source_url": "...",
    "source_type": "youtube",
    "duration": 180,
    "order_index": 1
  }
]
```

---

### Endpoints de Administración

#### POST /api/playlist

Agrega un video a la playlist.

**Body:**
```json
{
  "title": "Nombre del Video",
  "source_url": "https://www.youtube.com/embed/VIDEO_ID",
  "source_type": "youtube",
  "duration": 300
}
```

**Respuesta (201):**
```json
{
  "id": 3,
  "title": "Nombre del Video",
  "source_url": "https://www.youtube.com/embed/VIDEO_ID",
  "source_type": "youtube",
  "duration": 300,
  "order_index": 2,
  "created_at": "2026-04-06 12:00:00",
  "updated_at": "2026-04-06 12:00:00"
}
```

---

#### PUT /api/playlist/:id

Actualiza la metadata de un video.

**Body:**
```json
{
  "title": "Nuevo título",
  "duration": 350
}
```

**Respuesta (200):** El video actualizado.

---

#### DELETE /api/playlist/:id

Elimina un video de la playlist.

**Respuesta:** `204 No Content`

---

#### PUT /api/playlist/reorder

Reordena la playlist. Body debe ser un array.

**Body:**
```json
[
  { "id": 2, "orderIndex": 0 },
  { "id": 1, "orderIndex": 1 },
  { "id": 3, "orderIndex": 2 }
]
```

**Respuesta:** `204 No Content`

---

#### POST /api/playback/play

Inicia la reproducción.

**Respuesta:** Estado actual del reproductor.

---

#### POST /api/playback/pause

Pausa la reproducción.

**Respuesta:** Estado actual del reproductor.

---

#### POST /api/playback/skip

Salta al siguiente video.

**Respuesta:** Estado actual del reproductor.

---

#### POST /api/playback/seek

Busca a una posición específica.

**Body:**
```json
{
  "position": 120.5
}
```

**Respuesta:** Estado actual del reproductor.

---

## 8. Socket.IO — Comunicación en Tiempo Real

Socket.IO permite la comunicación bidireccional en tiempo real entre el servidor y los clientes.

### Eventos del Servidor → Cliente

#### sync:state

Enviado periódicamente (cada 2 segundos) con el estado actual.

```json
{
  "video": { ... },
  "position": 45.5,
  "isPlaying": true,
  "playlist": [ ... ],
  "timestamp": 1712400000000
}
```

#### video:advance

Cuando cambia el video al siguiente.

```json
{
  "video": { ... },
  "position": 0,
  "timestamp": 1712400000000
}
```

#### drift:correct

Cuando un cliente se desincronizó demasiado.

```json
{
  "position": 45.5,
  "timestamp": 1712400000000
}
```

#### playlist:update

Cuando la playlist cambia.

```json
{
  "playlist": [ ... ]
}
```

#### client:count

Cuando cambia la cantidad de clientes conectados.

```json
{
  "count": 15
}
```

---

### Eventos del Cliente → Servidor

#### client:ready

Cuando el cliente está listo para recibir sincronización.

```json
{
  "clientId": "abc123"
}
```

#### client:heartbeat

Enviado periódicamente con la posición actual del cliente.

```json
{
  "position": 45.5
}
```

#### client:reconnect

Cuando un cliente se reconecta.

```json
{
  "lastKnownPosition": 45.5
}
```

---

## 9. Base de Datos

### Sistema de Gestión

Se usa **sql.js**, que es SQLite compilado a WebAssembly. Esto permite:

- ✅ No requiere compilación nativa
- ✅ Funciona en cualquier plataforma (Windows, Mac, Linux)
- ✅ Persistencia en archivo local

### Schema

#### Tabla: playlist

Almacena los videos de la playlist.

```sql
CREATE TABLE playlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_playlist_order ON playlist(order_index);
```

#### Tabla: playback_state

Almacena el estado actual de reproducción.

```sql
CREATE TABLE playback_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_video_id INTEGER,
  position REAL NOT NULL DEFAULT 0,
  is_playing INTEGER NOT NULL DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (current_video_id) REFERENCES playlist(id)
);
```

### Archivo de la Base de Datos

Ubicación: `server/data/reproductor.db`

Este archivo se crea automáticamente al iniciar el servidor si no existe.

---

## 10. Configuración

### Variables de Entorno

Crear archivo `server/.env` basado en `.env.example`:

```env
# Puerto del servidor
PORT=3000

# Entorno (development o production)
NODE_ENV=development

# Contraseña de administrador (REQUERIDA)
ADMIN_PASSWORD=tu-contraseña-secreta

# Orígenes permitidos para CORS (separados por coma)
ALLOWED_ORIGINS=http://localhost:3000

# Ruta del archivo de base de datos
DB_PATH=./data/reproductor.db

# URL de la API de CoinGecko (para economic-service)
COINGECKO_URL=https://api.coingecko.com/api/v3/simple/price

# Threshold de drift en segundos (cuánto se puede desincronizar antes de corregir)
DRIFT_THRESHOLD=1

# Intervalo de broadcast en milisegundos
BROADCAST_INTERVAL=2000
```

### Configuración de CORS

Por defecto, solo permite conexiones desde `http://localhost:3000`.

Para producción, cambiar `ALLOWED_ORIGINS` a los dominios reales:

```env
ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com
```

---

## 11. Instalación Local

### Requisitos

- Node.js >= 20.0.0
- npm (viene con Node.js)

### Pasos

#### 1. Clonar o descargar el proyecto

```bash
cd Proyecto-ReproductorPro/server
```

#### 2. Instalar dependencias

```bash
npm install
```

#### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env y cambiar ADMIN_PASSWORD
```

#### 4. Iniciar el servidor

```bash
npm start
```

#### 5. Abrir en el navegador

- Admin: http://localhost:3000/admin
- Player: http://localhost:3000/player

---

## 12. Deployment en Producción

### Opción 1: Oracle Cloud Free Tier

#### Paso 1: Crear instancia

1. Crear cuenta en oracle.com/cloud/free/
2. Ir a Compute → Instances → Create Instance
3. Elegir:
   - Image: Oracle Linux 8 o Ubuntu 22.04
   - Shape: VM.Standard.A1.Flex (Always Free)
   - Resources: 1 CPU, 6 GB RAM
4. Generar o subir claves SSH
5. Crear instancia

#### Paso 2: Conectarse

```bash
ssh opc@IP_PUBLICA_DE_LA_INSTANCIA
```

#### Paso 3: Instalar Node.js

**En Oracle Linux:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

**En Ubuntu:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verificar: `node --version` y `npm --version`

#### Paso 4: Instalar Git y Nginx

```bash
# Oracle Linux
sudo yum install -y git nginx

# Ubuntu
sudo apt install -y git nginx
```

#### Paso 5: Clonar el repositorio

```bash
cd ~
git clone https://github.com/TU_USUARIO/reproductor-pro.git
cd reproductor-pro/server
```

#### Paso 6: Instalar dependencias

```bash
npm install --production
```

#### Paso 7: Configurar variables de entorno

```bash
cp .env.example .env
nano .env
# Cambiar ADMIN_PASSWORD y NODE_ENV=production
```

#### Paso 8: Configurar Nginx como proxy reverso

```bash
sudo cp ../deploy/nginx.conf /etc/nginx/conf.d/reproductor.conf
sudo nano /etc/nginx/conf.d/reproductor.conf
# Cambiar example.com por tu dominio o IP
```

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx
```

#### Paso 9: Abrir puertos en Oracle Cloud

En el panel de Oracle Cloud:

1. Virtual Cloud Networks → Tu VCN
2. Security Lists → Default Security List
3. Add Ingress Rules:
   - 80/tcp (HTTP)
   - 443/tcp (HTTPS)
   - 3000/tcp (si usás proxy directo)

#### Paso 10: Instalar y configurar PM2

```bash
sudo npm install -g pm2
pm2 start src/server.js --name reproductor-pro
pm2 startup
# Ejecutar el comando que pm2 muestre
pm2 save
```

#### Paso 11: Verificar

- http://IP_PUBLICA/admin
- http://IP_PUBLICA/player

---

### Opción 2: Usando PM2 Directly (sin Nginx)

Si preferís no usar Nginx:

```bash
pm2 start src/server.js --name reproductor-pro
# Abrir puerto 3000 en el firewall
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

Acceder: `http://IP_PUBLICA:3000/admin`

---

## 13. Seguridad

### Autenticación de Admin

- Todas las rutas `/api/*` requieren autenticación (excepto el player público).
- La contraseña se valida con comparación de tiempo constante para evitar timing attacks
- No hay sesión ni cookie — cada request debe incluir el header

### CORS

- Por defecto, solo permite orígenes configurados
- En producción, configurar `ALLOWED_ORIGINS` con los dominios reales

### Buenas Prácticas Recomendadas

1. **Cambiar la contraseña por defecto** en producción
2. **Usar HTTPS** con certificado SSL
3. **No exponer la base de datos** directamente
4. **Usar variables de entorno** para toda configuración sensible
5. **Mantener Node.js actualizado** para parches de seguridad

---

## 14. Funcionamiento del Motor de Sincronización

### Concepto: Leader Follower

El servidor actúa como "leader" — controla el tiempo. Los players son "followers" — obedecen al líder.

```
Servidor (Leader)                          Clientes (Followers)
     │                                            │
     │  ──── sync:state {position: 45.5} ────►  │
     │                                            │
     │  Cada 1 segundo:                           │
     │  position += 1                             │
     │                                            │
     │  ──── sync:state {position: 46.5} ────►  │
     │                                            │
```

### Drift (Desincronización)

Ocasionalmente, los clientes pueden desincronizarse por:

- Latencia de red
- Browser tab dormido (throttled)
- Dispositivo lento

### Corrección de Drift

```
Cliente reporta: position = 50
Servidor sabe:   position = 52

drift = |52 - 50| = 2 segundos

Si drift > DRIFT_THRESHOLD (1 segundo):
  ──── drift:correct {position: 52} ────►
```

### Loop Principal (1 tick por segundo)

```javascript
_tick() {
  if (!isPlaying) return;
  
  const now = Date.now();
  const elapsed = (now - lastTick) / 1000;
  position += elapsed;
  lastTick = now;
  
  // Si el video terminó
  if (position >= video.duration) {
    _advanceVideo();
  }
}
```

### Broadcast (cada 2 segundos)

```javascript
_broadcastState() {
  io.emit('sync:state', {
    video: currentVideo,
    position: position,
    isPlaying: isPlaying,
    playlist: playlist,
    timestamp: Date.now()
  });
}
```

### Persistencia (cada 5 segundos)

```javascript
_persistState() {
  playbackRepo.upsert(
    currentVideo?.id,
    position,
    isPlaying
  );
}
```

Esto asegura que si el servidor se reinicia, puede continuar desde donde estaba.

---

## 15. Glosario

| Término | Definición |
|---------|------------|
| **Leader/Follower** | Patrón donde un nodo controla y los demás obedecen |
| **Drift** | Desincronización entre el tiempo del servidor y del cliente |
| **Broadcast** | Envío de información a todos los clientes simultáneamente |
| **Heartbeat** | Señal periódica que indica que el cliente sigue conectado |
| **Sync Engine** | Componente que gestiona la sincronización del video |
| **WebSocket** | Conexión bidireccional persistente entre cliente y servidor |
| **CORS** | Cross-Origin Resource Sharing — permite requests entre dominios |
| **PM2** | Process Manager 2 — gestor de procesos para producción |
| **WASM** | WebAssembly — formato binario ejecutable en navegadores |

---

---

## 17. Flujo de Trabajo y Actualización (CI/CD)

El proyecto utiliza un flujo de Integración y Despliegue Continuo (CI/CD) automatizado a través de GitHub y Render.

### 1. Ciclo de Desarrollo
1.  **Cambios Locales**: Se realizan las modificaciones en el código fuente (backend en `server/src` o frontend en `server/public`).
2.  **Pruebas**: Se verifica el funcionamiento localmente usando el comando `npm run dev` dentro de la carpeta `server/`.
3.  **Commit**: Se guardan los cambios usando Git:
    ```bash
    git add .
    git commit -m "Descripción de los cambios"
    ```

### 2. Despliegue a Producción
La instancia de producción en Render está vinculada a la rama `main` del repositorio en GitHub.

1.  **Push**: Al ejecutar `git push origin main`, los cambios se suben al repositorio remoto.
2.  **Webhooks**: GitHub notifica a Render sobre el nuevo commit.
3.  **Build Automático**: Render inicia automáticamente un nuevo "Deploy":
    - Descarga la última versión del código.
    - Ejecuta `npm install` para actualizar dependencias.
    - Reinicia el proceso de Node.js.
4.  **Zero-Downtime**: Render intenta mantener la versión anterior activa hasta que la nueva esté lista para recibir tráfico.

### 3. Persistencia de Datos
Gracias al uso de **Turso (libSQL)** en producción, la base de datos es externa al sistema de archivos efímero de Render. Esto garantiza que:
- La playlist no se pierda al reiniciar el servidor.
- El estado de reproducción (posición del video) se mantenga sincronizado incluso después de una actualización de código.

---

## 18. Licencia y Créditos

Este proyecto fue desarrollado como una solución de video sincronizado de código abierto.

**Repositorio:** github.com/TU_USUARIO/reproductor-pro

---

*Documentación generada el 6 de abril de 2026*
