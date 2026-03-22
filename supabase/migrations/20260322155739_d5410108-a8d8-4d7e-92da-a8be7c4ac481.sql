-- Trigger: auto-complete subtasks when topic is closed
CREATE OR REPLACE FUNCTION public.auto_complete_subtasks_on_topic_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completado' AND (OLD.status IS DISTINCT FROM 'completado') THEN
    UPDATE public.subtasks 
    SET completed = true, completed_at = now() 
    WHERE topic_id = NEW.id AND completed = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_complete_subtasks
AFTER UPDATE ON public.topics
FOR EACH ROW
EXECUTE FUNCTION public.auto_complete_subtasks_on_topic_close();

-- Fix existing data
UPDATE public.subtasks SET completed = true, completed_at = now()
WHERE topic_id IN (SELECT id FROM public.topics WHERE status = 'completado')
AND completed = false;