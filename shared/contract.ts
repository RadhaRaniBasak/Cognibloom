export type InteractionKind = 'question' | 'explanation';
export type Feedback = 'helpful' | 'not_helpful';
export type SessionStatus = 'active' | 'ended';

export interface TopicStats {
  questions: number;
  explanations: number;
  challenges: number;
  challengesAnswered: number;
  sessions: number;
  helpful: number;
  notHelpful: number;
  lastStudiedAt: string | null;
}

export interface Topic {
  id: number;
  title: string;
  description: string | null;
  createdAt: string;
  stats: TopicStats;
  activeSessionId: number | null;
}

export interface CreateTopicRequest {
  title: string;
  description?: string;
}

export interface Interaction {
  id: number;
  sessionId: number;
  kind: InteractionKind;
  prompt: string;
  response: string;
  challenge: string | null;
  replyToId: number | null;
  feedback: Feedback | null;
  createdAt: string;
}

export interface HistoryItem extends Interaction {
  sessionStartedAt: string;
}

export interface HistoryPage {
  items: HistoryItem[];
  nextBefore: number | null;
}

export interface Session {
  id: number;
  topicId: number;
  topicTitle: string;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  status: SessionStatus;
  interactionCount: number;
}

export interface SessionDetail extends Session {
  interactions: Interaction[];
}

export type CreateInteractionRequest =
  { kind: 'question'; prompt: string } | { kind: 'explanation'; prompt: string; replyToId: number };

export interface SetFeedbackRequest {
  feedback: Feedback | null;
}

export interface DayActivity {
  date: string;
  questions: number;
  explanations: number;
}

export interface WeekActivity {
  questions: number;
  explanations: number;
}

export interface Dashboard {
  totals: Omit<TopicStats, 'lastStudiedAt'> & {
    topics: number;
    topicsStudied: number;
  };
  mostStudied: { topicId: number; title: string; interactions: number } | null;
  activity: {
    days: DayActivity[];
    activeDays: number;
    thisWeek: WeekActivity;
    lastWeek: WeekActivity;
  };
  topics: Topic[];
  needsReview: Array<{
    interactionId: number;
    sessionId: number;
    topicId: number;
    topicTitle: string;
    prompt: string;
    createdAt: string;
  }>;
  resume: { sessionId: number; topicTitle: string; lastActivityAt: string } | null;
}

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVALID_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'NOT_FOUND'
  | 'TOPIC_EXISTS'
  | 'SESSION_ENDED'
  | 'INVALID_REPLY'
  | 'RESPONDER_FAILED'
  | 'INTERNAL';

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
    existingId?: number;
  };
}
