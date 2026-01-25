import { createHmac } from 'crypto';

/**
 * Verify GitHub webhook signature
 * @param payload - The raw request body as string
 * @param signature - The X-Hub-Signature-256 header value
 * @param secret - The webhook secret
 * @returns true if signature is valid
 */
export function verifyGitHubSignature(
    payload: string,
    signature: string | null,
    secret: string
): boolean {
    if (!signature) {
        return false;
    }

    // GitHub sends signature as "sha256=<hash>"
    const [algorithm, hash] = signature.split('=');
    
    if (algorithm !== 'sha256') {
        return false;
    }

    // Compute HMAC
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedHash = hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(hash, expectedHash);
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
}
