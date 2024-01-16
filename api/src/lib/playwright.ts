import { Browser, BrowserServer, Page, chromium } from "playwright";
import { fetchWithResilience } from "./http.ts";
import type { PageFunction } from "/Users/tbitcomb/Library/Caches/deno/npm/registry.npmjs.org/playwright-core/1.35.1/types/structs.d.ts";

/**
 * Implements compatibililty with Deno.
 */
export async function launchServer (): Promise<{
    browser: Browser;
    browserServer: BrowserServer;
    port: number;
}> {
    const port = getRandomPortNum();
    const browserServer: BrowserServer = await chromium.launchServer({
        useWebSocket: true,
        args: [`--remote-debugging-port=${port}`],
        executablePath: "/usr/bin/chromium",
        ignoreDefaultArgs: ["--remote-debugging-pipe", "--remote-debugging-port=0"],
        headless: true,
    });
    const browser: Browser = await tryWithBackoff({
        fn: () => chromium.connectOverCDP(`http://localhost:${port}`)
    });

    return {
        browser,
        browserServer,
        port,
    };
}

export async function evaluate (args: {
    fnOrCode: (() => unknown) | string;
    page: Page;
}): Promise<{
    error?: { message: string; };
    result?: unknown;
}> {
    const {
        fnOrCode,
        page,
    } = args;

    try {
        const fn = (
            typeof fnOrCode === "string"
                ? (new Function(`
                    return (async function () {
                        ${fnOrCode}
                    })(...arguments);
                `))
                : fnOrCode
        ) as PageFunction<unknown, unknown>;

        return {
            result: await page.evaluate(fn),
        };
    } catch (error) {
        return {
            error: {
                message: error?.toString(),
            },
        };
    }
}

/**
 * Hijacks the fetchWithResilience function to add some robustness
 * to Playwrights goto method.
 */
export async function resilientGoto (args: {
    input: string;
    maxTries?: number;
    page: Page,
    referer?: string | undefined;
    timeout?: number | undefined;
    waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit" | undefined;
}): Promise<{ error?: OpenAIError; response?: Response; }> {
    const {
        input,
        maxTries,
        page,
        referer,
        timeout,
        waitUntil,
    } = {
        // waitUntil: "networkidle" as ("load" | "domcontentloaded" | "networkidle" | "commit" | undefined),
        ...args,
    };

    try {
        return await fetchWithResilience({
            fetchFn: async function () {
                try {
                    const pageResponse = await page.goto(input, {
                        referer,
                        timeout,
                        waitUntil: waitUntil,
                    });
    
                    return new Response((await pageResponse?.text()) ?? "", {
                        headers: new Headers(await pageResponse?.headers() ?? {}),
                        status: pageResponse?.status() || 500,
                    });
                } catch (error) {
                    console.log(`hit exception when requesting '${input}'`);
                    console.error(error);
    
                    return new Response(error?.message ?? "", { status: 500 });
                }
            },
            input,
            maxTries,
        });
    } catch (error) {
        await new Promise(function (resolve) {
            setTimeout(resolve, 5000);
        });

        return {
            error: {
                message: error?.message,
            },
        };
    }
}

type PlaywrightCookie = {
    name: string;
    value: string;
    domain: string;                        
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
};

export function getPlaywrightCookiesFromString (args: {
    cookieString: string;
    domain: string;
}): {
    playwrightCookies: PlaywrightCookie[];
} {
    const {
        cookieString,
        domain,
    } = args;

    return {
        playwrightCookies: cookieString
            .split("; ")
            .reduce(function (cookies: PlaywrightCookie[], pair: string) {
                const [name, value] = pair.split(/=(.*)/s);

                return [
                    ...cookies,
                    {
                        name,
                        value,
                        domain,                   
                        httpOnly: true,
                        secure: true,
                        sameSite: "None",
                    },
                ];
            }, [])
    };
}

/**
 * This is finds a random port number that is not being used by something else.
 **/
function getRandomPortNum (): number {
    const MIN_PORT_NUM = 1024;
    const MAX_PORT_NUM = 65535;
    const portNum = Math.ceil(Math.random() * ((MAX_PORT_NUM - 1) - MIN_PORT_NUM + 1) + MIN_PORT_NUM + 1);

    try {
        const server = Deno.listen({ port: portNum });

        server.close();

        return portNum;
    } catch (e) {
        if (e.name !== 'AddrInUse') throw e;

        return getRandomPortNum();
    }
}

/**
 * Tries to execute a function and retries (with backoff and timeout) if an error occurs.
 **/
async function tryWithBackoff (args: {
    fn: () => any;
    delay?: number;
    timeout?: number;
    startedAt?: number;
    error?: Error;
}): Promise<any> {
    const { fn, delay, timeout, startedAt, error } = {
        delay: 0,
        timeout: 30000,
        startedAt: Date.now(),
        ...args,
    };

    await new Promise(resolve => setTimeout(resolve, delay));

    if ((Date.now() - startedAt) > timeout) {
        throw (error || new Error('Function call timed out'));
    }

    try {
        return await fn();
    } catch (error) {
        console.error(error);
        return tryWithBackoff({
        fn,
        delay: delay + 1000,
        timeout,
        startedAt,
        error,
        });
    }
}
