import jwt from 'jsonwebtoken';

/**
 * Generate a GitHub App JWT token for authentication
 * @param appId - GitHub App ID
 * @param privateKey - PEM-encoded private key
 * @returns JWT token
 */
export function generateGitHubAppToken(appId: string, privateKey: string): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
        iat: now - 60, // Issued 60 seconds in the past to account for clock drift
        exp: now + 600, // Expires in 10 minutes (max allowed)
        iss: appId
    };

    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

/**
 * Get an installation access token for a GitHub App
 * @param appId - GitHub App ID
 * @param privateKey - PEM-encoded private key
 * @param installationId - Installation ID
 * @returns Access token
 */
export async function getInstallationAccessToken(
    appId: string,
    privateKey: string,
    installationId: string
): Promise<string> {
    const jwt = generateGitHubAppToken(appId, privateKey);

    const response = await fetch(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${jwt}`
            }
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to get installation token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token;
}

/**
 * List repositories accessible by a GitHub App installation
 * @param accessToken - Installation access token
 * @returns Array of repositories
 */
export async function listInstallationRepositories(accessToken: string) {
    const response = await fetch('https://api.github.com/installation/repositories', {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to list repositories: ${response.statusText}`);
    }

    const data = await response.json();
    return data.repositories;
}

/**
 * Get repository branches
 * @param accessToken - Installation access token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Array of branches
 */
export async function listRepositoryBranches(
    accessToken: string,
    owner: string,
    repo: string
) {
    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches`,
        {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${accessToken}`
            }
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to list branches: ${response.statusText}`);
    }

    return response.json();
}
