const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const utils = require('./utils'); 
const axios = require('axios');
const FormData = require('form-data');
const csvtojson = require('csvtojson');
require('dotenv').config(); // Ensure env vars like PINATA_JWT are loaded

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares ---
app.use(cors()); 
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));

// --- In-Memory Storage --- 
// TODO: Replace with a persistent database for production
const gameStates = new Map(); // txid -> gameState
const uploadedFiles = new Map(); // filename -> filePath

// --- Pinata Config (from bitRaffle) ---
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_UPLOAD_URL = process.env.PINATA_UPLOAD_URL || 'https://uploads.pinata.cloud/v3/files'; 
const PINATA_PUBLIC_GATEWAY_BASE = process.env.PINATA_PUBLIC_GATEWAY_BASE || 'https://gateway.pinata.cloud/ipfs/'; // Example Pinata gateway

// --- File Upload Setup ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Keep original filename but ensure uniqueness if needed (e.g., add timestamp)
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});
const upload = multer({ storage: storage });

// --- Helper: Upload to Pinata (REVERTED to bitRaffle V3 structure) ---
async function uploadToPinata(filePath, fileName) {
  if (!PINATA_JWT) {
      console.error('Pinata JWT key is missing. Cannot upload to IPFS.');
      throw new Error('IPFS configuration error: Missing Pinata JWT.');
  }
  try {
    const fileStream = fs.createReadStream(filePath);
    const formData = new FormData();
    // Match bitRaffle payload
    formData.append('file', fileStream, { filename: fileName }); // Keep filename hint for stream
    formData.append('name', fileName); // Explicit name field
    formData.append('network', 'public'); // Network field used by bitRaffle

    console.log(`[Pinata V3] Uploading ${fileName} to ${PINATA_UPLOAD_URL}`);
    const response = await axios.post(PINATA_UPLOAD_URL, formData, {
      maxBodyLength: Infinity, // Ensure large files are allowed
      headers: {
        // Use the form-data library's generated headers
        ...formData.getHeaders(), 
        // Override Authorization header
        'Authorization': `Bearer ${PINATA_JWT}`
      }
    });
    console.log('[Pinata V3] Upload successful:', response.data);
    // Assuming V3 response structure provides CID directly
    if (!response.data || !response.data.data || !response.data.data.cid) { 
        // Log the actual response for debugging if CID is missing
        console.error('[Pinata V3] Unexpected response structure:', response.data);
        throw new Error('IPFS CID not found in Pinata V3 response data object.');
    }
    return response.data.data.cid; // Return the IPFS CID from V3 response data object
  } catch (error) {
    console.error('[Pinata V3] Error uploading:', error.response?.data || error.message);
    let errorMsg = 'Failed to upload file to IPFS via Pinata V3.';
    if (error.response?.status === 401) {
        errorMsg = 'IPFS upload failed: Invalid Pinata JWT or insufficient scopes for V3 endpoint.';
    } else if (error.response?.data?.error) {
        errorMsg = `IPFS upload failed: ${error.response.data.error}`;
    } else if (error.message.includes('IPFS CID not found')) {
        errorMsg = error.message; // Propagate specific CID error
    }
    throw new Error(errorMsg);
  }
}

// ======================================================
// ==                API Endpoints                     ==
// ======================================================

