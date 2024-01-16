import { parseHTML } from "../../lib/dom.js";
import { getStateFrom } from "../../lib/runtime.js";

const template = /*html*/`
    <style>
        #container {
            background: var(--luna\\\\blue600);
            color: var(--luna\\\\white);
            display: flex;
            font: var(--luna\\\\font400);
            padding-left: 1rem;
            padding-right: 1rem;
        }
    </style>

    <div id="container">
        <h2>AuditBrain</h2>
    </div>
`;

export class AuditBrainChatHeaderComponent extends HTMLElement {
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
