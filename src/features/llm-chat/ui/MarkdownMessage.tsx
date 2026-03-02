import { isValidElement, useMemo, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

type MarkdownMessageProps = {
  content: string;
};

function flattenText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return flattenText(node.props.children ?? "");
  return "";
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  const [copiedBlockKey, setCopiedBlockKey] = useState<string | null>(null);

  const handleCopy = async (text: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard?.writeText(text);
      const key = text.slice(0, 120);
      setCopiedBlockKey(key);
      window.setTimeout(() => {
        setCopiedBlockKey((prev) => (prev === key ? null : prev));
      }, 1200);
    } catch {
      // no-op
    }
  };

  const components = useMemo(
    () => ({
      a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
      pre: ({ children }: { children?: ReactNode }) => {
        const codeText = flattenText(children ?? "");
        const key = codeText.slice(0, 120);
        const isCopied = copiedBlockKey === key;
        return (
          <div className="qf-chat-md-code-wrap">
            <button
              type="button"
              className="qf-chat-md-code-copy"
              onClick={() => {
                void handleCopy(codeText);
              }}
              aria-label={isCopied ? "Copied" : "Copy code"}
              title={isCopied ? "Copied" : "Copy code"}
            >
              <i className={`fa ${isCopied ? "fa-check" : "fa-copy"}`} aria-hidden="true" />
            </button>
            <pre className="qf-chat-md-code-pre">{children}</pre>
          </div>
        );
      },
    }),
    [copiedBlockKey]
  );

  return (
    <div className="qf-chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
