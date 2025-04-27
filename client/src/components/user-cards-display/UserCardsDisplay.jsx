import React from 'react';
import { Row, Col } from 'react-bootstrap';
import BingoCard from '../bingo-card/BingoCard'; // Import the single card component

/**
 * Renders a grid of BingoCard components.
 * @param {object} props - Component props.
 * @param {Array<object>} props.cards - Array of card objects.
 * @param {Array<number>} props.drawnNumbers - Array of drawn numbers.
 * @param {Array<number> | null} [props.winningSequence] - Optional winning sequence for highlighting.
 */
function UserCardsDisplay({ cards, drawnNumbers = [], winningSequence = null }) { // Add winningSequence prop
  if (!cards || cards.length === 0) {
    return <p>No cards to display.</p>; // Or null, depending on desired behavior
  }

  return (
    <Row xs={1} sm={2} md={3} lg={4} className="g-3"> {/* Adjust grid breakpoints as needed */} 
      {cards.map((card) => (
        <Col key={card.cardId || card.lineIndex}> {/* Use cardId or lineIndex as key */} 
          <BingoCard 
            card={card} 
            drawnNumbers={drawnNumbers} // Pass drawnNumbers to each card
            winningSequence={winningSequence} // Pass winningSequence to each card
          />
        </Col>
      ))}
    </Row>
  );
}

export default UserCardsDisplay; 