import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Interaction } from '../../../shared/contract';
import { count, formatTime } from '../format';

const MAX_LENGTH = 2000;
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

interface ComposerProps {
  topicTitle: string;
  replyingTo: Interaction | null;
  onCancelReply: () => void;
  onSend: (text: string) => Promise<unknown>;
  isSending: boolean;
  error: Error | null;
}

export function Composer({ topicTitle, replyingTo, onCancelReply, onSend, isSending, error }: ComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 260)}px`;
  }, [text]);

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  async function send() {
    const prompt = text.trim();
    if (!prompt || isSending) return;
    try {
      await onSend(prompt);
      setText('');
    } catch {}
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void send();
    } else if (event.key === 'Escape' && replyingTo) {
      onCancelReply();
    }
  }

  const charactersLeft = MAX_LENGTH - text.length;

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky bottom-0 -mx-5 mt-12 border-t border-rule bg-paper px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {replyingTo && (
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <p>
            <span className="font-semibold">Answering the challenge</span> from {formatTime(replyingTo.createdAt)}, in
            your own words.
          </p>
          <button
            type="button"
            onClick={onCancelReply}
            className="cursor-pointer text-leaf underline underline-offset-2"
          >
            Ask a question instead
          </button>
        </div>
      )}

      <label htmlFor="composer" className="sr-only">
        {replyingTo ? 'Your explanation' : 'Your question'}
      </label>
      <textarea
        id="composer"
        ref={textareaRef}
        rows={2}
        maxLength={MAX_LENGTH}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          replyingTo ? 'Explain it as you would to a friend who asked you' : `Ask something about ${topicTitle}`
        }
        className={`input resize-none font-serif text-[1.0625rem] leading-relaxed ${replyingTo ? 'border-l-4 border-l-highlighter' : ''}`}
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-brick">
          {error.message}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="text-xs text-graphite">
          {charactersLeft < 200 ? (
            <span className="text-ink">{count(charactersLeft, 'character')} left. </span>
          ) : (
            <span className="hidden sm:inline">{isMac ? '⌘' : 'Ctrl'} + Enter sends. </span>
          )}
          Answers come from a built-in mock; no AI model is connected.
        </p>
        <button type="submit" className="button button-primary" disabled={isSending || !text.trim()}>
          {isSending ? 'Sending…' : replyingTo ? 'Submit explanation' : 'Ask'}
        </button>
      </div>
    </form>
  );
}
