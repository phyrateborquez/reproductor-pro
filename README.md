# ReproductorPro

Synchronized video player server (CyTube-like) with admin dashboard and embeddable public player.

## Features

- **Synchronized playback**: Server-authority sync engine keeps all clients in sync
- **Admin dashboard**: Manage playlist, control playback, monitor connected clients
- **Embeddable player**: Public player page designed for iframe embedding
- **Multi-source support**: YouTube and Dailymotion video sources
- **Economic data strip**: Real-time currency display using CoinGecko API
- **SQLite persistence**: Playback state survives server restarts
- **Drift correction**: Automatic client position correction when drift exceeds threshold

## Project Structure

```
server/
├── src/
│   ├── app.js                    # Express app factory
│   ├── server.js                 # Entry point (HTTP + Socket.IO)
│   ├── config/
│   │   └── index.js              # Environment configuration
│   ├── db/
│   │   ├── index.js              # SQLite connection & migrations
│   │   └── migrations/
│   │       └── 001_initial.sql   # Database schema
│   ├── repositories/
│   │   ├── playlist-repo.js      # Playlist CRUD queries
│   │   └── playback-repo.js      # Playback state queries
│   ├── services/
│   │   ├── sync-engine.js        # Server authority sync loop
│   │   ├── playlist-manager.js   # Playlist business logic
│   │   └── economic-service.js   # CoinGecko data fetching
│   ├── routes/
│   │   ├── admin-routes.js       # Admin API routes
│   │   └── public-routes.js      # Public player routes
│   ├── middleware/
│   │   ├── auth.js               # Admin password authentication
│   │   └── validate.js           # Request validation
│   └── sockets/
│       ├── socket-handler.js     # Socket.IO event handlers
│       └── client-registry.js    # Connected client tracking
├── public/
│   ├── admin/                    # Admin dashboard static files
│   ├── player/                   # Public player static files
│   └── css/                      # Shared styles
├── .env.example                  # Environment template
└── package.json

deploy/
├── ecosystem.config.js           # PM2 configuration
└── nginx.conf                    # Nginx reverse proxy template
```

## Quick Start

### Development

```bash
cd server
cp .env.example .env
# Edit .env and set your ADMIN_PASSWORD
npm install
npm run dev
```

Open:
- Admin: http://localhost:3000/admin
- Player: http://localhost:3000/player

### Producción (Render)
- **Admin Panel**: [https://reproductor-pro.onrender.com/admin/](https://reproductor-pro.onrender.com/admin/)
- **Public Player**: [https://reproductor-pro.onrender.com/player/](https://reproductor-pro.onrender.com/player/)

### Production (Oracle Cloud / Ubuntu)

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Deploy
git clone <repo-url> /opt/reproductor-pro
cd /opt/reproductor-pro/server
cp .env.example .env
# Edit .env with production values
npm ci --production

# Start with PM2
pm2 start deploy/ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Workflow de Actualización
Para actualizar la versión en producción (Render):
1. Realiza tus cambios localmente y pruébalos con `npm run dev`.
2. Sube los cambios a la rama principal: `git push origin main`.
3. Render detectará el cambio y desplegará la nueva versión automáticamente (CI/CD).

### HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo certbot renew --dry-run
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | HTTP port |
| `ADMIN_PASSWORD` | **Yes** | — | Admin panel password |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated CORS origins |
| `NODE_ENV` | No | `development` | `production` enables optimizations |
| `DB_PATH` | No | `./data/reproductor.db` | SQLite file path |
| `COINGECKO_URL` | No | (default URL) | Override for economic API |
| `DRIFT_THRESHOLD` | No | 1 | Seconds of drift before correction |
| `BROADCAST_INTERVAL` | No | 2000 | ms between sync:state broadcasts |

## Socket.IO Events

### Server → Client

| Event | Payload | When |
|-------|---------|------|
| `sync:state` | `{ video, position, isPlaying, playlist, timestamp }` | Every 2s, and on connect |
| `playlist:update` | `{ playlist }` | When playlist changes |
| `video:advance` | `{ video, position, timestamp }` | When current video ends |
| `drift:correct` | `{ position, timestamp }` | When client drift > threshold |
| `error:video` | `{ message, videoId }` | When video fails to load |

### Client → Server

| Event | Payload | When |
|-------|---------|------|
| `client:ready` | `{ clientTime }` | On page load + Socket.IO connect |
| `client:heartbeat` | `{ position, clientTime }` | Every 5s |
| `client:reconnect` | `{ lastKnownPosition, clientTime }` | On Socket.IO reconnect |

## Embedding the Player

```html
<iframe
  src="https://reproductor-pro.onrender.com/player"
  width="800"
  height="500"
  frameborder="0"
  allow="autoplay; fullscreen"
  allowfullscreen
></iframe>
```
