export interface KnowledgeEntry {
  phrases: string[];
  answer: string;
  challenge: string;
  keyPoints: string[];
}

export interface TopicKnowledge {
  topicPhrases: string[];
  entries: KnowledgeEntry[];
}

const paragraphs = (...blocks: string[]) => blocks.join('\n\n');
const bullets = (...items: string[]) => items.map((item) => `- ${item}`).join('\n');
const code = (language: string, source: string) => '```' + language + '\n' + source.trim() + '\n```';

const reactHooks: TopicKnowledge = {
  topicPhrases: ['react', 'hooks', 'hook', 'jsx'],
  entries: [
    {
      phrases: [
        'useeffect',
        'use effect',
        'effect',
        'effects',
        'side effect',
        'side effects',
        'cleanup',
        'clean up',
        'dependency array',
        'unmount',
      ],
      answer: paragraphs(
        "Rendering in React is meant to be a pure calculation: props and state in, UI out. Some work doesn't fit that. Subscribing to a socket, starting a timer, fetching data or touching the DOM directly all reach outside the component, and `useEffect` is where that work goes. React runs the effect after the render has been committed to the screen, so it never blocks or corrupts the render itself.",
        "The dependency array tells React when the effect is out of date. If a dependency changed since the last render, React first runs the previous effect's cleanup, then runs the effect again with the new values. When the component unmounts, the last cleanup runs.",
        code(
          'jsx',
          `
useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();
  return () => connection.disconnect();
}, [roomId]);`,
        ),
        'Without the cleanup, every change of room would leave the old connection open. In development, Strict Mode deliberately runs one extra setup and cleanup when a component mounts, so a missing cleanup shows up right away instead of in production.',
      ),
      challenge:
        "The component above first renders with `roomId = 'general'`, then re-renders with `roomId = 'random'`. List every connect and disconnect call React makes, in order, and which room each one uses. Assume Strict Mode is off.",
      keyPoints: [
        "After the first render, the effect connects to 'general'.",
        "When `roomId` changes, React runs the old cleanup first and disconnects from 'general'. The cleanup closed over the values from the render that created it.",
        "Then the effect runs again and connects to 'random'.",
        "Each render's effect and cleanup see that render's props, which is why the cleanup still says 'general'.",
      ],
    },
    {
      phrases: [
        'usememo',
        'use memo',
        'usecallback',
        'use callback',
        'memo',
        'memoize',
        'memoise',
        'memoization',
        'memoisation',
      ],
      answer: paragraphs(
        '`useMemo` caches the result of a calculation between renders, and `useCallback` caches a function. Both take a dependency array and hand back the cached value until one of the dependencies changes.',
        'They are easy to overuse. Neither one makes a component render less on its own. They only pay off when something downstream compares values by reference:',
        bullets(
          'a child wrapped in `React.memo` that receives the object or function as a prop, or',
          'the dependency array of another hook, which would otherwise see a new value on every render.',
        ),
        'If neither applies, memoizing adds bookkeeping and nothing else. Most components are cheap to re-render, so measure before reaching for it.',
      ),
      challenge:
        'A parent passes `onSelect={() => setSelected(id)}` to a child wrapped in `React.memo`, and the child still re-renders every time the parent does. Why, and what is the smallest change that stops it?',
      keyPoints: [
        'An inline arrow function is a new function object on every render of the parent.',
        '`React.memo` compares props by reference, so it sees a changed `onSelect` each time.',
        'Wrapping the handler in `useCallback` with its real dependencies keeps the same function between renders.',
        'If the child is cheap to render, letting it re-render may be the better choice.',
      ],
    },
  ],
};

