import { fetchWithResilience } from "./http.ts";

export async function addArticleToIndex (args: {
    article: IndexableArticle;
}): Promise<{
    error?: { message: string; };
    response?: Response;
}> {
    const ensureIndexResult = await ensureArticleIndex();

    if (ensureIndexResult.error) {
        return ensureIndexResult;
    }

    const { article } = args;
    const { response } = await fetchWithResilience({
        init: {
            headers: new Headers({
                "Content-Type": "application/json",
            }),
            method: "POST",
            body: JSON.stringify(article),
        },
        input: "http://elasticsearch:9200/articles/_doc",
    });

    if (!response?.ok) {
        return {
            error: {
                message: "Article failed to be indexed",
            },
        };
    }

    return {
        response,
    };
}

export async function search (args: {
    query: string;
}): Promise<{ 
    hits?: Array<{
        _id: string;
        _index: string;
        _score: number;
    }>;
    error?: {
        message: string;
    };
}> {
    const { query } = args;

    const { response } = await fetchWithResilience({
        init: {
            headers: new Headers({
                "Content-Type": "application/json",
            }),
            method: "GET",
            body: JSON.stringify({
                query: {
                    match: {
                        message: query,
                    }
                }
            }),
        },
        input: "http://elasticsearch:9200/articles",
    });

    try {
        const json = await response.json();

        return {
            hits: json.hits.hits,
        };
    } catch {
        return {
            error: {
                message: "Search hits failed to be parsed",
            },
        };
    }
}

async function ensureArticleIndex () {
    const { response } = await fetchWithResilience({
        init: {
            headers: new Headers({
                "Content-Type": "application/json",
            }),
            method: "PUT",
            body: JSON.stringify({
                settings: {
                    number_of_shards: 1,
                    number_of_replicas: 1,
                },
                mappings: {
                    properties: {
                        content: {
                            type: "text",
                        },
                        excerpt: {
                            type: "text",
                        },
                        href: {
                            type: "text",
                        },
                        keywords: {
                            type: "keyword",
                        },
                        questions: {
                            type: "text",
                        },
                        siteName: {
                            type: "text",
                        },
                        summary: {
                            type: "text",
                        },
                        title: {
                            type: "text",
                        },
                        type: {
                            type: "text",
                        },
                    },
                },
            }),
        },
        input: "http://elasticsearch:9200/articles",
    });
    const text = response ? await response.text() : "";

    if (
        !response?.ok &&
        !/resource_already_exists_exception/.test(text)
    ) {
        return {
            error: {
                message: "Failed to initialize articles index.",
            },
        };
    }

    return { response };
}

export function isArticleHref (args: { href: string; }): { value: boolean } {
    const { href } = args;

    return {
        value: /hc\/en-us\/articles/.test(href),
    };
}

export function shouldCrawlHref (args: {
    href: string;
}): {
    value: boolean;
} {
    try {
        const { href } = args;
        const url = new URL(href);
        const { hostname, pathname } = url;

        if (/@/.test(pathname)) {
            return {
                value: false,
            };
        }

        if (hostname === "academy.auditboard.com") {
            return {
                value:
                    !/^\/accounts\/.*/.test(pathname) &&
                    !/^\/auth\/.*/.test(pathname) &&
                    !/^\/checkout\/.*/.test(pathname) &&
                    !/^\/invite\/.*/.test(pathname) &&
                    !/^\/signup\/.*/.test(pathname) &&
                    !/^\/login\/.*/.test(pathname)
            };
        }

        if (hostname === "support.soxhub.com") {
            return {
                value: false,
            };
            // return {
            //     value:
            //         /^\/hc\/en-us\/categories.*/.test(pathname) ||
            //         /^\/hc\/en-us\/sections.*/.test(pathname) ||
            //         /^\/hc\/en-us\/articles.*/.test(pathname)
            // };
        }
    } catch {
        // no-op
    }

    return { value: false };
}

export function shouldParseArticleForHref (args: {
    href: string;
}): {
    value: boolean;
} {
    const { href } = args;

    try {
        const url = new URL(href);
        const { hostname, pathname } = url;

        if (hostname === "support.soxhub.com") {
            return {
                value: /^\/hc\/en-us\/articles.*/.test(pathname),
            };
        }

        // // There is no way to tell if one of these
        // // hrefs is for an article, so assume they are for now
        // if (hostname === "academy.auditboard.com") {
        //     return {
        //         value: true,
        //     }
        // }
    } catch {
        // no-op
    }

    return { value: false };
}

