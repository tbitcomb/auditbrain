import ngrok from "@ngrok/ngrok";
import { handleSlackRequest } from "./lib/slack.ts";

const PORT = parseInt(Deno.env.get('PORT') || "3000", 10);
const NGROK_AUTH_TOKEN = Deno.env.get('NGROK_AUTH_TOKEN');
const NGROK_DOMAIN = Deno.env.get('NGROK_DOMAIN');
const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN') || "";
const SLACK_SIGNING_SECRET = Deno.env.get('SLACK_SIGNING_SECRET') || "";

Deno.serve({ port: PORT }, async function (request) {
    return await handleSlackRequest({
        request,
        signingSecret: SLACK_SIGNING_SECRET,
        slackBotToken: SLACK_BOT_TOKEN,
    });
});

console.log(`HTTP webserver running.  Access it at: http://localhost:${PORT}/`);

const ngrokConnection = await ngrok.connect({
    addr: `localhost:${PORT}`,
    authtoken: NGROK_AUTH_TOKEN,
    domain: NGROK_DOMAIN,
});

console.log(`Ngrok tunnel created: ${ngrokConnection}`);
