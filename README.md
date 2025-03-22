# bitRaffle

A trustless, automated, blockchain-based raffle system. bitRaffle uses Bitcoin's blockchain to provide transparent and verifiable raffle drawings that cannot be manipulated.

## How It Works

1. **Upload Participants**: Upload a CSV file containing all participant tickets
2. **IPFS Storage**: The system uploads the CSV file to IPFS and converts the CID to hex format
3. **External Transaction**: The user creates a Bitcoin transaction (in their own wallet) with the hex CID in an OP_RETURN output, and submits the transaction ID to the app
4. **Transaction Monitoring**: The app monitors the Bitcoin transaction until it's confirmed in a block and retrieves the actual blockhash
5. **Drawing Winner**: The winner is determined using the last 8 characters of the blockhash through a mathematical calculation
6. **Verification**: Anyone can verify the winner by performing the same calculation with the public blockhash

## Requirements

- Node.js 14+ (16+ recommended)
- npm 6+ (7+ recommended)
- Bitcoin wallet (for creating the transaction)
- Internet connectivity to access the Bitcoin API

## Installation

### Clone the repository

```bash
git clone https://github.com/yourusername/bitRaffle.git
cd bitRaffle
```

### Set up the server

```bash
cd server
npm install
```

### Set up the client

```bash
cd ../client
npm install
```

### Configure environment variables

Create a `.env` file in the server directory with your settings:

```
PORT=5000
NODE_ENV=development

# Pinata (IPFS) Configuration
PINATA_JWT_KEY=your_pinata_jwt_key_here
```

## Usage

### Start the server

```bash
cd server
npm run dev
```

### Start the client

```bash
cd client
npm start
```

Access the application at http://localhost:3000

## CSV Format

The CSV file should contain participant information with one ticket per line. The first line should be a header row.

Example:

```
name
John Doe
Jane Smith
Bob Johnson
```

## Creating the Bitcoin Transaction

After uploading the participants list, you will:

1. Copy the hex CID displayed in the application
2. Create a Bitcoin transaction with an OP_RETURN output containing this hex data in your preferred wallet
3. Submit the transaction ID back to the application
4. The app will monitor for confirmation and retrieve the actual blockhash when confirmed
5. The blockhash is then used for the winner drawing

## IPFS Integration

The system persists the participant list to IPFS for audit purposes. You'll need:

1. A Pinata JWT API key
2. Update the `.env` file with your Pinata credentials

## Security Considerations

- **Improved Security**: Your Bitcoin private keys stay in your wallet - the app never handles them
- **Participant Data**: Consider privacy implications when storing participant data
- **CSV Validation**: Ensure your CSV files are properly formatted to avoid errors
- **Blockchain Verification**: The app uses real blockchain data for drawing winners, not simulated values

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

## License

MIT 