import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Topic } from '../../../shared/contract';
import { ApiError } from '../api';
import { StartSessionButton } from '../components/StartSessionButton';
import { ErrorNotice, Loading } from '../components/States';
import { count, timeAgo } from '../format';
import { useCreateTopic, useTopics } from '../queries';

export function TopicsPage() {
  const topics = useTopics();

  return (
    <div className="max-w-3xl">
      <title>Topics | Cognibloom</title>
      <h1 className="text-[1.75rem] font-semibold">Topics</h1>
      <NewTopicForm />

      <section aria-label="Your topics" className="mt-12">
        {topics.isPending ? (
          <Loading />
        ) : topics.isError ? (
          <ErrorNotice error={topics.error} onRetry={() => topics.refetch()} />
        ) : topics.data.length === 0 ? (
          <p className="text-graphite">
            No topics yet. Add the first thing you want to understand, like React Hooks or Probability.
          </p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {topics.data.map((topic) => (
              <TopicRow key={topic.id} topic={topic} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NewTopicForm() {
  const navigate = useNavigate();
  const createTopic = useCreateTopic();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const error = createTopic.error;
  const fieldErrors = error instanceof ApiError ? error.fields : {};
  const existingId = error instanceof ApiError && error.code === 'TOPIC_EXISTS' ? error.existingId : undefined;
  const formError = error && !fieldErrors.title && !fieldErrors.description ? error.message : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTopic.mutate({ title, description }, { onSuccess: (topic) => navigate(`/topics/${topic.id}`) });
  }

  function clearError() {
    if (createTopic.isError) createTopic.reset();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 rounded-lg border border-rule bg-sheet p-4 sm:p-5">
      <h2 className="font-semibold">Add a topic</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Field id="topic-title" label="Name" error={fieldErrors.title}>
          <input
            id="topic-title"
            className="input"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              clearError();
            }}
            placeholder="e.g. React Hooks"
            maxLength={80}
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? 'topic-title-error' : undefined}
          />
        </Field>
        <Field id="topic-description" label="What do you want to understand?" optional error={fieldErrors.description}>
          <input
            id="topic-description"
            className="input"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              clearError();
            }}
            placeholder="e.g. When effects run, and why"
            maxLength={280}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={fieldErrors.description ? 'topic-description-error' : undefined}
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" className="button button-primary" disabled={createTopic.isPending}>
          {createTopic.isPending ? 'Adding…' : 'Add topic'}
        </button>
        {formError && (
          <p role="alert" className="text-sm text-brick">
            {formError}{' '}
            {existingId && (
              <Link to={`/topics/${existingId}`} className="text-leaf underline underline-offset-2">
                Open it
              </Link>
            )}
          </p>
        )}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  optional = false,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-graphite"> (optional)</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-brick">
          {error}
        </p>
      )}
    </div>
  );
}

function TopicRow({ topic }: { topic: Topic }) {
  const { stats } = topic;
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
      <div className="min-w-0 flex-1 basis-72">
        <Link to={`/topics/${topic.id}`} className="font-serif text-xl font-semibold hover:text-leaf">
          {topic.title}
        </Link>
        {topic.description && <p className="mt-1 text-graphite">{topic.description}</p>}
        <p className="mt-2 text-sm text-graphite">
          {stats.lastStudiedAt
            ? `${count(stats.questions, 'question')} and ${count(stats.explanations, 'explanation')}, last studied ${timeAgo(stats.lastStudiedAt)}.`
            : 'Not studied yet.'}
        </p>
      </div>
      <StartSessionButton
        topicId={topic.id}
        hasActiveSession={topic.activeSessionId !== null}
        quiet={topic.activeSessionId === null}
      />
    </li>
  );
}
