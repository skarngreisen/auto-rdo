CREATE OR REPLACE FUNCTION public.tr_notify_rdo_status()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_geologo_id UUID;
    v_geologo_name TEXT;
    v_projeto_name TEXT;
    v_message TEXT;
    v_targets UUID[];
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    BEGIN
        SELECT cliente INTO v_projeto_name FROM projetos WHERE id = NEW.projeto_id;

        SELECT pg.user_id, pr.name INTO v_geologo_id, v_geologo_name
        FROM projeto_geologos pg
        JOIN profiles pr ON pr.user_id = pg.user_id
        WHERE pg.projeto_id = NEW.projeto_id AND pg.fim IS NULL
        LIMIT 1;

        IF NEW.status = 'em_revisao' AND (TG_OP = 'INSERT' OR OLD.status = 'rascunho') THEN
            IF v_geologo_id IS NOT NULL THEN
                v_message := format('RDO do projeto %s — %s enviado para revisao.', v_projeto_name, NEW.data);
                v_targets := ARRAY[v_geologo_id];
                PERFORM notify_users(v_targets, v_message);
            END IF;
        END IF;

        IF NEW.status = 'aprovado' AND OLD.status = 'em_revisao' THEN
            IF NEW.user_id IS NOT NULL THEN
                v_message := format('RDO do projeto %s — %s aprovado por %s.', v_projeto_name, NEW.data, COALESCE(v_geologo_name, 'geologo'));
                v_targets := ARRAY[NEW.user_id];
                PERFORM notify_users(v_targets, v_message);
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_users failed: %', SQLERRM;
    END;
    END IF;
    RETURN NEW;
END;
$$;

ALTER TABLE rdos ENABLE TRIGGER tr_notify_rdo_status_trigger;
