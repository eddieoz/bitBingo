# Installation
- Install dependencies (using pnpm): `pnpm install`
- Install all including workspaces: `pnpm run install-all`

# Development
- Start everything (using concurrently): `pnpm start`
- Start Backend only: `pnpm run server` or `cd server && pnpm start`
- Start Frontend only: `pnpm run client` or `cd client && pnpm start`

# Docker
- Build: `docker compose build`
- Run: `docker compose up`

# Testing
- Test everything: `pnpm test`
- Test Backend: `cd server && pnpm test`
- Test Frontend: `cd client && pnpm test`

# Environment
Requires `.env` file in `server/` directory:
```
PORT=5000
NODE_ENV=development
PINATA_JWT_KEY=your_pinata_jwt_key_here
```