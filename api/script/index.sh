#!/usr/bin/env -S docker compose run --rm --use-aliases api deno run --ext ts --allow-env --allow-net --allow-read --allow-write --allow-sys --allow-run --allow-ffi

import {
    evaluate,
    launchServer,
    resilientGoto,
} from "../src/lib/playwright.ts";
import { htmlMarkdown, path } from "../deps.ts";
import type { Browser, BrowserContext, Page } from "/Users/tbitcomb/Library/Caches/deno/npm/registry.npmjs.org/playwright-core/1.35.1/index.d.ts";
import {
    sanitizeHref,
} from "../src/lib/http.ts";
import {
    addArticleToIndex,
    shouldCrawlHref,
    shouldParseArticleForHref,
} from "../src/lib/search-engine.ts";
import {
    askOpenAIModel,
} from "../src/lib/openai.ts";

const KNOWLEDGE_BASE_HOST = "https://support.soxhub.com";
const KNOWLEDGE_BASE_STARTING_URL = `${KNOWLEDGE_BASE_HOST}/hc/en-us/categories/360004421753-Knowledge-Base`;
const ACADEMY_BASE_HOST = "https://academy.auditboard.com";
const ACADEMY_BASE_STARTING_URL = `${ACADEMY_BASE_HOST}/`;
const ACADEMY_SESSION_TOKEN = (Deno.env.get("ACADEMY_SESSION_TOKEN") ?? "").trim() as string;

if (!ACADEMY_SESSION_TOKEN?.length) {
    throw new Error("Token must be set for AuditBoard Academy.");
}

const KNOWLEDGE_BASE_SESSION_TOKEN = (Deno.env.get("KNOWLEDGE_BASE_SESSION_TOKEN") ?? ")").trim();

if (!KNOWLEDGE_BASE_SESSION_TOKEN?.length) {
    throw new Error("Token must be set for AuditBoard Knowledge Base");
}

const WAIT_TIME_BETWEEN_PAGE_NAVIGATIONS = 5000;
const OPENAI_MODEL = "gpt-3.5-turbo-1106";
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || "";
const { pathname: __dirname } = new URL(import.meta.url);
const dataDirPath = path.join(__dirname, "..", "..", "data");
const indexerStatePath = path.join(dataDirPath, "indexer-state.json");
const readabilityCode = await Deno.readTextFile(
    path.join(__dirname, "..", "..", "vendor", "readability", "Readability.js")
) as string;
const isProbablyReaderableCode: string = await Deno.readTextFile(
    path.join(__dirname, "..", "..", "vendor", "readability", "Readability-readerable.js")
) as string;

await Deno.mkdir(dataDirPath, { recursive: true });

type IndexerState = {
    failedHrefs: string[];
    queuedHrefs: string[];
    visitedHrefs: string[];
};

const { indexerState: initialIndexerState } = await (async function recoverIndexerState (): Promise<{ indexerState: IndexerState }> {
    try {
        const json = await Deno.readTextFile(indexerStatePath);
        const indexerState = JSON.parse(json) as IndexerState;

        return { indexerState };
    } catch {
        return {
            indexerState: {
                failedHrefs: [],
                queuedHrefs: [
                    ACADEMY_BASE_STARTING_URL,
                    KNOWLEDGE_BASE_STARTING_URL,
                ],
                visitedHrefs: [],
            },
        };
    }
})();

async function saveIndexerState (args: { indexerState: IndexerState }) {
    const { indexerState } = args;
    const savedState = JSON.stringify(indexerState, null, 2);

    await Deno.writeTextFile(indexerStatePath, savedState);
}

