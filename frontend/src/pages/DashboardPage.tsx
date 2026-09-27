import { Link } from 'react-router';
import type { Dashboard } from '../../../shared/contract';
import { ActivityChart } from '../components/ActivityChart';
import { ErrorNotice, Loading } from '../components/States';
import { count, timeAgo } from '../format';
import { useDashboard } from '../queries';

export function DashboardPage() {
  const dashboard = useDashboard();

  if (dashboard.isPending) return <Loading />;
  if (dashboard.isError) return <ErrorNotice error={dashboard.error} onRetry={() => dashboard.refetch()} />;

  const { totals, activity, topics, needsReview, resume, mostStudied } = dashboard.data;
  if (totals.questions + totals.explanations === 0) return <NothingYet hasTopics={totals.topics > 0} />;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
      <title>Progress | Cognibloom</title>

      <header className="lg:col-start-1">
        <h1 className="max-w-[30ch] text-[1.75rem] leading-snug font-semibold text-balance sm:text-[2rem]">
          {headline(totals, activity.activeDays, activity.days.length)}
        </h1>
        {resume && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-rule bg-sheet px-4 py-3">
            <p>
              Your <span className="font-serif font-semibold">{resume.topicTitle}</span> session is still open. Last
              activity {timeAgo(resume.lastActivityAt)}.
            </p>
            <Link to={`/sessions/${resume.sessionId}`} className="button button-primary">
              Continue session
            </Link>
          </div>
        )}
      </header>

      <aside aria-labelledby="totals-heading" className="lg:col-start-2 lg:row-span-4 lg:row-start-1">
        <h2 id="totals-heading" className="text-lg font-semibold">
          Totals
        </h2>
        <Totals totals={totals} mostStudied={mostStudied} />
      </aside>

      <section aria-labelledby="activity-heading" className="lg:col-start-1">
        <h2 id="activity-heading" className="text-lg font-semibold">
          Last 14 days
        </h2>
        <p className="mt-1 text-graphite">{weekComparison(activity)}</p>
        <div className="mt-6">
          <ActivityChart days={activity.days} />
        </div>
      </section>

      {needsReview.length > 0 && (
        <section aria-labelledby="review-heading" className="lg:col-start-1">
          <h2 id="review-heading" className="text-lg font-semibold">
            Needs another look
          </h2>
          <p className="mt-1 max-w-prose text-graphite">
            Answers you marked as not helpful. Try asking in a different way, or come back to them later.
          </p>
          <ul className="mt-5 space-y-4">
            {needsReview.map((item) => (
              <li key={item.interactionId}>
                <Link
                  to={`/sessions/${item.sessionId}#interaction-${item.interactionId}`}
                  className="font-serif text-[1.0625rem] font-semibold hover:text-leaf"
                >
                  {item.prompt}
                </Link>
                <p className="text-sm text-graphite">
                  {item.topicTitle}, {timeAgo(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="topics-heading" className="lg:col-start-1">
        <h2 id="topics-heading" className="text-lg font-semibold">
          By topic
        </h2>
        <TopicTable topics={topics} />
      </section>
    </div>
  );
}

function headline(totals: Dashboard['totals'], activeDays: number, windowDays: number): string {
  const studied =
    activeDays === 0
      ? `You haven't studied in the last ${windowDays} days`
      : `You studied on ${activeDays} of the last ${windowDays} days`;
  if (totals.challenges === 0) return `${studied}.`;
  return `${studied} and answered ${totals.challengesAnswered} of the ${count(totals.challenges, 'challenge')} you were given.`;
}

function weekComparison({ thisWeek, lastWeek }: Dashboard['activity']): string {
  const describe = (week: typeof thisWeek) =>
    `${count(week.questions, 'question')} and ${count(week.explanations, 'explanation')}`;
  return `This week: ${describe(thisWeek)}. The week before: ${describe(lastWeek)}.`;
}

function Totals({ totals, mostStudied }: Pick<Dashboard, 'totals' | 'mostStudied'>) {
  const rated = totals.helpful + totals.notHelpful;
  const rows = [
    { label: 'Topics studied', value: `${totals.topicsStudied} of ${totals.topics}` },
    { label: 'Study sessions', value: totals.sessions.toLocaleString() },
    { label: 'Questions asked', value: totals.questions.toLocaleString() },
    { label: 'Challenges answered', value: `${totals.challengesAnswered} of ${totals.challenges}` },
    { label: 'Helpful answers', value: rated === 0 ? 'None rated' : `${totals.helpful} of ${rated} rated` },
  ];

  return (
    <dl className="mt-3 divide-y divide-rule border-y border-rule">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-graphite">{label}</dt>
          <dd className="font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
      {mostStudied && (
        <div className="py-2.5">
          <dt className="text-graphite">Most studied</dt>
          <dd className="mt-0.5">
            <Link to={`/topics/${mostStudied.topicId}`} className="font-serif text-lg font-semibold hover:text-leaf">
              {mostStudied.title}
            </Link>
          </dd>
        </div>
      )}
    </dl>
  );
}

function TopicTable({ topics }: Pick<Dashboard, 'topics'>) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left">
        <thead className="text-sm text-graphite">
          <tr className="border-b border-rule">
            <th scope="col" className="py-2 pr-4 font-normal">
              Topic
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              Questions
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              Challenges answered
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              Helpful
            </th>
            <th scope="col" className="py-2 font-normal">
              Last studied
            </th>
          </tr>
        </thead>
        <tbody>
          {topics.map(({ id, title, stats }) => {
            const rated = stats.helpful + stats.notHelpful;
            return (
              <tr key={id} className="border-b border-rule">
                <th scope="row" className="py-3 pr-4 font-normal">
                  <Link to={`/topics/${id}`} className="font-serif font-semibold hover:text-leaf">
                    {title}
                  </Link>
                </th>
                <td className="py-3 pr-4 text-right tabular-nums">{stats.questions}</td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {stats.challenges ? `${stats.challengesAnswered} of ${stats.challenges}` : '–'}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{rated ? `${stats.helpful} of ${rated}` : '–'}</td>
                <td className="py-3 text-graphite">
                  {stats.lastStudiedAt ? timeAgo(stats.lastStudiedAt) : 'Not started'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NothingYet({ hasTopics }: { hasTopics: boolean }) {
  return (
    <div className="max-w-xl">
      <title>Progress | Cognibloom</title>
      <h1 className="text-[1.75rem] leading-snug font-semibold text-balance">
        Your progress shows up here after your first study session.
      </h1>
      <p className="mt-3 text-graphite">
        You'll see which days you studied, how many challenges you answered in your own words, and which answers didn't
        help.
      </p>
      <Link to="/topics" className="button button-primary mt-6">
        {hasTopics ? 'Choose a topic to study' : 'Add your first topic'}
      </Link>
    </div>
  );
}
