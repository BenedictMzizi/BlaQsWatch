
-- ============================================================
-- BlaQsWatch Messaging System
-- Stage 1: Core database, access control and Realtime
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. CONVERSATIONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    business_id UUID NOT NULL
        REFERENCES public.businesses(id) ON DELETE CASCADE,

    conversation_type TEXT NOT NULL DEFAULT 'internal'
        CHECK (conversation_type IN ('internal', 'support')),

    title TEXT,

    created_by UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,

    support_status TEXT,

    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT conversations_support_status_check
        CHECK (
            (
                conversation_type = 'internal'
                AND support_status IS NULL
            )
            OR
            (
                conversation_type = 'support'
                AND support_status IN (
                    'open',
                    'in_progress',
                    'waiting_for_company',
                    'resolved'
                )
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_conversations_business
    ON public.conversations(business_id);

CREATE INDEX IF NOT EXISTS idx_conversations_type
    ON public.conversations(conversation_type);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message
    ON public.conversations(last_message_at DESC);


-- ------------------------------------------------------------
-- 2. CONVERSATION PARTICIPANTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversation_participants (
    conversation_id UUID NOT NULL
        REFERENCES public.conversations(id) ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    added_by UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL,

    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user
    ON public.conversation_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation
    ON public.conversation_participants(conversation_id);


-- ------------------------------------------------------------
-- 3. CONVERSATION MESSAGES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    conversation_id UUID NOT NULL
        REFERENCES public.conversations(id) ON DELETE CASCADE,

    sender_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,

    content TEXT NOT NULL
        CHECK (
            length(trim(content)) > 0
            AND length(content) <= 10000
        ),

    message_type TEXT NOT NULL DEFAULT 'text'
        CHECK (message_type = 'text'),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
    ON public.conversation_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_sender
    ON public.conversation_messages(sender_id);


-- ------------------------------------------------------------
-- 4. SECURITY HELPER: ACTIVE COMPANY MEMBERSHIP
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stockwise_is_active_business_member(
    p_business_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.business_members bm
        INNER JOIN public.profiles p
            ON p.id = bm.user_id
        INNER JOIN public.businesses b
            ON b.id = bm.business_id
        WHERE bm.business_id = p_business_id
          AND bm.user_id = p_user_id
          AND bm.active = TRUE
          AND p.active = TRUE
          AND b.active = TRUE
    );
$$;


-- ------------------------------------------------------------
-- 5. SECURITY HELPER: CAN ACCESS CONVERSATION
--
-- Company admins can see all conversations belonging to
-- their company.
--
-- Other company members can see conversations they joined.
--
-- Platform admins can access support conversations only.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stockwise_can_access_conversation(
    p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = p_conversation_id
          AND (
              (
                  c.conversation_type = 'support'
                  AND public.stockwise_is_platform_admin()
              )
              OR
              (
                  public.stockwise_has_business_access(c.business_id)
                  AND (
                      public.stockwise_is_business_admin(c.business_id)
                      OR EXISTS (
                          SELECT 1
                          FROM public.conversation_participants cp
                          WHERE cp.conversation_id = c.id
                            AND cp.user_id = auth.uid()
                      )
                  )
              )
          )
    );
$$;


-- ------------------------------------------------------------
-- 6. SECURITY HELPER: CAN MANAGE PARTICIPANTS
--
-- Existing participants can add other active members.
-- Company admins can manage participants.
-- Platform admins can manage participants in support threads.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stockwise_can_manage_conversation_participants(
    p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = p_conversation_id
          AND (
              public.stockwise_is_business_admin(c.business_id)
              OR (
                  c.conversation_type = 'support'
                  AND public.stockwise_is_platform_admin()
              )
              OR EXISTS (
                  SELECT 1
                  FROM public.conversation_participants cp
                  WHERE cp.conversation_id = c.id
                    AND cp.user_id = auth.uid()
              )
          )
    );
$$;


-- ------------------------------------------------------------
-- 7. AUTOMATICALLY ADD THE CREATOR AS A PARTICIPANT
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stockwise_add_conversation_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    INSERT INTO public.conversation_participants (
        conversation_id,
        user_id,
        added_by,
        last_read_at
    )
    VALUES (
        NEW.id,
        NEW.created_by,
        NEW.created_by,
        now()
    )
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversation_creator_participant
    ON public.conversations;

CREATE TRIGGER trg_conversation_creator_participant
AFTER INSERT ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.stockwise_add_conversation_creator();


-- ------------------------------------------------------------
-- 8. VALIDATE PARTICIPANT INSERTS
--
-- A participant must belong to the same active company.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stockwise_validate_conversation_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_business_id UUID;
BEGIN
    SELECT business_id
    INTO v_business_id
    FROM public.conversations
    WHERE id = NEW.conversation_id;

    IF v_business_id IS NULL THEN
        RAISE EXCEPTION 'Conversation does not exist.';
    END IF;

    IF NOT public.stockwise_is_active_business_member(
        v_business_id,
        NEW.user_id
    ) THEN
        RAISE EXCEPTION
            'Participant must be an active member of this company.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_conversation_participant
    ON public.conversation_participants;

CREATE TRIGGER trg_validate_conversation_participant
BEFORE INSERT ON public.conversation_participants
FOR EACH ROW
EXECUTE FUNCTION public.stockwise_validate_conversation_participant();


-- ------------------------------------------------------------
-- 9. PROTECT PARTICIPANT IDENTITY
--
-- Participants may update their own last_read_at only.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stockwise_protect_conversation_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.added_by IS DISTINCT FROM OLD.added_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION
            'Participant identity and membership fields cannot be changed.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_conversation_participant
    ON public.conversation_participants;

CREATE TRIGGER trg_protect_conversation_participant
BEFORE UPDATE ON public.conversation_participants
FOR EACH ROW
EXECUTE FUNCTION public.stockwise_protect_conversation_participant();


-- ------------------------------------------------------------
-- 10. UPDATE CONVERSATION PREVIEW WHEN A MESSAGE IS SENT
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stockwise_update_conversation_preview()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.conversations
    SET
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(
            regexp_replace(NEW.content, '\s+', ' ', 'g'),
            180
        ),
        updated_at = now()
    WHERE id = NEW.conversation_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_preview
    ON public.conversation_messages;

CREATE TRIGGER trg_update_conversation_preview
AFTER INSERT ON public.conversation_messages
FOR EACH ROW
EXECUTE FUNCTION public.stockwise_update_conversation_preview();


-- ------------------------------------------------------------
-- 11. ENABLE ROW LEVEL SECURITY
-- ------------------------------------------------------------

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 12. CONVERSATION POLICIES
-- ------------------------------------------------------------

DROP POLICY IF EXISTS conversations_select
    ON public.conversations;

CREATE POLICY conversations_select
ON public.conversations
FOR SELECT
TO authenticated
USING (
    public.stockwise_can_access_conversation(id)
);


DROP POLICY IF EXISTS conversations_insert
    ON public.conversations;

CREATE POLICY conversations_insert
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND public.stockwise_has_business_access(business_id)
);


DROP POLICY IF EXISTS conversations_update
    ON public.conversations;

CREATE POLICY conversations_update
ON public.conversations
FOR UPDATE
TO authenticated
USING (
    (
        conversation_type = 'internal'
        AND public.stockwise_is_business_admin(business_id)
    )
    OR
    (
        conversation_type = 'support'
        AND public.stockwise_is_platform_admin()
    )
)
WITH CHECK (
    (
        conversation_type = 'internal'
        AND public.stockwise_is_business_admin(business_id)
    )
    OR
    (
        conversation_type = 'support'
        AND public.stockwise_is_platform_admin()
    )
);


-- ------------------------------------------------------------
-- 13. PARTICIPANT POLICIES
-- ------------------------------------------------------------

DROP POLICY IF EXISTS conversation_participants_select
    ON public.conversation_participants;

CREATE POLICY conversation_participants_select
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
    public.stockwise_can_access_conversation(conversation_id)
);


DROP POLICY IF EXISTS conversation_participants_insert
    ON public.conversation_participants;

CREATE POLICY conversation_participants_insert
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
    public.stockwise_can_manage_conversation_participants(
        conversation_id
    )
    AND public.stockwise_is_active_business_member(
        (
            SELECT c.business_id
            FROM public.conversations c
            WHERE c.id = conversation_id
        ),
        user_id
    )
);


