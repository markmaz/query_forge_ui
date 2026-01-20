import React from 'react';
import '../../styles/chat.css';

const TypingDots: React.FC = () => (
  <div className="typing">
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
    <span className="typing-label">Assistant is thinking…</span>
  </div>
);

export default TypingDots;
