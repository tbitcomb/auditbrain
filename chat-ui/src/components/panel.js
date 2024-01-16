// import { parseHTML } from "../lib/dom.js";
import { dispatchEvent, getStateFrom } from "../lib/runtime.js";

// const template = /*html*/`
//     <h2>I'm A Teapot</h2>
// `;

// export const tagName = `auditbrain-chat-panel`;

export class AuditBrainChatPanelComponent extends HTMLElement {
    constructor () {
        super();
    }

    connectedCallback () {
        const panel = this;
        const { state } = getStateFrom({ element: panel });

        if (!state) {
            return;
        }

        state.eventTarget.addEventListener("activatepanelintent", function () {
            if (!panel) {
                return;
            }

            console.log('did receive activate panel intent');

            panel.setAttribute("data-is-active", "true");

            dispatchEvent({
                name: "panelactivated",
                target: state.eventTarget,
            });

            window.requestAnimationFrame(function () {
                panel.setAttribute("data-is-visible", "true");

                dispatchEvent({
                    name: "panelvisible",
                    target: state.eventTarget,
                });
            });
        });

        state.eventTarget.addEventListener("deactivatepanelintent", function () {
            if (!panel) {
                return;
            }

            panel.removeAttribute("data-is-visible");

            dispatchEvent({
                name: "panelinvisible",
                target: state.eventTarget,
            });
        });

        panel.addEventListener("transitionend", function () {
            const { state } = getStateFrom({ element: panel });

            if (!state) {
                return;
            }

            if (!state.data.isPanelActive) {
                panel.removeAttribute("data-is-active");

                dispatchEvent({
                    name: "paneldeactivated",
                    target: state.eventTarget,
                });
            }
        });
    }
}
