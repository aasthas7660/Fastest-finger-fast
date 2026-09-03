CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round SMALLINT NOT NULL CHECK (round IN (1, 2, 3)),
  question_number SMALLINT NOT NULL CHECK (question_number > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'TIMEOUT')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (round, question_number)
);

CREATE TABLE public.quiz_answer_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  round SMALLINT NOT NULL CHECK (round IN (1, 2, 3)),
  selected_answer SMALLINT NOT NULL CHECK (selected_answer >= 0),
  is_correct BOOLEAN NOT NULL,
  points_awarded INTEGER NOT NULL,
  answer_order INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (question_id, team_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_answer_events TO anon, authenticated;
GRANT ALL ON public.quiz_questions, public.quiz_answer_events TO service_role;

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answer_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view quiz questions" ON public.quiz_questions FOR SELECT USING (true);
CREATE POLICY "Anyone can create quiz questions" ON public.quiz_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update quiz questions" ON public.quiz_questions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete quiz questions" ON public.quiz_questions FOR DELETE USING (true);
CREATE POLICY "Anyone can view answer events" ON public.quiz_answer_events FOR SELECT USING (true);
CREATE POLICY "Anyone can submit answer events" ON public.quiz_answer_events FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_answer_events;
ALTER TABLE public.quiz_questions REPLICA IDENTITY FULL;
ALTER TABLE public.quiz_answer_events REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_round SMALLINT,
  p_question_number SMALLINT,
  p_team_id UUID,
  p_selected_answer SMALLINT,
  p_correct_answer SMALLINT
)
RETURNS TABLE (accepted BOOLEAN, is_correct BOOLEAN, points_awarded INTEGER, answer_order INTEGER, question_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  question_row public.quiz_questions%ROWTYPE;
  event_order INTEGER;
  result_correct BOOLEAN;
  result_points INTEGER;
  remaining_teams INTEGER;
BEGIN
  SELECT * INTO question_row
  FROM public.quiz_questions
  WHERE round = p_round AND question_number = p_question_number
  FOR UPDATE;

  IF question_row.id IS NULL OR question_row.status <> 'ACTIVE'
     OR clock_timestamp() >= question_row.started_at + interval '30 seconds' THEN
    IF question_row.id IS NOT NULL AND question_row.status = 'ACTIVE' THEN
      UPDATE public.quiz_questions SET status = 'TIMEOUT', completed_at = clock_timestamp()
      WHERE id = question_row.id;
    END IF;
    RETURN QUERY SELECT false, false, 0, 0, COALESCE(question_row.status, 'TIMEOUT');
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.quiz_answer_events WHERE question_id = question_row.id AND team_id = p_team_id) THEN
    RETURN QUERY SELECT false, false, 0, 0, question_row.status;
    RETURN;
  END IF;

  result_correct := p_selected_answer = p_correct_answer;
  result_points := CASE WHEN result_correct THEN 5 ELSE -3 END;
  SELECT COALESCE(MAX(answer_order), 0) + 1 INTO event_order
  FROM public.quiz_answer_events WHERE question_id = question_row.id;

  INSERT INTO public.quiz_answer_events
    (question_id, team_id, round, selected_answer, is_correct, points_awarded, answer_order)
  VALUES
    (question_row.id, p_team_id, p_round, p_selected_answer, result_correct, result_points, event_order);

  UPDATE public.teams
  SET total_score = total_score + result_points,
      current_round = p_round,
      round_1_score = CASE WHEN p_round = 1 THEN COALESCE(round_1_score, 0) + result_points ELSE round_1_score END,
      round_2_score = CASE WHEN p_round = 2 THEN COALESCE(round_2_score, 0) + result_points ELSE round_2_score END,
      round_3_score = CASE WHEN p_round = 3 THEN COALESCE(round_3_score, 0) + result_points ELSE round_3_score END,
      round_1_correct = CASE WHEN p_round = 1 AND result_correct THEN round_1_correct + 1 ELSE round_1_correct END,
      round_2_correct = CASE WHEN p_round = 2 AND result_correct THEN round_2_correct + 1 ELSE round_2_correct END,
      round_3_correct = CASE WHEN p_round = 3 AND result_correct THEN round_3_correct + 1 ELSE round_3_correct END
  WHERE id = p_team_id;

  IF result_correct THEN
    UPDATE public.quiz_questions SET status = 'COMPLETED', completed_at = clock_timestamp()
    WHERE id = question_row.id;
  ELSE
    SELECT COUNT(*) INTO remaining_teams FROM public.teams
    WHERE (p_round = 3 OR bracket = p_round);
    IF event_order >= remaining_teams THEN
      UPDATE public.quiz_questions SET status = 'COMPLETED', completed_at = clock_timestamp()
      WHERE id = question_row.id;
    END IF;
  END IF;

  SELECT status INTO question_row.status FROM public.quiz_questions WHERE id = question_row.id;
  RETURN QUERY SELECT true, result_correct, result_points, event_order, question_row.status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(SMALLINT, SMALLINT, UUID, SMALLINT, SMALLINT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_quiz_question(p_round SMALLINT, p_question_number SMALLINT)
RETURNS public.quiz_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result_row public.quiz_questions%ROWTYPE;
BEGIN
  INSERT INTO public.quiz_questions (round, question_number)
  VALUES (p_round, p_question_number)
  ON CONFLICT (round, question_number) DO NOTHING;
  SELECT * INTO result_row FROM public.quiz_questions
  WHERE round = p_round AND question_number = p_question_number;
  RETURN result_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_quiz_question(SMALLINT, SMALLINT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.expire_quiz_question(p_question_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quiz_questions
  SET status = 'TIMEOUT', completed_at = clock_timestamp()
  WHERE id = p_question_id AND status = 'ACTIVE'
    AND clock_timestamp() >= started_at + interval '30 seconds';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_quiz_question(UUID) TO anon, authenticated, service_role;