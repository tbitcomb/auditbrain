import { gptTokenizer } from "../../deps.ts";
import { fetchWithResilience } from "./http.ts";

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const MODERATIONS_URL = "https://api.openai.com/v1/moderations";
const DEFAULT_FREQUENCY_PENALTY = 0;
const DEFAULT_PRESENCE_PENALTY = 0;
const DEFAULT_TEMPERATURE = 1;
const DEFAULT_TOP_P = 1;
const DEFAULT_TOKEN_LIMIT = 4096;
const GPT_MODELS_MAP: Record<string, { contextWindow: number; maxOutputTokens: number; }> = Object.freeze({
    "ft:gpt-3.5-turbo-0613:personal:auditbrain:7tOHyn1t": Object.freeze({
        contextWindow: 4096,
        maxOutputTokens: 4096,
    }),
    "gpt-3.5-turbo": Object.freeze({
        contextWindow: 4096,
        maxOutputTokens: 4096,
    }),
    "gpt-3.5-turbo-1106": Object.freeze({
        contextWindow: 16385,
        maxOutputTokens: 4096,
    }),
    "gpt-3.5-turbo-16k": Object.freeze({
        contextWindow: 16385,
        maxOutputTokens: 4096,
    }),
    "gpt-4": Object.freeze({
        contextWindow: 8192,
        maxOutputTokens: 4096,
    }),
    "gpt-4-32k": Object.freeze({
        contextWindow: 32768,
        maxOutputTokens: 4096,
    }),
    "gpt-4-1106-preview": Object.freeze({
        contextWindow: 128000,
        maxOutputTokens: 4096,
    }),
});

function isAIMessage (args: {
    aiUserId?: string;
    message: ConversationMessage;
}): {
    value: boolean
} {
    const {
        aiUserId,
        message,
    } = args;
    
    return { value: message.role === "ai" || message.userId === aiUserId };
};

/**
 * This currently just uses the "gpt-3.5-turbo-0301" model name
 * because all the current GPT models seem to use clk100_base
 * tokens, so there's no point in fretting over which model
 * as far as I can tell.
 */
function getNumTokensForChat (args: {
    openAIMessages: OpenAIMessage[];
}): { numTokens: number; } {
    const {
        openAIMessages
    } = args;

    return {
        numTokens: gptTokenizer.encodeChat(
            openAIMessages,
            "gpt-3.5-turbo-0301",
        ).length,
    };
}

/**
 * Similar to `completeConversationWithOpenAI`, except it
 * takes in a single string and returns a single string.
 * Easiest way to get a one-off response from a model.
 */
export async function askOpenAIModel (args: {
    apiKey: string;
    fetchFn: FetchFunction;
    frequencyPenalty?: number;
    maxOutputTokens?: number;
    modelName: string;
    presencePenalty?: number;
    responseFormat?: string;
    systemPromptText?: string;
    temperature?: number;
    text: string;
    topP?: number;
}): Promise<{
    error?: OpenAIError;
    json?: unknown;
    text?: string;
}> {
    const {
        apiKey,
        fetchFn,
        frequencyPenalty,
        maxOutputTokens,
        modelName,
        presencePenalty,
        responseFormat,
        systemPromptText,
        temperature,
        text,
        topP,
    } = args;
    const conversation: ConversationData = {
        messages: [
            {
                id: crypto.randomUUID(),
                role: "user",
                text,
                ts: new Date().toISOString(),
                userId: "user",
            },
        ],
    };
    const { error, message } = await completeConversationWithOpenAI({
        apiKey,
        conversation,
        fetchFn,
        frequencyPenalty,
        maxOutputTokens,
        modelName,
        presencePenalty,
        responseFormat,
        systemPromptText,
        temperature,
        topP,
    });

    if (error) {
        return {
            error,
        };
    }

    if (message) {
        if (responseFormat === "json_object") {
            try {
                return {
                    json: JSON.parse(message.text),
                };
            } catch {
                return {
                    error: {
                        message: "Failed to parse JSON from OpenAI",
                    },
                };
            }
        } else {
            return {
                text: message.text,
            };
        }
    }

    return {
        error: {
            message: "OpenAI did not respond with a message",
        },
    }
};

/**
 * Given a conversation, passes it to an OpenAI model and returns
 * a message from the model in our own conversation message format.
 */
