import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Timer, ArrowRight, CheckCircle2, XCircle, Trophy } from "lucide-react";
import {
  POINTS_CORRECT,
  POINTS_WRONG,
  QUESTIONS,
  QUESTION_TIME,
  ROUND_TAGLINES,
  ROUND_TITLES,
} from "@/lib/quiz-data";
import {
  finalUnlocked,
  groupsForRound,
  totalScore,
  ensureQuestion,
  fetchQuestionData,
  expireQuestion,
  submitAnswer,
  useQuiz,
  type QuizAnswerEvent,
  type QuizQuestionState,
  type Group,
} from "@/lib/quiz-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/round/$round")({
  params: {
    parse: ({ round }) => {
      const n = Number(round);
      if (![1, 2, 3].includes(n)) throw notFound();
      return { round: String(n) };
    },
    stringify: ({ round }) => ({ round: String(round) }),
  },
  head: ({ params }) => {
    const r = Number(params.round);
    const title = `${ROUND_TITLES[r] ?? "Round"} — Fastest Finger First`;
    return {
      meta: [
        { title },
        { name: "description", content: ROUND_TAGLINES[r] ?? "Timed quiz round." },
        { property: "og:title", content: title },
        { property: "og:description", content: ROUND_TAGLINES[r] ?? "Timed quiz round." },
      ],
    };
  },
  component: RoundPage,
});

function RoundPage() {
  const { round } = Route.useParams();
  const r = Number(round);
  const { groups, hydrated } = useQuiz();

  const eligible = groupsForRound(groups, r);
  const questions = QUESTIONS[r] ?? [];
  const locked = r === 3 && !finalUnlocked(groups);

  if (!hydrated)
    return <div className="px-6 py-20 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header>
        <span className="font-mono text-xs tracking-[0.3em] text-accent">ROUND {r}</span>
        <h1 className="mt-3 font-display text-3xl font-black sm:text-4xl">{ROUND_TITLES[r]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{ROUND_TAGLINES[r]}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {QUESTION_TIME}s per question · correct{" "}
          <span className="text-success">+{POINTS_CORRECT}</span> · wrong{" "}
          <span className="text-destructive">{POINTS_WRONG}</span>
        </p>
      </header>

      {locked ? (
        <div className="panel mt-8 p-6">
          <div>
            <h2 className="text-lg font-bold">Round 3 is locked</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Both bracket winners must finish before the shared final can begin.
            </p>
            <Link to="/" className="btn-ghost mt-5 hover:bg-secondary">
              <Home className="size-4" /> Back to home
            </Link>
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="panel mt-8 p-6">
          <p className="text-sm text-muted-foreground">
            No groups added yet.{" "}
            <Link to="/" className="text-primary underline">
              Set up groups on the home page
            </Link>
            .
          </p>
        </div>
      ) : (
        <SharedQuizRunner key={r} round={r} groups={eligible} questions={questions} />
      )}
    </div>
  );
}