await (async function performIndexing (args: {
    browser?: Browser;
    context?: BrowserContext;
    indexerState: IndexerState;
}): Promise<void> {
    const {
        indexerState,
    } = {
        ...args,
    };
    const [ currentHref ] = indexerState.queuedHrefs.slice(-1);

    if (!currentHref) {
        console.log("done!")

        return;
    }

    const browser: Browser = args.browser ?? (await launchServer()).browser;
    const context: BrowserContext = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
    });

    await context.addCookies([
        {
            domain: "support.soxhub.com",
            httpOnly: true,
            name: "_zendesk_shared_session",
            path: "/",
            secure: true,
            expires: 1705387600,
            value: KNOWLEDGE_BASE_SESSION_TOKEN,
        },
        {
            domain: "academy.auditboard.com",
            httpOnly: true,
            name: "sj_sessionid",
            path: "/",
            sameSite: "Lax",
            secure: true,
            value: ACADEMY_SESSION_TOKEN,
        },
    ]);

    console.log(`launching new page for '${currentHref}'`);

    const page: Page = await context.newPage();
    const { state: newIndexerState } = await (async function (): Promise<{ state: IndexerState }> {
        try {
            const {
                error: pageResponseError,
                response: pageResponse,
            } = await (async function (): Promise<{
                error?: OpenAIError;
                response?: Response;
            }> {
                console.log(`navigating to '${currentHref}'`);

                const {
                    error: initialResponseError,
                    response: initialResponse,
                } = await resilientGoto({
                    input: currentHref,
                    page,
                });

                if (initialResponseError) {
                    console.log(`error returned when navigating to '${currentHref}'`);

                    return {
                        error: initialResponseError,
                    };
                }

                console.log(`checking if we need to click a registration button for '${currentHref}'`);

                const registerFreeButtonHref = await evaluate({
                    fnOrCode: function () {
                        const button = document.querySelector("a#purchase-button") as HTMLAnchorElement | null;
        
                        return button?.href ?? null;
                    },
                    page,
                }) as { result: string | null; };

                if (typeof registerFreeButtonHref === "string") {
                    console.log(`attempting to click registration button for '${currentHref}'`);

                    return await resilientGoto({
                        input: registerFreeButtonHref,
                        page,
                    });
                }

                return {
                    response: initialResponse,
                };
            })();

            if (pageResponseError || !pageResponse?.ok) {
                if (pageResponse) {
                    console.log(`server responded with ${pageResponse.status} code for '${currentHref}'`);
                }

                return updateIndexerState({
                    hrefsFailed: [ currentHref ],
                    state: indexerState,
                });
            }

            const resolvedHref = await page.url();

            console.log(`page url resolved to '${resolvedHref}' for '${currentHref}'`);

            const { error, article } = await (async function (): Promise<{
                error?: OpenAIError;
                article?: IndexableArticle | null;
            }> {
                console.log(`checking for video on page '${resolvedHref}'`);
                // Check first to see if the page contains video captions.
                // If it does, then pass that stuff to the AI instead of
                // trying to extract an article from the page data.
                const { result: videoCaptions } = (await evaluate({
                    fnOrCode: async function () {
                        const videoSrc = ((window.document as Document).querySelector("iframe.wistia_embed") as HTMLIFrameElement)?.src;

                        if (!videoSrc?.length) {
                            return;
                        }

                        const videoUrl = new URL(videoSrc);
                        const [ videoId ] = (videoUrl.pathname.match(/\/embed\/iframe\/(.+)/) ?? []).slice(-1);

                        if (!videoId?.length) {
                            return;
                        }

                        const captionsResponse = await fetch(`https://fast.wistia.net/embed/captions/${videoId}.vtt`);

                        if (captionsResponse.ok) {
                            return await captionsResponse.text();
                        }
                    },
                    page,
                })) as { error: { message: string; }; result: string; };

                if (videoCaptions?.length) {
                    console.log(`video captions found for '${resolvedHref}'`);

                    const title = await page.title();
                    const { result: siteName } = await evaluate({
                        fnOrCode: function () {
                            const meta: HTMLMetaElement | null =
                                document.querySelector('meta[name="global-title"]') ??
                                document.querySelector('meta[property="og:title"');

                            if (!meta) {
                                return "AuditBoard";
                            }

                            return meta.content?.trim() ?? "AuditBoard";
                        },
                        page,
                    }) as { result: string; };

                    console.log(`sending captions to OpenAI for '${resolvedHref}'`);

                    const { error, json } = await askOpenAIModel({
                        apiKey: OPENAI_API_KEY,
                        fetchFn: globalThis.fetch,
                        modelName: OPENAI_MODEL,
                        responseFormat: "json_object",
                        text: [
                            "You are being given VTT closed captions for a training video instructing a customer on an aspect of the AuditBoard auditing, risk, and compliance platform.",
                            `The title of the video is called "${title}".`,
                            "Your job is to provide a JSON object that contains the following information extracted from the captions:",
                            "\n",
                            "- title",
                            "- content",
                            "- excerpt",
                            "- href",
                            "- keywords",
                            "- questions",
                            "- siteName",
                            "- summary",
                            "\n",
                            "The content key of the JSON object should have a value containing the plain text extracted from the captions.",
                            "The excerpt should be a sentence taken from the captions.",
                            "The keywords should be an array of keywords you've extracted from the content of the captions.  These will be used in order to help users search for this article.",
                            "The title should be the title of the video.",
                            `The href value should be this: "${resolvedHref}"`,
                            `The siteName value should be this: "${siteName}"`,
                            "The value of the summary key should be a string that is a summary of the video.  I want you to write this summary.  It should be at least 1 sentence and be no more than a single paragraph long.",
                            "The value of the questions key should be an array.  Please fill this array with questions from the perspective of the viewer that this video answers.  Come up with as many questions as you can.  Each question should be a string that gets added to this array.",
                            "\n",
                            "Here are the captions:",
                            "\n",
                            "```",
                            videoCaptions,
                            "```"
                        ].join("\n")
                    });

                    if (error) {
                        console.log(`encountered error when sending captions to OpenAI for '${resolvedHref}'`);

                        return {
                            error,
                        };
                    }

                    if (!json) {
                        console.log(`OpenAI returned no result for captions of '${resolvedHref}'`);

                        return {
                            error: {
                                message: "OpenAI failed to respond with JSON.",
                            },
                        };
                    }

                    console.log(`data successfully extracted from captions for '${resolvedHref}'`);

                    return {
                        article: {
                            content: json.content ?? "",
                            excerpt: json.excerpt ?? "",
                            href: resolvedHref,
                            keywords: json.keywords ?? [],
                            questions: json.questions ?? [],
                            title,
                            siteName,
                            summary: json.summary ?? "",
                            type: "video",
                        } as IndexableArticle,
                    };
                }

                console.log(`checking if page may be a parseable article for '${resolvedHref}'`);

                // No captions?  No problem.  Let's try and extract a
                // markdown version of the page contents and pass that
                // to the AI instead.
                const { value: isArticleHref } = shouldParseArticleForHref({ href: resolvedHref });
                
                console.log(`href is probably for article on page '${resolvedHref}'`);

                const { result: articleIsDetectedInContent } = await evaluate({
                    fnOrCode: `
                        ${isProbablyReaderableCode}

                        return isProbablyReaderable(document.cloneNode(true));
                    `,
                    page,
                }) as { result: boolean; };

                console.log(`article content detection returned ${articleIsDetectedInContent} for '${resolvedHref}'`);

                const isProbablyArticle = 
                    isArticleHref &&
                    articleIsDetectedInContent;

                if (!isProbablyArticle) {
                    console.log(`article unlikely to be on page for '${resolvedHref}'`);

                    return {
                        article: null,
                    };
                }

                console.log(`parsing article for '${resolvedHref}'`);

                const { error: articleParseError, result: articleData } = await evaluate({
                    fnOrCode: `
                        ${readabilityCode}

                        const documentClone = document.cloneNode(true);
                        const article = new Readability(documentClone).parse();
                        const actualTitle = document.querySelector(".article__title")?.textContent?.trim() ?? article.title;
                        const content = article?.content?.trim() ?? "";

                        if (!content.length) {
                            return null;
                        }

                        const correctedArticle = {
                            ...(article ?? {}),
                            title: actualTitle,
                            content,
                        };

                        try {
                            return correctedArticle;
                        } catch {
                            return null;
                        }
                    `,
                    page,
                }) as { error: { message: string; }; result: ReadabilityArticle | null; };

                if (articleParseError) {
                    console.error(articleParseError);
                }

                if (!articleData?.content?.length) {
                    console.log(`no article found on page for '${resolvedHref}'`);

                    return {
                        article: null,
                    };
                }

                console.log(`sending article to OpenAI for page '${resolvedHref}'`);

                const articleSitename = articleData.siteName?.length ? articleData.siteName : null;
                const articleTitle = articleData.title?.length ? articleData.title : null;
                const markdownBody = htmlMarkdown.NodeHtmlMarkdown.translate(articleData.content);
                const articleMarkdown = [
                    `# ${articleSitename}`,
                    `## ${articleTitle}`,
                    markdownBody?.length ? markdownBody : null,
                ].filter(Boolean).join("\n\n");
                const { error, json } = await askOpenAIModel({
                    apiKey: OPENAI_API_KEY,
                    fetchFn: globalThis.fetch,
                    modelName: OPENAI_MODEL,
                    responseFormat: "json_object",
                    text: [
                        "You are tasked with reading an article about an aspect of the online platform called AuditBoard and providing data from that article as a JSON object.  AuditBoard is a platform that helps companies organize information around managing risk, auditing, and compliance.",
                        articleTitle ? `The title of this article is "${articleTitle}".` : null,
                        articleSitename ? `It is taken from the support site called "${articleSitename}"` : null,
                        "\n",
                        "These are the keys that this JSON object should contain:",
                        "\n",
                        "- title",
                        "- excerpt",
                        "- keywords",
                        "- questions",
                        "- siteName",
                        "- summary",
                        "\n",
                        "The value of the title key should be the title of the article.",
                        "The value of the excerpt should be an important sentence from the article content.  Use your best judgment on which to use.",
                        "The value of the keywords key should be an array.  You must extract keywords from the article content and place them as strings in this array.",
                        "The value of the questions key should be an array.  You must fill this array with questions that a reader would have that the article would answer.  Try to add as many questions as you can think of.",
                        "The value of the siteName key should be the name of the site, if provided.  If you don't know what it is, then set it to null.",
                        "The value of the summary key should be a string that is a summary of the article.  I want you to write this summary.  It should be at least 1 sentence and be no more than a single paragraph long.",
                        "If there is any value for which you are not confident on what to provide, then you can set the value as null.",
                        "\n",
                        "Here is the article in Markdown format:",
                        "\n",
                        "```markdown",
                        articleMarkdown,
                        "```"
                    ].join("\n")
                });

                if (error) {
                    console.log(`OpenAI responsed with error when sending article for '${resolvedHref}'`);

                    return { error };
                }

                if (!json) {
                    console.log(`OpenAI returned nothing when sending article for '${resolvedHref}'`);

                    return {
                        error: {
                            message: "Article failed to be extracted by OpenAI for unknown reasons.",
                        },
                    };
                }

                console.log(`data successfully extracted from written article for '${resolvedHref}'`);

                return {
                    article: {
                        content: articleMarkdown,
                        excerpt: json?.excerpt ?? "",
                        href: resolvedHref,
                        keywords: json.keywords ?? [],
                        questions: json.questions ?? [],
                        title: articleTitle ?? "",
                        siteName: articleSitename ?? "",
                        summary: json.summary ?? "",
                        type: "article",
                    } as IndexableArticle,
                };
            })();

            if (article) {
                console.log(`attempting to index data for '${resolvedHref}'`);

                const { error, response } = await addArticleToIndex({ article });

                if (error || !response?.ok) {
                    console.log(`failed to index data for '${resolvedHref}'`);
                    console.error(error ?? "failed to index article");

                    return updateIndexerState({
                        hrefsFailed: [ resolvedHref, currentHref ],
                        state: indexerState,
                    });
                }

                console.log(`successfully indexed data from page for '${resolvedHref}'`);
            }

            console.log(`checking for more hyperlinks to crawl on page for '${resolvedHref}'`);

            /**
             * Gather links in the current page so we can crawl those as well
             */
            const hrefsInPage = (await evaluate({
                fnOrCode: function () {
                    const anchors = Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[];
    
                    return anchors.map(function (a) { return a.href; }).filter(Boolean);
                },
                page,
            })).result as string[];
            const hrefsToQueue = hrefsInPage.reduce(function (hrefs: string[], href: string): string[] {
                return [
                    ...hrefs,
                    shouldCrawlHref({ href }).value
                        ? sanitizeHref({ href }).href
                        : null,
                ].filter(Boolean) as string[];
            }, []);

            if (hrefsToQueue.length) {
                console.log(`found ${hrefsToQueue.length} hyperlinks on page for '${resolvedHref}'`);
            } else {
                console.log(`no hyperlinks found on page for '${resolvedHref}'`);
            }

            if (error) {
                console.error(error);
                
                return updateIndexerState({
                    hrefsFailed: [ resolvedHref, currentHref ],
                    hrefsToQueue: hrefsToQueue,
                    state: indexerState,
                });
            } else {
                console.log(`adding url to succeeded hrefs for page '${resolvedHref}'`);

                return updateIndexerState({
                    hrefsSucceeded: [ resolvedHref, currentHref ],
                    hrefsToQueue: hrefsToQueue,
                    state: indexerState,
                });
            }
        } catch (error) {
            console.error(error);

            return updateIndexerState({
                hrefsFailed: [ currentHref ],
                state: indexerState,
            });
        }
    })();

    try {
        console.log(`closing page for '${currentHref}'`);

        await page.close();
    } catch {
        // no-op
    }

    await saveIndexerState({ indexerState: newIndexerState });

    console.log(`moving on to next queued page`);

    return await performIndexing({
        browser,
        context,
        indexerState: newIndexerState,
    });
})({ indexerState: initialIndexerState });


function updateIndexerState (args: {
    hrefsFailed?: string[];
    hrefsSucceeded?: string[];
    hrefsToQueue?: string[];
    state: IndexerState;
}): { state: IndexerState } {
    const {
        hrefsFailed,
        hrefsSucceeded,
        hrefsToQueue,
        state,
    } = {
        hrefsFailed: [],
        hrefsSucceeded: [],
        hrefsToQueue: [],
        ...args,
    };

    const failedHrefs = Array.from(
        new Set([ ...hrefsFailed, ...state.failedHrefs ]),
    );
    const visitedHrefs = Array.from(
        new Set([ ...hrefsFailed, ...hrefsSucceeded, ...state.visitedHrefs ]),
    );

    return {
        state: {
            failedHrefs,
            queuedHrefs:
                Array.from(
                    new Set([ ...hrefsToQueue, ...state.queuedHrefs ])
                ).filter(function (href) {
                    return !visitedHrefs.includes(href);
                }),
            visitedHrefs,
        }
    };
}
