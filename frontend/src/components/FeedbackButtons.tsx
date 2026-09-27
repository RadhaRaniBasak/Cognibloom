import { useId } from 'react';
import type { Feedback } from '../../../shared/contract';
import { useSetFeedback } from '../queries';

const choices: Array<{ value: Feedback; label: string; pressedStyle: string }> = [
  { value: 'helpful', label: 'Yes', pressedStyle: 'border-leaf bg-leaf text-sheet hover:border-leaf' },
  { value: 'not_helpful', label: 'No', pressedStyle: 'border-brick bg-brick text-sheet hover:border-brick' },
];

export function FeedbackButtons({
  sessionId,
  interactionId,
  feedback,
}: {
  sessionId: number;
  interactionId: number;
  feedback: Feedback | null;
}) {
  const labelId = useId();
  const setFeedback = useSetFeedback(sessionId, interactionId);

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span id={labelId} className="text-graphite">
        Was this helpful?
      </span>
      <div role="group" aria-labelledby={labelId} className="flex gap-2">
        {choices.map((choice) => {
          const pressed = feedback === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              aria-pressed={pressed}
              className={`button button-small min-w-12 ${pressed ? choice.pressedStyle : ''}`}
              onClick={() => setFeedback.mutate(pressed ? null : choice.value)}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
      {setFeedback.isError && (
        <span role="alert" className="text-brick">
          Your rating wasn't saved. Try again.
        </span>
      )}
    </div>
  );
}
