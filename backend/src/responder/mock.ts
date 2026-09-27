import { setTimeout as sleep } from 'node:timers/promises';
import { knowledge, type KnowledgeEntry } from './knowledge.js';
import type { Responder, TopicContext } from './responder.js';

const GENERIC_KEY_POINTS = [
  'What it is, in one or two plain sentences.',
  'The problem it solves, or why it exists at all.',
  'A concrete example you could run, draw or point to.',
  'A limit or a common mistake: where it goes wrong or gets misused.',
];

const SHORT_EXPLANATION_WORDS = 25;

const keyPointsByChallenge = new Map(
  knowledge.flatMap((topic) => topic.entries).map((entry) => [entry.challenge, entry.keyPoints]),
);

export function createMockResponder(delayMs = 0): Responder {
  return {
    async answer(topic, question) {
      await sleep(delayMs);
      const entry = findEntry(topic.title, question);
      if (entry) return { text: entry.answer, challenge: entry.challenge };
      return { text: fallbackAnswer(topic), challenge: fallbackChallenge(topic) };
    },

    async review(_topic, challenge, explanation) {
      await sleep(delayMs);
      return reviewExplanation(keyPointsByChallenge.get(challenge) ?? GENERIC_KEY_POINTS, explanation);
    },
  };
}

function findEntry(topicTitle: string, question: string): KnowledgeEntry | undefined {
  const questionText = normalize(question);
  const topicText = normalize(topicTitle);

  let best: KnowledgeEntry | undefined;
  let bestScore = 0;
  for (const group of knowledge) {
    const topicBonus = group.topicPhrases.some((phrase) => containsPhrase(topicText, phrase)) ? 1 : 0;
    for (const entry of group.entries) {
      const hits = entry.phrases.filter((phrase) => containsPhrase(questionText, phrase)).length;
      const score = hits === 0 ? 0 : hits * 2 + topicBonus;
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }
  }
  return best;
}

function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

function containsPhrase(normalizedText: string, phrase: string): boolean {
  return normalizedText.includes(` ${phrase} `);
}

function fallbackAnswer(topic: TopicContext): string {
  return [
    'This prototype answers from a small built-in set of explanations, and none of them covers this question yet. With a language model connected, the answer would appear here.',
    `The challenge below still works on its own: explaining ${topic.title} in your own words is a good way to find the gaps in what you know.`,
  ].join('\n\n');
}

function fallbackChallenge(topic: TopicContext): string {
  return `Explain ${topic.title} to a classmate who has never come across it: what it is, what problem it solves, and one situation where it goes wrong.`;
}

function reviewExplanation(keyPoints: string[], explanation: string): string {
  const wordCount = explanation.trim().split(/\s+/).length;
  const parts = [
    'Compare your explanation with what a complete answer covers:',
    keyPoints.map((point) => `- ${point}`).join('\n'),
    'Anything missing from yours is the part to revisit.',
  ];
  if (wordCount < SHORT_EXPLANATION_WORDS) {
    parts.push(
      `Yours is ${wordCount} ${wordCount === 1 ? 'word' : 'words'} long. Adding a concrete example usually shows whether the idea is really clear.`,
    );
  }
  return parts.join('\n\n');
}
