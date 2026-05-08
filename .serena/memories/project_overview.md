bitBingo is a trustless, automated, Bitcoin-based bingo system that uses Bitcoin's blockchain for transparent, verifiable, and manipulation-resistant game outcomes.

Architecture Overview:
- Backend: in-memory game state, deterministic bingo logic, IPFS (Pinata) for CSV storage, multi-provider Bitcoin data (mempool.space, blockstream.info, blockchain.info — tried in order).
- Frontend: communicates with backend via REST API.
- Game Logic: All randomness is derived from the Bitcoin block hash (via BIP32 HD key derivation), ensuring provable fairness.

How It Works:
1. Admin uploads CSV: List of participants (one per line, header `name`).
2. CSV stored on IPFS: The app uploads the CSV to IPFS (via Pinata) and returns a CID (hex-encoded).
3. Admin creates Bitcoin TX: The CID (hex) is embedded in a Bitcoin transaction's OP_RETURN output.
4. Admin submits TXID: The app monitors the transaction for confirmation.
5. Blockhash as randomness: Once confirmed, the block hash is used as the seed for all game randomness.
6. Game link shared: Players receive a link (with TXID) to join and view their cards.
7. Game proceeds: Numbers are drawn deterministically; cards are marked; winners are announced automatically.
8. Anyone can verify: All results are reproducible using public data.