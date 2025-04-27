# BitBingo Verification Process

This document outlines the deterministic processes used in BitBingo for generating bingo cards and drawing numbers, ensuring provable fairness and verifiability.

## Bingo Card Generation

Each bingo card is uniquely and deterministically generated based on the user's position in the participant list (CSV file) and the Bitcoin block that confirmed the IPFS CID transaction. This ensures that once the transaction is confirmed, the cards are fixed and can be independently verified.

Here's the step-by-step process triggered when a user requests their cards using their `nickname` and the `transactionId` anchoring the participant list:

1.  **Fetch Transaction:** The backend retrieves the Bitcoin transaction details using the provided `transactionId` via the BlockCypher API.
2.  **Validate Confirmation:** The system checks if the transaction is confirmed and retrieves its `block_hash` and `block_height`. If not confirmed, card generation cannot proceed.
3.  **Calculate Seed Base:** The backend calculates the SHA-256 hash of the confirmation `block_hash`. This resulting hash (referred to as `seedBase`) serves as the primary seed for card generation.
4.  **Extract IPFS CID:** The backend extracts the participant list's IPFS CID (expected as a hex representation of the UTF-8 CID string) from the `OP_RETURN` data within the confirmed transaction's outputs.
5.  **Fetch Participant List:** The hex data is converted back to a standard IPFS CID string (e.g., "bafk...") and used to fetch the participant CSV file from an IPFS gateway (like Pinata).
6.  **Parse CSV & Find User:** The CSV content is parsed using standard CSV header detection (the first row is treated as a header and skipped). The backend finds all line indices (0-based array index, starting from the first *data* row after the header) where the provided `nickname` appears (case-insensitive). Each matching line corresponds to one bingo card for the user.
7.  **Derive Public Key:** For *each* `lineIndex` found for the user:
    *   A unique BIP32 hierarchical deterministic (HD) public key is derived.
    *   **Seed:** The `seedBase` (SHA256 hash of the confirmation block hash, obtained in step 3) is used as the seed for the BIP32 root node.
    *   **Derivation Path:** The path `m/44'/0'/0'/0/{lineIndex}` is used, ensuring each line number (starting from 0 for the first participant after the header) results in a unique key.
    *   The resulting `publicKey` (as a Buffer, typically compressed 33-byte format) is specific to that participant line and the `seedBase`.
8.  **Generate Bingo Card Grid:** For *each* derived `publicKey` (Buffer):
    *   The `publicKey` Buffer is converted to its **hexadecimal string representation** (`publicKeyHex`, typically 66 characters for compressed keys).
    *   This `publicKeyHex` string is then hashed using SHA-256.
    *   This resulting hash is used as a source of deterministic pseudo-randomness to populate the 5x5 bingo grid.
    *   Numbers are selected sequentially for columns B, I, N, G, O within their standard ranges (B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75), ensuring uniqueness within each column.
    *   Bytes are consumed from the SHA-256 hash to select numbers. If the initial hash runs out of bytes, it's re-hashed (incorporating the current offset) to continue generation.
    *   The center square ('N'[2]) is always marked as free (null).
    *   A `cardId` is generated specifically using the format `card-{last 8 hex characters of publicKeyHex}`. (Example: If `publicKeyHex` ends in `...d3c53754`, the `cardId` is `card-d3c53754`).
9.  **Return Cards:** The generated card data (grid, cardId, lineIndex, username) for all matching lines is returned to the user's frontend.
10. **(Implementation Detail) Caching:** The backend caches the results (confirmation block hash, participant list) keyed by the `transactionId` to improve performance on subsequent requests for the same game session.

This entire process is deterministic. Anyone with the `transactionId` can independently fetch the confirmation `block_hash`, calculate its SHA-256 (`seedBase`), fetch the IPFS CSV, find the user's 0-based line index(es), and re-run the derivation and card generation steps to verify the cards are correct and haven't been tampered with.

### Manual Card Verification Steps

To manually verify a specific bingo card for a given user:

