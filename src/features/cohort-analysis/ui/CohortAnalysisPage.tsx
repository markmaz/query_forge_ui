import React, { useEffect, useMemo, useState } from 'react';
import { askAnalysis } from '../model/api';
import type { Conversation, Message } from '../model/types';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import TypingDots from './components/TypingDots';
import ChatHeader from './components/ChatHeader';
import '../styles/chat.css'

const LS_KEY = 'analysis-chat:conversation';

function newConversation(): Conversation {
  const now = Date.now();
  return { id: crypto.randomUUID(), title: 'New conversation', messages: [], createdAt: now, updatedAt: now };
}

const CohortAnalysisPage: React.FC = () => {
  const [conversation, setConversation] = useState<Conversation>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw) as Conversation;
    } catch {}
    return newConversation();
  });
  const [pending, setPending] = useState(false);

  // Persist
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(conversation));
  }, [conversation]);

  const send = async (text: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, createdAt: Date.now() };
    const withUser = { ...conversation, messages: [...conversation.messages, userMsg], updatedAt: Date.now() };
    setConversation(withUser);
    setPending(true);
    try {
      const reply = await askAnalysis(withUser.messages);
      const asstMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: reply, createdAt: Date.now() };
      setConversation(conv => ({ ...conv, messages: [...conv.messages, asstMsg], updatedAt: Date.now() }));
    } catch (e: any) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry—something went wrong.\n\n\`${e?.message ?? e}\``,
        createdAt: Date.now(),
      };
      setConversation(conv => ({ ...conv, messages: [...conv.messages, errMsg], updatedAt: Date.now() }));
    } finally {
      setPending(false);
    }
  };

  const onNew = () => setConversation(newConversation());
  const onRename = (title: string) => setConversation(c => ({ ...c, title, updatedAt: Date.now() }));

  const pendingNode = useMemo(() => <TypingDots />, []);

  return (
    <div className="chat-wrap">
      <ChatHeader conversation={conversation} onNew={onNew} onRename={onRename} />
      <MessageList messages={conversation.messages} pending={pending} pendingNode={pendingNode} />
      <MessageInput onSend={send} disabled={pending} />
    </div>
  );
};

export default CohortAnalysisPage;
