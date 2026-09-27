import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateInteractionRequest, CreateTopicRequest, Feedback, SessionDetail } from '../../shared/contract';
import { ApiError, api } from './api';

export const queryKeys = {
  topics: ['topics'] as const,
  topic: (topicId: number) => ['topics', topicId] as const,
  topicHistory: (topicId: number) => ['topics', topicId, 'history'] as const,
  session: (sessionId: number) => ['sessions', sessionId] as const,
  dashboard: ['dashboard'] as const,
};

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function useTopics() {
  return useQuery({ queryKey: queryKeys.topics, queryFn: api.listTopics });
}

export function useTopic(topicId: number) {
  return useQuery({ queryKey: queryKeys.topic(topicId), queryFn: () => api.getTopic(topicId) });
}

export function useTopicHistory(topicId: number) {
  return useInfiniteQuery({
    queryKey: queryKeys.topicHistory(topicId),
    queryFn: ({ pageParam }) => api.getTopicHistory(topicId, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
  });
}

export function useSession(sessionId: number) {
  return useQuery({ queryKey: queryKeys.session(sessionId), queryFn: () => api.getSession(sessionId) });
}

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.getDashboard(timeZone) });
}

function useInvalidateProgress() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.topics });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateTopic() {
  const invalidateProgress = useInvalidateProgress();
  return useMutation({
    mutationFn: (topic: CreateTopicRequest) => api.createTopic(topic),
    onSuccess: invalidateProgress,
  });
}

export function useStartSession() {
  const invalidateProgress = useInvalidateProgress();
  return useMutation({
    mutationFn: (topicId: number) => api.startSession(topicId),
    onSuccess: invalidateProgress,
  });
}

export function useEndSession(sessionId: number) {
  const queryClient = useQueryClient();
  const invalidateProgress = useInvalidateProgress();
  return useMutation({
    mutationFn: () => api.endSession(sessionId),
    onSuccess: (session) => {
      queryClient.setQueryData<SessionDetail>(
        queryKeys.session(sessionId),
        (detail) => detail && { ...detail, ...session },
      );
      invalidateProgress();
    },
  });
}

export function useSubmitInteraction(sessionId: number) {
  const queryClient = useQueryClient();
  const invalidateProgress = useInvalidateProgress();
  return useMutation({
    mutationFn: (interaction: CreateInteractionRequest) => api.submitInteraction(sessionId, interaction),
    onSuccess: (interaction) => {
      queryClient.setQueryData<SessionDetail>(
        queryKeys.session(sessionId),
        (detail) =>
          detail && {
            ...detail,
            interactions: [...detail.interactions, interaction],
            interactionCount: detail.interactionCount + 1,
            lastActivityAt: interaction.createdAt,
          },
      );
      invalidateProgress();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'SESSION_ENDED') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
      }
    },
  });
}

export function useSetFeedback(sessionId: number, interactionId: number) {
  const queryClient = useQueryClient();
  const invalidateProgress = useInvalidateProgress();
  const sessionKey = queryKeys.session(sessionId);
  const mutationKey = ['feedback', interactionId];

  return useMutation({
    mutationKey,
    scope: { id: `feedback-${interactionId}` },
    mutationFn: (feedback: Feedback | null) => api.setFeedback(interactionId, feedback),
    onMutate: async (feedback) => {
      await queryClient.cancelQueries({ queryKey: sessionKey });
      const previous = queryClient.getQueryData<SessionDetail>(sessionKey);
      queryClient.setQueryData<SessionDetail>(
        sessionKey,
        (detail) => detail && withFeedback(detail, interactionId, feedback),
      );
      return { previous };
    },
    onError: (_error, _feedback, context) => {
      if (context?.previous) queryClient.setQueryData(sessionKey, context.previous);
    },
    onSettled: () => {
      const isLastPendingClick = queryClient.isMutating({ mutationKey }) === 1;
      if (isLastPendingClick) void queryClient.invalidateQueries({ queryKey: sessionKey });
      invalidateProgress();
    },
  });
}

function withFeedback(detail: SessionDetail, interactionId: number, feedback: Feedback | null): SessionDetail {
  return {
    ...detail,
    interactions: detail.interactions.map((interaction) =>
      interaction.id === interactionId ? { ...interaction, feedback } : interaction,
    ),
  };
}
