import { parseHTML } from "../../lib/dom.js";
import { getStateFrom } from "../../lib/runtime.js";

const template = /*html*/`
    <style>
        #messages {
            overflow-x: hidden;
            overflow-y: scroll;
            padding: 1rem;
        }

        .message {
            display: block;
            float: left;
            margin-bottom: 0.5rem;
            width: 100%;
        }
    </style>

    <div id="messages">

    </div>
`;

/**
 * @param {{ state: ApplicationState; target: HTMLElement;  }} args 
 */
function renderMessages(args) {
    const {
        state,
        target,
    } = args;
    const messages = Array.from(state.data.conversation.messages);
    const messageElements = Array.from(target.getElementsByClassName("message"));

    (
        /** @param {{ index?: number; }} args */
        function iterateMessages (args) {
            const {
                index,
            } = {
                index: 0,
                ...(args || {}),
            }
            const message = messages[index];

            if (!message) {
                return;
            }

            const messageElement = messageElements.find(function (element) {
                return element.getAttribute("data-id") === message.id
            });

            if (!messageElement) {
                const type = message.role ?? "ai";
                const { documentFragment } = parseHTML({
                    document: target.ownerDocument,
                    html: /*html*/`
                        <auditbrain-chat-message
                            class="message"
                            data-id="${message.id}"
                            data-type="${type}"
                        ></auditbrain-chat-message>
                    `,
                    state,
                });
                const [ newMessageElement ] = documentFragment.children;

                target.append(newMessageElement);
            }

            iterateMessages({
                index: index + 1,
            });
        }
    )();
}

export class AuditBrainChatBodyComponent extends HTMLElement {
    constructor () {
        super();
    }

    connectedCallback () {
        const element = this;

        element.style.overflowY = "scroll";

        const { state } = getStateFrom({ element });

        if (!state) {
            throw new Error("state not found");
        }

        const shadow = element.attachShadow({ mode: "closed" });
        const { documentFragment } = parseHTML({
            document: shadow.ownerDocument,
            html: template,
            state,
        });

        shadow.append(documentFragment);

        const messages = shadow.getElementById("messages");

        if (!messages) {
            throw new Error("messages element not found");
        }

        renderMessages({
            state,
            target: messages,
        });

        const messageReceivedCallback = function () {
            const isAtScrollBottom = (element.scrollTop + element.clientHeight) >= element.scrollHeight;

            renderMessages({
                state,
                target: messages,
            });

            if (isAtScrollBottom) {
                element.scrollTop = element.scrollHeight;
            }
        };

        state.eventTarget.addEventListener("messagereceived", messageReceivedCallback);

        element.disconnectedCallback = function () {
            state.eventTarget.addEventListener("messagereceived", messageReceivedCallback);
        };
    }
}
