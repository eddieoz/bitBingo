import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import UserCardsDisplay from './UserCardsDisplay'; // Assuming default export
import BingoCard from '../bingo-card/BingoCard'; // Import the real component path

// Mock the BingoCard component
vi.mock('../bingo-card/BingoCard', () => {
    // Wrapper mock function that only considers the first arg (props)
    const mockComponent = vi.fn((props) => {
        // Render simple identifiable element using props
        const { card } = props; // Destructure needed props
        return <div data-testid="mock-bingo-card">Card ID: {card?.cardId || 'undefined'}</div>;
    });
    // Return the structure Vitest expects for a default export
    return { default: mockComponent };
});

// Helper to create mock card data
const createMockCardData = (count) => {
    const cards = [];
    for (let i = 0; i < count; i++) {
        cards.push({
            cardId: `card-${i}`,
            lineIndex: i,
            grid: {} // Grid details not needed for this test due to mock
        });
    }
    return cards;
};

describe('UserCardsDisplay Component', () => {

    test('Story: Render Multiple Cards - renders the correct number of BingoCard components', () => {
        // Arrange
        const mockCards = createMockCardData(3);
        const mockDrawnNumbers = new Set([1, 2, 3]);
        const mockWinningSequence = [];

        render(
            <UserCardsDisplay 
                cards={mockCards} 
                drawnNumbers={mockDrawnNumbers} 
                winningSequence={mockWinningSequence} 
            />
        );

        // Assert: Check that the correct number of mocked BingoCards were rendered
        const renderedCards = screen.getAllByTestId('mock-bingo-card');
        expect(renderedCards).toHaveLength(mockCards.length);

        // Check content of one mock card to ensure data flow
        expect(renderedCards[0]).toHaveTextContent(`Card ID: ${mockCards[0].cardId}`);
        expect(renderedCards[1]).toHaveTextContent(`Card ID: ${mockCards[1].cardId}`);
        expect(renderedCards[2]).toHaveTextContent(`Card ID: ${mockCards[2].cardId}`);
    });

    test('Story: Prop Drilling - passes correct props down to BingoCard instances', () => {
        // Arrange
        const mockCards = createMockCardData(2);
        const mockDrawnNumbers = new Set([10, 20]);
        const mockWinningSequence = [10];

        render(
            <UserCardsDisplay 
                cards={mockCards} 
                drawnNumbers={mockDrawnNumbers} 
                winningSequence={mockWinningSequence} 
            />
        );

        // Assert: Check that the mock BingoCard was called with the correct props
        const bingoCardMock = vi.mocked(BingoCard);
        expect(bingoCardMock).toHaveBeenCalledTimes(mockCards.length);

        // Check props passed to the first call (accessing the first argument)
        expect(bingoCardMock.mock.calls[0][0]).toEqual(
            expect.objectContaining({
                card: mockCards[0],
                drawnNumbers: mockDrawnNumbers,
                winningSequence: mockWinningSequence
            })
        );
        
        // Check props passed to the second call (accessing the first argument)
        expect(bingoCardMock.mock.calls[1][0]).toEqual(
            expect.objectContaining({
                card: mockCards[1],
                drawnNumbers: mockDrawnNumbers,
                winningSequence: mockWinningSequence
            })
        );
    });

    const mockCards = createMockCardData(2);

    beforeEach(() => {
        // Clear mocks before each test
        vi.mocked(BingoCard).mockClear();
    });

    it('should render the correct number of BingoCard components', () => {
        render(
            <React.Fragment>
                <UserCardsDisplay cards={mockCards} isLoading={false} error={null} />
            </React.Fragment>
        );
        const renderedCards = screen.getAllByTestId('mock-bingo-card');
        expect(renderedCards).toHaveLength(mockCards.length);
        // Check if the mock component was called the correct number of times
        expect(vi.mocked(BingoCard)).toHaveBeenCalledTimes(mockCards.length);
    });

    it('should pass the correct card data to each BingoCard component', () => {
        render(
            <React.Fragment>
                <UserCardsDisplay cards={mockCards} isLoading={false} error={null} />
            </React.Fragment>
        );
        // Check if the mock component was called with the correct props
        const bingoCardMock = vi.mocked(BingoCard);
        expect(bingoCardMock).toHaveBeenCalledTimes(mockCards.length);

        mockCards.forEach((card, index) => {
            // Access the first argument of the (index + 1)th call
            expect(bingoCardMock.mock.calls[index][0]).toEqual(
                expect.objectContaining({ 
                    card: card,
                    drawnNumbers: [], // Expect default value
                    winningSequence: null // Expect default value
                })
            );
        });
    });

}); 