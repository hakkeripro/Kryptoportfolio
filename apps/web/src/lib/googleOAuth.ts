/** Generate a random base64url string of `byteLength` bytes */
function randomBase64Url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function sha256Base64Url(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Fetch the Google client ID from the server (falls back to build-time env). */
export async function fetchGoogleClientId(apiBase = '/api'): Promise<string | null> {
  // Build-time env takes priority (set in Cloudflare Pages build vars)
  const fromEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (fromEnv) return fromEnv;

  try {
    const res = await fetch(`${apiBase}/v1/auth/config`);
    if (!res.ok) return null;
    const data = (await res.json()) as { googleClientId?: string | null };
    return data.googleClientId ?? null;
  } catch {
    return null;
  }
}

export async function initiateGoogleOAuth(apiBase = '/api') {
  const clientId = await fetchGoogleClientId(apiBase);
  if (!clientId) {
    throw new Error('Google sign-in is not available in this environment.');
  }

  const codeVerifier = randomBase64Url(64);
  const state = randomBase64Url(16);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  sessionStorage.setItem('oauth_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${window.location.origin}/auth/callback`,
    scope: 'openid email',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
