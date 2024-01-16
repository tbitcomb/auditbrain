import { dispatchEvent, saveApplicationState } from "./runtime.js";

/**
 * @param {{ text: string; }} args 
 * @returns {{ message: ConversationMessage; }}
 */
export function createUserMessage (args) {
    const {
        text,
    } = args;

    return {
        message: {
            id: crypto.randomUUID(),
            role: "user",
            text,
            ts: new Date().toISOString(),
            userId: "user",
        },
    };
}

/**
 * @param {{ text: string; }} args 
 * @returns {{ message: ConversationMessage; }}
 */
export function createAIMessage (args) {
    const {
        text,
    } = args;

    return {
        message: {
            id: crypto.randomUUID(),
            role: "ai",
            text,
            ts: new Date().toISOString(),
            userId: "ai",
        },
    };
}

/**
 * @param {{
 *  message: ConversationMessage;
 *  state: ApplicationState;
 * }} args
 */
export async function sendMessageToAI (args) {
    const {
        message,
        state,
    } = args;

    state.data.conversation.messages = [
        ...state.data.conversation.messages,
        message,
    ];

    dispatchEvent({ name: "messagereceived", target: state.eventTarget });
    dispatchEvent({ name: "messagesent", target: state.eventTarget });

    const response = await fetch("http://localhost:3000", {
        method: "POST",
        body: JSON.stringify({
            functionName: "completeConversation",
            args: [
                state.data.conversation,
            ],
        }),
    });
    const { message: aiMessage } = await response.json();

    state.data.conversation.messages = [
        ...state.data.conversation.messages,
        aiMessage,
    ];

    dispatchEvent({ name: "messagereceived", target: state.eventTarget });
    saveApplicationState({ state });
}

/**
 * @param {{
*   text: string;
*   state: ApplicationState;
* }} args
*/
export async function sendTextToAI (args) {
    const {
        text,
        state,
    } = args;

    const { message } = createUserMessage({ text });

    return sendMessageToAI({ message, state });
}
