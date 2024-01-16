import {
    createApplicationState,
    dispatchEvent,
    recoverApplicationState,
    setStateFor,
} from "../lib/runtime.js";
import { parseHTML } from "../lib/dom.js";

const template = /*html*/`
    <style>
        #panel {
            background: var(--luna\\\\white);
            border-radius: 1rem;
            box-shadow: var(--luna\\\\shadow400);
            display: none;
            opacity: 0;
            height: 100vh;
            overflow: hidden;
            max-height: 34.375rem;
            position: absolute;
            transition: opacity 0.15s linear;
            transform: translate(-100%, -100%);
            /* width: 18.75rem; */
            width: 400px;
        }

        #panel[data-is-active="true"] {
            display: block;
        }

        #panel[data-is-visible="true"] {
            opacity: 1;
        }

        #pages {
            display: flex;
            height: 100%;
            position: absolute;
            transform: translateX(0%);
            transition: transform 0.5s ease-in-out;
            width: 100%;
        }

        #pages[data-active-page="chat"] {
            transform: translateX(-100%);
        }

        .page {
            flex-shrink: 0;
            height: 100%;
            width: 100%;
        }

        #fab {
            float: right;
        }
    </style>

    <div id="wrapper">
        <auditbrain-chat-panel id="panel">
            <div id="pages">
                <auditbrain-chat-home id="home" class="page"></auditbrain-chat-home>
                <auditbrain-chat-page id="chat" class="page"></auditbrain-chat-page>
            </div>
        </auditbrain-chat-panel>
        <auditbrain-chat-fab id="fab"></auditbrain-chat-fab>
    </div>
`;

export class AuditBrainChatUIComponent extends HTMLElement {
    constructor () {
        super();
    }

    connectedCallback () {
        const chatUIElement = this;
        const { state } = (function () {
            const { state: recoveredState } = recoverApplicationState();

            if (recoveredState) {
                return { state: recoveredState };
            }

            return createApplicationState();
        })();

        setStateFor({
            element: chatUIElement,
            state,
        });

        chatUIElement.style.setProperty('position', 'fixed');
        chatUIElement.style.setProperty('right', '1rem');
        chatUIElement.style.setProperty('bottom', '1rem');

        const shadow = chatUIElement.attachShadow({ mode: "closed" });

        shadow.append(
            parseHTML({
                document: shadow.ownerDocument,
                html: template,
                state,
            }).documentFragment,
        );

        const pages = /** @type {HTMLDivElement} */ shadow.getElementById("pages");

        state.eventTarget.addEventListener("navigatepageintent", function (event) {
            pages?.setAttribute("data-active-page", state.data.activePageName);

            dispatchEvent({
                name: "pagenavigated",
                target: state.eventTarget,
            });
        });
    }
}
