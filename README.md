# bitRaffle

A trustless, automated, Bitcoin-based raffle system that uses Bitcoin's blockchain to provide transparent and verifiable raffle drawings that cannot be manipulated.

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

## Running with Docker

Alternatively, you can run the application using Docker and Docker Compose.

**Prerequisites:**
- Docker installed
- Docker Compose installed

**Steps:**

1.  **Configure Environment Variables:**
    Ensure you have a `.env` file in the `server/` directory with your `PINATA_JWT_KEY`, as described in the Installation section. The Docker setup mounts the local directory, so this file will be used by the container.
    ```
    # server/.env
    PORT=5000
    NODE_ENV=development
    PINATA_JWT_KEY=your_pinata_jwt_key_here
    ```

2.  **Build the Docker Image:**
    ```bash
    docker compose build
    ```

3.  **Run the Application:**
    ```bash
    docker compose up
    ```
    This command will start both the client and server services.

4.  **Access the Application:**
    - Client UI: [http://localhost:3000](http://localhost:3000)
    - Server API (for client requests): [http://localhost:5000](http://localhost:5000)

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

## Deployment

To deploy bitRaffle to a demo or production environment, consider the following:

1.  **Environment Variables**: Configure the necessary environment variables in your deployment environment. These are typically set through the hosting provider's interface.
    *   `server/.env`:
        *   `NODE_ENV`: Set to `production` for optimized performance and security.
        *   `PINATA_JWT_KEY`: **Required**. Your secret JWT key from Pinata for IPFS uploads.
        *   `PORT`: Your hosting provider might set this automatically. The server will use `process.env.PORT` if available, otherwise defaulting to `5000`.
        *   `BLOCKCYPHER_NETWORK`: (Optional) Set to `main` or `testnet`. Defaults to `main`.
        *   `BLOCKCYPHER_API_BASE_URL`: (Optional) Override the default BlockCypher API endpoint (`https://api.blockcypher.com/v1`).
        *   `PINATA_PUBLIC_GATEWAY_BASE`: (Optional) Set the base URL for public IPFS links generated (e.g., `https://ipfs.io/ipfs`). Defaults to `https://gateway.pinata.cloud/ipfs`.
    *   Client Build:
        *   `REACT_APP_API_URL`: **Required**. The full URL to your deployed backend API (e.g., `https://your-demo-site.com/api`). This needs to be available during the *client build process*.

2.  **Build Client**: The React frontend needs to be built into static assets.
    ```bash
    cd client
    # Set the API URL environment variable for the build
    REACT_APP_API_URL=https://your-backend-url/api npm run build
    cd ..
    ```
    The static files will be in `client/build/`.

3.  **Server Deployment**: Deploy the `server/` directory.
    *   Ensure only production dependencies are installed (`npm ci --only=production` inside the `server` directory).
    *   Start the server using `node index.js`.
    *   Make sure the server can access the configured `PORT`.

4.  **Serving Client Assets**: The static client assets (`client/build/`) need to be served.
    *   Option A: Configure the Node.js server (in `server/index.js`) to serve static files from the `client/build` directory.
    *   Option B: Use a reverse proxy (like Nginx or your hosting platform's equivalent) to serve the static files and route API requests (e.g., `/api/*`) to the Node.js backend.

5.  **Dockerfile for Production**: If using Docker, adapt the `Dockerfile` and `docker-compose.yml` for production.
    *   Use a multi-stage build: Stage 1 builds the client, Stage 2 copies server code, installs *production* dependencies, copies client build artifacts, and sets the `CMD` to `node index.js`.
    *   Do not mount local volumes for code in production.
    *   Ensure environment variables are passed correctly to the container.

## License

MIT 