// --- 1. Upload Participant List (MODIFIED) --- 
app.post('/api/upload-participants', upload.single('participantFile'), async (req, res) => { // Made async
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }
  
  const filePath = req.file.path;
  const originalFilename = req.file.originalname; // Use original name for context
  const uniqueFilename = req.file.filename; // The saved unique name
  console.log(`[Upload] File received: ${uniqueFilename}, Original: ${originalFilename}, Path: ${filePath}`);
  
  try {
      // 1. Count Participants
      console.log(`[Upload] Parsing CSV: ${filePath}`);
      const participants = await csvtojson().fromFile(filePath);
      const participantCount = participants.length;
      if (participantCount === 0) {
        // Clean up the invalid file
        fs.unlinkSync(filePath);
        console.warn(`[Upload] Invalid or empty CSV file uploaded: ${uniqueFilename}`);
        return res.status(400).json({ message: 'CSV file is empty or invalid.' });
      }
      console.log(`[Upload] Found ${participantCount} participants.`);

      // 2. Calculate Hex CID (SHA256 hash of the file content)
      const fileBuffer = fs.readFileSync(filePath);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      console.log(`[Upload] Calculated SHA256 Hex CID: ${fileHash}`);

      // 3. Upload to IPFS via Pinata
      console.log(`[Upload] Uploading ${uniqueFilename} to Pinata...`);
      const ipfsCid = await uploadToPinata(filePath, uniqueFilename); // Use unique name for Pinata
      console.log(`[Upload] IPFS CID received: ${ipfsCid}`);

      // 4. Store file info (optional, as check-transaction uses OP_RETURN now)
      // uploadedFiles.set(uniqueFilename, { filePath, fileHash, ipfsCid }); // Store more info if needed
      // For now, just store path keyed by unique filename, needed by check-transaction? -> No, check-tx uses op_return!
      // Let's keep the simple path storage for now, though it might become redundant if check-tx works fully
      uploadedFiles.set(uniqueFilename, filePath); 

      // 5. Send Response
      res.status(200).json({ 
          message: 'File uploaded successfully!', 
          filename: uniqueFilename, // Return the unique filename used on server
          hexCid: fileHash,         // <-- ADDED
          ipfsCid: ipfsCid,         // <-- ADDED
          participantCount: participantCount // <-- ADDED
      });

  } catch (error) {
      console.error(`[Upload] Error processing file ${uniqueFilename}:`, error);
      // Clean up uploaded file on error
      if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
      }
      // Remove from map if it was added
      uploadedFiles.delete(uniqueFilename);

      res.status(500).json({ 
          message: `Failed to process file: ${error.message}`
      });
  }
});

