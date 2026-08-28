-- Corregge la race condition sui contatori di utilizzo (runs_used,
-- cvs_adapted_used, cover_letters_used): il pattern precedente era
-- "SELECT contatore -> fai il lavoro costoso -> UPDATE +1", non atomico —
-- richieste concorrenti potevano leggere lo stesso valore prima che
-- l'incremento si applicasse, bypassando il limite mensile.
--
-- adjust_usage_counter(p_user_id, p_counter, p_delta) sostituisce quel
-- pattern con un'unica operazione atomica lato database:
--
-- p_delta = 1  (riserva): UPDATE condizionale che incrementa SOLO SE il
--   nuovo valore resta entro il limite del piano — la stessa query
--   verifica e applica, senza finestra fra le due cose. Ritorna true se
--   la riga è stata aggiornata (riserva riuscita), false se il limite era
--   già raggiunto o l'utente non ha una subscription. Va chiamata PRIMA
--   di fare il lavoro costoso (Claude, worker, scraping), non dopo.
--
-- p_delta = -1 (rilascio): applicato sempre, con floor a 0 — usato per
--   "restituire" la riserva se il lavoro costoso fallisce dopo che lo
--   slot è già stato preso (Claude/worker/scraping falliti), così un
--   tentativo fallito non consuma comunque una quota reale dell'utente.
--   Non ha bisogno dello stesso controllo atomico del delta positivo:
--   non esiste un limite da poter bypassare rilasciando.
--
-- Niente SQL dinamico/EXECUTE: i tre contatori sono elencati esplicitamente
-- in rami IF separati — nessuna superficie di SQL injection, anche se
-- p_counter fosse per assurdo controllato da input non fidato.
--
-- SECURITY DEFINER + controllo auth.uid() interno: la funzione gira con i
-- privilegi del proprietario (bypassa RLS su subscriptions, che potrebbe
-- non permettere agli utenti di scrivere direttamente i propri contatori),
-- ma verifica esplicitamente che p_user_id coincida con l'utente autenticato
-- della richiesta. Senza questo controllo, chiunque potrebbe chiamare
-- l'RPC via PostgREST passando lo user_id di un ALTRO utente e manipolarne
-- i contatori (azzerarli con p_delta negativo, o consumargli la quota con
-- p_delta positivo) — SECURITY DEFINER senza questa verifica avrebbe
-- riaperto esattamente il tipo di gap che questa funzione doveva chiudere.

CREATE OR REPLACE FUNCTION adjust_usage_counter(
  p_user_id uuid,
  p_counter text,
  p_delta integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_limit integer;
  v_rows integer;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'non autorizzato: p_user_id non corrisponde all''utente autenticato';
  END IF;

  IF p_counter NOT IN ('runs_used', 'cvs_adapted_used', 'cover_letters_used') THEN
    RAISE EXCEPTION 'contatore sconosciuto: %', p_counter;
  END IF;

  IF p_delta = 0 THEN
    RETURN true;
  END IF;

  IF p_delta < 0 THEN
    IF p_counter = 'runs_used' THEN
      UPDATE subscriptions SET runs_used = GREATEST(0, runs_used + p_delta) WHERE user_id = p_user_id;
    ELSIF p_counter = 'cvs_adapted_used' THEN
      UPDATE subscriptions SET cvs_adapted_used = GREATEST(0, cvs_adapted_used + p_delta) WHERE user_id = p_user_id;
    ELSE
      UPDATE subscriptions SET cover_letters_used = GREATEST(0, cover_letters_used + p_delta) WHERE user_id = p_user_id;
    END IF;
    RETURN true;
  END IF;

  -- p_delta > 0: riserva condizionale, serve il tier per conoscere il limite
  SELECT tier INTO v_tier FROM subscriptions WHERE user_id = p_user_id;
  IF v_tier IS NULL THEN
    RETURN false;
  END IF;

  IF p_counter = 'runs_used' THEN
    SELECT runs_per_month INTO v_limit FROM usage_limits WHERE tier = v_tier;
  ELSIF p_counter = 'cvs_adapted_used' THEN
    SELECT cvs_per_month INTO v_limit FROM usage_limits WHERE tier = v_tier;
  ELSE
    SELECT cover_letters_per_month INTO v_limit FROM usage_limits WHERE tier = v_tier;
  END IF;

  IF v_limit IS NULL THEN
    -- Nessun limite definito per questo tier/contatore (es. cover_letters_per_month
    -- è NULL per i tier b2b_* in usage_limits) — nessun tetto da applicare,
    -- incrementa e basta, stesso comportamento del codice precedente quando
    -- `limits` risultava assente.
    IF p_counter = 'runs_used' THEN
      UPDATE subscriptions SET runs_used = runs_used + p_delta WHERE user_id = p_user_id;
    ELSIF p_counter = 'cvs_adapted_used' THEN
      UPDATE subscriptions SET cvs_adapted_used = cvs_adapted_used + p_delta WHERE user_id = p_user_id;
    ELSE
      UPDATE subscriptions SET cover_letters_used = cover_letters_used + p_delta WHERE user_id = p_user_id;
    END IF;
    RETURN true;
  END IF;

  IF p_counter = 'runs_used' THEN
    UPDATE subscriptions SET runs_used = runs_used + p_delta
      WHERE user_id = p_user_id AND runs_used + p_delta <= v_limit;
  ELSIF p_counter = 'cvs_adapted_used' THEN
    UPDATE subscriptions SET cvs_adapted_used = cvs_adapted_used + p_delta
      WHERE user_id = p_user_id AND cvs_adapted_used + p_delta <= v_limit;
  ELSE
    UPDATE subscriptions SET cover_letters_used = cover_letters_used + p_delta
      WHERE user_id = p_user_id AND cover_letters_used + p_delta <= v_limit;
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

COMMENT ON FUNCTION adjust_usage_counter(uuid, text, integer) IS
  'Incrementa/decrementa atomicamente un contatore di utilizzo (runs_used,
   cvs_adapted_used, cover_letters_used) su subscriptions. p_delta positivo:
   riserva condizionale (incrementa SOLO SE resta entro il limite del piano,
   ritorna true/false). p_delta negativo: rilascio incondizionato con floor
   a 0 (usato per restituire la riserva se il lavoro costoso a valle
   fallisce). Sostituisce il vecchio pattern SELECT-poi-UPDATE, non atomico
   e soggetto a race condition su richieste concorrenti. SECURITY DEFINER
   con controllo p_user_id = auth.uid() interno: mai chiamabile per un
   utente diverso da quello autenticato nella richiesta.';
