import { bytesToHexString } from "./encoding.ts";

export async function createHmacSha256 (args: { secret: string; message: string; }): Promise<{ hmac: string; }> {
    const { secret, message } = args;

    // Step 1: Generate secret key
    // Text encoder to convert string to Uint8Array
    const encoder = new TextEncoder();

    const key = await window.crypto.subtle.importKey(
        'raw', // raw format of the key - should be Uint8Array
        encoder.encode(secret),
        { // algorithm details
            name: 'HMAC',
            hash: {name: 'SHA-256'}
        },
        false, // export = false
        ['sign', 'verify'] // what this key can do
    );

    // Step 2: Create HMAC
    const signature = await window.crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(message)
    );

    // Convert signature to hex
    const { hex: hmac } = bytesToHexString({
        bytes: new Uint8Array(signature),
    });
 
    return { hmac };
}
