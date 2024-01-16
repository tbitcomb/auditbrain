import { isClass, setStateFor } from "./runtime.js";

/**
 * Given an HTML string, parses it into a DocumentFragment
 * and (optionally) sets the given application state on all
 * of the elements in the tree.
 * 
 * @param {{ document: Document; html: string; state?: ApplicationState | null; }} args
 * @returns {{ documentFragment: DocumentFragment; }}
 */
export function parseHTML (args) {
    const {
        document,
        html,
        state,
    } = args;

    const div = document.createElement("div");

    div.insertAdjacentHTML("beforeend", html);

    const childNodes = Array.from(div.childNodes);
    const documentFragment = new DocumentFragment();

    documentFragment.append(...childNodes);

    (/** @param {{ nodes: Array<HTMLElement|Node>; index?: number; }} args */ function setStateOnChildren (args) {
        const {
            index,
            nodes,
        } = {
            index: 0,
            ...(args ?? {}),
        };

        if (index >= nodes.length) {
            return;
        }

        const currentNode = nodes[index];
        const isElement = currentNode?.nodeType === 1;

        if (isElement) {
            if (state) {
                setStateFor({
                    element: /** @type {HTMLElement} */(currentNode),
                    state,
                });
            }

            setStateOnChildren({
                index: 0,
                nodes: Array.from(currentNode.childNodes),
            });
        }

        setStateOnChildren({
            nodes,
            index: index + 1,
        });
    })({ nodes: childNodes });

    return { documentFragment };
}

/**
 * @param {{ pathname: string; customElementRegistry: CustomElementRegistry }} args
 */
export async function registerCustomElement (args) {
    const {
        pathname,
        customElementRegistry,
    } = args;
    const importedModule = await import(pathname);
    const {
        tagName,
        default: _default,
    } = importedModule;
    const { customElementClass } = (
        /**
         * @param {{ index?: number; }} args 
         * @returns {{ customElementClass: HTMLElement | null }}
         */ 
        function findCustomElementClass (args) {
            if (_default) {
                return {
                    customElementClass: _default,
                }
            }

            const {
                index,
            } = {
                index: 0,
                ...args,
            };
            const props = Object.values(importedModule);

            if (index >= props.length) {
                return {
                    customElementClass: null,
                };
            }

            const prop = props[index];
            
            if (!isClass({ maybeClass: prop })) {
                return findCustomElementClass({
                    index: index + 1,
                });
            }

            return {
                customElementClass: prop,
            };
        }
    )();

    if (typeof customElementClass !== "function") {
        throw new Error(`custom element class for '${tagName}' not found`);
    }

    customElementRegistry.define(tagName, customElementClass);
}