// --- 2. Check Transaction & Initialize Game --- 
app.post('/api/check-transaction', async (req, res) => {
  const { txid, participantFilename } = req.body;
  console.log(`[Check TX] Received request for TXID: ${txid}, Filename: ${participantFilename}`);

  if (!txid || !participantFilename) {
    return res.status(400).json({ message: 'Missing txid or participant filename.' });
  }

  const participantFilePath = uploadedFiles.get(participantFilename);
  if (!participantFilePath || !fs.existsSync(participantFilePath)) {
    console.error(`[Check TX] Participant file path not found or invalid for filename: ${participantFilename}`);
    return res.status(404).json({ message: 'Participant file not found. Please upload again.' });
  }

  try {
    // Fetch TX data to get block hash and OP_RETURN
    console.log(`[Check TX] Fetching TX data for ${txid}...`);
    const { blockHash, opReturnHex } = await utils.fetchTxDataAndBlockHash(txid);
    console.log(`[Check TX] TX ${txid} confirmed in block ${blockHash}. OP_RETURN hex: ${opReturnHex}`);

    // Fetch participants using the OP_RETURN data (as IPFS CID hex)
    console.log(`[Check TX] Fetching participants from OP_RETURN hex ${opReturnHex}...`);
    const participants = await utils.getParticipantsFromOpReturn(opReturnHex);
    console.log(`[Check TX] Successfully fetched ${participants.length} participants.`);

    // Validate participants against the uploaded file (Optional but recommended)
    // TODO: Implement a check if needed (e.g., compare first few names or count)
    console.log(`[Check TX] Participant validation against uploaded file ${participantFilename} - Skipping for now.`);

    // Initialize Game State if not exists
    if (!gameStates.has(txid)) {
        console.log(`[Check TX] Initializing new game state for ${txid}`);
        const baseSeed = blockHash; // Use block hash as the base seed
        console.log(`[Check TX] Generating cards using base seed (blockhash): ${baseSeed}`);
        const allCards = utils.generateAllCards(participants, baseSeed);
        
        // Clean up uploaded file after use
        fs.unlink(participantFilePath, (err) => {
            if (err) console.error(`[Check TX] Error deleting uploaded file ${participantFilePath}:`, err);
            else console.log(`[Check TX] Cleaned up uploaded file: ${participantFilePath}`);
            uploadedFiles.delete(participantFilename); // Remove from map
        });

        // --- Generate GM Token during initialization --- 
        const initialGmToken = crypto.randomBytes(16).toString('hex');
        console.log(`[Check TX] Generated initial GM Token for ${txid}`);

        gameStates.set(txid, {
            txid: txid,
            status: 'initialized',
            blockHash: blockHash, // Store the block hash
            participants: participants, // Store the fetched participants
            baseSeed: baseSeed,
            cards: allCards, 
            drawnNumbers: [],
            drawSequence: [], // Store the sequence of derived public keys
            nextDerivationIndex: 0, 
            gmToken: initialGmToken, // Store the generated GM token
            lastDrawTime: null,
            creationTime: Date.now(),
            isOver: false, // NEW: Track if the game has a winner
            winners: [] // NEW: Store usernames of winners
        });
        console.log(`[Check TX] Game state for ${txid} successfully initialized with ${allCards.length} cards.`);
        
        // --- Return the newly generated token only on initialization --- 
        res.status(200).json({ 
            message: 'Transaction confirmed and game state initialized/verified.',
            txid: txid,
            blockHash: blockHash,
            participantCount: participants.length,
            gmToken: initialGmToken // Include the new token
        });
        return; // Exit here after sending init response
        
    } else {
        console.log(`[Check TX] Game state for ${txid} already exists.`);
        const existingGameState = gameStates.get(txid); // Retrieve the existing state
        // Optionally update participants if re-checking? For now, assume immutable after init.
        // gameState.participants = participants; // If you want to allow updates
        // gameState.blockHash = blockHash; // Should be the same, but can update

        // --- If game already existed, don't send token ---
        res.status(200).json({
            message: 'Transaction confirmed and game state verified.', // Slightly different message
            txid: txid,
            blockHash: blockHash, // Use the blockHash fetched in this request context
            // Use the retrieved existingGameState here
            participantCount: existingGameState ? existingGameState.participants.length : 0 // Add a check in case it's somehow null/undefined
        });
    }

  } catch (error) {
    console.error(`[Check TX] Error processing transaction ${txid}:`, error.message);
    // Clean up uploaded file even on error?
     if (participantFilePath && fs.existsSync(participantFilePath)) {
        fs.unlink(participantFilePath, (err) => {
            if (err) console.error(`[Check TX] Error deleting uploaded file ${participantFilePath} after error:`, err);
            uploadedFiles.delete(participantFilename); // Remove from map
        });
     }
    
    let statusCode = 500;
    if (error.message.includes('Transaction ID not found')) statusCode = 404;
    if (error.message.includes('Transaction not yet confirmed')) statusCode = 409; // Conflict or Precondition Failed
    if (error.message.includes('No OP_RETURN data') || error.message.includes('IPFS CID')) statusCode = 400; // Bad Request - TX might be invalid
    if (error.message.includes('rate limit reached')) statusCode = 429; // Too Many Requests
    if (error.message.includes('Failed to retrieve or decode participant list')) statusCode = 502; // Bad Gateway (IPFS issue)

    res.status(statusCode).json({ 
        message: `Failed to process transaction: ${error.message}`
    });
  }
});

