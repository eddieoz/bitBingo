import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BingoCard from './BingoCard'; // Corrected to default import

// Mock CSS Modules if necessary (if component imports CSS)
vi.mock('./BingoCard.css', () => ({ default: {} })); 

// Helper to create mock grid data
const createMockGrid = () => ({
    B: [1, 2, 3, 4, 5],
    I: [16, 17, 18, 19, 20],
    N: [31, 32, null, 34, 35], // Includes free space
    G: [46, 47, 48, 49, 50],
    O: [61, 62, 63, 64, 65]
});

describe('BingoCard Component', () => {
    const mockGrid = createMockGrid();
    const mockDrawnNumbers = new Set(); // Empty for render test
    const mockWinningSequence = [];   // Empty for render test

    test('Story: Render Grid - displays the 5x5 grid correctly', () => {
        // Create a mock card object containing the grid and other needed fields
        const mockCardProp = {
            cardId: 'test-card-123',
            lineIndex: 1,
            grid: mockGrid
        };

        render(
            <BingoCard 
                card={mockCardProp} // Pass the card object
                drawnNumbers={mockDrawnNumbers} 
                winningSequence={mockWinningSequence} 
            />
        );

        // Check headers are rendered
        expect(screen.getByRole('columnheader', { name: /B/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /I/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /N/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /G/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /O/i })).toBeInTheDocument();

        // Check a few numbers from the grid are present
        expect(screen.getByText('1')).toBeInTheDocument(); // B column
        expect(screen.getByText('17')).toBeInTheDocument(); // I column
        expect(screen.getByText('34')).toBeInTheDocument(); // N column
        expect(screen.getByText('48')).toBeInTheDocument(); // G column
        expect(screen.getByText('65')).toBeInTheDocument(); // O column
        
        // Check the FREE space cell (it should have specific text or class)
        // Assuming it might contain the text "FREE" or have a specific test-id/class
        // For now, let's check for the cell itself. Test might need refinement based on implementation.
        // The free space is N[2]. It might render as empty or with specific text.
        // We'll refine this check in the "Mark Free Space" test.
        expect(screen.getAllByRole('cell').length).toBe(25); // Correct role is 'cell'
    });

    test('Story: Mark Drawn Numbers - adds marked class to drawn numbers', () => {
        const numbersToMark = new Set([3, 17, 48, 65]); // Example numbers from mockGrid
        const mockCardProp = {
            cardId: 'test-card-mark',
            lineIndex: 2,
            grid: mockGrid
        };

        render(
            <BingoCard 
                card={mockCardProp} 
                drawnNumbers={numbersToMark} // Pass the set of drawn numbers
                winningSequence={[]} 
            />
        );

        // Check that the cells containing drawn numbers have the 'marked' class
        numbersToMark.forEach(number => {
            const cell = screen.getByText(number.toString());
            expect(cell).toHaveClass('marked');
        });

        // Check a number that wasn't drawn does NOT have the class
        const unmarkedCell = screen.getByText('1'); // Example unmarked number
        expect(unmarkedCell).not.toHaveClass('marked');

        // Check the free space (should also be marked, handled in next test explicitly)
        const freeSpace = screen.getByText('FREE');
        expect(freeSpace).toHaveClass('marked'); 
    });

    test('Story: Mark Free Space - adds marked class/text to the free space', () => {
        // Arrange: Render with empty drawn numbers
        const mockCardProp = {
            cardId: 'test-card-free',
            lineIndex: 3,
            grid: mockGrid
        };

        render(
            <BingoCard 
                card={mockCardProp} 
                drawnNumbers={new Set()} // No numbers drawn explicitly
                winningSequence={[]} 
            />
        );

        // Assert: Find the FREE space cell and check its properties
        const freeSpaceCell = screen.getByText('FREE');
        expect(freeSpaceCell).toBeInTheDocument();
        // Component logic automatically adds 'marked' to free space
        expect(freeSpaceCell).toHaveClass('marked'); 
        expect(freeSpaceCell).toHaveClass('free-space'); 
    });

    test('Story: Highlight Winning Sequence - adds highlight class to winning numbers', () => {
        // Arrange: Define a winning sequence and the necessary drawn numbers
        const winningLine = [16, 17, 'FREE', 47, 62]; // Example diagonal using free space
        const drawnForWin = new Set([16, 17, 47, 62]); // Numbers needed + others maybe
        const mockCardProp = {
            cardId: 'test-card-win',
            lineIndex: 4,
            grid: mockGrid
        };

        render(
            <BingoCard 
                card={mockCardProp} 
                drawnNumbers={drawnForWin}
                winningSequence={winningLine} // Pass the winning sequence
            />
        );

        // Assert: Check cells in the winning sequence have the highlight class
        winningLine.forEach(item => {
            const cellText = typeof item === 'string' ? item : item.toString();
            const cell = screen.getByText(cellText);
            expect(cell).toHaveClass('winning-number');
            // They should also still be marked
            expect(cell).toHaveClass('marked'); 
        });

        // Assert: Check a cell NOT in the winning sequence does NOT have the class
        const nonWinningCell = screen.getByText('1'); // Example non-winning number
        expect(nonWinningCell).not.toHaveClass('winning-number');
        // If it wasn't drawn, it also shouldn't be marked
        expect(nonWinningCell).not.toHaveClass('marked'); 
    });
}); 