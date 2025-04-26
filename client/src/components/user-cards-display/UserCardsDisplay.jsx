import React from 'react';
import { Row, Col } from 'react-bootstrap';
import BingoCard from '../bingo-card/BingoCard'; // Import the single card component

/**
 * Renders a grid of BingoCard components.
 * Expects a `cards` prop which is an array of card objects 
 * (same structure as expected by BingoCard).
 */
function UserCardsDisplay({ cards }) {
  if (!cards || cards.length === 0) {
    return <p>No cards to display.</p>; // Or null, depending on desired behavior
  }

  return (
    <Row xs={1} sm={2} md={3} lg={4} className="g-3"> {/* Adjust grid breakpoints as needed */} 
      {cards.map((card) => (
        <Col key={card.cardId || card.lineIndex}> {/* Use cardId or lineIndex as key */} 
          <BingoCard card={card} />
        </Col>
      ))}
    </Row>
  );
}

export default UserCardsDisplay; 