const javascript: TopicKnowledge = {
  topicPhrases: ['javascript', 'js', 'node', 'nodejs', 'typescript', 'ecmascript'],
  entries: [
    {
      phrases: [
        'event loop',
        'microtask',
        'microtasks',
        'macrotask',
        'task queue',
        'settimeout',
        'set timeout',
        'promise',
        'promises',
        'async',
        'await',
        'call stack',
        'non blocking',
        'asynchronous',
      ],
      answer: paragraphs(
        "JavaScript runs your code on a single thread with one call stack. When you start something slow, like a timer or a network request, the browser or Node does the waiting elsewhere and later queues a callback. The event loop's job is simple: whenever the call stack is empty, take the next queued job and run it.",
        'Two queues matter. Promise reactions (`.then` callbacks and the code after an `await`) go into the microtask queue. Timers, I/O and UI events are tasks. After each task finishes, the engine runs every queued microtask before it picks up the next task.',
        code(
          'js',
          `
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
console.log('D');
// Logs: A, D, C, B`,
        ),
        '`setTimeout(fn, 0)` doesn’t mean “now”. It means “after the current task and every microtask it queued”.',
      ),
      challenge:
        'A `.then` callback schedules another `.then`, which schedules another, forever. A `setTimeout(fn, 0)` was queued before the chain started. Does the timeout ever fire? Explain using the two queues.',
      keyPoints: [
        'The microtask queue is drained completely before the next task runs.',
        'Each microtask queues another, so the microtask queue never becomes empty.',
        'The timeout is a task, so it never gets a turn. The page or process is starved.',
        'That is why an endless promise chain can freeze a page just like a `while (true)` loop.',
      ],
    },
    {
      phrases: ['closure', 'closures', 'lexical scope', 'scope', 'scopes', 'scoping', 'captured', 'capture', 'var'],
      answer: paragraphs(
        "A closure is a function together with the variables it could see where it was created. A function defined inside another function keeps access to the outer function's variables even after the outer function has returned. Those variables stay alive for as long as the inner function does.",
        code(
          'js',
          `
function makeCounter() {
  let count = 0;
  return () => ++count;
}

const next = makeCounter();
next(); // 1
next(); // 2`,
        ),
        "`count` isn't copied into the returned function. The function holds a reference to the variable itself, which is what makes closures useful for private state and callbacks, and also what causes the classic stale-value bugs.",
      ),
      challenge:
        'This loop logs 3, 3, 3: `for (var i = 0; i < 3; i++) setTimeout(() => console.log(i));` Changing `var` to `let` makes it log 0, 1, 2. What changes about what each callback closes over?',
      keyPoints: [
        'With `var` there is one `i` for the whole function, and all three callbacks close over that same variable.',
        'The callbacks run after the loop has finished, when `i` is already 3.',
        'With `let`, each iteration gets a fresh binding of `i`, so each callback closes over a different variable.',
        'Closures capture variables, not values. That is the whole bug.',
      ],
    },
  ],
};

const probability: TopicKnowledge = {
  topicPhrases: ['probability', 'statistics', 'stats', 'bayes', 'math', 'maths', 'mathematics'],
  entries: [
    {
      phrases: [
        'bayes',
        'bayesian',
        'conditional probability',
        'conditional',
        'posterior',
        'priors',
        'prior probability',
        'false positive',
        'false positives',
        'base rate',
        'positive test',
        'test result',
      ],
      answer: paragraphs(
        "Bayes' theorem tells you how far to update a belief after seeing evidence:",
        code('', 'P(H | E) = P(E | H) × P(H) / P(E)'),
        'The part people skip is P(H), the base rate. Take a test that catches 99% of real cases and has a 5% false-positive rate, for a condition that 1 in 1,000 people have. Out of 100,000 people:',
        bullets(
          '100 have the condition, and the test catches 99 of them.',
          "99,900 don't, and 5% of them (4,995 people) test positive anyway.",
        ),
        'So only 99 of the 5,094 positive results are real: about 1.9%. When a condition is rare, false positives from the large healthy group swamp the true ones, even with an accurate test.',
      ),
      challenge:
        'Same test, but now you only test people who already have symptoms, and 1 in 10 of them has the condition. Roughly how likely is a positive result to be real, and why did it change so much?',
      keyPoints: [
        "Out of 1,000 people with symptoms, 100 have the condition and 99 test positive; 900 don't and 45 test positive.",
        '99 / (99 + 45) ≈ 69%, up from about 1.9%.',
        "The test didn't change. The prior did: testing a higher-risk group raises the base rate.",
        'That is why screening everyone and testing symptomatic patients give very different results with the same test.',
      ],
    },
    {
      phrases: [
        'expected value',
        'expected values',
        'expectation',
        'expectations',
        'raffle',
        'lottery',
        'bet',
        'betting',
      ],
      answer: paragraphs(
        'The expected value of a random quantity is its long-run average: each possible outcome weighted by its probability, then summed.',
        code('', 'E[X] = Σ x × P(X = x)'),
        "A fair die gives (1 + 2 + 3 + 4 + 5 + 6) / 6 = 3.5. You will never roll a 3.5. Expected value isn't the most likely outcome; it's what the average converges to over many repetitions.",
        'Two properties do most of the work:',
        bullets(
          'Linearity: E[X + Y] = E[X] + E[Y], even when X and Y depend on each other.',
          'It ignores spread. A bet that pays 0 or 100 with equal odds has the same expected value as a guaranteed 50, but very different risk.',
        ),
      ),
      challenge:
        'A raffle sells 1,000 tickets at 10 each, and one ticket wins a prize of 5,000. What is the expected value of buying one ticket, and why might someone reasonably buy one anyway?',
      keyPoints: [
        'Expected winnings: 5,000 × 1/1,000 = 5.',
        'Net expected value: 5 − 10 = −5 per ticket, so on average you lose half the price.',
        'Expected value ignores spread; a small chance at a large prize can matter more to someone than its average.',
        'People decide by what outcomes are worth to them, not only by averages, which is why both raffles and insurance exist.',
      ],
    },
  ],
};

