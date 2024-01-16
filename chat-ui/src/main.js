import { AuditBrainChatUIComponent } from "./components/chat-ui.js";
import { AuditBrainChatPanelComponent } from "./components/panel.js";
import { AuditBrainChatHomePageComponent } from "./components/home/page.js";
import { AuditBrainChatPageComponent } from "./components/chat/page.js";
import { AuditBrainChatFABComponent } from "./components/floating-action-button.js";
import { AuditBrainChatHeaderComponent } from "./components/chat/header.js";
import { AuditBrainChatBodyComponent } from "./components/chat/body.js";
import { AuditBrainChatMessageComponent } from "./components/chat/message.js";
import { AuditBrainChatTypingComponent } from "./components/chat/typing.js";
import { AuditBrainChatFooterComponent } from "./components/chat/footer.js";

// import { registerCustomElement } from "./lib/dom.js";

/**
 * 
 * @param {{ customElements: CustomElementRegistry, document: Document }} args 
 * @returns {{ element: AuditBrainChatUIComponent }}
 */
export function insertChatComponent (args) {
    const {
        customElements: customElementRegistry,
        document,
    } = args;

    // registerCustomElement({ customElementRegistry, pathname: "/src/components/chat-ui.js" });
    // registerCustomElement({ customElementRegistry, pathname: "/src/components/panel.js" });
    // registerCustomElement({ customElementRegistry, pathname: "/src/components/home/page.js" });
    // registerCustomElement({ customElementRegistry, pathname: "/src/components/chat/page.js" });
    // registerCustomElement({ customElementRegistry, pathname: "/src/components/chat/floating-action-button.js" });
    // registerCustomElement({ customElementRegistry, pathname: "/src/components/chat/header.js" });
    // registerCustomElement({ customElementRegistry, pathname: "/src/components/chat/body.js" });
    // registerCustomElement({ customElementRegistry, pathname: "/src/components/chat/message.js" });
    // registerCustomElement({ customElementRegistry, pathname: "/src/components/chat/footer.js" });

    customElementRegistry.define("auditbrain-chat", AuditBrainChatUIComponent);
    customElementRegistry.define("auditbrain-chat-panel", AuditBrainChatPanelComponent);
    customElementRegistry.define("auditbrain-chat-home", AuditBrainChatHomePageComponent);
    customElementRegistry.define("auditbrain-chat-page", AuditBrainChatPageComponent);
    customElementRegistry.define("auditbrain-chat-fab", AuditBrainChatFABComponent);
    customElementRegistry.define("auditbrain-chat-header", AuditBrainChatHeaderComponent);
    customElementRegistry.define("auditbrain-chat-body", AuditBrainChatBodyComponent);
    customElementRegistry.define("auditbrain-chat-message", AuditBrainChatMessageComponent);
    customElementRegistry.define("auditbrain-chat-footer", AuditBrainChatFooterComponent);
    customElementRegistry.define("auditbrain-chat-typing", AuditBrainChatTypingComponent);

    const element = /** @type {AuditBrainChatUIComponent} */ (document.createElement("auditbrain-chat"));
    
    document.body.insertAdjacentElement("beforeend", element);
    
    return { element };
}
