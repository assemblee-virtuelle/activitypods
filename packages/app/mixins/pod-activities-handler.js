module.exports = {
  dependencies: ['pod-activities-watcher'],
  async started() {
    for (const [key, activityHandler] of Object.entries(this.schema.activities)) {
      const boxTypes = [];
      if (activityHandler.onReceive) boxTypes.push('inbox');
      if (activityHandler.onEmit) boxTypes.push('outbox');

      await this.broker.call('pod-activities-watcher.watch', {
        matcher: activityHandler.match,
        actionName: this.name + '.processActivity',
        boxTypes,
        key
      });
    }
  },
  actions: {
    async processActivity(ctx) {
      const { key, boxType, dereferencedActivity, actorUri } = ctx.params;

      const activityHandler = this.schema.activities[key];

      if (!activityHandler) {
        this.logger.warn(`Cannot process activity because no handler with key ${key} found`);
        return;
      }

      if (boxType === 'inbox' && activityHandler.onReceive) {
        await activityHandler.onReceive.bind(this)(ctx, dereferencedActivity, actorUri);
      } else if (boxType === 'outbox' && activityHandler.onEmit) {
        await activityHandler.onEmit.bind(this)(ctx, dereferencedActivity, actorUri);
      } else {
        this.logger.warn(
          `Cannot process activity because no onReceive or onEmit methods are associated with with key ${key}`
        );
      }
    }
  }
};
