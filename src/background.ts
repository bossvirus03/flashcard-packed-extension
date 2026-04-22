// Background Service Worker for the extension
// Handles authentication and message passing

const API_URL = 'https://flashcard-extension.onrender.com';
// const API_URL = 'http://localhost:3000';

type AuthTokenResult = string | { token?: string };

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticate') {
    void handleGoogleAuth(sendResponse).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown authentication error';
      sendResponse({ success: false, error: message });
    });

    // Keep the message channel open for async auth response.
    return true;
  }

  if (request.action === 'getToken') {
    chrome.storage.local.get('authToken', (data) => {
      sendResponse({ token: data.authToken });
    });

    // Response is async because chrome.storage callback runs later.
    return true;
  }

  // Always respond for unknown actions to avoid message port closure errors.
  sendResponse({ success: false, error: `Unknown action: ${String(request?.action)}` });
  return false;
});

async function handleGoogleAuth(
  sendResponse: (response: { success: boolean; user?: unknown; error?: string }) => void,
) {
  try {
    const token = await getGoogleAccessToken(true);

    if (!token) {
      sendResponse({ success: false, error: 'No Google token returned' });
      return;
    }

    // Get user info from Google
    let response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Token may be stale; clear cache and retry once.
    if (response.status === 401) {
      await removeCachedToken(token);
      const refreshedToken = await getGoogleAccessToken(true);

      if (!refreshedToken) {
        sendResponse({ success: false, error: 'Unable to refresh Google token' });
        return;
      }

      response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${refreshedToken}`,
        },
      });
    }

    if (!response.ok) {
      sendResponse({
        success: false,
        error: `Failed to fetch Google profile: ${response.status}`,
      });
      return;
    }

    const userInfo = await response.json();
    const googleId = userInfo?.sub || userInfo?.id;

    if (!googleId) {
      sendResponse({
        success: false,
        error: 'Google profile is missing user id (sub)',
      });
      return;
    }

    if (!userInfo?.email) {
      sendResponse({
        success: false,
        error: 'Google profile is missing email',
      });
      return;
    }

    // Send to backend for authentication
    const backendResponse = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userInfo.email,
        googleId,
        name: userInfo.name,
        picture: userInfo.picture,
      }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      sendResponse({
        success: false,
        error: `Backend auth failed (${backendResponse.status}): ${errorText || 'Unknown error'}`,
      });
      return;
    }

    const authData = await backendResponse.json();

    if (!authData?.access_token) {
      sendResponse({ success: false, error: 'Backend did not return access_token' });
      return;
    }

    // Store the JWT token
    chrome.storage.local.set({
      authToken: authData.access_token,
      user: {
        id: authData.id,
        email: authData.email,
        name: authData.name,
        picture: authData.picture,
      },
    });

    sendResponse({ success: true, user: authData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown authentication error';
    console.error('Authentication error:', error);
    sendResponse({ success: false, error: message });
  }
}

async function getGoogleAccessToken(interactive: boolean): Promise<string | null> {
  const result = (await chrome.identity.getAuthToken({ interactive })) as AuthTokenResult;

  if (typeof result === 'string') {
    return result;
  }

  return result?.token ?? null;
}

async function removeCachedToken(token: string): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}