const machineLearning: TopicKnowledge = {
  topicPhrases: ['machine learning', 'ml', 'deep learning', 'neural', 'neural networks', 'ai'],
  entries: [
    {
      phrases: [
        'gradient descent',
        'gradient',
        'gradients',
        'learning rate',
        'loss function',
        'training loss',
        'optimizer',
        'optimiser',
        'backprop',
        'backpropagation',
        'converge',
        'convergence',
        'sgd',
      ],
      answer: paragraphs(
        "Training a model means finding parameters that make a loss function small, where the loss measures how wrong the model's predictions are. Gradient descent gets there in small steps: compute the gradient of the loss with respect to every parameter (the direction in which the loss grows fastest), then move the parameters a little in the opposite direction.",
        code('', 'θ ← θ − η × ∇L(θ)'),
        "η is the learning rate, the size of each step, and it's the setting that breaks training most often:",
        bullets(
          'Too small, and progress is slow and can stall on flat regions.',
          'Too large, and each step overshoots the minimum, so the loss bounces around or blows up to NaN.',
        ),
        'In practice the gradient is rarely computed on the whole dataset. Mini-batch gradient descent estimates it from a small batch at each step, which is noisier but far cheaper.',
      ),
      challenge:
        "Your training loss falls steadily for a few hundred steps, then suddenly spikes and turns into NaN. What's the most likely cause, and what would you try first?",
      keyPoints: [
        'The learning rate is probably too high: one large step overshoots into a region where the loss explodes.',
        'Lower the learning rate, or use warmup and a decay schedule so steps are gentler where training is fragile.',
        "Clip gradients so a single bad batch can't produce a huge update.",
        'Check the data for bad values, like NaN, infinity or unscaled features, that produce extreme gradients.',
      ],
    },
    {
      phrases: [
        'overfitting',
        'overfit',
        'overfits',
        'underfitting',
        'underfit',
        'generalization',
        'generalisation',
        'generalize',
        'generalise',
        'regularization',
        'regularisation',
        'validation loss',
        'validation set',
        'validation accuracy',
        'dropout',
      ],
      answer: paragraphs(
        "A model overfits when it learns its training data too specifically, noise included, and does worse on data it hasn't seen. The signature is a gap: training loss keeps falling while validation loss stops improving and starts to rise.",
        "That's why you hold data out. The validation set stands in for the future. If you tune against it again and again it stops being a fair test, which is why a final test set is kept separate until the end.",
        'The usual fixes:',
        bullets(
          'More, or more varied, training data.',
          'A simpler model, or fewer features.',
          'Regularization such as weight decay or dropout.',
          'Early stopping at the point where validation loss is lowest.',
        ),
      ),
      challenge:
        "A model reaches 99% accuracy on the training set and 71% on validation. A teammate suggests adding more layers to push validation accuracy up. What's wrong with that plan?",
      keyPoints: [
        'A gap that large means the model is already overfitting.',
        'More layers add capacity, which usually widens the gap instead of closing it.',
        'The next steps point the other way: more data, regularization, or a simpler model.',
        "It's also worth checking for leakage or a mismatch between the training and validation data.",
      ],
    },
  ],
};

