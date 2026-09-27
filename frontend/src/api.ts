import type {
  ApiErrorBody,
  CreateInteractionRequest,
  CreateTopicRequest,
  Dashboard,
  ErrorCode,
  Feedback,
  HistoryPage,
  Interaction,
  Session,
  SessionDetail,
  Topic,
} from '../../shared/contract';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly fields: Record<string, string> = {},
    readonly existingId?: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = options.body !== undefined;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Check that it's running, then try again.");
  }

  const data: unknown = await response.json().catch(() => null);
  if (response.ok) return data as T;

  const error = (data as Partial<ApiErrorBody> | null)?.error;
  throw new ApiError(
    response.status,
    error?.code ?? 'INTERNAL',
    error?.message ?? `The server answered with status ${response.status}.`,
    error?.fields,
    error?.existingId,
  );
}

export const api = {
  listTopics: () => request<Topic[]>('/topics'),

  createTopic: (topic: CreateTopicRequest) => request<Topic>('/topics', { method: 'POST', body: topic }),

  getTopic: (topicId: number) => request<Topic>(`/topics/${topicId}`),

  getTopicHistory: (topicId: number, before?: number) =>
    request<HistoryPage>(`/topics/${topicId}/interactions${before ? `?before=${before}` : ''}`),

  startSession: (topicId: number) => request<Session>(`/topics/${topicId}/sessions`, { method: 'POST' }),

  getSession: (sessionId: number) => request<SessionDetail>(`/sessions/${sessionId}`),

  endSession: (sessionId: number) => request<Session>(`/sessions/${sessionId}/end`, { method: 'POST' }),

  submitInteraction: (sessionId: number, interaction: CreateInteractionRequest) =>
    request<Interaction>(`/sessions/${sessionId}/interactions`, { method: 'POST', body: interaction }),

  setFeedback: (interactionId: number, feedback: Feedback | null) =>
    request<Interaction>(`/interactions/${interactionId}/feedback`, { method: 'PUT', body: { feedback } }),

  getDashboard: (timeZone: string) => request<Dashboard>(`/dashboard?tz=${encodeURIComponent(timeZone)}`),
};
