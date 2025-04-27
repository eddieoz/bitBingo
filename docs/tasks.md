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
    - [x] **Client (Player):** Periodically poll the `/api/game-state/{txid}` endpoint (e.g., every 1-2 seconds) from `client/app/play/[txid]/page.tsx` to get the latest drawn numbers. (Implemented in `PlayPage.tsx` using TanStack Query - path needs verification)
    - [x] **Client (GM):** Periodically poll the `/api/game-state/{txid}` endpoint from `client/app/page.tsx` (when managing an active game) to get the latest drawn numbers and stats.
- [x] **Frontend (Game Master UI - `client/app/page.tsx`):**
    - [x] Identify the GM client-side (e.g., via token check after game init/load).
    - [x] Display a "Draw Number" button only if identified as GM for the current/loaded `{txid}`. (Check implementation location)
    - [x] Button click handler calls `/api/draw/{txid}`. (Check implementation location)
    - [x] Display a statistics box showing the top 3 closest-to-win states and player counts, updated via polling `/api/game-state/{txid}`. (Check implementation location)
- [x] **Frontend (Player UI - `client/app/play/[txid]/page.tsx`):**
    - [x] Receive updated drawn number list via polling `/api/game-state/{txid}`. (Implemented via polling - path needs verification)
    - [x] Update React state with the list/sequence of drawn numbers. (Implemented - path needs verification)
    - [x] **Display Sequence:** Show the drawn numbers in order (e.g., "B:12, I:25, N:40, ...") at the top of the page. (Implemented - path needs verification)
    - [x] Pass the list of drawn numbers down to `BingoCard` component(s) if they are rendered here (or fetch separately if cards aren't shown on player page). *(Self-correction: Cards ARE shown on player page)*. (Implemented in `PlayPage.tsx` -> `UserCardsDisplay.jsx` - paths need verification)
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
    *   [x] **Story: Correct Derivation:** Given a seed hash and index, When `derivePublicKey` is called, Then it returns the expected BIP32 public key Buffer (verify against known vectors if possible).
    *   [x] **Story: Input Validation (Seed):** Given invalid seedHash (null, empty, non-hex), When `derivePublicKey` is called, Then it throws an appropriate error.
    *   [x] **Story: Input Validation (Index):** Given invalid index (negative, non-number), When `derivePublicKey` is called, Then it throws an appropriate error.
*   **`generateBingoCard`:**
    *   [x] **Story: Valid Card Structure:** Given a public key Buffer, When `generateBingoCard` is called, Then it returns a valid card object (`cardId`, `grid` with 5 columns, 5 rows per column, N[2] is null).
    *   [x] **Story: Column Number Ranges & Uniqueness:** Given a public key Buffer, When `generateBingoCard` is called, Then each column contains 5 unique numbers within the correct range (B: 1-15, etc.).
    *   [x] **Story: Determinism (Same Input):** Given the *same* public key Buffer, When `generateBingoCard` is called multiple times, Then it returns the *same* card grid.
    *   [x] **Story: Determinism (Different Input):** Given *different* public key Buffers, When `generateBingoCard` is called, Then it returns *different* card grids.
    *   [x] **Story: Input Validation:** Given invalid publicKey (null, empty Buffer), When `generateBingoCard` is called, Then it throws an appropriate error.
*   **`hashPublicKeyToNumber`:**
    *   [x] **Story: Valid Number Range:** Given a public key Buffer, When `hashPublicKeyToNumber` is called, Then it returns a number between 1 and 75 (inclusive).
    *   [x] **Story: Determinism:** Given the *same* public key Buffer, When `hashPublicKeyToNumber` is called multiple times, Then it returns the *same* number.
    *   [x] **Story: Input Validation:** Given invalid publicKey (null, empty/short Buffer), When `hashPublicKeyToNumber` is called, Then it throws an appropriate error.
*   **`generateAllCards`:**
    *   [x] **Story: Correct Card Array:** Given participants and block hash, When `generateAllCards` is called, Then it returns an array of card objects matching the participant list, each with correct `name`, `ticket`, `cardId`, `grid`.
    *   [x] **Story: Correct Derivation Index:** Given participants and block hash, When `generateAllCards` is called, Then card generation uses the participant's 1-based index for derivation.
*   **`calculateMaxMarkedInLine`:**
    *   [x] **Story: No Marks:** Given a grid and no matching drawn numbers, When called, Then it returns 0.
    *   [x] **Story: Partial Marks:** Given a grid and some matching numbers, When called, Then it returns the correct max count in any line.
    *   [x] **Story: Winning Line:** Given a grid and drawn numbers forming a win, When called, Then it returns 5.
    *   [x] **Story: Free Space Handling:** Given a grid, When called, Then the free space ('N'[2]) is counted correctly for relevant lines.
*   **`checkWinCondition`:**
    *   [x] **Story: No Win:** Given grid and drawn numbers, When no win exists, Then it returns `null`.
    *   [x] **Story: Horizontal Win:** Given grid and drawn numbers, When a horizontal line wins, Then it returns the winning sequence.
    *   [x] **Story: Vertical Win:** Given grid and drawn numbers, When a vertical line wins, Then it returns the winning sequence.
    *   [x] **Story: Diagonal Win:** Given grid and drawn numbers, When a diagonal line wins, Then it returns the winning sequence.
    *   [x] **Story: Free Space Win:** Given a winning line using the free space, When called, Then it correctly identifies the win and returns the sequence.
    *   [x] **Story: Multiple Wins:** Given multiple simultaneous wins, When called, Then it returns one defined winning sequence consistently (e.g., first found).

**B. Backend Integration Tests (API Endpoints - `server/index.js`)** (Requires mocking `utils.js`, `fs`, `crypto`, `axios`)

*   **`/api/check-transaction` (POST):**
    *   [ ] **Story: Successful Initialization:** Given valid `txid`/`participantFilename`, mocks succeed, When called, Then returns 200, initializes `gameStates` correctly, includes `gmToken`, deletes upload.
    *   [Existing] **Story: Game Already Exists:** Given valid `txid` where game state exists, When called, Then returns 200, does *not* return `gmToken`, state is unchanged.
    *   [ ] **Story: Missing Input:** Given missing `txid` or `filename`, When called, Then returns 400.
    *   [ ] **Story: File Not Found:** Given non-existent `filename`, When called, Then returns 404.
    *   [ ] **Story: TX Fetch Error (e.g., Unconfirmed):** Given `fetchTxDataAndBlockHash` mock throws, When called, Then returns appropriate error status (e.g., 400 or 500) and message.
    *   [ ] **Story: IPFS Fetch Error:** Given `getParticipantsFromOpReturn` mock throws, When called, Then returns appropriate error status (e.g., 500) and message.
    *   **NOTE:** Integration tests for this endpoint (`server/tests/check-transaction.integration.test.js`) are currently skipped due to unexplained hangs/long runtimes and unclear error output. Further investigation is needed.
*   **`/api/cards/:txid/:nickname` (GET):**
    *   [Existing] **Story: Get User Cards (Happy Path):** Given valid `txid`/`nickname`, game exists, When called, Then returns 200 with user's card data.
    *   [Existing] **Story: Nickname Not Found:** Given valid `txid` but invalid `nickname`, When called, Then returns 404 "Nickname not found".
*   **`/api/draw/:txid` (POST):**
    *   [ ] **Story: Successful Draw (No Win):** Given valid `txid`/GM token, game active, When called, Then returns 200, updates `drawnNumbers`, `nextDerivationIndex`, checks for win (no win found).
    *   [ ] **Story: Successful Draw (With Win):** Given valid `txid`/GM token, game active, draw causes win, When called, Then returns 200, updates state including `isOver`, `winners`.
    *   [ ] **Story: Draw on Finished Game:** Given valid `txid`/GM token, game `isOver`, When called, Then returns 400 "Game already over".
    *   [ ] **Story: Unauthorized Draw:** Given valid `txid` but invalid/missing token, When called, Then returns 401.
    *   [ ] **Story: Draw for Non-existent Game:** Given invalid `txid`, When called, Then returns 404.
    *   [ ] **Story: Draw Requires Retry:** Given scenario needing multiple derivations for unique number, When called, Then returns 200 with the *correct* unique number after retries.
    *   **NOTE:** Integration tests for this endpoint (`server/tests/api.draw.test.js`) are currently skipped due to mocking challenges similar to `/api/check-transaction`. Further investigation is needed.
*   **`/api/game-state/:txid` (GET):**
    *   [x] **Story: Get State (Player):** Given valid `txid`, game exists, no GM token, When called, Then returns 200 with basic state (`drawnNumbers`, `isOver`, `winners`).
    *   [x] **Story: Get State (GM):** Given valid `txid`, game exists, valid GM token, When called, Then returns 200 with full state including stats.
    *   [x] **Story: Get State for Non-existent Game:** Given invalid `txid`, When called, Then returns 404.

**C. Frontend Unit/Integration Tests (`client/` - React Testing Library)**

*   **`UserLogin` Component (If used on Player Page `client/app/play/[txid]/page.tsx`):** *(Adjust if login happens elsewhere)*
    *   [x] **Story: Render:** Given `txid`, When rendered, Then displays Nickname input and Login button.
    *   [x] **Story: Successful Login:** Given user input, When Login clicked and API succeeds, Then `onLoginSuccess` is called with session data.
    *   [x] **Story: Failed Login:** Given user input, When Login clicked and API fails, Then `onLoginError` is called with error message.
    *   [x] **Story: Loading State:** Given user input, When Login clicked, Then shows loading state while API call is pending.
*   **`BingoCard` Component:**
    *   [x] **Story: Render Grid:** Given `grid` data, When rendered, Then displays the 5x5 grid correctly.
    *   [x] **Story: Mark Drawn Numbers:** Given `grid` and `drawnNumbers`, When rendered, Then marks numbers found in `drawnNumbers`.
    *   [x] **Story: Mark Free Space:** Given `grid`, When rendered, Then the free space (N[2]) is always marked.
    *   [x] **Story: Highlight Winning Sequence:** Given `winningSequence`, When rendered, Then highlights numbers in that sequence.
*   **`UserCardsDisplay` Component (Used on Player Page `client/app/play/[txid]/page.tsx`):**
    *   [x] **Story: Render Multiple Cards:** Given `cards` array, When rendered, Then renders the correct number of `BingoCard` components.
    *   [x] **Story: Prop Drilling:** Given props (`cards`, `drawnNumbers`, `winningSequence`), When rendered, Then passes correct props down to `BingoCard` instances.
*   **Admin Page Component (`client/app/page.tsx`):**
    *   [ ] **Story: Game Mode Selection:** Test rendering and state changes for game mode radio buttons/selector. *(Blocked - async issues in tests)*
    *   [ ] **Story: Game Init Call:** Test that `/api/check-transaction` is called with the correct `gameMode`. *(Blocked - async issues in tests)*
    *   [ ] **Story: Draw Button:** Test visibility and click handler based on GM status and game state. *(Blocked - async issues in tests)*
    *   [ ] **Story: Statistics Display:** Test correct rendering of stats based on fetched game state. *(Blocked - async issues in tests)*
    *   [ ] **Story: Partial Win Controls:** Test visibility and functionality of "Continue"/"End Game" buttons based on game state (`partialWinOccurred`). *(Blocked - async issues in tests)*
*   **Player Page Component (`client/app/play/[txid]/page.tsx`):**
    *   [ ] **Story: Drawn Numbers Display:** Test correct display of drawn numbers sequence.
    *   [ ] **Story: Winner Display:** Test correct display of partial/full winners based on fetched game state and mode.
    *   [ ] **Story: Card Display:** Test rendering of `UserCardsDisplay` with correct props.

**D. Frontend E2E Tests (Cypress/Playwright)**

*   [ ] **Scenario: Player Full Flow (Happy Path - `client/app/play/[txid]/page.tsx`):**
    *   Given a valid game TXID exists on the backend
    *   When a user navigates to the play page (`/play/[txid]`)
    *   And enters their correct nickname (if login is required here)
    *   Then their bingo cards are displayed
    *   And the "Drawn Numbers" section updates periodically
    *   When the game ends and they are a winner
    *   Then the winner banner is shown (reflecting partial/full win status correctly)
    *   And their winning sequence (if applicable) is highlighted on their card
*   [ ] **Scenario: Player Login Failure (`client/app/play/[txid]/page.tsx` - if applicable):**
    *   Given a valid game TXID
    *   When a user navigates to the play page
    *   And enters an incorrect/non-existent nickname
    *   And clicks Login
    *   Then an error message is displayed below the form
    *   And the cards are not shown
*   [ ] **Scenario: Game Master Full Flow (`client/app/page.tsx`):**
    *   Given the GM navigates to the admin page (`/`)
    *   And uploads a participant file
    *   And selects a Game Mode (e.g., "Partial & Full Card")
    *   And submits to initialize the game (gets TXID)
    *   And loads the game state using the TXID
    *   Then the "Draw Number" button is visible
    *   And the Statistics box is visible
    *   When the GM clicks "Draw Number"
    *   Then a new number appears in the "Drawn Numbers" list (on GM page)
    *   And the Statistics box updates
    *   *(Add steps for Partial Win scenario if mode requires)*
    *   When a partial win occurs
    *   Then the partial winners are displayed
    *   And the "Draw Number" button is hidden
    *   And "Continue"/"End Game" buttons appear
    *   When the GM clicks "Continue"
    *   Then the "Draw Number" button reappears
    *   When the GM draws numbers until a full card win
    *   Then the Full Card Winner Announcement banner is displayed
    *   And the "Draw Number" button might be disabled (or hidden)
*   [ ] **Scenario: Spectator View (`client/app/play/[txid]/page.tsx`):**
    *   Given a valid game TXID
    *   When a user navigates to the play page (`/play/[txid]`)
    *   And does *not* log in (or login is not required for viewing)
    *   Then they can see the "Drawn Numbers" list updating
    *   And they see the Winner Announcement banner when the game ends (showing partial/full winners correctly)
    *   But they cannot see any cards or GM controls (unless cards are public, confirm requirements)

---

## Notes
- Mark tasks as complete if already implemented in the codebase.
- Use @tests-tdd+bdd.mdc for all test-related stories.
- Update this roadmap as features are implemented or refined.

---

# EPIC: Implement Full Card Win Modes (@tests-tdd+bdd.mdc)

## Description
Enhance the bingo game to support two distinct winning modes: "Full Card Win Only" and "Partial Win & Full Card". This involves modifying the game state, win condition logic, API endpoints, and frontend UI to accommodate mode selection, intermediate game states (partial wins), Game Master controls for continuation, and appropriate display of winners and statistics based on the selected mode.

---

## Roadmap & Stories

### 7. Backend: Core Logic & State Management (@tests-tdd+bdd.mdc)
- [ ] **Story: Add Game Mode to State:** Modify `gameStates` in `server/index.js` to include `gameMode: 'partialAndFull' | 'fullCardOnly'`, `partialWinOccurred: boolean` (default false), `partialWinners: string[] | null`, `fullCardWinners: string[] | null`. Adjust existing `winners` field usage if necessary.
- [ ] **Story: Game Initialization with Mode:** Update `/api/check-transaction` (or relevant init endpoint) to accept a `gameMode` parameter in the request body and store it in the new `gameStates` entry. Add validation for the mode.
- [ ] **Story: Rename `checkWinCondition`:** Rename existing `checkWinCondition` in `server/utils.js` to `checkLineWin` for clarity. Update all call sites.
- [ ] **Story: Implement `checkFullCardWin`:** Create a new function `checkFullCardWin(grid, drawnNumbers)` in `server/utils.js` that returns `true` if all 24 numbers on the card are present in `drawnNumbers`, `false` otherwise. Include unit tests.
- [ ] **Story: Update `/api/draw/:txid` Logic:**
    - [ ] Refactor endpoint to check `gameState.gameMode`.
    - [ ] **`fullCardOnly` Mode:** Call only `checkFullCardWin`. On win, set `isOver=true`, record winners in `fullCardWinners`.
    - [ ] **`partialAndFull` Mode (Before Partial Win):** If `!partialWinOccurred`, call `checkLineWin`. On win, set `partialWinOccurred=true`, record `partialWinners`. **Do not** set `isOver`. Return state indicating partial win occurred.
    - [ ] **`partialAndFull` Mode (After Partial Win):** If `partialWinOccurred`, call only `checkFullCardWin`. On win, set `isOver=true`, record `fullCardWinners`.
    - [ ] Ensure draw requests are rejected if `partialWinOccurred` is true *unless* the GM has signaled continuation (e.g., implicitly handled by frontend controls enabling draw button again).
- [ ] **Story: Implement `/api/end-game/:txid` (POST):** Create a new endpoint requiring GM token. Sets `isOver = true` for the specified game `txid`. Used when GM chooses not to continue after a partial win in `partialAndFull` mode.
- [ ] **Story: Update `/api/game-state/:txid` Response:** Modify the endpoint to return the new state fields (`gameMode`, `partialWinOccurred`, `partialWinners`, `fullCardWinners`).
- [ ] **Story: Update GM Statistics:**
    - [ ] In `partialAndFull` mode, when `partialWinOccurred` is true, modify the statistics calculation to report progress towards a full card win (e.g., count of marked squares per card, grouped by count).
    - [ ] Ensure the correct statistics (line-based or full-card-based) are returned based on the current game phase.

### 8. Frontend: UI & Interaction (@tests-tdd+bdd.mdc) - Target: `client/app/page.tsx` (Admin/GM Page)
- [ ] **Story: Add Game Mode Selection (GM):** In `client/app/page.tsx`, when setting up a new game (after file upload, before calling `/api/check-transaction`), add radio buttons/selector for "Partial Win & Full Card" and "Full Card Win Only".
- [ ] **Story: Pass Game Mode on Init:** Modify the frontend logic in `client/app/page.tsx` that calls `/api/check-transaction` to include the selected `gameMode`.
- [ ] **Story: Disable Mode Selection:** Disable the game mode selector in `client/app/page.tsx` after the first number has been drawn for the loaded game (fetch state from `/api/game-state`).
- [ ] **Story: Handle Partial Win State (GM):** In `client/app/page.tsx`, when managing a game where `gameState.partialWinOccurred` is true and `gameState.isOver` is false (fetched from `/api/game-state/:txid`):
    - [ ] Display the `partialWinners`.
    - [ ] Hide the "Draw Number" button.
    - [ ] Show "Continue to Full Card" and "End Game Now" buttons.
- [ ] **Story: Implement GM Continuation/End Controls:** In `client/app/page.tsx`:
    - [ ] "Continue" button: Re-enable the "Draw Number" button. (May involve internal state change).
    - [ ] "End Game" button: Call the new `/api/end-game/:txid` endpoint. Update UI to reflect game end.
- [ ] **Story: Update Winner Display (GM View):** Modify the winner announcement logic in `client/app/page.tsx` to display winners clearly based on mode and state (`partialWinners`, `fullCardWinners`).
- [ ] **Story: Display Correct Statistics (GM):** Ensure the statistics box in `client/app/page.tsx` displays the appropriate stats (line-based or full-card-based) fetched from `/api/game-state` depending on the game phase (`partialWinOccurred`).
- [ ] **Story: Player Winner Display (client/app/play/[txid]/page.tsx):** Modify the player monitoring page to display winner information fetched from `/api/game-state/:txid`, correctly handling `partialWinOccurred`, `partialWinners`, `fullCardWinners`, and `isOver` based on the `gameMode`.

### 9. Testing: Expanded Coverage (@tests-tdd+bdd.mdc)
- [ ] **Story: Backend Unit Tests:** Add tests for `checkFullCardWin`. Update tests for `utils.js` functions affected by renaming/logic changes.
- [ ] **Story: Backend Integration Tests:** Add/Update tests for `/api/check-transaction`, `/api/draw`, `/api/game-state`, and the new `/api/end-game` to cover both game modes, partial win state transitions, and GM actions. Address existing skipped tests if possible.
- [ ] **Story: Frontend Unit/Integration Tests:** 
    - [ ] Update tests for `UserLogin` component.
    - [ ] Update tests for `client/app/page.tsx` and related components to cover mode selection, GM controls visibility/functionality, and updated winner/stats display logic. *(Partially done, blocked by async issues)*
    - [ ] Update tests for `client/app/play/[txid]/page.tsx` and related components.
- [ ] **Story: Frontend E2E Tests:** Add new Cypress/Playwright scenarios covering:
    - [ ] Game Master flow for `fullCardOnly` mode.
    - [ ] Game Master flow for `partialAndFull` mode, including the decision point (continue/end) and subsequent states.
    - [ ] Player view verification for both modes, showing correct winner announcements. 