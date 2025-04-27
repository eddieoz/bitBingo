# EPIC: Transform bitRaffle into bitBingo (@tests-tdd+bdd.mdc)

## Description
Implement a provably-fair, trustless, and verifiable bingo game using Bitcoin and IPFS, adapting the existing bitRaffle codebase. The system must allow users to upload a CSV of usernames, anchor the file in a Bitcoin transaction, generate deterministic bingo cards, and play a real-time bingo game with verifiable draws and winner detection.

---

## Roadmap & Stories

### 1. CSV Upload & Anchoring
- [x] User uploads a CSV file with one username per line (each line = one bingo card)
- [x] CSV is uploaded to IPFS, CID is returned (Note: Assumed external process; backend verifies TXID/CID)
- [x] CID is anchored in a Bitcoin transaction via OP_RETURN (Note: Assumed external process; backend verifies)
- [x] System monitors transaction and retrieves block hash (Implemented in `/api/check-transaction`)

### 2. Card Generation & User Login (@tests-tdd+bdd.mdc)
- [x] **Define BDD Scenarios:** Detail expected behavior for card retrieval, nickname not found, invalid TXID, unconfirmed TX, missing OP_RETURN. (Initial BDD definition done, detailed test plan in Section 6)
- [x] **Frontend:** Modify PlayPage input from Block Number to Transaction ID. (`client/app/play/[txid]/page.tsx`)
- [x] **Backend Implementation (`/api/cards`, helpers):**
    - [x] Implement `/api/cards` logic: fetch TX, get block hash, fetch IPFS CSV, parse, find lines, use current block hash seed, cache results. (Implemented via `/api/check-transaction` for init, and `/api/cards/:txid/:nickname` for retrieval; in-memory cache)
    - [x] Extract logic into helper functions (`derivePublicKey`, `generateBingoCard`), improve error handling. (Logic exists in `server/utils.js`)
    - [x] Ensure deterministic card generation from public key hash. (Logic exists in `server/utils.js`)
- [x] **Frontend:** Create/Update `UserCardsDisplay` component to render the cards received from `/api/cards`. (Exists and used in `PlayPage.tsx`)
- [x] **Frontend:** Refactor `PlayPage` to use `/api/cards` backend endpoint exclusively. (Uses `/api/cards/:txid/:nickname` via `UserLogin` component)
- [x] **Documentation:** Update user verification steps for card generation. (Covered by docs/verification.md)
- [x] **Testing:** Defined detailed unit and integration tests in Section 6.

### 3. Number Drawing (Game Master)
- [x] **Backend:** Create `/api/draw/{txid}` endpoint. (Exists in `server/index.js`)
    - [x] Verify request comes from the Game Master. (Implemented via Bearer token check in `/api/draw/:txid`)
- [x] **Backend:** Implement logic within `/api/draw/{txid}`: (Base logic and uniqueness implemented)
    - [x] Maintain game state **in memory**, keyed by `{txid}` (incl. base derivation seed from block hash, list of drawn numbers, draw index). Retrieve block hash associated with `{txid}` if needed. (Uses `gameStates` Map in `server/index.js`)
    - [x] On draw request:
        - [x] Increment draw index (persistent for the specific `{txid}` game instance in memory). (Uses `nextDerivationIndex`)
        - [x] Derive public key using base seed + draw index (use `server/utils.js` logic). (Implemented)
        - [x] Hash public key, take last 8 hex digits, convert to decimal `(decimal % 75) + 1`. (Implemented in `utils.hashPublicKeyToNumber`)
        - [x] Ensure uniqueness against numbers already drawn for this `{txid}` game. If not unique, increment index and repeat derivation until a unique number is found. (Implemented with retry loop in `/api/draw/:txid`)
        - [x] Store the newly drawn unique number in the game state for `{txid}`. (Stored in `gameState.drawnNumbers`)
- [x] **Backend:** Create `/api/game-state/{txid}` endpoint. (Exists in `server/index.js`)
    - [x] Returns the current list/sequence of drawn numbers for the given `{txid}` game. (Implemented)
    - [x] **(For GM Stats):** If requested by GM, also calculate and return statistics: (Statistics logic implemented in GET endpoint: calculates groups by *max marks in any line*)
        - [x] Retrieve all generated bingo cards for `{txid}` (using logic similar to `/api/cards`). (Uses `gameState.cards`)
        - [x] Compare drawn numbers against each card to find win progress. (Uses `utils.calculateMaxMarkedInLine`)
        - [x] Determine the top 3 closest-to-win states and player counts. Return this data. (Calculates groups by *max marks in line*, returns formatted string)