1.  **Obtain Inputs:**
    *   `transactionId`: The Bitcoin transaction ID anchoring the game's participant list.
    *   `nickname`: The username whose card you want to verify.
2.  **Find Confirmation Block Hash:** Use a block explorer (e.g., mempool.space, blockstream.info) to find the `transactionId`. Note down the `block_hash` of the block it was confirmed in.
3.  **Calculate Seed Base:** Calculate the SHA-256 hash of the `block_hash` obtained in step 2. You can use online tools or command-line utilities (e.g., `echo -n "BLOCK_HASH" | sha256sum`). This result is the `seedBase` (hex string).
4.  **Find OP_RETURN Data:** In the transaction details (from step 2), find the output with `script_type` as `null-data`. Copy the `data_hex` value.
5.  **Decode IPFS CID:** Convert the `data_hex` from step 4 back into a readable string (UTF-8). You can use online hex-to-string converters. The result should be an IPFS CID (e.g., `baf...` or `Qm...`).
6.  **Fetch Participant List:** Use an IPFS gateway (like `https://ipfs.io/ipfs/YOUR_CID` or `https://gateway.pinata.cloud/ipfs/YOUR_CID`) to view the CSV file content using the CID from step 5.
7.  **Find User's Line Index:** Carefully examine the CSV content, skipping the header row. Find the line number where the `nickname` appears. Remember this is a **0-based index** relative to the *first data row* (e.g., the first name after the header is index 0, the second is index 1, etc.). Let this be `lineIndex`.
8.  **Derive Public Key using BIP32 Tool:**
    *   Go to a reliable BIP32 derivation tool, like Ian Coleman's [https://iancoleman.io/bip39/](https://iancoleman.io/bip39/) (ensure you are using a secure, offline version if concerned about seed exposure, although here we use a public hash as the seed).
    *   In the "BIP39 Mnemonic" field, **clear any existing words**. We are not using a mnemonic.
    *   Select the "BIP32" tab.
    *   In the "BIP32 Root Key" field, paste the `seedBase` (hex string from step 3).
    *   Select the "BIP32" Derivation Path tab.
    *   Set the derivation path to `m/44'/0'/0'/0/{lineIndex}` (replace `{lineIndex}` with the number from step 7).
    *   Find the derived public key for this path in the "Derived Addresses" table. Copy the **compressed public key** (hex string, should start with `02` or `03`, 66 characters long). Let this be `publicKeyHex`.