// --- 3. Draw Next Number (GM Only) --- 
app.post('/api/draw/:txid', (req, res) => {
  const { txid } = req.params;
  const gameState = gameStates.get(txid);

  console.log(`[Draw] Request received for game ${txid}`);

  if (!gameState) {
    console.warn(`[Draw] Game state not found for ${txid}`);
    return res.status(404).json({ message: 'Game not found or not initialized.' });
  }

  // --- GM Token Verification --- 
  const authHeader = req.headers.authorization;
  const providedToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  
  // Token MUST always be provided and match the one generated at initialization
  if (!providedToken) {
      console.warn(`[Draw] Missing GM token for game ${txid}`);
      return res.status(401).json({ message: 'Authorization token required for drawing numbers.'});
  }
  if (providedToken !== gameState.gmToken) {
      console.warn(`[Draw] Invalid GM token provided for game ${txid}. Expected: ${gameState.gmToken ? gameState.gmToken.substring(0,4)+'...' : 'null'}, Got: ${providedToken ? providedToken.substring(0,4)+'...' : 'null'}`); // Added logging
      return res.status(403).json({ message: 'Invalid authorization token.' });
  }
  console.log(`[Draw] GM token verified for ${txid}`);
  
  // --- End GM Token Verification ---

  // --- Check if game already ended ---
  if (gameState.isOver) {
    console.log(`[Draw] Game ${txid} is already over. Winners: ${gameState.winners.join(', ')}`);
    return res.status(400).json({
        message: 'Game is already over.',
        winners: gameState.winners,
        drawnNumbers: gameState.drawnNumbers,
        totalDrawn: gameState.drawnNumbers.length
    });
  }

  if (gameState.drawnNumbers.length >= 75) {
    console.log(`[Draw] All 75 numbers already drawn for game ${txid}`);
    return res.status(400).json({ message: 'All 75 numbers have been drawn.' });
  }

  const index = gameState.nextDerivationIndex;
  const seed = gameState.baseSeed; // Use the stored base seed (block hash)
  let drawnNumber;
  let derivedPublicKey;
  let attempts = 0;
  const maxAttempts = 1000; // Avoid infinite loops

  console.log(`[Draw] Attempting to draw number using index ${index} and seed ${seed.substring(0,8)}...`);
  do {
      try {
          // Derive the public key using the NEXT index
          derivedPublicKey = utils.derivePublicKey(seed, index + attempts);
          // Hash the public key to get a number (1-75)
          drawnNumber = utils.hashPublicKeyToNumber(derivedPublicKey);

          if (gameState.drawnNumbers.includes(drawnNumber)) {
             console.log(`[Draw] Number ${drawnNumber} (from index ${index + attempts}) already drawn, retrying...`);
          }
      } catch (error) {
          console.error(`[Draw] Error during number derivation for game ${txid} at index ${index + attempts}:`, error);
          return res.status(500).json({ message: `Failed to derive number: ${error.message}`});
      }
      attempts++;
      if (attempts > maxAttempts) {
          console.error(`[Draw] Maximum derivation attempts (${maxAttempts}) reached for game ${txid}. Aborting draw.`);
          return res.status(500).json({ message: 'Failed to draw a unique number after many attempts.'});
      }
  } while (gameState.drawnNumbers.includes(drawnNumber));

  // Success! Store the number and update state
  gameState.drawnNumbers.push(drawnNumber);
  gameState.drawSequence.push({ index: index + attempts - 1, publicKey: derivedPublicKey, number: drawnNumber });
  gameState.nextDerivationIndex = index + attempts; // Set the *next* index to use
  gameState.lastDrawTime = Date.now();

  console.log(`[Draw] Successfully drawn number ${drawnNumber} for game ${txid} (using derivation index ${index + attempts - 1}). Next index: ${gameState.nextDerivationIndex}`);

  // --- Check for Winner(s) after draw ---
  let currentWinnersData = [];
  if (gameState.drawnNumbers.length >= 5) { // Minimum numbers needed for a potential win
      gameState.cards.forEach(card => {
          const winningSequence = utils.checkWinCondition(card.grid, gameState.drawnNumbers);
          if (winningSequence) { // checkWinCondition now returns sequence or null
              currentWinnersData.push({ username: card.username, sequence: winningSequence, cardId: card.cardId });
          }
      });
  }

  if (currentWinnersData.length > 0) {
      gameState.isOver = true;
      gameState.winners = currentWinnersData; // Store the array of {username, sequence} objects
      const winnerNames = currentWinnersData.map(w => w.username);
      console.log(`[Draw] Game ${txid} finished! Winners: ${winnerNames.join(', ')}`);
  }
  // --- End Winner Check ---

  const responsePayload = {
    message: 'Number drawn successfully!',
    drawnNumber: drawnNumber,
    totalDrawn: gameState.drawnNumbers.length,
    nextDerivationIndex: gameState.nextDerivationIndex,
    isOver: gameState.isOver,
    winners: gameState.winners // This now includes the sequences
  };

  res.status(200).json(responsePayload);
});


