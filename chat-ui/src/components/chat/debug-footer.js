import { parseHTML } from "../../lib/dom.js";
import { getStateFrom } from "../../lib/runtime.js";
import { simulateAIMessageReceived, simulateUserMessageReceived } from "../../lib/debug.js";

const template = /*html*/`
    <button id="ai-message-button">Add AI Message</button>
    <button id="user-message-button">Add User Message</button>
`;

export class AuditBrainChatFooterComponent extends HTMLElement {
    constructor () {
        super();
    }

    connectedCallback () {
        const element = this;
        const { state } = getStateFrom({ element });

        if (!state) {
            throw new Error("State not found");
        }

        const shadow = element.attachShadow({ mode: "closed" });
        const { documentFragment } = parseHTML({
            document: shadow.ownerDocument,
            html: template,
            state,
        });

        shadow.append(documentFragment);

        const aiMessageButton = shadow.getElementById("ai-message-button");

        aiMessageButton?.addEventListener("click", function () {
            simulateAIMessageReceived({
                text: "Hello!  How may I help you?",
                state,
            });
        });

        const userMessageButton = shadow.getElementById("user-message-button");

        userMessageButton?.addEventListener("click", function () {
            simulateUserMessageReceived({
                text: "I have a problem.",
                state,
            });
        });
    }
}
