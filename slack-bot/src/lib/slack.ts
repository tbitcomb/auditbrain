import { readAll as readAllFromStream } from "std/streams/read_all";
import { readerFromStreamReader } from "std/streams/reader_from_stream_reader";
import { createHmacSha256 } from "./lib/crypto.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function generateTimestamp (): { ts: number } {
    return {
        ts: (Date.now() + performance.now()) / 1000,
    };
}

function convertSlackTimestampToISO (args: {
    ts: number;
}): {
    iso: string;
} {
    const { ts } = args;
    
    return {
        iso: (new Date(ts * 1000)).toISOString(),
    };
}

function convertISOStringToSlackTimestamp (args: {
    iso: string;
}): {
    ts: number;
} {
    const { iso } = args;

    return {
        ts: ((new Date(iso)).getTime() + performance.now()) / 1000,
    };
}

export async function handleSlackRequest (args: {
    request: Request;
    signingSecret: string;
    slackBotToken: string;
}): Promise<Response> {
    const {
        request,
        signingSecret,
        slackBotToken
    } = args;
    const { text } = await readSlackRequestBodyAsText({
        request,
        signingSecret,
    });

    let response = new Response('', { status: 200 });

    const url = new URL(request.url);

    if (url.pathname === '/slack/activity') {
        const params = new URLSearchParams(text);
        const payload = params.get('payload');
        const activity: SlackActivity = JSON.parse(payload || "{}");

        if (activity.callback_id === "deleteBotMessage") {
            const channel = activity.channel.id;
            const ts = activity.original_message.ts;

            await deleteSlackMessage({ token: slackBotToken, channel, ts });
        }
    } else if (url.pathname === '/slack/events') {
        const requestPayload = JSON.parse(text);

        // If this is a url_verification event, respond with the challenge token
        if (requestPayload.type === 'url_verification') {
            const body = textEncoder.encode(
                JSON.stringify({
                    challenge: requestPayload.challenge,
                }),
            );

            response = new Response(body, {
                status: 200,
            });
        } else if (requestPayload.type === 'event_callback') {
            const event: SlackEvent = requestPayload.event;

            // Ensure the event is a message event
            if (event.type === 'message') {
                const slackMessage = event as SlackMessage;

                handleSlackMessage({ slackMessage, token: slackBotToken });
            }
        }
    }

    return response;
}

function isUserMentioned (args: {
    message: SlackMessage;
    userId: string;
}): boolean {
    const { message, userId } = args;
    const { mentions } = findMentions({ object: message });

    for (const mention of mentions) {
        if (mention.user_id === userId) return true;
    }

    return false;
}

function findMentions (args: {
    object: {
        [key: string]: unknown;
    };
    mentions?: { type: string; user_id: string; }[];
}): { mentions: { type: string; user_id: string; }[] } {
    const { object } = args;
    let { mentions } = {
        mentions: [],
        ...args,
    };

    if (object.type === "user" && object.user_id) {
        mentions = [ ...mentions, { type: object.type, user_id: object.user_id as string } ];
    }

    const children = [
        ...(Array.isArray(object.blocks) ? object.blocks : []),
        ...(Array.isArray(object.elements) ? object.elements : []),
    ];

    for (const child of children) {
        const { mentions: childMentions } = findMentions({ object: child, mentions });

        mentions = Array.from(new Set([ ...mentions, ...childMentions ]));
    }

    return { mentions };
}

