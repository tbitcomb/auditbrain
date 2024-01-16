async function printRequest (args: { request: Request, bodyText: string; }): Promise<void> {
    const { request, bodyText } = args;

    console.log(
        JSON.stringify({
            url: request.url,
            method: request.method,
            headers: Array.from(request.headers.entries()).reduce((hash, [k, v]) => ({ ...hash, [k]: v }), {}),
            body: bodyText,
        }, null, 2),
    );
}
