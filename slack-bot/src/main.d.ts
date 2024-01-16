type SlackEvent = {
    type: string;
};

type SlackBotInfoResponsePayload = {
    ok: boolean;
    error?: string;
    warning?: string;
    bot?: {
        id: string;
        deleted: boolean;
        name: string;
        updated: number;
        app_id: string;
        user_id: string;
        icons: Record<string, string>;
    };
    response_metadata?: {
        warnings: string[];
    };
};

type SlackMessage = {
    type: string;
    subtype?: string;
    text?: string;
    ts: string;
    user?: string;
    channel: string;
    channel_type?: string;
    bot_id?: string;
    username?: string;
    attachments?: {
        service_name: string;
        text: string;
        fallback: string;
        thumb_url: string;
        thumb_width: number;
        thumb_height: number;
        id: number;
    };
    blocks?: {
        type: string;
        elements: Record<string, string>[];
    };
};

type SlackConversationHistoryPayload = {
    ok: boolean;
    error?: string;
    latest?: string;
    messages?: SlackMessage[];
    has_more?: boolean;
    pin_count?: number;
    response_metadata?: {
        next_cursor?: string;
    };
};

type BuildChatArgs = {
    conversation: SlackMessage[];
    messages: OpenAIMessage[];
    numHistoryTokens:
    number; index: number
};

type SlackUserInfo = {
    id: string;
    team_id: string;
    name: string;
    deleted: boolean;
    color: string;
    real_name: string;
    tz: string;
    tz_label: string;
    tz_offset: number;
    is_admin: boolean;
    is_owner: boolean;
    is_primary_owner: boolean;
    is_restricted: boolean;
    is_ultra_restricted: boolean;
    is_bot: boolean;
    updated: number;
    is_app_user: boolean;
    has_2fa: boolean;
    profile: {
        avatar_hash?: string;
        status_text?: string;
        status_emoji?: string;
        real_name: string;
        display_name: string;
        real_name_normalized: string;
        display_name_normalized: string;
        image_original?: string;
        image_24?: string;
        image_32?: string;
        image_48?: string;
        image_72?: string;
        image_192?: string;
        image_512?: string;
        team: string;
    };
};

type SlackUserInfoResponsePayload = {
    ok: boolean;
    error?: string;
    user?: SlackUserInfo;
};

type SlackChatPostMessageResponse = {
    ok: boolean;
    error?: string;
    channel?: string;
    ts?: string;
    message?: SlackMessage;
};

type SlackAuthTestResponse = {
    ok: boolean;
    error?: string;
    warning?: string;
    url?: string;
    team?: string;
    user?: string;
    team_id?: string;
    user_id?: string;
    bot_id?: string;
};

type SlackMessageAttachment = {
    text?: string;
    fallback?: string;
    callback_id?: string;
    color?: string;
    attachment_type?: string;
    actions: [
        {
            name: string;
            text: string;
            type: string;
            value: string;
        }
    ],
}

type SlackActionItem = {
    name: string;
    type: string;
    value: string;
};

type SlackActivity = {
    type: string;
    actions?: SlackActionItem[];
    callback_id?: string;
    team?: {
        id: string;
        domain: string;
    },
    channel: {
        id: string;
        name: string;
    };
    user?: {
        id: string;
        name: string;
    };
    action_ts?: string;
    message_ts?: string;
    attachment_id?: string;
    token?: string;
    is_app_unfurl?: boolean;
    is_enterprise_install?: boolean;
    original_message: SlackMessage;
    response_url?: string;
    trigger_id?: string;
};