async function handleSlackMessage (args: {
    slackMessage: SlackMessage;
    token: string;
}): Promise<Response> {
    const { slackMessage, token } = args;

    const botInfo = await authTest({ token });

    if (
        slackMessage.subtype ||
        slackMessage.bot_id ||
        (slackMessage.channel_type !== "im" && !isUserMentioned({ message: slackMessage, userId: botInfo.user_id || "NULL_USER_ID" }))
    ) {
        return new Response('', { status: 200 });
    }

    if (botInfo.error) {
        console.error(`botinfo error: ${botInfo.error}`);

        return new Response(botInfo.error, { status: 500 });
    }

    if (!botInfo.user) {
        console.error('botInfo.user missing');

        return new Response("bot not found", { status: 500 });
    }

    // const { bot_id: botId } = botInfo;
    const { conversationHistory: conversationHistoryPayload } = await getConversationHistory({
        token,
        channel: slackMessage.channel,
        // inclusive: true,
        limit: 100  // the maximum allowed messages to be fetched is 1000. Default is 100.
    });
    const slackMessages: SlackMessage[] = (conversationHistoryPayload.messages ?? []);
    const { auditbrainConversation } = (async function buildConversationData (args: {
        auditbrainConversation?: ConversationData;
        index?: number;
        slackMessages: SlackMessage[];
    }): Promise<{ auditbrainConversation: ConversationData }> {
        const {
            auditbrainConversation,
            index,
            slackMessages,
        } = {
            auditbrainConversation: { messages: [] },
            index: (args || { slackMessages: [] }).slackMessages.length - 1,
            ...(args || {}),
        };

        if (index < 0) {
            return { auditbrainConversation };
        }

        const slackMessage = slackMessages[index];

        return await buildConversationData({
            auditbrainConversation: {
                ...auditbrainConversation,
                messages: [
                    {
                        text: slackMessage.text ?? "",
                        ts: slackMessage.ts,
                        userId: slackMessage.user ?? null,
                    },
                    ...auditbrainConversation.messages,
                ]
            },
            index: index - 1,
            slackMessages,
        });
    })({ slackMessages });

    // TODO: This is where we will take our preprocessed Slack data and
    // send it over to our own chat API
    const response = await fetch('https://what is my api?', {
        method: "POST",
        headers: new Headers({
            'Content-Type': 'application/json; charset=utf-8',
            // 'Authorization': `Bearer `,
        }),
        // body: JSON.stringify(data),
    });
    const json = await response.json();

    if (json.error) {
        console.log(json.error.message);
    }

    // console.log(JSON.stringify(json, null, 2))

    // const { choices: [ { message: { content } } ] } = json;
    const postSlackMessageResponsePayload: SlackChatPostMessageResponse = await postSlackMessage({
        token,
        channel: slackMessage.channel,
        text: "Hi!  I am working but currently cannot contact your API.  Try again later!",
        attachments: [
            {
                text: "",
                fallback: "Unable to delete bot message.",
                callback_id: "deleteBotMessage",
                color: "#3AA3E3",
                attachment_type: "default",
                actions: [
                    {
                        "name": "delete",
                        "text": "Delete",
                        "type": "button",
                        "value": "delete",
                    }
                ]
            }
        ]
    });

    if (postSlackMessageResponsePayload.error) {
        console.error(`slack post message error: ${postSlackMessageResponsePayload.error}`)

        return new Response(postSlackMessageResponsePayload.error, { status: 500 });
    }

    return new Response('', { status: 200 });
}

async function authTest (args: { token: string; }): Promise<SlackAuthTestResponse> {
    const { token } = args;
    const url = new URL("https://slack.com/api/auth.test");
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
            token,
        }),
    });
    const payload: SlackAuthTestResponse = await response.json();

    return payload;
}

// async function getBotInfo (args: { token: string; }): Promise<SlackBotInfoResponsePayload> {
//     const { token } = args;
//     const url = new URL("https://slack.com/api/bots.info");
//     const response = await fetch(url, {
//         method: "POST",
//         headers: {
//             "Authorization": `Bearer ${token}`,
//             "Content-Type": "application/json; charset=utf-8",
//         },
//         body: JSON.stringify({
//             token,
//         }),
//     });
//     const payload: SlackBotInfoResponsePayload = await response.json();

//     return payload;
// }

async function getConversationHistory (args: { token: string; channel: string; limit?: number; }): Promise<{ conversationHistory: SlackConversationHistoryPayload }> {
    const { token, channel, limit } = {
        limit: 100,
        ...args
    };
    const url = new URL("https://slack.com/api/conversations.history");

    url.searchParams.set('channel', channel);
    url.searchParams.set('limit', `${limit}`);

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });
    const payload: SlackConversationHistoryPayload = await response.json();

    return { conversationHistory: payload };
}

// async function getUserInfo (args: { token: string; user: string; }): Promise<SlackUserInfoResponsePayload> {
//     const { token, user } = args;
//     const url = new URL("https://slack.com/api/users.info");

//     url.searchParams.set('user', user);