DROP POLICY IF EXISTS conversation_participants_update
    ON public.conversation_participants;

CREATE POLICY conversation_participants_update
ON public.conversation_participants
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
    AND public.stockwise_can_access_conversation(conversation_id)
)
WITH CHECK (
    user_id = auth.uid()
    AND public.stockwise_can_access_conversation(conversation_id)
);


DROP POLICY IF EXISTS conversation_participants_delete
    ON public.conversation_participants;

CREATE POLICY conversation_participants_delete
ON public.conversation_participants
FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()
    OR public.stockwise_is_business_admin(
        (
            SELECT c.business_id
            FROM public.conversations c
            WHERE c.id = conversation_id
        )
    )
    OR (
        public.stockwise_is_platform_admin()
        AND EXISTS (
            SELECT 1
            FROM public.conversations c
            WHERE c.id = conversation_id
              AND c.conversation_type = 'support'
        )
    )
);


-- ------------------------------------------------------------
-- 14. MESSAGE POLICIES
-- ------------------------------------------------------------

DROP POLICY IF EXISTS conversation_messages_select
    ON public.conversation_messages;

CREATE POLICY conversation_messages_select
ON public.conversation_messages
FOR SELECT
TO authenticated
USING (
    public.stockwise_can_access_conversation(conversation_id)
);


DROP POLICY IF EXISTS conversation_messages_insert
    ON public.conversation_messages;

CREATE POLICY conversation_messages_insert
ON public.conversation_messages
FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND public.stockwise_can_access_conversation(conversation_id)
);

-- Deliberately no UPDATE or DELETE policy for messages.


-- ------------------------------------------------------------
-- 15. TABLE PERMISSIONS
-- RLS remains responsible for restricting actual access.
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.conversations
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.conversation_participants
TO authenticated;

GRANT SELECT, INSERT
ON public.conversation_messages
TO authenticated;


-- ------------------------------------------------------------
-- 16. SECURITY FUNCTION PERMISSIONS
-- ------------------------------------------------------------

REVOKE ALL ON FUNCTION
    public.stockwise_is_active_business_member(UUID, UUID)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
    public.stockwise_can_access_conversation(UUID)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
    public.stockwise_can_manage_conversation_participants(UUID)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    public.stockwise_is_active_business_member(UUID, UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION
    public.stockwise_can_access_conversation(UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION
    public.stockwise_can_manage_conversation_participants(UUID)
TO authenticated;


-- ------------------------------------------------------------
-- 17. ENABLE REALTIME
-- ------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) THEN

        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'conversations'
        ) THEN
            ALTER PUBLICATION supabase_realtime
                ADD TABLE public.conversations;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'conversation_participants'
        ) THEN
            ALTER PUBLICATION supabase_realtime
                ADD TABLE public.conversation_participants;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'conversation_messages'
        ) THEN
            ALTER PUBLICATION supabase_realtime
                ADD TABLE public.conversation_messages;
        END IF;

    END IF;
END;
$$;

COMMIT;

-- ============================================================
-- END OF BLAQSWATCH MESSAGING MIGRATION
-- ============================================================