- [x] **Real-time (Polling):**
    - [x] **Client (Player & GM):** Periodically poll the `/api/game-state/{txid}` endpoint (e.g., every 1-2 seconds) to get the latest drawn numbers (and stats for GM). (Implemented in `PlayPage.tsx` using TanStack Query)
- [x] **Frontend (Game Master UI):**
    - [x] Identify the GM client-side. (Implemented via localStorage token check in `PlayPage.tsx`)
    - [x] Display a "Draw Number" button only if identified as GM for the current `{txid}`. (Implemented via conditional rendering in `PlayPage.tsx`)
    - [x] Button click handler calls `/api/draw/{txid}`. (Implemented in `PlayPage.tsx`'s `handleDrawNumber`)
    - [x] Display a statistics box showing the top 3 closest-to-win states and player counts, updated via polling `/api/game-state/{txid}`. (Implemented via polling and state update in `PlayPage.tsx`, displays stats based on max marks per line)
- [x] **Frontend (Player UI):**
    - [x] Receive updated drawn number list via polling `/api/game-state/{txid}`. (Implemented via polling in `PlayPage.tsx`)
    - [x] Update React state with the list/sequence of drawn numbers. (Implemented in `PlayPage.tsx` via TanStack Query)
    - [x] **Display Sequence:** Show the drawn numbers in order (e.g., "B:12, I:25, N:40, ...") at the top of the page. (Implemented in `PlayPage.tsx`)
    - [x] Pass the list of drawn numbers down to `BingoCard` component(s). (Implemented in `PlayPage.tsx` -> `UserCardsDisplay.jsx`)
    - [x] Modify `BingoCard` to visually mark numbers present in the drawn numbers list. (Implemented in `BingoCard.jsx`)

### 4. Real-Time Card Marking & Win Detection
- [x] As numbers are drawn, automatically mark them on all user cards (Implemented via frontend polling, state updates, and `BingoCard` component logic)
- [x] Win detection happens on backend during `/api/draw`. Frontend displays winner based on `/api/game-state`.

### 5. Determinism & Verification
- [x] All card and number generation is deterministic and verifiable from block hash, CSV, and public process (Based on server logic in `utils.js`)
- [x] Document the verification process for users (in README/docs) (Requires manual verification/creation of docs)

### 6. Testing (TDD/BDD) - DETAILED PLAN @tests-tdd+bdd.mdc

**Goal:** Ensure comprehensive test coverage for all critical functionalities using TDD (Unit/Integration) and BDD (Integration/E2E) principles. Tests marked with `[Existing]` have some prior implementation but may need review/expansion. Tests marked `[ ]` are pending.

**A. Backend Unit Tests (`server/utils.js`)**

*   **`derivePublicKey`:**
    *   [ ] **Story: Correct Derivation:** Given a seed hash and index, When `derivePublicKey` is called, Then it returns the expected BIP32 public key Buffer (verify against known vectors if possible).
    *   [ ] **Story: Input Validation (Seed):** Given invalid seedHash (null, empty, non-hex), When `derivePublicKey` is called, Then it throws an appropriate error.
    *   [ ] **Story: Input Validation (Index):** Given invalid index (negative, non-number), When `derivePublicKey` is called, Then it throws an appropriate error.
*   **`generateBingoCard`:**
    *   [ ] **Story: Valid Card Structure:** Given a public key Buffer, When `generateBingoCard` is called, Then it returns a valid card object (`cardId`, `grid` with 5 columns, 5 rows per column, N[2] is null).
    *   [ ] **Story: Column Number Ranges & Uniqueness:** Given a public key Buffer, When `generateBingoCard` is called, Then each column contains 5 unique numbers within the correct range (B: 1-15, etc.).
    *   [ ] **Story: Determinism (Same Input):** Given the *same* public key Buffer, When `generateBingoCard` is called multiple times, Then it returns the *same* card grid.
    *   [ ] **Story: Determinism (Different Input):** Given *different* public key Buffers, When `generateBingoCard` is called, Then it returns *different* card grids.
    *   [ ] **Story: Input Validation:** Given invalid publicKey (null, empty Buffer), When `generateBingoCard` is called, Then it throws an appropriate error.
*   **`hashPublicKeyToNumber`:**
    *   [ ] **Story: Valid Number Range:** Given a public key Buffer, When `hashPublicKeyToNumber` is called, Then it returns a number between 1 and 75 (inclusive).
    *   [ ] **Story: Determinism:** Given the *same* public key Buffer, When `hashPublicKeyToNumber` is called multiple times, Then it returns the *same* number.
    *   [ ] **Story: Input Validation:** Given invalid publicKey (null, empty/short Buffer), When `hashPublicKeyToNumber` is called, Then it throws an appropriate error.
*   **`generateAllCards`:**
    *   [ ] **Story: Correct Card Array:** Given participants and block hash, When `generateAllCards` is called, Then it returns an array of card objects matching the participant list, each with correct `name`, `ticket`, `cardId`, `grid`.
    *   [ ] **Story: Correct Derivation Index:** Given participants and block hash, When `generateAllCards` is called, Then card generation uses the participant's 1-based index for derivation.
*   **`calculateMaxMarkedInLine`:**
    *   [ ] **Story: No Marks:** Given a grid and no matching drawn numbers, When called, Then it returns 0.
    *   [ ] **Story: Partial Marks:** Given a grid and some matching numbers, When called, Then it returns the correct max count in any line.
    *   [ ] **Story: Winning Line:** Given a grid and drawn numbers forming a win, When called, Then it returns 5.
    *   [ ] **Story: Free Space Handling:** Given a grid, When called, Then the free space ('N'[2]) is counted correctly for relevant lines.
*   **`checkWinCondition`:**
    *   [ ] **Story: No Win:** Given grid and drawn numbers, When no win exists, Then it returns `null`.
    *   [ ] **Story: Horizontal Win:** Given grid and drawn numbers, When a horizontal line wins, Then it returns the winning sequence.
    *   [ ] **Story: Vertical Win:** Given grid and drawn numbers, When a vertical line wins, Then it returns the winning sequence.
    *   [ ] **Story: Diagonal Win:** Given grid and drawn numbers, When a diagonal line wins, Then it returns the winning sequence.
    *   [ ] **Story: Free Space Win:** Given a winning line using the free space, When called, Then it correctly identifies the win and returns the sequence.
    *   [ ] **Story: Multiple Wins:** Given multiple simultaneous wins, When called, Then it returns one defined winning sequence consistently (e.g., first found).

**B. Backend Integration Tests (API Endpoints - `server/index.js`)** (Requires mocking `utils.js`, `fs`, `crypto`, `axios`)

*   **`/api/check-transaction` (POST):**
    *   [ ] **Story: Successful Initialization:** Given valid `txid`/`participantFilename`, mocks succeed, When called, Then returns 200, initializes `gameStates` correctly, includes `gmToken`, deletes upload.
    *   [Existing] **Story: Game Already Exists:** Given valid `txid` where game state exists, When called, Then returns 200, does *not* return `gmToken`, state is unchanged.
    *   [ ] **Story: Missing Input:** Given missing `txid` or `filename`, When called, Then returns 400.
    *   [ ] **Story: File Not Found:** Given non-existent `filename`, When called, Then returns 404.
    *   [ ] **Story: TX Fetch Error (e.g., Unconfirmed):** Given `fetchTxDataAndBlockHash` mock throws, When called, Then returns appropriate error status (e.g., 400 or 500) and message.
    *   [ ] **Story: IPFS Fetch Error:** Given `getParticipantsFromOpReturn` mock throws, When called, Then returns appropriate error status (e.g., 500) and message.
*   **`/api/cards/:txid/:nickname` (GET):**
    *   [Existing] **Story: Get User Cards (Happy Path):** Given valid `txid`/`nickname`, game exists, When called, Then returns 200 with user's card data.
    *   [Existing] **Story: Nickname Not Found:** Given valid `txid` but invalid `nickname`, When called, Then returns 404 "Nickname not found".
    *   [Existing] **Story: Game Not Found:** Given invalid `txid`, When called, Then returns 404 "Game not found".
*   **`/api/draw/:txid` (POST):**
    *   [ ] **Story: Successful Draw (No Win):** Given valid `txid`/GM token, game active, When called, Then returns 200, updates `drawnNumbers`, `nextDerivationIndex`, checks for win (no win found).
    *   [ ] **Story: Successful Draw (With Win):** Given valid `txid`/GM token, game active, draw causes win, When called, Then returns 200, updates state including `isOver`, `winners`.
    *   [ ] **Story: Draw on Finished Game:** Given valid `txid`/GM token, game `isOver`, When called, Then returns 400 "Game already over".
    *   [ ] **Story: Unauthorized Draw:** Given valid `txid` but invalid/missing token, When called, Then returns 401.
    *   [ ] **Story: Draw for Non-existent Game:** Given invalid `txid`, When called, Then returns 404.
    *   [ ] **Story: Draw Requires Retry:** Given scenario needing multiple derivations for unique number, When called, Then returns 200 with the *correct* unique number after retries.
*   **`/api/game-state/:txid` (GET):**
    *   [ ] **Story: Get State (Player):** Given valid `txid`, game exists, no GM token, When called, Then returns 200 with basic state (`drawnNumbers`, `isOver`, `winners`).
    *   [ ] **Story: Get State (GM):** Given valid `txid`, game exists, valid GM token, When called, Then returns 200 with full state including stats.
    *   [ ] **Story: Get State for Non-existent Game:** Given invalid `txid`, When called, Then returns 404.

**C. Frontend Unit/Integration Tests (`client/` - React Testing Library)**

*   **`UserLogin` Component:**
    *   [ ] **Story: Render:** Given `txid`, When rendered, Then displays Nickname input and Login button.
    *   [ ] **Story: Successful Login:** Given user input, When Login clicked and API succeeds, Then `onLoginSuccess` is called with session data.
    *   [ ] **Story: Failed Login:** Given user input, When Login clicked and API fails, Then `onLoginError` is called with error message.
    *   [ ] **Story: Loading State:** Given user input, When Login clicked, Then shows loading state while API call is pending.
*   **`BingoCard` Component:**
    *   [ ] **Story: Render Grid:** Given `grid` data, When rendered, Then displays the 5x5 grid correctly.
    *   [ ] **Story: Mark Drawn Numbers:** Given `grid` and `drawnNumbers`, When rendered, Then marks numbers found in `drawnNumbers`.
    *   [ ] **Story: Mark Free Space:** Given `grid`, When rendered, Then the free space (N[2]) is always marked.
    *   [ ] **Story: Highlight Winning Sequence:** Given `winningSequence`, When rendered, Then highlights numbers in that sequence.
*   **`UserCardsDisplay` Component:**
    *   [ ] **Story: Render Multiple Cards:** Given `cards` array, When rendered, Then renders the correct number of `BingoCard` components.
    *   [ ] **Story: Prop Drilling:** Given props (`cards`, `drawnNumbers`, `winningSequence`), When rendered, Then passes correct props down to `BingoCard` instances.

**D. Frontend E2E Tests (`client/app/play/[txid]/page.tsx` - Cypress/Playwright)**

*   [ ] **Scenario: Player Full Flow (Happy Path):**
    *   Given a valid game TXID exists on the backend
    *   When a user navigates to the play page (`/play/[txid]`)
    *   And enters their correct nickname
    *   And clicks Login
    *   Then their bingo cards are displayed
    *   And the "Drawn Numbers" section updates periodically
    *   When the game ends and they are a winner
    *   Then the winner banner is shown
    *   And their winning sequence is highlighted on their card
*   [ ] **Scenario: Player Login Failure:**
    *   Given a valid game TXID
    *   When a user navigates to the play page
    *   And enters an incorrect/non-existent nickname
    *   And clicks Login
    *   Then an error message is displayed below the form
    *   And the cards are not shown
*   [ ] **Scenario: Game Master Full Flow:**
    *   Given a valid game TXID exists and the user has the GM token (e.g., set in localStorage)
    *   When the GM navigates to the play page
    *   And logs in with any nickname (or auto-identifies as GM)
    *   Then their cards are displayed
    *   And the "Draw Number" button is visible
    *   And the Statistics box is visible
    *   When the GM clicks "Draw Number"
    *   Then a new number appears in the "Drawn Numbers" list
    *   And the Statistics box updates
    *   When the game ends (triggered by a draw)
    *   Then the Winner Announcement banner is displayed
    *   And the "Draw Number" button might be disabled (or hidden)
*   [ ] **Scenario: Spectator View:**
    *   Given a valid game TXID
    *   When a user navigates to the play page
    *   And does *not* log in
    *   Then they can see the "Drawn Numbers" list updating
    *   And they see the Winner Announcement banner when the game ends
    *   But they cannot see any cards or GM controls

---

## Notes
- Mark tasks as complete if already implemented in the codebase.
- Use @tests-tdd+bdd.mdc for all test-related stories.
- Update this roadmap as features are implemented or refined. 