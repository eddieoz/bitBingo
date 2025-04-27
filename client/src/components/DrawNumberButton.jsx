import React from 'react';
import { Button, Spinner } from 'react-bootstrap';

function DrawNumberButton({ onDraw, isLoading, isDisabled }) {
  return (
    <div className="draw-number-button text-center my-3">
      <Button 
        variant="success" 
        size="lg"
        onClick={onDraw}
        disabled={isDisabled || isLoading} // Disable if explicitly told or if loading
      >
        {isLoading ? (
          <>
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
            />
            <span className="ms-2">Drawing...</span>
          </>
        ) : (
          'Draw Next Number'
        )}
      </Button>
    </div>
  );
}

export default DrawNumberButton; 