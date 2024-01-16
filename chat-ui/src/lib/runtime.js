/**
 * This module contains shared behavior specific to application
 * state and behavior that doesn't necessarily drive the DOM. 
 */

const OWNER_MAP = new WeakMap();

/**
 * @returns {{ state: ApplicationState }}
 */
export function createApplicationState () {
    return {
        state: {
            data: {
                conversation: {
                    messages: []
                },
                isPanelActive: false,
                activePageName: "home",
            },
            eventTarget: new EventTarget(),
        },
    };
};

/**
 * @param {{ state: ApplicationState }} args
 */
export function saveApplicationState (args) {
    const { state } = args;
    const json = JSON.stringify(state);

    localStorage.setItem("auditbrain-state", json);
}

/**
 * @returns {{ state: ApplicationState | null }}
 */
export function recoverApplicationState () {
    const json = localStorage.getItem("auditbrain-state") ?? "";

    try {
        const state = /** @type {ApplicationState | null} */(JSON.parse(json) ?? null);

        if (state && typeof state === "object") {
            state.eventTarget = new EventTarget();
            state.data.isPanelActive = false;
            state.data.conversation.messages = (state.data.conversation.messages ?? []).filter(Boolean);

            return { state };
        } 
    } catch {
        // no-op
    }

    return { state: null };
}

/**
 * 
 * @param {{ element: HTMLElement, state: ApplicationState }} args 
 */
export function setStateFor (args) {
    const {
        element,
        state,
    } = args;

    OWNER_MAP.set(element, state);
}

/**
 * 
 * @param {{ element: HTMLElement }} args
 * @returns {{ state: ApplicationState | null; }} 
 */
export function getStateFrom (args) {
    const {
        element,
    } = args;

    return {
        state: OWNER_MAP.get(element) ?? null,
    }
}

/**
 * @param {{ state: ApplicationState; }} args 
 */
export function activatePanel (args) {
    const {
        state,
    } = args;

    state.data.isPanelActive = true;

    dispatchEvent({
        name: "activatepanelintent",
        target: state.eventTarget,
    });
}

/**
 * @param {{ state: ApplicationState; }} args 
 */
export function deactivatePanel (args) {
    const {
        state,
    } = args;

    state.data.isPanelActive = false;

    dispatchEvent({
        name: "deactivatepanelintent",
        target: state.eventTarget,
    });
}

/**
 * @param {{ pageName: PanelPageName; state: ApplicationState; }} args 
 */
export function navigateToPage (args) {
    const {
        pageName,
        state,
    } = args;

    state.data.activePageName = pageName;

    dispatchEvent({
        init: {
            detail: {
                pageName,
            },
        },
        name: "navigatepageintent",
        target: state.eventTarget,
    });
}

/** @param {{ name: string; init?: CustomEventInit; target: EventTarget; }} args */
export function dispatchEvent (args) {
    const {
        name,
        init,
        target,
    } = {
        init: {},
        ...args,
    };

    const event = new CustomEvent(name, init);

    target.dispatchEvent(event);

    console.log(event);
}

/**
 * @param {{ maybeClass: unknown; }} args 
 * @returns {boolean}
 */
export function isClass (args) {
    const { 
        maybeClass,
    } = args;

    return typeof maybeClass === "function" && Object.getOwnPropertyNames(maybeClass).length === 3;
}
