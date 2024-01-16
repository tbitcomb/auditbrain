import { parseHTML } from "../../lib/dom.js";
import { getStateFrom } from "../../lib/runtime.js";

const template = /*html*/`
    <style>
        .typing {
            --dot-width: 7px;
            --dot-color: #3b5998;
            --speed: 1.5s;
            display: inline-flex;
            height: 1em;
            position: relative;
        }

        .dot {
            animation: blink var(--speed) infinite;
            animation-fill-mode: both;
            background: var(--dot-color);
            border-radius: 50%;
            height: var(--dot-width);
            left:0;
            margin-right: 0.25rem;
            top:0;
            width: var(--dot-width);
        }

        .dot:nth-child(2) {
            animation-delay: .2s;
        }
            
        .dot:nth-child(3) {
            animation-delay: .4s;
        }

        @keyframes blink {
            0% {
                opacity: .1;
            }
            20% {
                opacity: 1;
            }
            100% {
                opacity: .1;
            }
        }
    </style>

    <div id="typing" class="typing">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
    </div>
`;

export class AuditBrainChatTypingComponent extends HTMLElement {
    constructor () {
        super();
    }

    connectedCallback () {
        const element = this;
        const { state } = getStateFrom({ element });
        const shadow = element.attachShadow({ mode: "closed" });
        const { documentFragment } = parseHTML({
            document: shadow.ownerDocument,
            html: template,
            state,
        });

        shadow.append(documentFragment);
    }
}