export async function completeConversationWithOpenAI (args: {
    aiUserId?: string;
    apiKey: string;
    conversation: ConversationData;
    fetchFn: FetchFunction;
    frequencyPenalty?: number;
    maxOutputTokens?: number;
    modelName: string;
    presencePenalty?: number;
    responseFormat?: string;
    systemPromptText?: string;
    temperature?: number;
    topP?: number;
}): Promise<{
    message?: ConversationMessage;
    error?: OpenAIError;
}> {
    const {
        aiUserId,
        apiKey,
        conversation,
        fetchFn,
        frequencyPenalty,
        maxOutputTokens,
        modelName,
        presencePenalty,
        responseFormat,
        systemPromptText,
        temperature,
        topP,
    } = {
        aiUserId: "unknown",
        maxOutputTokens: DEFAULT_TOKEN_LIMIT,
        ...args,
    };
    const { openAIMessages: messages } = convertConversationToOpenAIChat({
        aiUserId,
        conversation,
        modelName,
        numTokensToAllocateForOutput: maxOutputTokens,
        systemPromptText,
    });
    const { error, message } = await completeOpenAIChat({
        apiKey,
        fetchFn,
        frequencyPenalty,
        messages,
        modelName,
        presencePenalty,
        responseFormat,
        temperature,
        maxOutputTokens,
        topP,
    });

    if (error) {
        return { error };
    }

    if (!message) {
        return {
            error: {
                message: "No message was parsed from OpenAI but no error was provided",
            },
        };
    }

    return {
        message: {
            id: crypto.randomUUID(),
            json: (function () {
                try {
                    return JSON.parse(message.content);
                } catch {
                    return null;
                }
            })(),
            role: "ai",
            text: message.content,
            ts: `${(Date.now() + performance.now()) / 1000}`,
            userId: aiUserId,
        },
    };
}

/**
 * Takes a list of conversation messages and converts them to
 * messages that are formatted for use with the OpenAI API.
 * It sticks a system prompt at both the beginning of the conversation
 * and before the most recent message, which I've found is
 * sometimes necessary.
 * 
 * @param {number} numTokensToAllocateForOutput
 * Determines how many tokens the model will return in its response message.
 * This value will be used to automatically compact the conversation to ensure the API will accept it.
 * If it exceeds the token limit for the model, then this value will automatically
 * be adjusted.
 */
export function convertConversationToOpenAIChat (args: {
    aiUserId?: string;
    conversation: ConversationData;
    modelName: string;
    numTokensToAllocateForOutput: number;
    systemPromptText?: string;
}): {
    openAIMessages: OpenAIMessage[];
} {
    const {
        aiUserId,
        conversation,
        modelName,
        numTokensToAllocateForOutput,
        systemPromptText,
    } = {
        ...args,
    };
    const { contextWindow, maxOutputTokens } = GPT_MODELS_MAP[modelName];
    const allocatedOutputTokens = Math.min(
        numTokensToAllocateForOutput,
        maxOutputTokens >= contextWindow ? maxOutputTokens / 2 : maxOutputTokens,
    );
    const allocatedContextTokens = contextWindow - allocatedOutputTokens;
    const messages = Object.freeze(
        Array
            .from(conversation.messages)
            .filter(Boolean)
    );
    const systemPrompt: OpenAIMessage = Object.freeze({
        role: "system",
        content: systemPromptText?.length ? systemPromptText : "You are a helpful assistant.",
    });

    return (
        function generateOpenAIConversation (args?: {
            index?: number;
            numHistoryTokens?: number;
            openAIMessages?: OpenAIMessage[];
        }): { openAIMessages: OpenAIMessage[]; } {
            const {
                numHistoryTokens,
                openAIMessages,
                index,
            } = {
                openAIMessages: [
                    systemPrompt,
                ],
                numHistoryTokens: 0,
                index: 0,
                ...(args ?? {}),
            };

            if (index >= messages.length) {
                const { numTokens } = getNumTokensForChat({ openAIMessages });
                const hasExceededTokenLimit = numTokens > allocatedContextTokens;
        
                if (hasExceededTokenLimit) {
                    return generateOpenAIConversation({
                        numHistoryTokens: numTokens,
                        index,
                        // If we have exceeded the token limit, pop off
                        // the oldest non-system message from the history and
                        // keep trying again until we are within the limit.
                        openAIMessages: (function () {
                            const firstSystemPromptIndex = openAIMessages.findIndex((message) => message.role === "system");
                            const spliceIndex = Math.max(firstSystemPromptIndex, 0);
        
                            return openAIMessages.filter((_, index) => index !== spliceIndex);
                        })(),
                    });
                }
        
                return {
                    openAIMessages,
                };
            }
        
            const message = messages[index];
            const openAIMessage: OpenAIMessage = {
                // Previous messages in the history may have come from
                // us, so the messages that have our user ID will use
                // get the "assistant" role since that's what we're
                // impersonating.
                role: isAIMessage({ aiUserId, message }).value ? "assistant" : "user",
                content: message.text,
            };
            const nextIndex = index + 1;

            return generateOpenAIConversation({
                numHistoryTokens,
                index: nextIndex,
                openAIMessages: [
                    ...openAIMessages,
                    // // If we have reached the most recent message, prepend it
                    // // with the system prompt yet again.
                    // ...(
                    //     nextIndex === messages.length
                    //     ? [systemPrompt, openAIMessage]
                    //     : [openAIMessage]
                    // ),
                    openAIMessage,
                ],
            });
        }
    )();
};

