import { parseHTML } from "../../lib/dom.js";
import { getStateFrom } from "../../lib/runtime.js";

const template = /*html*/`
    <style>
        #message {
            --animation-delay: 2.5s;
            background: var(--luna\\\\gray200);
            border-radius: 0.3rem;
            box-sizing: border-box;
            color: var(--luna\\\\gray900);
            float: left;
            font: var(--luna\\\\font200);
            font-family: var(--luna\\\\fontFamily);
            max-width: 75%;
            padding: 0.5rem;
        }

        #message[data-type="user"] {
            background: var(--luna\\\\blue500);
            color: var(--luna\\\\white);
            float: right;
        }

        #message[data-type="ai"] #text {
            animation-iteration-count: 1;
            animation-delay: var(--animation-delay);
        }

        #message[data-type="ai"] #typing {
            animation-iteration-count: 1;
            animation-delay: var(--animation-delay);
        }

        #typing {
            animation: disappear 0s infinite;
            animation-fill-mode: both;
            animation-iteration-count: 1;
        }

        #text {
            animation: disappear 0s infinite;
            animation-direction: reverse;
            animation-fill-mode: both;
            animation-iteration-count: 1;
            word-wrap: break-word;
        }

        @keyframes disappear {
            0% {
                display: block;
            }
            100% {
                display: none;
            }
        }
    </style>
`;

export class AuditBrainChatMessageComponent extends HTMLElement {
    constructor () {
        super();
    }

    connectedCallback () {
        const element = this;
        const { state } = getStateFrom({ element });

        if (!state) {
            throw Error("state not found");
        }

        const shadow = element.attachShadow({ mode: "closed" });
        const messageId = element.getAttribute("data-id");

        if (!messageId) {
            throw Error("message element is missing an ID");
        }

        /** @type {ConversationMessage | undefined} */
        const message = state.data.conversation.messages.find(/** @param {ConversationMessage} m */ function (m) { return m.id && m.id === messageId });

        if (!message) {
            throw Error(`message not found for ID '${messageId}'`);
        }

        const type = message.role || "ai";
        const html = /*html*/`
            ${template}

            <div id="message" data-id="${message.id}" data-type="${type}">
                <auditbrain-chat-typing id="typing"></auditbrain-chat-typing>
                <span id="text">${message.text}</span>
            </div>
        `;
        const { documentFragment } = parseHTML({
            document: shadow.ownerDocument,
            html,
            state,
        });

        shadow.append(documentFragment);
    }
}
