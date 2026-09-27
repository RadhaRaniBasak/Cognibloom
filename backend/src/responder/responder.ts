export interface TopicContext {
  title: string;
  description: string | null;
}

export interface Answer {
  text: string;
  challenge: string | null;
}

export interface Responder {
  answer(topic: TopicContext, question: string): Promise<Answer>;

  review(topic: TopicContext, challenge: string, explanation: string): Promise<string>;
}
