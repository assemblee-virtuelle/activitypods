const urlJoin = require('url-join');

// Inspired from https://github.com/CommunitySolidServer/CommunitySolidServer/blob/15a929a87e4ce00c0ed266e296405c8e4a22d4a7/config/identity/handler/base/provider-factory.json#L30
module.exports = (settings, privateJwk) => ({
  claims: {
    openid: ['azp'],
    webid: ['webid']
  },
  // Default client settings that might not be defined.
  // Mostly relevant for WebID clients.
  clientDefaults: { id_token_signed_response_alg: privateJwk.alg },
  clockTolerance: 120,
  cookies: {
    keys: [settings.cookieSecret],
    long: { signed: true, maxAge: 86400000 },
    short: { signed: true }
  },
  enabledJWA: {
    dPoPSigningAlgValues: [
      'RS256',
      'RS384',
      'RS512',
      'PS256',
      'PS384',
      'PS512',
      'ES256',
      'ES256K',
      'ES384',
      'ES512',
      'EdDSA'
    ]
  },
  features: {
    claimsParameter: { enabled: true },
    clientCredentials: { enabled: true },
    devInteractions: { enabled: false },
    dPoP: { enabled: true },
    introspection: { enabled: true },
    registration: { enabled: true },
    rpInitiatedLogout: {
      enabled: true,
      // Automatically submit the form
      logoutSource: async (ctx, form) => {
        // Simulate button click
        form = form.replace('</form>', '<input type="hidden" name="logout" value="yes"/></form>');
        ctx.body = `
          <!DOCTYPE html>
          <head>
            <script>
              document.addEventListener('DOMContentLoaded', function () { document.forms[0].submit() });
            </script>
          </head>
          <body>
            ${form}
            <noscript>
              <button autofocus type="submit" form="op.logoutForm" value="yes" name="logout">Continue</button>
            </noscript>
          </body>
          </html>
        `;
      },
      // Redirect to the frontend
      postLogoutSuccessSource: async ctx => {
        ctx.body = `
          <!DOCTYPE html>
          <head>
            <script>
              window.location.href = "${settings.frontendUrl}";
            </script>
          </head>
          <body>
            <noscript>
              <h1>Success !</h1>
            </noscript>
          </body>
          </html>
        `;
      }
    },
    revocation: { enabled: true },
    userinfo: { enabled: false }
  },
  jwks: { keys: [privateJwk] },
  // Returns the id_token https://solid.github.io/authentication-panel/solid-oidc/#tokens-id
  // Some fields are still missing, see https://github.com/CommunitySolidServer/CommunitySolidServer/issues/1154#issuecomment-1040233385
  findAccount: async (ctx, sub) => ({
    accountId: sub,
    async claims() {
      return { sub, webid: sub, azp: ctx.oidc.client?.clientId };
    }
  }),
  // Since the login form is on a separated frontend, we must redirect to it
  interactions: {
    url: async (ctx, interaction) => {
      console.log('interaction', interaction);
      switch (interaction?.prompt?.name) {
        case 'login': {
          const loginUrl = new URL(urlJoin(settings.frontendUrl, '/login'));
          loginUrl.searchParams.set('interaction_id', interaction.jti);
          loginUrl.searchParams.set('client_id', interaction?.params?.client_id);
          loginUrl.searchParams.set('redirect', interaction.returnTo);
          return loginUrl.toString();
        }

        case 'consent': {
          // We automatically grant required scopes so consent screen should not be handled
          // See loadExistingGrant config below
          throw new Error('Consent interaction not handled');
        }

        default: {
          console.error('Unknown interaction', interaction);
        }
      }
    }
  },
  // Automatically grant `webid` and `openid` scopes to avoid dealing with the consent interaction
  // https://github.com/panva/node-oidc-provider/blob/main/recipes/skip_consent.md
  loadExistingGrant: async ctx => {
    const grantId = ctx.oidc.result?.consent?.grantId || ctx.oidc.session.grantIdFor(ctx.oidc.client.clientId);
    if (grantId) {
      return ctx.oidc.provider.Grant.find(grantId);
    } else {
      const clientId = ctx.oidc.client.clientId;
      const accountId = ctx.oidc.session.accountId;
      const grant = new ctx.oidc.provider.Grant({ accountId, clientId });
      grant.addOIDCScope('webid openid');
      await grant.save();
      return grant;
    }
  },
  // Solid OIDC requires pkce https://solid.github.io/solid-oidc/#concepts
  pkce: { methods: ['S256'], required: () => true },
  scopes: ['openid', 'profile', 'offline_access', 'webid'],
  subjectTypes: ['public'],
  ttl: {
    AccessToken: 3600,
    AuthorizationCode: 600,
    BackchannelAuthenticationRequest: 600,
    ClientCredentials: 600,
    DeviceCode: 600,
    Grant: 1209600,
    IdToken: 3600,
    Interaction: 3600,
    RefreshToken: 86400,
    Session: 1209600
  },
  renderError: async (ctx, out, error) => {
    console.error(error);
    ctx.type = 'html';
    ctx.body = `
      <!DOCTYPE html>
      <head>
        <title>Error</title>
      </head>
      <body>
        <div>
          <h1>Error</h1>
          ${Object.entries(out)
            .map(([key, value]) => `<pre><strong>${key}</strong>: ${value}</pre>`)
            .join('')}
        </div>
      </body>
      </html>
    `;
  }
});
