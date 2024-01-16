import { insertChatComponent } from "../src/main.js";

const { element } = insertChatComponent({
    customElements: window.customElements,
    document,
});
