import { useEffect, useRef, useState, type Ref } from 'react';
import { Link, useLocation } from 'react-router';
import type { CreateInteractionRequest, Interaction, SessionDetail } from '../../../shared/contract';
import { ApiError } from '../api';
import { Composer } from '../components/Composer';
import { FeedbackButtons } from '../components/FeedbackButtons';
import { Markdown } from '../components/Markdown';
import { StartSessionButton } from '../components/StartSessionButton';
import { ErrorNotice, Loading, NotFound } from '../components/States';
import { dayAndTime, formatTime } from '../format';
import { useEndSession, useSession, useSubmitInteraction } from '../queries';
import { useIdParam } from './useIdParam';

export function SessionPage() {
  const sessionId = useIdParam();
  if (sessionId === null) return <NotFound message="This session doesn't exist." />;
  return <SessionView key={sessionId} sessionId={sessionId} />;
}

function SessionView({ sessionId }: { sessionId: number }) {
  const session = useSession(sessionId);
  const submit = useSubmitInteraction(sessionId);
  const endSession = useEndSession(sessionId);
  const [replyingTo, setReplyingTo] = useState<Interaction | null>(null);
  const pendingRef = useRef<HTMLLIElement>(null);
  const linkedId = useLinkedInteraction(session.isSuccess);

  useEffect(() => {
    if (submit.isPending) pendingRef.current?.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
  }, [submit.isPending]);

  if (session.isPending) return <Loading />;
  if (session.isError) {
    if (session.error instanceof ApiError && session.error.status === 404)
      return <NotFound message="This session doesn't exist." />;
    return <ErrorNotice error={session.error} onRetry={() => session.refetch()} />;
  }

  const detail = session.data;
  const isActive = detail.status === 'active';
  const answeredQuestionIds = new Set(detail.interactions.map((interaction) => interaction.replyToId));

  async function send(prompt: string) {
    const input: CreateInteractionRequest = replyingTo
      ? { kind: 'explanation', prompt, replyToId: replyingTo.id }
      : { kind: 'question', prompt };
    await submit.mutateAsync(input);
    setReplyingTo(null);
  }

  return (
    <article className="max-w-[44rem]">
      <title>{`${detail.topicTitle} session | Cognibloom`}</title>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="font-serif text-[2.25rem] leading-tight font-semibold tracking-tight">{detail.topicTitle}</h1>
          <p className="mt-1.5 text-graphite">
            {describeTiming(detail)}{' '}
            <Link to={`/topics/${detail.topicId}`} className="text-leaf underline underline-offset-2">
              Topic history
            </Link>
          </p>
        </div>
        {isActive && (
          <button type="button" className="button" onClick={() => endSession.mutate()} disabled={endSession.isPending}>
            End session
          </button>
        )}
      </header>
      {endSession.isError && (
        <p role="alert" className="mt-3 text-sm text-brick">
          {endSession.error.message}
        </p>
      )}

      {isActive && detail.interactions.length === 0 && !submit.isPending && (
        <p className="mt-10 max-w-prose text-graphite">
          Ask your first question. Each answer ends with a short challenge, and answering it in your own words shows you
          what you've understood and what you haven't.
        </p>
      )}

      <ol className="mt-10 space-y-14">
        {detail.interactions.map((interaction) => (
          <Exchange
            key={interaction.id}
            interaction={interaction}
            sessionId={sessionId}
            isLinked={interaction.id === linkedId}
            canAnswer={isActive}
            isAnswered={answeredQuestionIds.has(interaction.id)}
            isBeingAnswered={replyingTo?.id === interaction.id}
            onAnswer={() => setReplyingTo(interaction)}
          />
        ))}
        {submit.isPending && <PendingExchange input={submit.variables} ref={pendingRef} />}
      </ol>

      {isActive ? (
        <Composer
          topicTitle={detail.topicTitle}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          onSend={send}
          isSending={submit.isPending}
          error={submit.error}
        />
      ) : (
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <p className="max-w-md text-graphite">This session has ended. To keep going, start a new one.</p>
          <StartSessionButton topicId={detail.topicId} hasActiveSession={false} label="Start a new session" />
        </div>
      )}
    </article>
  );
}

interface ExchangeProps {
  interaction: Interaction;
  sessionId: number;
  isLinked: boolean;
  canAnswer: boolean;
  isAnswered: boolean;
  isBeingAnswered: boolean;
  onAnswer: () => void;
}

function Exchange({
  interaction,
  sessionId,
  isLinked,
  canAnswer,
  isAnswered,
  isBeingAnswered,
  onAnswer,
}: ExchangeProps) {
  let answerLabel = 'Answer in your own words';
  if (isBeingAnswered) answerLabel = 'Answering below';
  else if (isAnswered) answerLabel = 'Answer again';

  return (
    <li
      id={`interaction-${interaction.id}`}
      className={`-mx-4 scroll-mt-6 rounded-lg px-4 py-2 ${isLinked ? 'pointed-at' : ''}`}
    >
      <LearnerText kind={interaction.kind} text={interaction.prompt} createdAt={interaction.createdAt} />
      <Markdown text={interaction.response} className="mt-5" />

      {interaction.challenge && (
        <section aria-label="Challenge" className="mt-7">
          <h3 className="text-sm font-semibold">Challenge</h3>
          <Markdown text={interaction.challenge} highlighted className="mt-1.5" />
          {canAnswer && (
            <button type="button" className="button button-small mt-4" onClick={onAnswer} disabled={isBeingAnswered}>
              {answerLabel}
            </button>
          )}
        </section>
      )}

      <FeedbackButtons sessionId={sessionId} interactionId={interaction.id} feedback={interaction.feedback} />
    </li>
  );
}

function LearnerText({ kind, text, createdAt }: { kind: Interaction['kind']; text: string; createdAt?: string }) {
  const time = createdAt ? <p className="mt-1 text-sm text-graphite">{formatTime(createdAt)}</p> : null;

  if (kind === 'question') {
    return (
      <>
        <h2 className="font-serif text-[1.375rem] leading-snug font-semibold whitespace-pre-wrap">{text}</h2>
        {time}
      </>
    );
  }
  return (
    <>
      <h2 className="text-sm font-semibold">Your explanation</h2>
      <blockquote className="study-text mt-2 border-l-4 border-highlighter pl-4 whitespace-pre-wrap">{text}</blockquote>
      {time}
    </>
  );
}

function PendingExchange({ input, ref }: { input: CreateInteractionRequest; ref: Ref<HTMLLIElement> }) {
  return (
    <li ref={ref} className="scroll-mt-6 py-2">
      <LearnerText kind={input.kind} text={input.prompt} />
      <p role="status" className="mt-5 text-graphite">
        Waiting for a response…
      </p>
    </li>
  );
}

function describeTiming(session: SessionDetail): string {
  const started = `Started ${dayAndTime(session.startedAt)}`;
  if (!session.endedAt) return `${started}.`;

  const sameDay = new Date(session.startedAt).toDateString() === new Date(session.endedAt).toDateString();
  return `${started}, ended ${sameDay ? `at ${formatTime(session.endedAt)}` : dayAndTime(session.endedAt)}.`;
}

function useLinkedInteraction(isLoaded: boolean): number | null {
  const { hash } = useLocation();
  const match = /^#interaction-(\d+)$/.exec(hash);
  const linkedId = match ? Number(match[1]) : null;

  useEffect(() => {
    if (isLoaded && linkedId !== null) {
      document.getElementById(`interaction-${linkedId}`)?.scrollIntoView({ block: 'start' });
    }
  }, [isLoaded, linkedId]);

  return linkedId;
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
