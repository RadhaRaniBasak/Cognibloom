import type { DayActivity } from '../../../shared/contract';
import { count, formatDate, formatLongDay } from '../format';

const totalFor = (day: DayActivity) => day.questions + day.explanations;

const localNoon = (date: string) => `${date}T12:00:00`;

export function ActivityChart({ days }: { days: DayActivity[] }) {
  const busiestDay = Math.max(1, ...days.map(totalFor));
  const first = days[0];
  const today = days.at(-1);

  return (
    <figure>
      <div className="flex h-36 items-end gap-1 border-b border-graphite/50 sm:gap-1.5">
        {days.map((day) => {
          const description = `${formatLongDay(localNoon(day.date))}: ${count(day.questions, 'question')}, ${count(day.explanations, 'explanation')}`;
          return (
            <div
              key={day.date}
              role="img"
              aria-label={description}
              title={description}
              className="flex h-full flex-1 flex-col justify-end"
            >
              {totalFor(day) > 0 && (
                <div
                  className="flex flex-col overflow-hidden rounded-t-[3px]"
                  style={{ height: `${(totalFor(day) / busiestDay) * 100}%` }}
                >
                  {day.explanations > 0 && (
                    <div
                      className="border border-b-0 border-highlighter-edge bg-highlighter"
                      style={{ flex: day.explanations }}
                    />
                  )}
                  {day.questions > 0 && <div className="bg-graphite" style={{ flex: day.questions }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div aria-hidden className="mt-1.5 flex gap-1 text-center text-xs text-graphite tabular-nums sm:gap-1.5">
        {days.map((day) => (
          <span key={day.date} className={`flex-1 ${day === today ? 'font-bold text-ink' : ''}`}>
            {Number(day.date.slice(8))}
          </span>
        ))}
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-graphite">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-[2px] bg-graphite" />
          Questions asked
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-[2px] border border-highlighter-edge bg-highlighter" />
          Challenges explained
        </span>
        {first && today && (
          <span className="sm:ml-auto">
            {formatDate(localNoon(first.date))} to {formatDate(localNoon(today.date))}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
