import ReactMarkdown, { type Components } from 'react-markdown';

const highlightedParagraphs: Components = {
  p: ({ children }) => (
    <p>
      <mark>{children}</mark>
    </p>
  ),
};

export function Markdown({
  text,
  highlighted = false,
  className = '',
}: {
  text: string;
  highlighted?: boolean;
  className?: string;
}) {
  return (
    <div className={`study-text ${className}`}>
      <ReactMarkdown components={highlighted ? highlightedParagraphs : undefined}>{text}</ReactMarkdown>
    </div>
  );
}
