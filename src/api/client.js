const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const SUBMISSIONS_ENDPOINT = `${BASE_URL}/api/submissions`;
const DOWNLOAD_ENDPOINT = `${BASE_URL}/api/download`;

async function handleResponse(response) {
  if (!response.ok) {
    let message = 'Unexpected server error';
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch (error) {
      // ignore parsing error
    }
    throw new Error(message);
  }
  return response.json();
}

export async function fetchSubmissions(signal) {
  const response = await fetch(SUBMISSIONS_ENDPOINT, { signal });
  return handleResponse(response);
}

export async function createSubmission(payload) {
  const response = await fetch(SUBMISSIONS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
}

export function getDownloadUrl() {
  return DOWNLOAD_ENDPOINT;
}
