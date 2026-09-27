import { Link } from 'react-router';
import type { HistoryItem, TopicStats } from '../../../shared/contract';
import { ApiError } from '../api';
import { StartSessionButton } from '../components/StartSessionButton';
import { ErrorNotice, Loading, NotFound } from '../components/States';
import { count, formatLongDay, formatTime, timeAgo } from '../format';
import { useTopic, useTopicHistory } from '../queries';
import { useIdParam } from './useIdParam';

export function TopicPage() {
  const topicId = useIdParam();
  if (topicId === null) return <NotFound message="This topic doesn't exist." />;
  return <TopicView key={topicId} topicId={topicId} />;
}

function TopicView({ topicId }: { topicId: number }) {
  const topic = useTopic(topicId);

  if (topic.isPending) return <Loading />;
  if (topic.isError) {
    if (topic.error instanceof ApiError && topic.error.status === 404)
      return <NotFound message="This topic doesn't exist." />;
    return <ErrorNotice error={topic.error} onRetry={() => topic.refetch()} />;
  }

  const { title, description, stats, activeSessionId } = topic.data;
  return (
    <article className="max-w-3xl">
      <title>{`${title} | Cognibloom`}</title>
      <Link to="/topics" className="text-sm text-graphite hover:text-ink">
        All topics
      </Link>
      <h1 className="mt-2 font-serif text-[2.5rem] leading-tight font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-2 max-w-prose text-lg text-graphite">{description}</p>}

      <p className="mt-6 max-w-prose">{summarize(stats)}</p>
      <div className="mt-6">
        <StartSessionButton topicId={topicId} hasActiveSession={activeSessionId !== null} />
      </div>

      <History topicId={topicId} />
    </article>
  );
}

function summarize(stats: TopicStats): string {
  if (!stats.lastStudiedAt) return "You haven't studied this yet. Start a session and ask your first question.";

  const rated = stats.helpful + stats.notHelpful;
  const sentences = [
    `You've asked ${count(stats.questions, 'question')} across ${count(stats.sessions, 'session')}` +
      (stats.challenges
        ? ` and answered ${stats.challengesAnswered} of ${count(stats.challenges, 'challenge')} in your own words.`
        : '.'),
    rated ? `Rated helpful: ${stats.helpful} of ${rated}.` : '',
    `Last studied ${timeAgo(stats.lastStudiedAt)}.`,
  ];
  return sentences.filter(Boolean).join(' ');
}

function History({ topicId }: { topicId: number }) {
  const history = useTopicHistory(topicId);

  if (history.isPending) return <Loading />;
  if (history.isError) {
    return (
      <div className="mt-14">
        <ErrorNotice error={history.error} onRetry={() => history.refetch()} />
      </div>
    );
  }

  const sessions = groupBySession(history.data.pages.flatMap((page) => page.items));
  if (sessions.length === 0) return null;

  return (
    <section aria-labelledby="history-heading" className="mt-14">
      <h2 id="history-heading" className="text-lg font-semibold">
        History
      </h2>
      <ol className="mt-4 space-y-9">
        {sessions.map((session) => (
          <li key={session.sessionId}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-rule pb-2">
              <h3 className="font-semibold">
                {formatLongDay(session.startedAt)}, {formatTime(session.startedAt)}
              </h3>
              <Link to={`/sessions/${session.sessionId}`} className="text-sm text-leaf underline underline-offset-2">
                Open session
              </Link>
            </div>
            <ul className="mt-4 space-y-4">
              {session.items.map((item) => (
                <HistoryEntry key={item.id} item={item} />
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {history.hasNextPage && (
        <button
          type="button"
          className="button mt-8"
          onClick={() => history.fetchNextPage()}
          disabled={history.isFetchingNextPage}
        >
          {history.isFetchingNextPage ? 'Loading…' : 'Show older'}
        </button>
      )}
    </section>
  );
}

function HistoryEntry({ item }: { item: HistoryItem }) {
  const isExplanation = item.kind === 'explanation';
  return (
    <li className={isExplanation ? 'border-l-4 border-highlighter pl-3' : ''}>
      <Link to={`/sessions/${item.sessionId}#interaction-${item.id}`} className="group block">
        {isExplanation && <span className="block text-sm text-graphite">Your explanation</span>}
        <span className="line-clamp-2 font-serif group-hover:text-leaf">{item.prompt}</span>
      </Link>
      {item.feedback && (
        <p className={`mt-0.5 text-sm ${item.feedback === 'helpful' ? 'text-leaf' : 'text-brick'}`}>
          {item.feedback === 'helpful' ? 'Answer rated helpful' : 'Answer rated not helpful'}
        </p>
      )}
    </li>
  );
}

function groupBySession(items: HistoryItem[]) {
  const sessions: Array<{ sessionId: number; startedAt: string; items: HistoryItem[] }> = [];
  for (const item of items) {
    const current = sessions.at(-1);
    if (current?.sessionId === item.sessionId) current.items.unshift(item);
    else sessions.push({ sessionId: item.sessionId, startedAt: item.sessionStartedAt, items: [item] });
  }
  return sessions;
}
