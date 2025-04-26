import React from 'react';
import './Footer.css';

function Footer() {
  return (
    <footer className="app-footer">
      <p>
        Author: <a href="https://nostr.com/npub1atrrqav7xyur93xszyaeuyyzy70mpmax488grndfaz3kddyc3dyquawyga" target="_blank" rel="noopener noreferrer">@eddieoz</a>
        | License: MIT
        | Github: <a href="https://github.com/eddieoz/bitBingo" target="_blank" rel="noopener noreferrer">github.com/eddieoz/bitBingo</a>
        | <a href="https://github.com/eddieoz/bitBingo/blob/master/docs/how-to-use.md" target="_blank" rel="noopener noreferrer">How to Use</a>
      </p>
    </footer>
  );
}

export default Footer; 