// deno-lint-ignore no-explicit-any
type HandlerFunction = (...args: any[]) => unknown;

type FetchFunction = typeof window.fetch;

type ConversationMessage = {
    id: string;
    json?: Record<string, unknown> | unknown[] | null;
    text: string;
    role?: "user" | "ai";
    ts: string;
    userId: string | null;
};

type ConversationData = {
    messages: ConversationMessage[];
};

type OpenAIMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

type OpenAIError = {
    message: string;
};

type ReadabilityArticle = {
    title: string;
    content: string;
    textContent: string;
    length: number;
    excerpt: string;
    byline: string;
    dir: string;
    siteName: string;
    lang: string;
    publishedTime: string;
};

type IndexableArticle = {
    content: string;
    excerpt: string;
    href: string;
    keywords: string[];
    questions: string[];
    title: string;
    siteName: string;
    summary: string;
    type: "article" | "video";
};

type OpenAILongTermMemory = {
    context: string;
    maxTokens: number;
    modelName: string;
};
