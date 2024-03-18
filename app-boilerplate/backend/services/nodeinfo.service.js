const urlJoin = require('url-join');
const { NodeinfoService } = require('@semapps/nodeinfo');
const CONFIG = require('../config/config');
const package = require('../package.json');

module.exports = {
  mixins: [NodeinfoService],
  settings: {
    baseUrl: CONFIG.HOME_URL,
    software: {
      name: 'activitypods',
      version: package.version,
      repository: package.repository?.url,
      homepage: package.homepage
    },
    protocols: ['activitypub'],
    metadata: {
      frontend_url: CONFIG.FRONT_URL,
      login_url: CONFIG.FRONT_URL && urlJoin(CONFIG.FRONT_URL, 'login'),
      logout_url: CONFIG.FRONT_URL && urlJoin(CONFIG.FRONT_URL, 'login?logout=true'),
      resource_url: CONFIG.FRONT_URL && urlJoin(CONFIG.FRONT_URL, 'r')
    }
  },
  actions: {
    async getUsersCount(ctx) {
      const appRegistrations = await ctx.call('app-registrations.list');
      return {
        total: appRegistrations['ldp:contains'].length,
        activeHalfYear: appRegistrations['ldp:contains'].length,
        activeMonth: appRegistrations['ldp:contains'].length
      };
    }
  }
};