9.  **Generate Card Grid (Manual Simulation):** This is the most complex part to do purely manually. It requires simulating the `generateBingoCard` function logic:
    *   Take the `publicKeyHex` (compressed hex string starting with `02` or `03`, from step 8).
    *   Calculate the SHA-256 hash **of this hex string**. You can use online tools or command-line utilities (e.g., `echo -n "PUBLIC_KEY_HEX_STRING" | sha256sum`). Let the result be `cardSeedHash`.
    *   Convert the `cardSeedHash` (hex) into a byte buffer.
    *   Iterate through columns B, I, N, G, O:
        *   For each column, generate 5 unique numbers within its range (B:1-15, I:16-30, N:31-45, G:46-60, O:61-75). Skip the 3rd slot (index 2) for column N (it's FREE).
        *   To generate a number: Take the next 2 bytes from the SHA-256 hash (use Big Endian), convert to an integer `hashInt`. Calculate `num = (hashInt % rangeSize) + rangeMin`. If the number is already used in the column, take the *next* 2 bytes and repeat until a unique number is found.
        *   If you run out of bytes in the SHA-256 hash, re-hash the *current* hash value (potentially combined with an offset, as per the implementation) to get a new hash to continue drawing bytes from.
    *   Compare the resulting manually generated grid with the card displayed in the BitBingo application for that user and `lineIndex`.
    *   **Verify Card ID:** Check that the `cardId` displayed in the app matches `card-{last 8 hex characters of publicKeyHex}`.

**(Note:** Step 9 is computationally intensive to perform by hand. Verifying the derived `publicKeyHex` in step 8 provides strong assurance, as the subsequent card generation from that key is deterministic library code.)

## Number Drawing

The sequence of drawn numbers is also deterministic, derived from the same `seedBase` (SHA256 of the confirmation block hash) using sequential derivation indices.

1.  **Base Seed:** The `seedBase` (SHA256 hash of the confirmation block hash) is used, identical to card generation.
2.  **Sequential Derivation:** Numbers are drawn based on an incrementing derivation index, starting from `index = 0`.
3.  **Derive Public Key:** For each potential draw `index` (starting at 0), derive the public key using the `seedBase` and the path `m/44'/0'/0'/0/{index}`.
4.  **Hash to Number:** Take the derived `publicKey` (Buffer). Take the **last 4 bytes** of this raw buffer, interpret them as a 32-bit unsigned Big Endian integer (`decimalValue`). Calculate the bingo number as `(decimalValue % 75) + 1`. (Note: This differs from card generation; it does *not* use SHA256 here).
5.  **Ensure Uniqueness:** Check if the generated `bingoNumber` has already been drawn in the current game sequence. If it *has* been drawn, **discard this number and increment the `index`**, then repeat steps 3 and 4 with the new `index` until a unique number is found.
6.  **Add to Sequence:** Once a unique `bingoNumber` is found, it is added to the official sequence of drawn numbers for the game, and the system records the `index` that successfully generated it.
7.  **Next Draw:** The next draw attempt will start by trying the `index` immediately following the last successfully used index.

### Manual Number Sequence Verification Steps

To manually verify the sequence of drawn numbers:

1.  **Obtain Inputs:**
    *   `transactionId`: The Bitcoin transaction ID anchoring the game.
    *   The sequence of drawn numbers as displayed by the BitBingo application.
2.  **Find Confirmation Block Hash:** As in card verification (step 2), find the `block_hash` for the `transactionId`.
3.  **Calculate Seed Base:** As in card verification (step 3), calculate the SHA-256 hash of the `block_hash` to get the `seedBase` (hex).
4.  **Iterate and Verify:**
    *   Initialize an empty list for your manually verified sequence `verifiedSequence = []`.
    *   Initialize the derivation index `currentIndex = 0`.
    *   Loop until `verifiedSequence` matches the length of the sequence shown in the application:
        *   **Derive Key:** Use the BIP32 tool (as in card step 8) with the `seedBase` and derivation path `m/44'/0'/0'/0/{currentIndex}`. Get the **compressed** `publicKeyHex`.
        *   **Hash to Number (Manual):** Take the `publicKeyHex` obtained from the tool. Take the **last 8 characters** (representing the last 4 bytes) of this **compressed** hex string. Convert this 8-character hex substring to a decimal integer (`decimalValue`). Calculate `bingoNumber = (decimalValue % 75) + 1`.
        *   **Check Uniqueness:** See if `bingoNumber` is already present in `verifiedSequence`.
        *   **If Unique:** Add `bingoNumber` to `verifiedSequence`.
        *   **Increment Index:** Always increment `currentIndex = currentIndex + 1` (regardless of whether the number was unique or not).
    *   Compare your `verifiedSequence` with the sequence shown in the application. They should match exactly in number and order.

## Winner Verification

Once the drawn number sequence is verified, winner verification is straightforward:

1.  **Obtain Winner's Card(s):** Generate or retrieve the specific card grid(s) for the declared winner using the manual card verification steps above.
2.  **Obtain Drawn Sequence:** Use the verified sequence of drawn numbers.
3.  **Check for Bingo:** Examine the winner's card(s) against the drawn sequence. A win requires 5 marked squares in a line (row, column, or diagonal). Remember the center 'N' square (FREE) is always considered marked.
4.  **Verify Winning Line:** Ensure the winning line claimed matches one of the valid bingo patterns on the card, using only numbers from the verified drawn sequence (and the FREE space if applicable).

This multi-stage verification process allows any participant or observer to confirm the fairness of the card distribution, the number draw, and the declared winner(s). 