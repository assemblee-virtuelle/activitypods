const fs = require('fs');
const path = require('path');
const { generateKeyPair, exportJWK, importJWK, jwtVerify } = require('jose');

// See https://github.com/CommunitySolidServer/CommunitySolidServer/blob/15a929a87e4ce00c0ed266e296405c8e4a22d4a7/src/identity/configuration/CachedJwkGenerator.ts
module.exports = {
  name: 'jwk',
  settings: {
    jwtPath: null,
    alg: 'ES256'
  },
  async created() {
    const privateKeyPath = path.resolve(this.settings.jwtPath, 'jwk' + this.settings.alg + '.key');
    const publicKeyPath = path.resolve(this.settings.jwtPath, 'jwk' + this.settings.alg + '.key.pub');

    if (!fs.existsSync(privateKeyPath) && !fs.existsSync(publicKeyPath)) {
      console.log('JWK not found, generating...');
      if (!fs.existsSync(this.settings.jwtPath)) {
        fs.mkdirSync(this.settings.jwtPath);
      }
      await this.actions.generateKeyPair({ privateKeyPath, publicKeyPath });
    } else {
      this.privateJwk = JSON.parse(fs.readFileSync(privateKeyPath));
      this.publicJwk = JSON.parse(fs.readFileSync(publicKeyPath));
    }
  },
  actions: {
    async generateKeyPair(ctx) {
      const { privateKeyPath, publicKeyPath } = ctx.params;

      const { privateKey, publicKey } = await generateKeyPair(this.settings.alg);

      this.privateJwk = await exportJWK(privateKey);
      this.publicJwk = await exportJWK(publicKey);

      this.privateJwk.alg = this.settings.alg;
      this.publicJwk.alg = this.settings.alg;

      fs.writeFileSync(privateKeyPath, JSON.stringify(this.privateJwk));
      fs.writeFileSync(publicKeyPath, JSON.stringify(this.publicJwk));
    },
    async get() {
      return { privateJwk: this.privateJwk, publicJwk: this.publicJwk };
    },
    async verifyToken(ctx) {
      const { token } = ctx.params;

      const publicKey = await importJWK(this.publicJwk, this.settings.alg);

      // Allow expired token to last one more month
      const { payload } = await jwtVerify(token, publicKey /*, { clockTolerance: 2629800 }*/);

      return payload;
    }
  }
};
