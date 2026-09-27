import { useNavigate } from 'react-router';
import { useStartSession } from '../queries';

export function StartSessionButton({
  topicId,
  hasActiveSession,
  label,
  quiet = false,
}: {
  topicId: number;
  hasActiveSession: boolean;
  label?: string;
  quiet?: boolean;
}) {
  const navigate = useNavigate();
  const startSession = useStartSession();

  return (
    <div>
      <button
        type="button"
        className={quiet ? 'button' : 'button button-primary'}
        disabled={startSession.isPending}
        onClick={() => startSession.mutate(topicId, { onSuccess: (session) => navigate(`/sessions/${session.id}`) })}
      >
        {startSession.isPending ? 'Opening…' : (label ?? (hasActiveSession ? 'Continue session' : 'Start session'))}
      </button>
      {startSession.isError && (
        <p role="alert" className="mt-2 text-sm text-brick">
          {startSession.error.message}
        </p>
      )}
    </div>
  );
}
