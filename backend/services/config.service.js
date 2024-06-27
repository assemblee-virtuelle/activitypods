module.exports = {
  name: 'config',
  dependencies: ['api'],
  async started() {
    await this.broker.call('api.addRoute', {
      route: {
        path: '/.well-known/config.js',
        name: 'config',
        aliases: {
          'GET /': 'config.get'
        }
      }
    });
  },
  actions: {
    async get(ctx) {
      ctx.meta.$responseType = 'text/javascript';
      return `
        window.CONFIG = {
          INSTANCE_NAME: "${process.env.SEMAPPS_INSTANCE_NAME}",
          INSTANCE_DESCRIPTION: "${process.env.SEMAPPS_INSTANCE_DESCRIPTION}",
          DEFAULT_LOCALE: "${process.env.SEMAPPS_DEFAULT_LOCALE}",
          BACKEND_URL: "${process.env.SEMAPPS_HOME_URL}",
          MAPBOX_ACCESS_TOKEN: "${process.env.SEMAPPS_MAPBOX_ACCESS_TOKEN}",
          COLOR_PRIMARY: "${process.env.SEMAPPS_COLOR_PRIMARY}",
          COLOR_SECONDARY: "${process.env.SEMAPPS_COLOR_SECONDARY}",
        };
      `;
    }
  }
};