//     const response = await fetch(url, {
//         method: "GET",
//         headers: {
//             "Authorization": `Bearer ${token}`,
//             "Content-Type": "application/x-www-form-urlencoded",
//         },
//     });
//     const payload: SlackUserInfoResponsePayload = await response.json();

//     return payload;
// }

async function postSlackMessage (args: { token: string; channel: string, text?: string; attachments?: SlackMessageAttachment[] }): Promise<SlackChatPostMessageResponse> {
    const { channel, token, text, attachments } = {
        attachments: [],
        ...args,
    };

    const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
            channel,
            text: typeof text === "string" ? text : null,
            attachments,
        }),
    });
    const payload: SlackChatPostMessageResponse = await response.json();

    return payload;
}

// async function updateSlackMessage (args: { token: string; channel: string, ts: string; text?: string; attachments?: SlackMessageAttachment[] }): Promise<SlackChatPostMessageResponse> {
//     const { channel, token, ts, text, attachments } = {
//         attachments: [],
//         ...args,
//     };

//     const body = Object.entries({
//         channel,
//         ts,
//         text,
//         attachments,
//     }).reduce((hash, [k, v]) => {
//         return {
//             ...hash,
//             [k]: v,
//         };
//     }, {});

//     const response = await fetch('https://slack.com/api/chat.update', {
//         method: "POST",
//         headers: {
//             "Authorization": `Bearer ${token}`,
//             "Content-Type": "application/json; charset=utf-8",
//         },
//         body: JSON.stringify(body),
//     });
//     const payload: SlackChatPostMessageResponse = await response.json();

//     return payload;
// }


async function deleteSlackMessage (args: { token: string; channel: string, ts: string; }): Promise<SlackChatPostMessageResponse> {
    const { channel, token, ts } = args;

    const response = await fetch('https://slack.com/api/chat.delete', {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
            channel,
            ts,
        }),
    });
    const payload: SlackChatPostMessageResponse = await response.json();

    return payload;
}

async function readSlackRequestBodyAsText (args: { request: Request; signingSecret: string; nowMsFn?: () => number; }): Promise<{ text: string; }> {
    const { data } = await readSlackRequestBody(args);

    return {
        text: textDecoder.decode(data),
    }
}

async function readSlackRequestBody (args: { request: Request; signingSecret: string; nowMsFn?: () => number; }): Promise<{ data: Uint8Array }> {
    const { request, signingSecret, nowMsFn } = {
        nowMsFn: () => Date.now(),
        ...args,
    };
    const verifyErrorPrefix = "Failed to verify authenticity"

    const readableStreamReader = request.body?.getReader() ?? new ReadableStreamDefaultReader(new ReadableStream());
    const reader = readerFromStreamReader(readableStreamReader);
    const bufferedReq = await readAllFromStream(reader);

    // Find the relevant request headers
    const signature = request.headers.get("x-slack-signature");

    if (!signature) {
        throw new Error("Expected `x-slack-signature` header to contian a value but none found.");
    }

    const requestTimestampSec = Number(
        request.headers.get("x-slack-request-timestamp"),
    );

    if (Number.isNaN(requestTimestampSec)) {
        throw new Error(
            `${verifyErrorPrefix}: header x-slack-request-timestamp did not have the expected type (${requestTimestampSec})`,
        )
    }

    // Calculate time-dependent values
    const nowMs: number = nowMsFn();
    const fiveMinutesAgoSec = Math.floor(nowMs / 1000) - 60 * 5

    // Enforce verification rules

    // Rule 1: Check staleness
    if (requestTimestampSec < fiveMinutesAgoSec) {
        throw new Error(`${verifyErrorPrefix}: stale`)
    }

    // Rule 2: Check signature
    // Separate parts of signature
    const [signatureVersion, signatureHash] = signature.split("=")
    // Only handle known versions
    if (signatureVersion !== "v0") {
        throw new Error(`${verifyErrorPrefix}: unknown signature version`)
    }

    const { hmac } = await createHmacSha256({
        secret: signingSecret,
        message: `${signatureVersion}:${requestTimestampSec}:${textDecoder.decode(bufferedReq)}`,
    });

    // TODO Time safe compare (?)
    if (signatureHash !== hmac) {
        throw new Error(`${verifyErrorPrefix}: signature mismatch`)
    }

    return { data: bufferedReq };
}
