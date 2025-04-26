# BitBingo Verification Process

This document outlines the deterministic processes used in BitBingo for generating bingo cards and drawing numbers, ensuring provable fairness and verifiability.

## Bingo Card Generation

Each bingo card is uniquely and deterministically generated based on the user's position in the participant list (CSV file) and the Bitcoin block preceding the one that confirmed the IPFS CID transaction. This ensures that once the transaction is confirmed, the cards are fixed and can be independently verified.

Here's the step-by-step process triggered when a user requests their cards using their `nickname` and the `transactionId` anchoring the participant list:

1.  **Fetch Transaction:** The backend retrieves the Bitcoin transaction details using the provided `transactionId` via the BlockCypher API.
2.  **Validate Confirmation:** The system checks if the transaction is confirmed and retrieves its `block_height`. If not confirmed, card generation cannot proceed.
3.  **Get Previous Block Hash:** The backend fetches the full block details for the *previous* block (`block_height - 1`) to get its `blockHash` (referred to as `prevBlockHash`). This hash serves as the primary seed for card generation.
4.  **Extract IPFS CID:** The backend extracts the participant list's IPFS CID (in hex format) from the `OP_RETURN` data within the confirmed transaction's outputs.
5.  **Fetch Participant List:** The hex CID is converted back to a standard IPFS CID string (e.g., "bafk...") and used to fetch the participant CSV file from an IPFS gateway (like Pinata).
6.  **Parse CSV & Find User:** The CSV content is parsed. The backend finds all line numbers (1-based index) where the provided `nickname` appears in the 'name' column (case-insensitive). Each matching line corresponds to one bingo card for the user.
7.  **Derive Public Key:** For *each* `lineIndex` found for the user:
    *   A unique BIP32 hierarchical deterministic (HD) public key is derived.
    *   **Seed:** The `prevBlockHash` (obtained in step 3) is used as the seed for the BIP32 root node.
    *   **Derivation Path:** The path `m/44'/0'/0'/0/{lineIndex}` is used, ensuring each line number results in a unique key.
    *   The resulting `publicKey` (as a Buffer) is specific to that participant line and the `prevBlockHash`.
8.  **Generate Bingo Card Grid:** For *each* derived `publicKey`:
    *   The `publicKey` is hashed using SHA-256.
    *   This hash is used as a source of deterministic pseudo-randomness to populate the 5x5 bingo grid.
    *   Numbers are selected sequentially for columns B, I, N, G, O within their standard ranges (B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75), ensuring uniqueness within each column.
    *   Bytes are consumed from the SHA-256 hash to select numbers. If the initial hash runs out of bytes, it's re-hashed to continue generation.
    *   The center square ('N'[2]) is always marked as free (null).
    *   A `cardId` is generated using the last few digits of the public key's hex representation.
9.  **Return Cards:** The generated card data (grid, cardId, lineIndex) for all matching lines is returned to the user's frontend.

This entire process is deterministic. Anyone with the `transactionId` can independently fetch the `prevBlockHash`, the IPFS CSV, find the user's line number(s), and re-run the derivation and card generation steps to verify the cards are correct and haven't been tampered with.

## Number Drawing (To Be Implemented)

*(Details to be added once implemented - will also be deterministic based on the confirmation block hash)* 