const defaultMapping = require('./defaultMapping');
const { ACTIVITY_TYPES } = require('@semapps/activitypub');

const AnnouncerMixin = {
  settings: {
    notificationMapping: defaultMapping
  },
  dependencies: ['announcer'],
  async started() {
    await this.broker.call('announcer.watch', { types: this.settings.acceptedTypes });

    // await this.broker.call('activity-mapping.addMapper', {
    //   match: {
    //     type: ACTIVITY_TYPES.ANNOUNCE,
    //     object: {
    //       type: this.settings.acceptedTypes
    //     }
    //   },
    //   mapping: this.settings.notificationMapping
    // });
  },
  hooks: {
    after: {
      async create(ctx, res) {
        await ctx.call('announcer.giveRightsAfterCreate', res);
        return res;
      }
    }
  }
};

module.exports = AnnouncerMixin;
