import { createAIMessage, createUserMessage } from "./conversation.js";
import { dispatchEvent } from "./runtime.js";

/**
 * 
 * @param {{ text: string; state: ApplicationState; }} args
 */
export function simulateAIMessageReceived (args) {
    const {
        state,
        text,
    } = args;

    const { message } = createAIMessage({ text });

    state.data.conversation.messages = [ ...state.data.conversation.messages, message ];

    dispatchEvent({ name: "messagereceived", target: state.eventTarget });
}

/**
 * 
 * @param {{ text: string; state: ApplicationState; }} args
 */
export function simulateUserMessageReceived (args) {
    const {
        state,
        text,
    } = args;

    const { message } = createUserMessage({ text });

    state.data.conversation.messages = [ ...state.data.conversation.messages, message ];

    dispatchEvent({ name: "messagereceived", target: state.eventTarget });
}