// --- 4. Get Game State (Player & GM) ---
app.get('/api/game-state/:txid', async (req, res) => {
  const { txid } = req.params;
  const { gm } = req.query; // Check for ?gm=true query param
  const isGMRequest = gm === 'true';

  // console.log(`[State] Request for game ${txid}${isGMRequest ? ' (GM)' : ''}`);

  const gameState = gameStates.get(txid);

  if (!gameState) {
    console.warn(`[State] Game state not found for ${txid}`);
    return res.status(404).json({ message: 'Game not found.' });
  }

  // --- Calculate Statistics --- 
  let statistics = "Statistics not available yet."; // Default to string
  if (gameState.cards && gameState.cards.length > 0 && gameState.drawnNumbers.length > 0) {
      // Calculate the max marked in any line for each card
      const maxInLineCounts = gameState.cards.map(card => {
          return utils.calculateMaxMarkedInLine(card.grid, gameState.drawnNumbers);
      });

      // Count how many players have each 'max marked in line' value
      const countsMap = maxInLineCounts.reduce((acc, count) => {
          // Only include counts >= 2 (less than 2 isn't very informative)
          if (count >= 2) { 
              acc[count] = (acc[count] || 0) + 1;
          }
          return acc;
      }, {});

      const sortedCounts = Object.entries(countsMap)
          .map(([markedNum, playerCount]) => ({ markedNum: parseInt(markedNum, 10), playerCount }))
          .sort((a, b) => b.markedNum - a.markedNum); // Sort by max marked in line descending

      const topStats = sortedCounts; // Show all relevant groups (>=2 marks in a line)

      if (topStats.length > 0) {
        // Updated formatting to reflect max marks in a line
        statistics = topStats.map(stat => 
          `${stat.playerCount} player${stat.playerCount > 1 ? 's' : ''} ${stat.playerCount > 1 ? 'have' : 'has'} a line with ${stat.markedNum} mark${stat.markedNum > 1 ? 's' : ''}`
        ).join('\n');
      } else {
        // Adjust message if no one has at least 2 in a line yet
        statistics = "No players have 2 or more marks in a line yet."; 
      }
  }
  // --- End Statistics Calculation ---

  res.status(200).json({
    status: gameState.status,
    drawnNumbers: gameState.drawnNumbers,
    drawSequenceLength: gameState.drawSequence.length, // Maybe useful for verification?
    lastDrawTime: gameState.lastDrawTime,
    isOver: gameState.isOver,
    winners: gameState.winners,
    statistics: statistics // Include formatted statistics
  });
});


// --- 5. Get Player Cards --- 
app.get('/api/cards/:txid/:nickname', (req, res) => {
  const { txid, nickname } = req.params;
  
  console.log(`[Cards] Request for player '${nickname}' in game ${txid}`);

  const gameState = gameStates.get(txid);

  if (!gameState) {
    console.warn(`[Cards] Game state not found for ${txid}`);
    return res.status(404).json({ message: 'Game not found.' });
  }

  if (!gameState.cards || gameState.cards.length === 0) {
      console.error(`[Cards] No cards found in game state for ${txid}`);
      return res.status(404).json({ message: 'No cards generated for this game yet.' });
  }

  // Find cards matching the nickname (case-insensitive comparison)
  const playerCards = gameState.cards.filter(card => 
    card.username.toLowerCase() === nickname.toLowerCase()
  );

  if (playerCards.length === 0) {
    console.warn(`[Cards] No cards found for nickname '${nickname}' in game ${txid}`);
    return res.status(404).json({ message: 'Nickname not found in participant list for this game.' });
  }

  console.log(`[Cards] Found ${playerCards.length} card(s) for '${nickname}' in game ${txid}`);
  res.status(200).json({ cards: playerCards }); 
});

// ======================================================
// ==                Server Start                      ==
// ======================================================

app.listen(PORT, () => {
  console.log(`BitBingo Server listening on port ${PORT}`);
  console.log(`Uploads directory: ${UPLOADS_DIR}`);
  // Log environment variables being used (optional, for debugging)
  console.log(`BLOCKCYPHER_API_BASE_URL: ${process.env.BLOCKCYPHER_API_BASE_URL || 'Default (Blockcypher v1)'}`);
  console.log(`PINATA_PUBLIC_GATEWAY_BASE: ${process.env.PINATA_PUBLIC_GATEWAY_BASE || 'Default (ipfs.io)'}`);
  console.log(`BLOCKCYPHER_NETWORK: ${process.env.BLOCKCYPHER_NETWORK || 'Default (main)'}`);

});
