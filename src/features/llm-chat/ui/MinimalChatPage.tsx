import React, { useEffect, useMemo, useRef, useState } from "react";

import { useAppSelector } from "../../../shared/lib/hooks";
import { sendMinimalChat, type ChatMessage } from "../../../shared/services/chat";

type UiChatMessage = ChatMessage & {
  id: string;
};

const listStyle: React.CSSProperties = {
  width: "100%",
  height: "52vh",
  overflowY: "auto",
  border: "1px solid var(--bs-border-color, #dee2e6)",
  borderRadius: 8,
  background: "var(--bs-body-bg, #fff)",
};

const bubbleBaseStyle: React.CSSProperties = {
  width: "100%",
  display: "block",
  boxSizing: "border-box",
  borderRadius: 8,
  padding: "0.625rem 0.75rem",
  whiteSpace: "pre-wrap",
  lineHeight: 1.35,
};

function toRequestMessages(messages: UiChatMessage[]): ChatMessage[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

function createMessage(role: ChatMessage["role"], content: string): UiChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

export default function MinimalChatPage() {
  const workspaceId = useAppSelector((state) => state.userWorkspaces.selectedWorkspaceId ?? null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const canSend = input.trim().length > 0 && !loading;
  const hasMessages = messages.length > 0;

  useEffect(() => {
    listEndRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, loading]);

  const visibleMessages = useMemo(() => messages, [messages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || loading) return;

    const userMessage = createMessage("user", content);
    const requestMessages = [...toRequestMessages(messages), { role: "user" as const, content }];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const result = await sendMinimalChat({
        workspaceId,
        messages: requestMessages,
        debug,
      });

      setMessages((prev) => [...prev, createMessage("assistant", result.assistant.content)]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to send chat request.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  function handleClear() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="py-3 px-3 w-100" style={{ width: "100%", maxWidth: "none" }}>
      <div className="card w-100" style={{ width: "100%", maxWidth: "none" }}>
        <div className="card-body d-flex flex-column gap-3 w-100" style={{ width: "100%" }}>
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div>
              <h5 className="mb-1">LLM Chat Test</h5>
              <div className="text-muted small">POST /api/v1/chat/minimal (non-streaming)</div>
            </div>
            <div className="d-flex align-items-center gap-3">
              <div className="form-check mb-0">
                <input
                  id="chat-debug-toggle"
                  type="checkbox"
                  className="form-check-input"
                  checked={debug}
                  onChange={(event) => setDebug(event.target.checked)}
                />
                <label className="form-check-label small" htmlFor="chat-debug-toggle">
                  Debug
                </label>
              </div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleClear}
                disabled={!hasMessages && !error}
              >
                Clear chat
              </button>
            </div>
          </div>

          <div style={listStyle} className="p-3" aria-label="Chat messages">
            {!hasMessages ? (
              <div className="text-muted small">No messages yet. Send a prompt to test the chat endpoint.</div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {visibleMessages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <div key={message.id} className="w-100" style={{ width: "100%" }}>
                      <div style={{ width: "100%" }}>
                        <div
                          className="small text-muted mb-1"
                          style={{ textAlign: isUser ? "right" : "left" }}
                        >
                          {isUser ? "You" : "Assistant"}
                        </div>
                        <div
                          style={{
                            ...bubbleBaseStyle,
                            background: isUser ? "rgba(13, 110, 253, 0.12)" : "rgba(108, 117, 125, 0.12)",
                            border: `1px solid ${isUser ? "rgba(13, 110, 253, 0.25)" : "rgba(108, 117, 125, 0.25)"}`,
                          }}
                        >
                          {message.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {loading ? (
              <div className="mt-3">
                <div className="small text-muted mb-1">Assistant</div>
                <div
                  style={{
                    ...bubbleBaseStyle,
                    background: "rgba(108, 117, 125, 0.08)",
                    border: "1px dashed rgba(108, 117, 125, 0.25)",
                    width: "100%",
                  }}
                >
                  Thinking...
                </div>
              </div>
            ) : null}
            <div ref={listEndRef} />
          </div>

          {error ? (
            <div className="alert alert-danger py-2 px-3 mb-0" role="alert">
              {error}
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
            className="d-flex flex-column gap-2 w-100"
            style={{ width: "100%" }}
          >
            <label htmlFor="chat-test-input" className="form-label mb-0 small fw-semibold">
              Message
            </label>
            <textarea
              id="chat-test-input"
              className="form-control"
              rows={4}
              placeholder="Type a prompt..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
              <div className="small text-muted">
                Workspace header: {workspaceId ? <code>{workspaceId}</code> : "none"}
              </div>
              <button type="submit" className="btn btn-primary" disabled={!canSend}>
                {loading ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
