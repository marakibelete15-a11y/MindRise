ALTER TYPE moderation_action_type ADD VALUE IF NOT EXISTS 'warn_user';
ALTER TYPE moderation_action_type ADD VALUE IF NOT EXISTS 'restrict_user';
ALTER TYPE moderation_action_type ADD VALUE IF NOT EXISTS 'unrestrict_user';
ALTER TYPE moderation_action_type ADD VALUE IF NOT EXISTS 'ban_user';
ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'banned';