/**
 * A convenience function that takes an OpenAI chat,
 * sends it to the OpenAI chat completions API endpoint,
 * and returns either the message generated by the
 * GPT model or an error object.  It also calculates the
 * `max_tokens` value so that only the number of
 * remaining tokens are requested.
 */
export async function completeOpenAIChat (args: {
    apiKey: string;
    fetchFn: FetchFunction;
    frequencyPenalty?: number;
    messages: OpenAIMessage[];
    modelName: string;
    presencePenalty?: number;
    responseFormat?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
}): Promise<{
    error?: OpenAIError;
    message?: OpenAIMessage;
}> {
    const {
        apiKey,
        fetchFn,
        frequencyPenalty,
        messages,
        modelName,
        presencePenalty,
        responseFormat,
        temperature,
        topP,
    } = {
        frequencyPenalty: DEFAULT_FREQUENCY_PENALTY,
        presencePenalty: DEFAULT_PRESENCE_PENALTY,
        temperature: DEFAULT_TEMPERATURE,
        topP: DEFAULT_TOP_P,
        ...args,
    };
    const { numTokens: totalTokens } = getNumTokensForChat({ openAIMessages: messages });
    const { contextWindow, maxOutputTokens: outputTokenLimit } = GPT_MODELS_MAP[args.modelName];
    // If a hard limit on the number of tokens for the output is not passed
    // then take the total number of tokens for the conversation and
    // subtract that from the context window size for the model.
    // If that value still exceeds the max token output for the model,
    // then default to that output size.
    const maxOutputTokens =
        args.maxOutputTokens ??
        Math.min(contextWindow - totalTokens, outputTokenLimit);
    const { response } = await fetchWithResilience({
        fetchFn,
        init: {
            method: "POST",
            headers: new Headers({
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Bearer ${apiKey}`,
            }),
            body: JSON.stringify(
                Object.entries({
                    model: modelName,
                    messages,
                    // The maximum number of tokens that can be generated in the chat completion.
                    max_tokens: maxOutputTokens,
                    response_format: responseFormat ? {
                        type: responseFormat ?? "text",
                    } : undefined,
                    // max_tokens: (tokenLimit-totalTokens),
                    temperature,
                    top_p: topP,
                    frequency_penalty: frequencyPenalty,
                    presence_penalty: presencePenalty,
                }).reduce(function (hash, [k, v]) {
                    if (v === undefined) {
                        return hash;
                    }

                    return {
                        ...hash,
                        [k]: v,
                    };
                }, {}),
            ),
        },
        input: CHAT_COMPLETIONS_URL,
    });

    try {
        const json = await response.json();

        if (json.error) {
            return {
                error: json.error as OpenAIError,
            };
        }
    
        const { choices: [ { message } ] } = json;
    
        return {
            message: message as OpenAIMessage,
        }
    } catch {
        return {
            error: {
                message: "OpenAI responsed with malformed data that couldn't be parsed",
            },
        };
    }
}

export async function isTextInappropriate (args: {
    apiKey: string;
    fetchFn: FetchFunction;
    text: string;
}): Promise<{ error?: OpenAIError; isInappropriate?: boolean }> {
    const { 
        apiKey,
        fetchFn,
        text,
    } = args;
    const { response } = await fetchWithResilience({
        fetchFn,
        init: {
            method: "POST",
            headers: new Headers({
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Bearer ${apiKey}`,
            }),
            body: JSON.stringify({
                input: text,
            }),
        },
        input: MODERATIONS_URL,
    });

    try {
        const json = await response.json();

        if (json.error) {
            return {
                error: json.error as OpenAIError,
            };
        }
    
        const { results: [ { isFlagged } ] } = json;
    
        return {
            isInappropriate: isFlagged,
        }
    } catch {
        return {
            error: {
                message: "OpenAI responsed with malformed data that couldn't be parsed",
            },
        };
    }    
}

