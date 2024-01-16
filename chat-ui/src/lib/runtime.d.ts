type ApplicationState = {
    eventTarget: EventTarget;
    data: {
        conversation: ConversationData;
        isPanelActive: boolean;
        activePageName: PanelPageName;
    };
}

type PanelPageName = "home" | "chat";
