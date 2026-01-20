import React, { useEffect, useRef } from 'react';
import type { Message } from '../../model/types';
import '../../styles/chat.css';

type Props = { messages: Message[]; pending?: boolean; pendingNode?: React.ReactNode; };

const MessageList: React.FC<Props> = ({ messages, pending, pendingNode }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  return (
    <div className="chat-list" ref={ref}>
      {messages.map(m => (
        <div key={m.id} className={`msg ${m.role}`}>
          <div className="msg-bubble">
            <div className="msg-meta">
              <span className="msg-role">{m.role === 'user' ? 'You' : 'Assistant'}</span>
              <span className="msg-time">{new Date(m.createdAt).toLocaleTimeString()}</span>
            </div>
            <div className="msg-content">{m.content}</div>
          </div>
        </div>
      ))}
      {pending && pendingNode}
    </div>
  );
};

export default MessageList;
