const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const utils = require('./utils'); 

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


// ======================================================
// ==                API Endpoints                     ==
// ======================================================

// --- 1. Upload Participant List --- 
app.post('/api/upload-participants', upload.single('participantFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }
  console.log(`[Upload] File received: ${req.file.filename}, Path: ${req.file.path}`);
  uploadedFiles.set(req.file.filename, req.file.path);
  res.status(200).json({ 
      message: 'File uploaded successfully!', 
      filename: req.file.filename 
  });
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
            gmToken: null, // Initialize GM token placeholder
            lastDrawTime: null,
            creationTime: Date.now(),
            isOver: false, // NEW: Track if the game has a winner
            winners: [] // NEW: Store usernames of winners
        });
        console.log(`[Check TX] Game state for ${txid} successfully initialized with ${allCards.length} cards.`);
        
    } else {
        console.log(`[Check TX] Game state for ${txid} already exists.`);
        // Optionally update participants if re-checking? For now, assume immutable after init.
        // gameState.participants = participants; // If you want to allow updates
        // gameState.blockHash = blockHash; // Should be the same, but can update
    }

    res.status(200).json({ 
        message: 'Transaction confirmed and game state initialized/verified.',
        txid: txid,
        blockHash: blockHash,
        participantCount: participants.length
    });

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
  
  // On first draw, generate and store token if not present
  if (gameState.nextDerivationIndex === 0 && !gameState.gmToken) {
      gameState.gmToken = crypto.randomBytes(16).toString('hex');
      console.log(`[Draw] First draw for ${txid}. Generated GM token.`);
      // No token check needed for the very first draw
  } else {
      // For subsequent draws, token MUST be provided and match
      if (!providedToken) {
          console.warn(`[Draw] Missing GM token for game ${txid}`);
          return res.status(401).json({ message: 'Authorization token required for drawing numbers.'});
      }
      if (providedToken !== gameState.gmToken) {
          console.warn(`[Draw] Invalid GM token provided for game ${txid}`);
          return res.status(403).json({ message: 'Invalid authorization token.' });
      }
      console.log(`[Draw] GM token verified for ${txid}`);
  }
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
  let currentWinners = [];
  if (gameState.drawnNumbers.length >= 5) { // Minimum numbers needed for a potential win
      gameState.cards.forEach(card => {
          if (utils.checkWinCondition(card.grid, gameState.drawnNumbers)) {
              currentWinners.push(card.username);
          }
      });
  }

  if (currentWinners.length > 0) {
      gameState.isOver = true;
      gameState.winners = currentWinners; // Set winners for this draw
      console.log(`[Draw] Game ${txid} finished! Winners: ${currentWinners.join(', ')}`);
  }
  // --- End Winner Check ---

  const responsePayload = {
    message: 'Number drawn successfully!',
    drawnNumber: drawnNumber,
    totalDrawn: gameState.drawnNumbers.length,
    nextDerivationIndex: gameState.nextDerivationIndex,
    isOver: gameState.isOver,
    winners: gameState.winners
  };

  // Include the token in the response only for the FIRST successful draw
  if (gameState.drawnNumbers.length === 1 && gameState.gmToken) {
      responsePayload.gmToken = gameState.gmToken;
      console.log(`[Draw] Sending GM token in response for first draw.`);
  }

  res.status(200).json(responsePayload);
});


// --- 4. Get Game State (Player & GM) ---
app.get('/api/game-state/:txid', async (req, res) => {
  const { txid } = req.params;
  const { gm } = req.query; // Check for ?gm=true query param
  const isGMRequest = gm === 'true';

  console.log(`[State] Request for game ${txid}${isGMRequest ? ' (GM)' : ''}`);

  const gameState = gameStates.get(txid);

  if (!gameState) {
    console.warn(`[State] Game state not found for ${txid}`);
    return res.status(404).json({ message: 'Game not found.' });
  }

  // --- Calculate Statistics ---
  let statistics = { message: "Statistics not available yet." };
  if (gameState.cards && gameState.cards.length > 0 && gameState.drawnNumbers.length > 0) {
      const markedCounts = gameState.cards.map(card => {
          return utils.countMarkedNumbers(card.grid, gameState.drawnNumbers);
      });

      const countsMap = markedCounts.reduce((acc, count) => {
          acc[count] = (acc[count] || 0) + 1;
          return acc;
      }, {});

      const sortedCounts = Object.entries(countsMap)
          .map(([markedNum, playerCount]) => ({ markedNum: parseInt(markedNum, 10), playerCount }))
          .sort((a, b) => b.markedNum - a.markedNum); // Sort by marked numbers descending

      const top3Stats = sortedCounts.slice(0, 3);

      if (top3Stats.length > 0) {
        statistics = top3Stats.map(stat => 
          `${stat.playerCount} player${stat.playerCount > 1 ? 's' : ''} ${stat.playerCount > 1 ? 'have' : 'has'} ${stat.markedNum} number${stat.markedNum > 1 ? 's' : ''} marked`
        ).join('\n');
      } else {
        statistics = "No players have marked numbers yet.";
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
