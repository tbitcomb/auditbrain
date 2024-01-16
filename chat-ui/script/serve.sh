#!/usr/bin/env -S docker compose run --rm --service-ports chat-ui deno run --ext ts --allow-env --allow-net --allow-read

import { path } from "../deps.ts";

const PORT = parseInt(Deno.env.get('PORT') || "1337", 10);
const __dirname = new URL('.', import.meta.url).pathname;
const abortController = new AbortController();
const EXTENSIONS_TO_MIME_MAP: Record<string, string> = Object.freeze({
    ".css": "text/css",
    ".gif": "image/gif",
    ".htm": "text/html",
    ".html": "text/html",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
});

Deno.addSignalListener('SIGINT', () => {
    abortController.abort();
});

Deno.serve({ port: PORT, signal: abortController.signal }, async function (request: Request) {
    const url = new URL(request.url);

    const pathname = (function () {
        if (url.pathname === "/") {
            return "/www/index.html";
        }

        return url.pathname;
    })();

    // const filePath =  path.join(__dirname, "..", "www", pathname);
    const filePath =  path.join(__dirname, "..", pathname);
    const fileExtension = path.extname(filePath);
    const contentType = EXTENSIONS_TO_MIME_MAP[fileExtension] ?? "application/octet-stream";

    console.log(filePath)

    try {
        const data = await Deno.readTextFile(filePath);

        return new Response(data, {
            headers: {
                "Content-Type": contentType,
            },
            status: 200,
        });
    } catch {
        return new Response('file not found', { status: 404 });
    }
});
