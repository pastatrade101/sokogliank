import { firebaseConfig } from '../config/firebaseConfig';

const REGION = 'us-central1';

function endpointFor(functionName) {
  return `https://${REGION}-${firebaseConfig.projectId}.cloudfunctions.net/${functionName}`;
}

function candidateEndpoints(functionName) {
  const absolute = endpointFor(functionName);
  const fromEnv = (process.env.REACT_APP_PREMIUM_CHECKOUT_URL || '').trim();
  const local = `/${functionName}`;
  const localSlash = `/${functionName}/`;
  const absoluteSlash = `${absolute}/`;

  const candidates = [];

  if (fromEnv) {
    candidates.push(fromEnv);
    if (!fromEnv.endsWith('/')) {
      candidates.push(`${fromEnv}/`);
    }
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      candidates.push(local, localSlash, absolute, absoluteSlash);
      return [...new Set(candidates)];
    }
  }

  candidates.push(absolute, absoluteSlash, local, localSlash);
  return [...new Set(candidates)];
}

function parseResponseBody(text) {
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

export async function initiatePremiumCheckout({
  user,
  provider,
  accountNumber,
  productId,
}) {
  if (!user) {
    throw new Error('Sign in required.');
  }
  const jwtToken = await user.getIdToken();

  const requestBody = JSON.stringify({
    jwtToken,
    provider,
    accountNumber,
    productId,
  });
  const endpoints = candidateEndpoints('initiatePremiumCheckout');
  let lastError = null;
  let saw404 = false;

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });
      const payload = parseResponseBody(await response.text());

      if (!response.ok) {
        if (response.status === 404) {
          saw404 = true;
          lastError = new Error(`Endpoint not found at ${url} (404).`);
          continue;
        }
        throw new Error(
          payload?.message ||
            `Payment initiation failed with status ${response.status}.`,
        );
      }

      if (payload?.success !== true) {
        throw new Error(payload?.message || 'Unable to initiate premium checkout.');
      }

      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  if (saw404) {
    throw new Error(
      'Payment endpoint not found (404). Restart the React dev server, then retry. If it persists, deploy Cloud Function "initiatePremiumCheckout".',
    );
  }
  throw new Error(
    lastError instanceof Error
      ? lastError.message
      : 'Unable to initiate premium checkout.',
  );
}
