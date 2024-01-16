const HTTP_STATUS_MAP = new WeakMap();
const FIBONACCI_SEQUENCE = Object.freeze([0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55]);

export function setResponseStatus (args: { object: Record<string, unknown>; status: number; }) {
    const { object, status } = args;

    HTTP_STATUS_MAP.set(object, status);

    return object;
}

export function getResponseStatus (args: { object: unknown; }): { status: number | null } {
    const { object } = args;

    return { status: HTTP_STATUS_MAP.get(object as Record<string, unknown>) ?? null };
}

export function valueToResponse (args: { value: unknown }): { response: Response } {
    const { value } = args;

    if (value?.constructor === Response) {
        return { response: value };
    }

    const { status } = (function () {
        try {
            return { status: getResponseStatus({ object: value }).status || 200 };
        } catch {
            return { status: 200 };
        }
    })();
    const body = JSON.stringify(value);

    return { response: new Response(body, { status }) };
}

export async function fetchWithResilience (args: {
    fetchFn?: FetchFunction;
    input: RequestInfo | URL;
    init?: RequestInit;
    maxTries?: number;
    waitDuration?: number;
}): Promise<{ response: Response }> {
    const {
        fetchFn,
        input,
        init,
        maxTries,
        waitDuration,
    } = {
        fetchFn: globalThis.fetch,
        init: {},
        maxTries: 20,
        waitDuration: 500,
        ...args,
    };

    const initWithFollowRedirect: RequestInit = {
        ...init,
        redirect: "follow",
    };

    return await (
        async function fetchWithBackoff (args?: {
            fibonacciIndex?: number;
            numAttempts: number;
        }): Promise<{ response: Response; }> {
            const {
                fibonacciIndex,
                numAttempts,
            } = {
                fibonacciIndex: 0,
                numAttempts: maxTries,
                ...(args ?? {}),
            };

            try {
                const response = await fetchFn(input, initWithFollowRedirect);
                const retryAfter = parseInt(`${response.headers.get('Retry-After')}`, 10);
                const serverDemandsRetryLater = !Number.isNaN(retryAfter);

                if (serverDemandsRetryLater) {
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            
                    return await fetchWithBackoff({ numAttempts: numAttempts - 1, fibonacciIndex: fibonacciIndex + 1 });
                } else if (
                    // otherwise successful responses
                    /^2\d\d$/.test(String(response.status)) ||
                    // 4xx responses that don't include request timeout or gone
                    (/^4\d\d$/.test(String(response.status)) && response.status !== 408 && response.status !== 410)
                ) {
                    return { response };
                } else if (numAttempts > 0) {
                    await new Promise(resolve => setTimeout(resolve, FIBONACCI_SEQUENCE[fibonacciIndex] * waitDuration));
        
                    return await fetchWithBackoff({ numAttempts: numAttempts - 1, fibonacciIndex: fibonacciIndex + 1 });
                } else {
                    throw new Error(`Request failed with status code: ${response.status}`);
                }
            } catch (error) {
                if (numAttempts > 0) {
                    // Wait and retry
                    await new Promise(resolve => setTimeout(resolve, FIBONACCI_SEQUENCE[fibonacciIndex] * waitDuration));
        
                    return await fetchWithBackoff({ numAttempts: numAttempts - 1, fibonacciIndex: fibonacciIndex + 1 });
                } else {
                    throw error;
                }
            }
        }
    )();
}

export function sanitizeHref (args: {
    href: string | null;
}): {
    href: string | null;
 } {
    const { href } = args;

    let url;

    if (!href) {
        return {
            href: null,
        };
    }

    try {
        url = new URL(href);
    } catch {
        return {
            href: null,
        };
    }

    // Remove these things because they cause
    // unnecessary repetition in some cases.
    if (url.hostname === "support.soxhub.com" && url.pathname === "/hc/en-us/related/click") {
        const data = url.searchParams.get('data');

        url.search = '';
        url.hash = '';
        
        if (data) {
            url.searchParams.set("data", data);
        }
    } else {
        url.search = '';
        url.hash = '';
    }

    return {
        href: url.toString(),
    };
}
