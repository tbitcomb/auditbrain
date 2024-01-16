import { setResponseStatus, valueToResponse } from "./lib/http.ts";
import { completeConversationWithOpenAI } from "./lib/openai.ts";

function functionNotFound () {
    return setResponseStatus({ 
        object: {
            error: "function not found",
        },
        status: 500,
    });
}

/**
 * This function simply wraps the app behavior in a scope where
 * functions can access important variables without needing
 * to have them passed in directly.  This is useful for the way
 * that request handlers are used, where the arguments they
 * receive are controlled by the request data.
 */
export function main (args: {
    fetchFn: FetchFunction;
    openAIAPIKey: string;
    openAIMaxOutputTokens: number;
    openAIModel: string;
    aiUserId: string;
}) {
    const {
        fetchFn,
        openAIAPIKey,
        openAIMaxOutputTokens,
        openAIModel,
        aiUserId,
    } = args;
    const requestHandlers: Record<string, HandlerFunction> = Object.freeze({
        completeConversation,
    });
    
    /**
     * Given a converstaion we've received, convert it into an OpenAI
     * conversation, pass it to the OpenAI model, and then return
     * the completion in a form that can be used by a client.
     */
    async function completeConversation (conversation: ConversationData): Promise<{ error?: OpenAIError; message?: ConversationMessage; }> {
        // todo: reject inappropriate message

        const { error, message: extractedQueriesMessage } = await completeConversationWithOpenAI({
            aiUserId,
            apiKey: openAIAPIKey,
            responseFormat: "json_object",
            conversation: {
                ...conversation,
                messages: [
                    ...conversation.messages,
                    {
                        id: crypto.randomUUID(),
                        role: "user",
                        text: "In the form of a JSON object, provide me a list of search engine queries that I could use to search the AuditBoard documentation to help me answer my questions from this conversation.  This object should contain a single key called \"queries\" with a value that is an array of strings.  When creating queries, try to give more precedence to the most recent messages in our conversation.",
                        ts: new Date().toISOString(),
                        userId: "user",
                    } as ConversationMessage,
                ],
            },
            fetchFn,
            modelName: openAIModel,
            maxOutputTokens: openAIMaxOutputTokens,
        });

        const { systemPromptText } = await (async function () {
            const defaultSystemPrompt = {
                systemPromptText: "As an AuditBoard customer support expert, your task is to answer questions about the AuditBoard platform.  Only provide answers that are a concise paragraph long."
            };

            if (!extractedQueriesMessage?.json) {
                return defaultSystemPrompt;
            }

            const { queries } = extractedQueriesMessage?.json as { queries: string[] };
            const elasticsearchQuery = {
                "query": {
                    "bool": {
                        "must": [
                            {
                                bool: {
                                    should: queries.map(function (query) {
                                        return {
                                            match: {
                                                content: query,
                                            },
                                        };
                                    }),
                                },
                            },
                        ],
                        // "filter": [
                        //     {
                        //         "term": {
                        //             "type": "video"
                        //         }
                        //     }
                        // ]
                    }
                }
            };
            console.log(JSON.stringify(elasticsearchQuery, null, 2));
            const response = await fetch("http://elasticsearch:9200/articles/_search", {
                body: JSON.stringify(elasticsearchQuery),
                headers: {
                    "Content-Type": "application/json",
                },
                method: "POST",
            })

            if (!response.ok) {
                console.log(response.status)

                return defaultSystemPrompt;
            }

            const json = await response.json();
            const articles = json.hits.hits.map(function (hit) {
                return hit._source;
            });

            console.log(JSON.stringify(articles, null, 2))

            return {
                systemPromptText: [
                    defaultSystemPrompt.systemPromptText,
                    "Use the following search results to help you answer questions:",
                    "\n",
                    "```json",
                    JSON.stringify(articles, null, 2),
                    "```",
                    "Use this information to answer questions about the AuditBoard platform.  When answering a question, provide a single concise paragraph at most."
                ].join("\n")
            }
        })();

        return await completeConversationWithOpenAI({
            aiUserId,
            apiKey: openAIAPIKey,
            conversation,
            fetchFn,
            modelName: openAIModel,
            maxOutputTokens: openAIMaxOutputTokens,
            systemPromptText:  systemPromptText,
        });
    }

    return Object.freeze({
        handleRequest: async function handleRequest (args: { request: Request }): Promise<{ response: Response }> {
            const { request } = args;
            const data = await request.json();
            const { functionName } = data;
            const requestArgs: unknown[] | undefined = data.args;
            
            if (!Array.isArray(requestArgs)) {
                return {
                    response: new Response(
                        JSON.stringify({
                            error: {
                                message: "Body of request must be a JSON array.",
                            },
                        }),
                        {
                            status: 400,
                            headers: {
                                "Access-Control-Allow-Origin": "*",
                            },
                        },
                    ),
                };
            }

            const handlerFunction = requestHandlers[functionName] ?? functionNotFound;
            const handlerOutput = await handlerFunction(...requestArgs);
        
            return valueToResponse({ value: handlerOutput });
        }
    });
}
