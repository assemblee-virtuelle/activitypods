const AssertionService = require('./services/assertion');
const BadgeService = require('./services/badge');
const BakedBadgeService = require('./services/baked-badge');

const OpenBadgesApp = {
  name: 'openbadges',
  created() {
    this.broker.createService(AssertionService);
    this.broker.createService(BadgeService);
    this.broker.createService(BakedBadgeService);
  },
};

module.exports = OpenBadgesApp;
