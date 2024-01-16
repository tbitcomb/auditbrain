#!/usr/bin/env -S docker compose run --rm --service-ports --use-aliases api deno run --ext ts --allow-env --allow-net --allow-read --allow-run --allow-ffi --allow-sys

import { ngrok } from "../deps.ts";
import { main } from "../src/main.ts";

const PORT = parseInt(Deno.env.get('PORT') || "3000", 10);
const NGROK_AUTH_TOKEN = Deno.env.get('NGROK_AUTH_TOKEN');
const NGROK_DOMAIN = Deno.env.get('NGROK_DOMAIN');
const { handleRequest } = main({
    fetchFn: globalThis.fetch,
    openAIAPIKey: Deno.env.get('OPENAI_API_KEY') || "",
    // Not sure I remember what this one is.
    openAIMaxOutputTokens: parseInt(Deno.env.get('OPENAI_MAX_OUTPUT_TOKENS') || "1500", 10),
    // openAIModel: Deno.env.get('OPENAI_MODEL') || "gpt-3.5-turbo-16k",
    // openAIModel: "gpt-3.5-turbo-1106",
    openAIModel: "gpt-4-1106-preview",
    aiUserId: Deno.env.get("AI_USER_ID") ?? "",
});
const abortController = new AbortController();

Deno.addSignalListener('SIGINT', () => {
    abortController.abort();
});

Deno.serve({ port: PORT, signal: abortController.signal }, async function (request: Request) {
    const { response } = await handleRequest({ request });

    response.headers.set("Access-Control-Allow-Origin", "*");

    return response;
});

console.log(`HTTP webserver running.  Access it at: http://localhost:${PORT}/`);

const ngrokConnection = await ngrok.connect({
    addr: `localhost:${PORT}`,
    authtoken: NGROK_AUTH_TOKEN,
    domain: NGROK_DOMAIN,
});

console.log(`Ngrok tunnel created: ${ngrokConnection}`);
