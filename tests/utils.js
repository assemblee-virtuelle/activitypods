const fetch = require('node-fetch');
const { delay } = require('@semapps/ldp');
const CONFIG = require('./config');

const arrayOf = value => {
  // If the field is null-ish, we suppose there are no values.
  if (value === null || value === undefined) {
    return [];
  }
  // Return as is.
  if (Array.isArray(value)) {
    return value;
  }
  // Single value is made an array.
  return [value];
};

const fetchServer = (url, options = {}) => {
  if (!options.headers) options.headers = new fetch.Headers();

  switch (options.method) {
    case 'POST':
    case 'PATCH':
    case 'PUT':
      if (!options.headers.has('Accept')) options.headers.set('Accept', 'application/ld+json');
      if (!options.headers.has('Content-Type')) options.headers.set('Content-Type', 'application/ld+json');
      break;
    case 'DELETE':
      break;
    case 'GET':
    default:
      if (!options.headers.has('Accept')) options.headers.set('Accept', 'application/ld+json');
      break;
  }

  if (options.body && options.headers.get('Content-Type').includes('json')) {
    options.body = JSON.stringify(options.body);
  }

  return fetch(url, {
    method: options.method || 'GET',
    body: options.body,
    headers: options.headers
  })
    .then(response =>
      response.text().then(text => ({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: text
      }))
    )
    .then(({ status, statusText, headers, body }) => {
      let json;
      try {
        json = JSON.parse(body);
      } catch (e) {
        // not json, no big deal
      }
      return Promise.resolve({ status, statusText, headers, body, json });
    });
};

const fetchMails = async () => {
  const results = await fetch(CONFIG.MAILCATCHER_API_URL, {
    headers: {
      Accept: 'application/json'
    }
  });

  const json = await results.json();

  return json;
};

const clearMails = async () => {
  await fetch(CONFIG.MAILCATCHER_API_URL, {
    method: 'DELETE'
  });
};

/**
 * Call a callback and expect the result object to have all properties in `fieldNames`.
 * If not, try again after `delayMs` until `maxTries` is reached.
 * If `fieldNames` is `undefined`, the return value of `callback` is expected to not be
 * `undefined`.
 * @type {import("./utilTypes").waitForResource}
 */
const waitForResource = async (delayMs, fieldNames, maxTries, callback) => {
  for (let i = 0; i < maxTries; i += 1) {
    const result = await callback();
    // If a result (and the expected field, if required) is present, return.
    if (result !== undefined && arrayOf(fieldNames).every(fieldName => Object.keys(result).includes(fieldName))) {
      return result;
    }
    await delay(delayMs);
  }
  throw new Error(`Waiting for resource failed. No results after ${maxTries} tries`);
};

const tryUntilTimeout = async (fn, maxWait = 5000, waitBetween = 50) => {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    let lastError = undefined;
    let shouldContinue = true;
    setTimeout(() => {
      const timeoutError = new Error(
        `Timeout exceeded.${lastError && ` See \`cause\` for most recent error: ${lastError.message}`}`
      );
      timeoutError.cause = lastError || 'Timeout exceeded';
      if (lastError?.stack) timeoutError.stack = lastError.stack;
      reject(timeoutError);
      shouldContinue = false;
    }, maxWait);

    while (shouldContinue) {
      try {
        const result = await fn(); // eslint-disable-line no-await-in-loop
        resolve(result);
        return;
      } catch (e) {
        lastError = e;
        await delay(waitBetween); // eslint-disable-line no-await-in-loop
      }
    }
  });
};
module.exports = {
  arrayOf,
  fetchServer,
  fetchMails,
  clearMails,
  waitForResource,
  tryUntilTimeout
};
