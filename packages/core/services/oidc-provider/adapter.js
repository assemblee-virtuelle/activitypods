const fetch = require('node-fetch');
const isEmpty = require('lodash/isEmpty.js');

const grantable = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest'
]);

const consumable = new Set(['AuthorizationCode', 'RefreshToken', 'DeviceCode', 'BackchannelAuthenticationRequest']);

function grantKeyFor(id) {
  return `grant:${id}`;
}

function userCodeKeyFor(userCode) {
  return `userCode:${userCode}`;
}

function uidKeyFor(uid) {
  return `uid:${uid}`;
}

class RedisAdapter {
  constructor(name, client) {
    this.name = name;
    this.client = client;
  }

  async upsert(id, payload, expiresIn) {
    const key = this.key(id);
    const store = consumable.has(this.name) ? { payload: JSON.stringify(payload) } : JSON.stringify(payload);

    const multi = this.client.multi();
    multi[consumable.has(this.name) ? 'hmset' : 'set'](key, store);

    if (expiresIn) {
      multi.expire(key, expiresIn);
    }

    if (grantable.has(this.name) && payload.grantId) {
      const grantKey = grantKeyFor(payload.grantId);
      multi.rpush(grantKey, key);
      // if you're seeing grant key lists growing out of acceptable proportions consider using LTRIM
      // here to trim the list to an appropriate length
      const ttl = await this.client.ttl(grantKey);
      if (expiresIn > ttl) {
        multi.expire(grantKey, expiresIn);
      }
    }

    if (payload.userCode) {
      const userCodeKey = userCodeKeyFor(payload.userCode);
      multi.set(userCodeKey, id);
      multi.expire(userCodeKey, expiresIn);
    }

    if (payload.uid) {
      const uidKey = uidKeyFor(payload.uid);
      multi.set(uidKey, id);
      multi.expire(uidKey, expiresIn);
    }

    await multi.exec();
  }

  async find(id) {
    const data = consumable.has(this.name)
      ? await this.client.hgetall(this.key(id))
      : await this.client.get(this.key(id));

    if (isEmpty(data)) {
      if (this.name === 'Client' && id.startsWith('http')) {
        if (!/^https:|^http:\/\/localhost(?::\d+)?(?:\/|$)/u.test(id)) {
          throw new Error(`SSL is required for client_id authentication unless working locally.`);
        }
        const response = await fetch(id, {
          headers: {
            JsonLdContext: 'https://www.w3.org/ns/solid/oidc-context.jsonld'
          }
        });
        if (response.status !== 200) {
          throw new Error(`Unable to access data at ${id}: ${await response.text()}`);
        }
        const data = await response.text();
        let json;
        try {
          json = JSON.parse(data);
          const contexts = Array.isArray(json['@context']) ? json['@context'] : [json['@context']];
          // We can only parse as simple JSON if the @context is correct
          if (!contexts.includes('https://www.w3.org/ns/solid/oidc-context.jsonld')) {
            throw new Error('Missing context https://www.w3.org/ns/solid/oidc-context.jsonld');
          }
        } catch (error) {
          json = undefined;
          console.error(`Found unexpected client ID for ${id}: ${error.message}`);
        }

        if (json) {
          // Need to make sure the document is about the id
          if (json.client_id !== id) {
            throw new Error('The client registration `client_id` field must match the client ID');
          }
          // Reformat if necessary as the @container directive doesn't work
          if (json.redirect_uris['@none']) json.redirect_uris = json.redirect_uris['@none'];
          json = {
            client_id: json.client_id,
            redirect_uris: json.redirect_uris
          };
        } else {
          // Since the client ID does not match the default JSON-LD we try to interpret it as RDF
          // payload = await this.parseRdfClientId(data, id, response);
        }

        // `token_endpoint_auth_method: 'none'` prevents oidc-provider from requiring a client_secret
        // eslint-disable-next-line ts/naming-convention
        return { ...json, token_endpoint_auth_method: 'none' };
      } else {
        return undefined;
      }
    }

    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    const { payload, ...rest } = data;
    return {
      ...rest,
      ...JSON.parse(payload)
    };
  }

  async findByUid(uid) {
    const id = await this.client.get(uidKeyFor(uid));
    return this.find(id);
  }

  async findByUserCode(userCode) {
    const id = await this.client.get(userCodeKeyFor(userCode));
    return this.find(id);
  }

  async destroy(id) {
    const key = this.key(id);
    await this.client.del(key);
  }

  async revokeByGrantId(grantId) {
    const multi = this.client.multi();
    const tokens = await this.client.lrange(grantKeyFor(grantId), 0, -1);
    tokens.forEach(token => multi.del(token));
    multi.del(grantKeyFor(grantId));
    await multi.exec();
  }

  async consume(id) {
    await this.client.hset(this.key(id), 'consumed', Math.floor(Date.now() / 1000));
  }

  key(id) {
    return `${this.name}:${id}`;
  }
}

module.exports = RedisAdapter;
