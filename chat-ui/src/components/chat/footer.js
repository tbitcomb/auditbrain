import { parseHTML } from "../../lib/dom.js";
import { getStateFrom } from "../../lib/runtime.js";
import { simulateAIMessageReceived, simulateUserMessageReceived } from "../../lib/debug.js";
import { sendTextToAI } from "../../lib/conversation.js";

const template = /*html*/`
    <style>
        #container {
            --padding: 0.3125rem;
            border-top: 1px solid var(--luna\\\\gray200);
            display: grid;
            grid-template-columns: 1fr auto;
            padding-bottom: var(--padding);
            padding-top: var(--padding);
            width: 100%;
        }

        #send {
            --size: 24px;
            align-self: center;
            background: none;
            border: none;
            margin-left: var(--padding);
            margin-right: var(--padding);
            padding: 0;
        }

        #send, #send-icon {
            height: var(--size);
            width: var(--size);
        }

        #send-icon {
            fill: var(--luna\\\\gray500);
        }

        #textarea {
            border: none;
            font: var(--luna\\\\font200);
            margin-left: var(--padding);
            margin-right: var(--padding);
            resize: none;
        }
    </style>

    <form id="container" method="POST">
        <textarea id="textarea" minlength="5"></textarea>

        <button id="send">
            <svg
                id="send-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 -960 960 960"
            >
                <path d="M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v140l240 60-240 60v140Zm0 0v-400 400Z"/>
            </svg>
        </button>
    </form>
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

        // const sendButton = /** @type {HTMLButtonElement} */ (shadow.getElementById("send"));
        const textarea = /** @type {HTMLTextAreaElement} */ (shadow.getElementById("textarea"));
        const container = /** @type {HTMLFormElement} */ (shadow.getElementById("container"));

        container?.addEventListener("submit", function (event) {
            event.preventDefault();

            const text = textarea.value;

            if (!text) { 
                return;
            }

            textarea.value = "";

            sendTextToAI({
                text,
                state,
            });

            return false;
        });

        // sendButton?.addEventListener("click", function () {
        //     const text = textarea.value;

        //     if (!text) { 
        //         return;
        //     }

        //     textarea.value = "";

        //     sendTextToAI({
        //         text,
        //         state,
        //     });
        // });
    }
}
