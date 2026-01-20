import React, { useState } from 'react';
import '../../styles/chat.css';

type Props = { onSend: (text: string) => void; disabled?: boolean; placeholder?: string; };

const MessageInput: React.FC<Props> = ({ onSend, disabled, placeholder = 'Ask a question…' }) => {
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="chat-input">
      <textarea
        className="chat-textarea"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button className="btn btn-primary" onClick={submit} disabled={disabled || !text.trim()}>
        <i className='fa fa-paper-plane me-2'/>
        Send
      </button>
    </div>
  );
};

export default MessageInput;
