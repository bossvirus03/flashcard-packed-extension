export async function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('authToken', (data) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            chrome.runtime.lastError.message || 'Failed to get auth token',
          ),
        );
        return;
      }

      const token = data.authToken as string | undefined;

      if (!token) {
        reject(new Error('Missing auth token'));
        return;
      }

      resolve(token);
    });
  });
}