function SharedQuizRunner({
  round,
  groups,
  questions,
}: {
  round: number;
  groups: Group[];
  questions: { q: string; options: string[]; answer: number }[];
}) {
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<QuizQuestionState | null>(null);
  const [answers, setAnswers] = useState<QuizAnswerEvent[]>([]);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);

  const question = questions[index]!;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const nextState = await ensureQuestion(round, index + 1);
      const data = await fetchQuestionData(nextState.id);
      if (alive) {
        setState(data.question);
        setAnswers(data.answers);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [index, round]);

  useEffect(() => {
    const questionId = state?.id;
    if (!questionId) return;
    const channel = supabase
      .channel(`question-${questionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_questions", filter: `id=eq.${questionId}` },
        () => {
          void fetchQuestionData(questionId).then((data) => {
            setState(data.question);
            setAnswers(data.answers);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quiz_answer_events",
          filter: `question_id=eq.${questionId}`,
        },
        () => {
          void fetchQuestionData(questionId).then((data) => {
            setState(data.question);
            setAnswers(data.answers);
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [state?.id]);

  useEffect(() => {
    if (!state || state.status !== "ACTIVE") return;
    const tick = () => {
      const remaining = QUESTION_TIME - (Date.now() - Date.parse(state.started_at)) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(remaining)));
      if (remaining <= 0) void expireQuestion(state.id);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [state]);

  const answer = async (teamId: string, selectedAnswer: number) => {
    if (!state || state.status !== "ACTIVE" || answers.some((a) => a.team_id === teamId)) return;
    await submitAnswer(round, index + 1, teamId, selectedAnswer, question.answer);
    const data = await fetchQuestionData(state.id);
    setState(data.question);
    setAnswers(data.answers);
  };

  const pct = (timeLeft / QUESTION_TIME) * 100;
  const completed = state?.status !== "ACTIVE";
  const roundFinished = completed && index + 1 >= questions.length;

  return (
    <div className="panel mt-8 p-6">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>
          All teams · Question {index + 1}/{questions.length}
        </span>
        <span className="font-mono text-primary">{completed ? state?.status : "LIVE"}</span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Timer className={`size-4 ${timeLeft <= 10 ? "text-destructive" : "text-accent"}`} />
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
              timeLeft <= 10 ? "bg-destructive" : "accent-gradient"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 shrink-0 text-right font-mono text-sm">{timeLeft}s</span>
      </div>

      <h2 className="mt-6 text-xl font-bold leading-snug">{question.q}</h2>
      <div className="mt-5 grid gap-4">
        {groups.map((group) => {
          const event = answers.find((item) => item.team_id === group.id);
          return (
            <div key={group.id} className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{group.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  Total {totalScore(group)} pts
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {question.options.map((option, optionIndex) => (
                  <button
                    key={option}
                    disabled={Boolean(event) || completed || timeLeft <= 0}
                    onClick={() => void answer(group.id, optionIndex)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm ${event ? (optionIndex === event.selected_answer ? (event.is_correct ? "border-success bg-success/15" : "border-destructive bg-destructive/15") : "opacity-50") : "border-border bg-background hover:border-primary"}`}
                  >
                    {option}
                    {event &&
                      optionIndex === event.selected_answer &&
                      (event.is_correct ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : (
                        <XCircle className="size-4 text-destructive" />
                      ))}
                  </button>
                ))}
              </div>
              {event && (
                <p
                  className={`mt-2 text-xs ${event.is_correct ? "text-success" : "text-destructive"}`}
                >
                  {event.is_correct
                    ? `Correct! +${POINTS_CORRECT} points`
                    : `Wrong! ${POINTS_WRONG} points`}{" "}
                  · Answer {event.answer_order}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {completed && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Correct answer:{" "}
            <span className="font-semibold text-success">{question.options[question.answer]}</span>
          </p>
          {!roundFinished && (
            <button
              onClick={() => setIndex((value) => value + 1)}
              className="btn-primary hover:btn-primary-hover"
            >
              Next question <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      )}
      {roundFinished && (
        <p className="mt-6 text-center text-sm font-semibold text-success">
          Round complete. Scores are stored centrally.
        </p>
      )}
    </div>
  );
}

function RoundResult({
  round,
  group,
  score,
  onReplayPick,
}: {
  round: number;
  group: Group;
  score: number;
  onReplayPick: () => void;
}) {
  return (
    <div className="panel mt-8 p-8 text-center">
      <span className="accent-gradient mx-auto grid size-14 place-items-center rounded-2xl">
        <Trophy className="size-7 text-primary-foreground" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-black">Round {round} finished</h2>
      <p className="mt-2 text-sm text-muted-foreground">{group.name} scored</p>
      <p className="mt-2 font-display text-5xl font-black text-gradient">{score}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        The next round does not start automatically. Go back to the home page, then open Round{" "}
        {round < 3 ? round + 1 : 3} from the navbar when you are ready.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary hover:btn-primary-hover">
          <Home className="size-4" /> Home page
        </Link>
        <button onClick={onReplayPick} className="btn-ghost hover:bg-secondary">
          Next group
        </button>
        <Link to="/leaderboard" className="btn-ghost hover:bg-secondary">
          <Trophy className="size-4" /> Leaderboard
        </Link>
      </div>
    </div>
  );
}

function FinalWinner({ finalists: pair }: { finalists: Group[] }) {
  const sorted = [...pair].sort((a, b) => (b.scores[3] ?? 0) - (a.scores[3] ?? 0));
  const winner = sorted[0]!;
  const runnerUp = sorted[1]!;
  return (
    <div className="mt-6 rounded-xl border border-primary/40 bg-primary/10 p-6 text-center">
      <span className="accent-gradient mx-auto grid size-12 place-items-center rounded-2xl">
        <Trophy className="size-6 text-primary-foreground" />
      </span>
      <h3 className="mt-4 font-display text-2xl font-black">WINNER</h3>
      <p className="mt-2 text-lg font-bold">{winner.name}</p>
      <p className="font-mono text-sm text-primary">Final round score: {winner.scores[3] ?? 0}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        Runner-up: <span className="font-semibold text-foreground">{runnerUp.name}</span> ·{" "}
        {runnerUp.scores[3] ?? 0} pts
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary hover:btn-primary-hover">
          <Home className="size-4" /> Back to Home
        </Link>
        <Link to="/leaderboard" className="btn-ghost hover:bg-secondary">
          <Trophy className="size-4" /> View Leaderboard
        </Link>
      </div>
    </div>
  );
}
