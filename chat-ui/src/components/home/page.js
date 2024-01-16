import { navigateToPage, getStateFrom } from "../../lib/runtime.js";
import { parseHTML } from "../../lib/dom.js";

const template = /*html*/`
    <style>
        #container {
            background: var(--luna\\\\blue500);
            color: var(--luna\\\\white);
            font: var(--luna\\\\fontFamily);
            height: 100%;
            padding: 1rem;
        }
    </style>

    <div id="container">
        <h2>Have a question?</h2>
        <h3>Ask me anything!</h3>
        <p>My name is AuditBrain.  I am an AI trained to answer any questions you have about AuditBoard.</p>
        <button id="chatnow">Chat Now</button>
    </div>
`;
export class AuditBrainChatHomePageComponent extends HTMLElement {
    constructor () {
        super();
    }

    connectedCallback () {
        const homePageElement = this;
        const shadow = this.attachShadow({ mode: "closed" });
        const { state } = getStateFrom({ element: homePageElement });

        const { documentFragment } = parseHTML({
            document: shadow.ownerDocument,
            html: template,
            state,
        });

        shadow.append(documentFragment);

        const button =  /** @type {HTMLButtonElement} */ (shadow.getElementById("chatnow"));

        button.addEventListener("click", function () {
            const { state } = getStateFrom({ element: homePageElement });

            if (!state) {
                return;
            }

            navigateToPage({
                pageName: "chat",
                state,
            });
        });
    }
}
