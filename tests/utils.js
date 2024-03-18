const fetch = require('node-fetch');
const { delay } = require('@semapps/ldp');

const arrayOf = value => {
  // If the field is null-ish, we suppose there are no values.
  if (!value) {
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

/**
 * Call a callback and expect the result object to have all properties in `fieldNames`.
 * If not, try again after `delayMs` until `maxTries` is reached.
 * If `fieldNames` is `undefined`, the return value of `callback` is expected to not be
 * `undefined`.
 *
 * @type {import("./utilTypes").waitForResource}
 **/
const waitForResource = async (delayMs, fieldNames, maxTries, callback) => {
  for (let i = 0; i < maxTries; i += 1) {
    const result = await callback();
    // If a result (and the expected field, if required) is present, return.
    if (result !== undefined && arrayOf(fieldNames).every(fieldName => Object.keys(result).includes(fieldName))) {
      return result;
    }
    await delay(delayMs);
  }
  throw new Error('Waiting for resource failed. No results after ' + maxTries + ' tries');
};

module.exports = {
  arrayOf,
  fetchServer,
  waitForResource
};