export function createLongTermMemory (args: {
    context?: string;
    modelName: string;
    maxTokens?: number;
}): {
    error?: OpenAIError;
    longTermMemory?: OpenAILongTermMemory;
} {
    const {
        context,
        maxTokens,
        modelName,
    } = {
        context: "",
        ...args,
    };

    if (typeof maxTokens !== "number" || Number.isNaN(maxTokens)) {
        return {
            error: {
                message: "Max tokens should be a number when creating long term memory",
            },
        };
    }

    const model = GPT_MODELS_MAP[modelName];

    if (!model) {
        return {
            error: {
                message: "Model not found when creating long term memory",
            }
        };
    }

    if (maxTokens > model.maxOutputTokens) {
        return {
            error: {
                message: "Max tokens for long term memory cannot exceed the max output tokens for the model",
            },
        };
    }

    if (maxTokens > model.contextWindow) {
        return {
            error: {
                message: "Max tokens for long term memory cannot exceed the context window for the model",
            },
        };
    }

    return {
        longTermMemory: {
            context,
            maxTokens,
            modelName,
        },
    };
}

export async function updateLongTermMemory (args: {
    apiKey: string;
    fetchFn: FetchFunction;
    learningMaterial: string;
    longTermMemory: OpenAILongTermMemory;
    systemPromptText?: string;
}): Promise<{
    error?: OpenAIError;
    longTermMemory?: OpenAILongTermMemory;
}> {
    const {
        apiKey,
        fetchFn,
        learningMaterial,
        longTermMemory,
        systemPromptText,
    } = {
        systemPromptText: "You are a helpful assistant.",
        ...args,
    };
    const model = GPT_MODELS_MAP[longTermMemory.modelName];

    if (!model) {
        return {
            error: {
                message: "Model could not be found when updating long term memory.",
            },
        };
    }

    const openAIMessages: OpenAIMessage[] = [
        {
            role: "system",
            content: [
                systemPromptText,
                "The following is everything you know about your expertise:",
                "\n",
                "```",
                longTermMemory.context,
                "```"
            ].join("\n"),
        },
        {
            role: "user",
            content: [
                "Here is some new information pertaining to your knowledge.",
                "\n",
                "```",
                learningMaterial,
                "```",
                "\n",
                "Study this information, learn from it, adding it to your overall knowledge, and then respond with everything you know about AuditBoard.  Only respond with your knowledge and no extra verbiage or acknowledgement.",
            ].join("\n")
        }
    ];
    const { numTokens } = getNumTokensForChat({ openAIMessages });

    if (numTokens > model.contextWindow) {
        return {
            error: {
                message: "The number of tokens in the messages created to update long-term memory exceeds the size of the context window for the specified model.",
            },
        };
    }

    const { response } = await fetchWithResilience({
        fetchFn,
        init: {
            method: "POST",
            headers: new Headers({
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Bearer ${apiKey}`,
            }),
            body: JSON.stringify(
                Object.entries({
                    model: longTermMemory.modelName,
                    messages: openAIMessages,
                    max_tokens: longTermMemory.maxTokens,
                }).reduce(function (hash, [k, v]) {
                    if (v === undefined) {
                        return hash;
                    }

                    return {
                        ...hash,
                        [k]: v,
                    };
                }, {}),
            ),
        },
        input: CHAT_COMPLETIONS_URL,
    });

    try {
        const json = await response.json();

        if (json.error) {
            return {
                error: json.error as OpenAIError,
            };
        }
    
        const { choices: [ { message } ] } = json;
        const responseMessage = message as OpenAIMessage;
    
        return {
            longTermMemory: {
                ...longTermMemory,
                context: responseMessage.content,
            },
        };
    } catch {
        return {
            error: {
                message: "OpenAI responsed with malformed data that couldn't be parsed",
            },
        };
    }
}