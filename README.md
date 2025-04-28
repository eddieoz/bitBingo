# bitBingo

A trustless, automated, Bitcoin-based bingo system that uses Bitcoin's blockchain for transparent, verifiable, and manipulation-resistant game outcomes.

## Architecture Overview

- **Backend**: Node.js (Express), in-memory game state, deterministic bingo logic, IPFS (Pinata) for CSV storage, BlockCypher for Bitcoin data.
- **Frontend**: React (Create React App) - migrating to Next.js, Bootstrap UI, communicates with backend via REST API.
- **Game Logic**: All randomness is derived from the Bitcoin block hash (via BIP32 HD key derivation), ensuring provable fairness.

## How It Works

1. **Admin uploads CSV**: List of participants (one per line, header `name`).
2. **CSV stored on IPFS**: The app uploads the CSV to IPFS (via Pinata) and returns a CID (hex-encoded).
3. **Admin creates Bitcoin TX**: The CID (hex) is embedded in a Bitcoin transaction's OP_RETURN output (e.g., using Electrum).
4. **Admin submits TXID**: The app monitors the transaction for confirmation.
5. **Blockhash as randomness**: Once confirmed, the block hash is used as the seed for all game randomness (card generation, number draws).
6. **Game link shared**: Players receive a link (with TXID) to join and view their cards.
7. **Game proceeds**: Numbers are drawn deterministically; cards are marked; winners are announced automatically.
8. **Anyone can verify**: All results are reproducible using public data (block hash, CSV, open-source logic).

## Backend API Endpoints

- `POST /api/check-transaction` — Initialize a game from a TXID and participant file (admin only).
- `POST /api/draw/:txid` — Draw the next bingo number (Game Master only, requires token).
- `POST /api/end-game/:txid` — Manually end a game (for partial win mode, GM only).
- `POST /api/continue-game/:txid` — Continue after a partial win (GM only).
- `GET /api/game-state/:txid` — Get current game state (drawn numbers, winners, etc.).
- `GET /api/cards/:txid/:nickname` — Get all cards for a user in a game.

## Requirements

- Node.js v20+
- pnpm (preferred) or npm
- Bitcoin wallet (for creating the transaction)
- Pinata JWT API key (for IPFS storage)
- Internet connectivity

## Installation

1. Clone the repository:
```bash
git clone https://github.com/eddieoz/bitBingo.git
cd bitBingo
```

2. Install dependencies (using pnpm):
```bash
pnpm install
```

3. Configure environment variables:
Create a `.env` file in the `server/` directory:
```
PORT=5000
NODE_ENV=development
PINATA_JWT_KEY=your_pinata_jwt_key_here
```

## Usage

1. Start the backend:
```bash
cd server
pnpm start
```

2. Start the frontend:
```bash
cd ../client
pnpm start
```

3. Access the app at [http://localhost:3000](http://localhost:3000)

## Running with Docker

1. Ensure you have a `.env` file in `server/` as above.
2. Build and run:
```bash
docker compose build
docker compose up
```
- Client: [http://localhost:3000](http://localhost:3000)
- Server: [http://localhost:5000](http://localhost:5000)

## CSV Format

CSV must have a header row `name` and one nickname per line:
```
name
Alice
Bob
Charlie
```

## Verification

- All randomness (card generation, number draws) is derived from the block hash of the confirmed Bitcoin transaction.
- Cards: For each participant, derive a BIP32 public key using the block hash (SHA-256) as the seed and path `m/44'/0'/0'/0/{lineIndex}`. The card grid is generated from the public key (see `server/utils.js`).
- Drawn numbers: For each draw, derive a public key at the next index, take the last 4 bytes, convert to an integer, and map to 1–75.
- Anyone can verify results using the public block hash, the original CSV, and the open-source logic (see `docs/verification.md`).

## Testing

- **Backend**: From `server/`, run:
  ```bash
  pnpm test
  ```
- **Frontend**: From `client/`, run:
  ```bash
  pnpm test
  ```

## Security Considerations

- Private keys are never handled by the app.
- All randomness is public and verifiable.
- CSVs should not contain sensitive data.

## License

MIT 
