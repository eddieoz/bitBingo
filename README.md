# bitRaffle

A trustless, automated, blockchain-based raffle system that uses Bitcoin's blockchain to provide transparent and verifiable raffle drawings that cannot be manipulated.

## How It Works

1. **Upload Participants**: Upload a CSV file containing participant tickets
2. **IPFS Storage**: The system uploads the CSV file to IPFS and converts the CID to hex format
3. **External Transaction**: Create a Bitcoin transaction (in your own wallet) with the hex CID in an OP_RETURN output, and submit the transaction ID to the app
4. **Transaction Monitoring**: The app monitors the Bitcoin transaction until it's confirmed in a block and retrieves the blockhash
5. **Drawing Winners**: The specified number of winners are determined using BIP32 key derivation. The blockhash serves as the seed, and winners are selected based on calculations involving the derived public keys.
6. **Verification**: Anyone can verify the winners by replicating the BIP32 derivation and calculations using the public blockhash and participant list.

## Tips on creating the transaction on Electrum
 - Go to the **Send** tab
 - In the **Pay to** field, enter the following format:
   ```
   script(OP_RETURN <CID_hex_format>)
   ```
   Example:
   ```
   script(OP_RETURN 6261666b72656966753377663376717a347537756b747a65367465326c78623537656b777267336e67646a6c346b74676f6167356a667775646769)
   ```
 - Click **Pay...**
 - Select an appropriate transaction fee (consider network congestion for timing)
 - Click **Sign** to authorize the transaction
 - Click **Broadcast** to send the transaction to the network
 - Copy the **Transaction ID** (txid) to the app for monitoring confirmation status
    
    Example:
    ```
    6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002
    ```

## Requirements

- Node.js 14+ (16+ recommended)
- npm 6+ (7+ recommended)
- Bitcoin wallet (for creating the transaction)
- Internet connectivity to access the Bitcoin API
- Pinata JWT API key for IPFS storage

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/bitRaffle.git
cd bitRaffle
```

2. Install dependencies:
```bash
npm run install-all
```

3. Configure environment variables:
Create a `.env` file in the server directory:
```
PORT=5000
NODE_ENV=development
PINATA_JWT_KEY=your_pinata_jwt_key_here
```

## Usage

1. Start the application:
```bash
npm start
```

2. Access the application at http://localhost:3000

## CSV Format

The CSV file should contain participant information with one ticket per line. The first line should be a header row.

Example:
```
name
John Doe
Jane Smith
Bob Johnson
```

## Verification

The raffle's results are verifiable using the confirmed transaction's block hash and the participant list. The process leverages BIP32 Hierarchical Deterministic Wallets, using the block hash as the seed.

1.  **Obtain Data**:
    *   Get the **Block Hash** of the block containing the raffle transaction (this can be found on any Bitcoin block explorer using the transaction ID).
    *   Get the **Participant List** (CSV file) used for the raffle. Note the total **Participant Count**.
    *   Note the **Number of Winners** drawn.

2.  **BIP32 Derivation**:
    *   Use the **Block Hash** as the **BIP39 Seed** (in hex format).
    *   Derive keys using the **BIP44 path** structure: `m/44'/0'/0'/0/i`, where `i` starts at `0` and increments for each winner to be drawn.
    *   For each derivation path, obtain the corresponding **Public Key**.

3.  **Calculate Winner Index**:
    *   For each derived **Public Key**, take the **last 8 characters** of its hexadecimal representation.
    *   Convert these 8 characters to an integer.
    *   Calculate the winner index using the formula:
        ```winner_index = int(publicKey[-8:], 16) mod participant_count```
    *   The participant at this `winner_index` (0-based) in the list is the potential winner for this derivation step.

4.  **Handle Duplicates**:
    *   If a participant is selected more than once, the derivation index `i` is incremented, and a new public key is derived until a unique winner is found. This ensures each participant can only win once per raffle.

5.  **Verify with Ian Coleman Tool**:
    *   You can cross-reference the derivation process using the [Ian Coleman BIP39 tool](https://iancoleman.io/bip39/).
    *   Paste the **Block Hash** (hex) into the "**BIP39 Seed**" field.
    *   Select the "**BIP44**" tab for the derivation path.
    *   Under "**Derived Addresses**", observe the public keys generated for paths `m/44'/0'/0'/0/0`, `m/44'/0'/0'/0/1`, etc.
    *   Compare these public keys and perform the calculation described in step 3 to verify each winner selection.

## Development

- Server: Express.js with Node.js
- Client: React with Bootstrap
- Blockchain: Bitcoin Mainnet/Testnet (configurable)
- Storage: IPFS distributed file system via Pinata
- APIs: BlockCypher for blockchain data

## Security Considerations

- Your Bitcoin private keys stay in your wallet - the app never handles them
- Consider privacy implications when storing participant data
- Ensure CSV files are properly formatted to avoid errors
- The app uses real blockchain data for drawing winners, not simulated values

## License

MIT 
