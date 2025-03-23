# bitRaffle

A trustless, automated, blockchain-based raffle system that uses Bitcoin's blockchain to provide transparent and verifiable raffle drawings that cannot be manipulated.

## How It Works

1. **Upload Participants**: Upload a CSV file containing participant tickets
2. **IPFS Storage**: The system uploads the CSV file to IPFS and converts the CID to hex format
3. **External Transaction**: Create a Bitcoin transaction (in your own wallet) with the hex CID in an OP_RETURN output, and submit the transaction ID to the app
4. **Transaction Monitoring**: The app monitors the Bitcoin transaction until it's confirmed in a block and retrieves the blockhash
5. **Drawing Winner**: The winner is determined using the last 8 characters of the blockhash through a mathematical calculation
6. **Verification**: Anyone can verify the winner by performing the same calculation with the public blockhash

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

To verify a drawing:
1. Get the block hash containing the transaction (can be verified on any blockchain explorer)
2. Get the participant count from the CSV file
3. Perform the calculation: `winner_index = int(block_hash[-8:], 16) % participant_count`
4. The participant at index `winner_index` (zero-based) is the winner

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