const systemDesign: TopicKnowledge = {
  topicPhrases: ['system design', 'systems design', 'systems', 'architecture', 'distributed', 'backend', 'scalability'],
  entries: [
    {
      phrases: [
        'cache',
        'caches',
        'caching',
        'cached',
        'redis',
        'memcached',
        'ttl',
        'invalidate',
        'invalidation',
        'cdn',
      ],
      answer: paragraphs(
        'A cache keeps a copy of data somewhere faster to read than its source: memory instead of disk, a nearby CDN node instead of your origin server, a precomputed result instead of a query. It helps when the same data is read far more often than it changes.',
        'The common pattern is cache-aside. The application checks the cache first; on a miss it reads the database and stores the result with a time-to-live (TTL).',
        'The hard part is staleness. Once data lives in two places, the copies can disagree, and you choose a trade-off:',
        bullets(
          'Short TTLs are simple, but a read can be stale for up to the TTL.',
          'Invalidating on every write keeps data fresher, but every code path that writes has to remember to do it.',
        ),
        "A cache also adds a failure mode: if it's empty or goes down, all of its traffic lands on the database at once.",
      ),
      challenge:
        'A popular product page is cached with a 60-second TTL. At the moment the entry expires, 5,000 requests arrive for it. What happens to your database, and how would you prevent it?',
      keyPoints: [
        'Every request misses at the same moment and goes to the database: a cache stampede.',
        'Let one request rebuild the value while the others wait for it (a lock, or single-flight request coalescing).',
        "Refresh popular keys before they expire, or add random jitter to TTLs so keys don't expire together.",
        'Serving the stale value while refreshing in the background (stale-while-revalidate) keeps latency flat.',
      ],
    },
    {
      phrases: [
        'scale',
        'scaling',
        'scalable',
        'horizontal',
        'horizontally',
        'vertical',
        'vertically',
        'load balancer',
        'load balancing',
        'stateless',
        'replica',
        'replicas',
        'replication',
        'sharding',
        'shard',
        'sticky session',
        'sticky sessions',
        'session state',
      ],
      answer: paragraphs(
        "Vertical scaling means a bigger machine: more CPU, more memory. It's the simplest option and goes further than people expect, but it has a ceiling and leaves you with a single point of failure.",
        "Horizontal scaling means more machines behind a load balancer. That only works cleanly if the servers are stateless: any request can go to any server because nothing important lives in one server's memory. Sessions, uploads and caches move to shared stores.",
        'The database is usually the hard part, because it is the state:',
        bullets(
          'Read replicas spread out reads, at the cost of replication lag.',
          'Sharding splits data across databases by a key such as user id, at the cost of cross-shard queries and rebalancing.',
        ),
        'Most systems scale the stateless tier first and put off sharding for as long as replicas and caching can carry the load.',
      ),
      challenge:
        "Your API keeps logged-in users' sessions in each server's memory. You add a second server behind a round-robin load balancer, and users start getting logged out at random. What's happening, and what are two ways to fix it?",
      keyPoints: [
        'Round-robin sends a user’s requests to different servers, and the second server has no record of the session.',
        'Move session state to a shared store, such as Redis or the database, that every server can read.',
        'Or use signed, stateless tokens that carry the session with each request.',
        'Sticky sessions also work, but they tie each user to one server and log them out when it restarts.',
      ],
    },
  ],
};

export const knowledge: TopicKnowledge[] = [reactHooks, javascript, probability, machineLearning, systemDesign];
