import React from 'react';
import type { Conversation } from '../../model/types';
import { copyToClipboard, downloadFile, toMarkdown } from '../../lib/format'
import '../../styles/chat.css';

type Props = {
  conversation: Conversation;
  onNew: () => void;
  onRename?: (title: string) => void;
};

const ChatHeader: React.FC<Props> = ({ conversation, onNew, onRename }) => {
  const doCopy = async () => {
    const ok = await copyToClipboard(toMarkdown(conversation));
    alert(ok ? 'Copied conversation to clipboard.' : 'Copy failed—your browser may block clipboard access.');
  };

  const dlMd = () =>
    downloadFile(`${conversation.title || 'conversation'}.md`, toMarkdown(conversation), 'text/markdown');

  const dlJson = () =>
    downloadFile(`${conversation.title || 'conversation'}.json`, JSON.stringify(conversation, null, 2), 'application/json');

  return (
    <div className="chat-header">
      <input
        className="chat-title"
        value={conversation.title}
        onChange={e => onRename?.(e.target.value)}
        aria-label="Conversation title"
      />
      <div className="chat-actions">
        <button className="btn btn-outline-secondary" onClick={doCopy} title="Copy Markdown"><i className="fa-solid fa-arrow-up-from-bracket me-2"></i>Share</button>
        <button className="btn btn-outline-secondary" onClick={dlMd} title="Download .md"><i className="fa-solid fa-download me-2"></i>.md</button>
        <button className="btn btn-outline-secondary" onClick={dlJson} title="Download .json"><i className="fa-solid fa-download me-2"></i>.json</button>
        <button className="btn btn-secondary" onClick={onNew}><i className="fa-solid fa-comments me-2"></i>New chat</button>
      </div>
    </div>
  );
};

export default ChatHeader;
