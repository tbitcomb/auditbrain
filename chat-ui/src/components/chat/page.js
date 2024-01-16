import { parseHTML } from "../../lib/dom.js";
import { getStateFrom } from "../../lib/runtime.js";

const template = /*html*/`
    <style>
        #container {
            display: grid;
            grid-template-rows: auto 1fr auto;
            height: 100%;
            width: 100%;
        }
    </style>

    <div id="container">
        <auditbrain-chat-header id="header"></auditbrain-chat-header>
        <auditbrain-chat-body id="body"></auditbrain-chat-body>
        <auditbrain-chat-footer id="footer"></auditbrain-chat-footer>
    </div>
`;

export class AuditBrainChatPageComponent extends HTMLElement {
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
