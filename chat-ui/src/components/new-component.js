import { parseHTML } from "../lib/dom.js";
import { getStateFrom } from "../lib/runtime.js";

const template = /*html*/`
    <h2>I'm A Teapot</h2>
`;

export const tagName = `auditbrain-chat-panel`;

export class AuditBrainChatNewComponent extends HTMLElement {
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
