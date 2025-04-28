# bitBingo Frontend (React)

This is the frontend for [bitBingo](https://bitBingo.sats4.life), a trustless, Bitcoin-powered bingo system.

## Features

- Upload participant CSV (admin)
- Submit Bitcoin transaction ID (admin)
- Player login with nickname (from CSV)
- View assigned bingo cards
- Live game state: drawn numbers, card marking, win detection
- Game Master controls (draw, end/continue game in special modes)
- Responsive, Bootstrap-based UI

## Getting Started

### Prerequisites
- Node.js v20+
- pnpm (preferred) or npm

### Install dependencies
```bash
pnpm install
```

### Environment Variables
Create a `.env` file in the `client/` directory (or set env vars before build):
```
REACT_APP_API_URL=http://localhost:5000
```
Set this to your backend API URL for local/dev/prod as needed.

### Run the app
```bash
pnpm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for production
```bash
pnpm build
```
The static files will be in `build/`.

### Run tests
```bash
pnpm test
```

## Project Structure
- `src/components/` — UI components (login, cards, game state, admin tools)
- `src/types/` — TypeScript interfaces for card/user/game data
- `src/lib/` — Utility functions
- `public/` — Static assets

## Main UI Flow
- **Admin**: Upload CSV → get CID → create Bitcoin TX → submit TXID → share game link
- **Player**: Open game link → enter nickname → view cards → watch game progress

## Notes
- All game logic is deterministic and verifiable (see backend and docs).
- The frontend only consumes backend outcomes; all business rules are enforced server-side.

## License
MIT
