# How to Use bitBingo

Welcome to [bitBingo](https://bitBingo.sats4.life), a trustless and transparent bingo system powered by Bitcoin's blockchain. This guide covers both **Admins** (who run games) and **Players** (who participate).

## Quick Start

**For Admins:**
1. Prepare a CSV with a `name` header and one nickname per line.
2. Upload the CSV to bitBingo (get a hex CID).
3. Create a Bitcoin transaction with `OP_RETURN YOUR_CID_HEX_VALUE` (e.g., in Electrum).
4. Submit the TXID to bitBingo.
5. Share the game link (`/play/YOUR_TXID`) with players.
6. Wait for blockchain confirmation. The game runs automatically.

**For Players:**
1. Receive the game link from the admin.
2. Open the link in your browser.
3. Log in with your nickname (as in the CSV).
4. Watch your cards update as numbers are drawn.
5. See if you win when the game concludes.

## Detailed Instructions

### For Admins

#### 1. Prepare Your Participant List
- Create a CSV file with a header row `name` and one nickname per line.
- Example:
  ```csv
  name
  Alice
  Bob
  Charlie
  ```

#### 2. Upload CSV to bitBingo
- Go to [bitBingo](https://bitBingo.sats4.life).
- Use the "Upload Participants" feature.
- Select your CSV file.
- The system uploads it to IPFS and gives you a **hex CID**.

#### 3. Create a Bitcoin Transaction
- Use a wallet that supports custom scripts (e.g., Electrum).
- In the **Send** tab, enter: `script(OP_RETURN YOUR_CID_HEX_VALUE)`
- Set amount to zero, choose a fee, sign, and broadcast.
- Copy the **TXID** after broadcasting.

#### 4. Submit the TXID & Share the Game Link
- Return to bitBingo and enter the TXID.
- The app generates a unique game link: `/play/YOUR_TXID`
- Share this link with all participants.

#### 5. Wait for Confirmation & Results
- The app monitors the blockchain for confirmation.
- Once confirmed, the block hash is used for all randomness.
- Numbers are drawn, cards are marked, and winners are determined automatically.

#### 6. View Winners
- Winners are displayed on the game page after the game concludes.
- Admins and players see the same results.

#### 7. Game Modes
- **fullCardOnly**: Only full-card bingos win.
- **partialAndFull**: Partial wins (e.g., line bingo) can end the game early, or the game can continue to full card (admin-controlled).

### For Players

#### 1. Receive the Game Link
- The admin will share a link like `/play/SOME_TXID`.

#### 2. Access the Game Page
- Open the link in your browser.
- You'll see the game interface for that raffle.

#### 3. Log In
- Enter your nickname (exactly as in the CSV).
- Click "Login".

#### 4. View Your Cards & Game Progress
- Your assigned bingo card(s) will appear.
- Drawn numbers are shown and cards are marked automatically.
- The page updates live as the game progresses.

#### 5. Check for Winners
- When a win is detected, a banner appears with the winner(s) and card IDs.
- If you win, your card will be highlighted.

### 6. Verify the Results (Optional)
- Anyone can verify the results using the TXID, block hash, and original CSV.
- See [docs/verification.md](verification.md) for step-by-step instructions.

## Troubleshooting

- **TX not confirming?** Check your fee; use RBF if needed.
- **CSV upload failing?** Ensure the header is `name` and each nickname is unique.
- **Login failing?** Double-check your nickname matches the CSV exactly.
- **Game not starting?** The TX may not be confirmed yet. Check the TXID on a block explorer.
- **Verification mismatch?** Ensure you use the exact block hash and correct CSV. See [verification guide](verification.md).

## Notes
- All randomness is derived from the Bitcoin block hash and is fully deterministic and verifiable.
- No private keys are ever handled by the app.
- The process is transparent and trustless: anyone can audit the results.

## See Also
- [docs/verification.md](verification.md) for technical verification steps
- [README.md](../README.md) for architecture and API details
