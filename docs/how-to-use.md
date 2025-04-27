# How to Use bitBingo

Welcome to [bitBingo](https://bitBingo.sats4.life), a trustless and transparent raffle system powered by Bitcoin's blockchain. This guide will walk you through the steps for both **Raffle Administrators** (running the raffle) and **Players** (participating).

## Quick Start

**For Admins:**
1.  **Prepare participant list** (CSV with "name" header).
2.  **Upload CSV** to bitBingo platform (get Hex CID).
3.  **Create Bitcoin TX** with `OP_RETURN YOUR_CID_HEX_VALUE`.
4.  **Submit TXID** to bitBingo.
5.  Share the **Game Link** (`https://bitBingo.sats4.life/play/YOUR_TXID`) with players.
6.  Wait for blockchain confirmation. Winners are automatically determined.

**For Players:**
1.  Receive the **Game Link** from the admin.
2.  Visit the link in your browser.
3.  **Log in** using your nickname (as listed in the admin's CSV).
4.  Watch the game unfold and see your cards marked automatically.
5.  Check if you're a winner once the game concludes.

## Detailed Instructions

### For Raffle Administrators

#### Step 1: Prepare Your Participant List

Create a CSV file with your participants. The file must:
- Have a header row exactly matching `name`.
- List each participant's unique nickname on a separate line.

Example CSV:
```csv
name
PlayerOne
LuckyPlayer
BingoFan_99
AliceW
```

*(Spreadsheet software like Excel or Google Sheets can export/save as CSV.)*

#### Step 2: Upload Your CSV to bitBingo

1.  Visit [https://bitBingo.sats4.life](https://bitBingo.sats4.life) (or the admin-specific portal, if separate).
2.  Use the "Upload Participants" (or similar) feature.
3.  Select your CSV file.
4.  The system processes the file, uploads it to IPFS, assigns Bingo cards, and provides a **CID (Content Identifier) in hex format**.
5.  **Copy this hex value** - it's crucial for the next step.

#### Step 3: Create a Bitcoin Transaction

You need a Bitcoin wallet supporting custom scripts (like Electrum) to embed the CID.

**Using Electrum Wallet (recommended):**
1.  Install [Electrum](https://electrum.org/).
2.  Go to the **Send** tab.
3.  In **Pay to**, enter: `script(OP_RETURN YOUR_CID_HEX_VALUE)`
    *   *Example:* `script(OP_RETURN 626...)`
4.  Set the **Amount** to **zero**.
5.  Choose an appropriate transaction **fee** (higher fees confirm faster).
6.  Click **Pay...**, then **Sign**, and **Broadcast**.
7.  **Copy the Transaction ID (txid)** immediately after broadcasting.

#### Step 4: Submit the Transaction ID & Share Link

1.  Return to [https://bitBingo.sats4.life](https://bitBingo.sats4.life) (or the admin portal).
2.  Enter the **Transaction ID (txid)** in the designated field.
3.  Click "Submit" (or similar) to register the game.
4.  The system generates a unique **Game Link**: `https://bitBingo.sats4.life/play/YOUR_TXID`
5.  **Share this link with all your participants.**

#### Step 5: Wait for Confirmation & Results

- bitBingo monitors the Bitcoin blockchain for your transaction's confirmation.
- Once confirmed (typically ~10 minutes, depends on fees/network), the block hash is used as a source of randomness to determine the "drawn" numbers.
- The system automatically compares drawn numbers to player cards according to Bingo rules.
- When a winning condition is met, the game concludes, and winners are identified.

#### Step 6: View Winners

- Winners are automatically displayed on the Game Link page (`/play/YOUR_TXID`) once the game concludes.
- As the admin, you can also view the results there.

### For Players

#### Step 1: Receive the Game Link

The raffle administrator will share a unique link, like `https://bitBingo.sats4.life/play/SOME_TRANSACTION_ID`.

#### Step 2: Access the Game Page

Open the link in your web browser. You'll see the game interface for that specific raffle.

#### Step 3: Log In

1.  Find the "Login" or "Enter Nickname" section.
2.  Enter the **exact nickname** that the administrator used for you in their participant list (case-sensitivity might matter).
3.  Click "Login".

#### Step 4: View Your Cards & Game Progress

- Once logged in, you should see your assigned Bingo card(s).
- The page shows the game's Transaction ID.
- It displays the list of numbers "drawn" so far, derived from the Bitcoin block hash once the transaction confirms.
- Your card(s) will automatically mark numbers as they are drawn.
- The page updates automatically (usually every few seconds) to reflect the latest game state.

#### Step 5: Check for Winners

- Keep the page open or revisit it.
- Once the transaction is confirmed and the game logic determines a winner based on the drawn numbers and card patterns, a "BINGO!" banner will appear, announcing the winner(s) by nickname and card ID.
- If you are a winner, your winning card might be highlighted.

### Step 7 (Admin & Players): Verify the Results (Optional)

The transparency of bitBingo allows anyone to verify the results independently.

1.  **Gather Info:**
    *   The **Block Hash** of the Bitcoin block containing the admin's transaction (visible on the game page or a block explorer using the TXID).
    *   The original **participant list (CSV)**. *Note: The admin might need to share this for full verification.*
    *   The **winning sequence** and **winner details** (from the game page).

2.  **Use Ian Coleman BIP39 Tool:**
    *   Go to [https://iancoleman.io/bip39/](https://iancoleman.io/bip39/) (run offline for security if preferred).
    *   In the "**BIP39 Seed**" field (NOT the Mnemonic field), paste the **Block Hash**.
    *   Select the "**BIP44**" tab.
    *   Set the "Coin" type if necessary (usually Bitcoin 0').
    *   Look at the derived addresses/keys under the "Derived Addresses" section. The sequence of these derived keys/addresses provides the deterministic randomness.

3.  **Relate Derived Data to Drawn Numbers/Winners:**
    *   The *exact mechanism* relating the derived keys (e.g., `m/44'/0'/0'/0/0`, `m/44'/0'/0'/0/1`, ...) to the drawn Bingo numbers (1-75) needs to be understood from the bitBingo backend logic (likely found in `server/utils.js` or `server/index.js`). This part of the documentation needs refinement once that logic is fully analyzed.
    *   *Hypothetical Example:* The last few bytes of each derived public key might be converted to a decimal number, and `modulo 75 + 1` could determine the sequence of drawn numbers until a winner is found according to standard Bingo rules applied to the cards generated from the original CSV/CID.

*(The original documentation's example calculation using modulo N was likely for a simpler raffle winner selection, not a full Bingo game simulation. The core principle of using the block hash and BIP32 derivation for deterministic randomness remains.)*

## Troubleshooting

- **Admin: Transaction not confirming?** Check fees; consider fee bumping (e.g., RBF in Electrum).
- **Admin: CSV upload failing?** Ensure format is correct (header `name`, one nickname per line).
- **Player: Login failing?** Double-check your nickname matches the admin's list exactly. Clear browser cache if needed.
- **Player: Game not starting/stuck?** The admin's transaction might not be confirmed yet. Check the TXID on a block explorer ([Blockstream Explorer](https://blockstream.info/)).
- **Verification not matching?** Ensure you're using the *exact* block hash and the *correct* participant list/card generation logic. The specific mapping from derived keys to drawn numbers is critical.

## Remember

- The process aims for trustlessness and transparency.
- Game outcomes are determined by public Bitcoin blockchain data (block hash) and predefined rules.
- No single party controls the random number generation post-transaction.
- Verification is possible but requires understanding the specific derivation path and number generation logic used by *this specific implementation* of bitBingo.

For further questions, refer to the project's GitHub repository or contact information. 
