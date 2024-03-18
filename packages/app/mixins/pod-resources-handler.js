const { ACTIVITY_TYPES, OBJECT_TYPES } = require('@semapps/activitypub');
const PodActivitiesHandlerMixin = require('./pod-activities-handler');

module.exports = {
  mixins: [PodActivitiesHandlerMixin],
  settings: {
    type: null
  },
  dependencies: ['pod-resources'],
  created() {
    if (!this.schema.activities) this.schema.activities = {};

    if (this.onCreate) {
      this.schema.activities.create = {
        match: {
          type: ACTIVITY_TYPES.CREATE,
          object: {
            type: this.settings.type
          }
        },
        async onEmit(ctx, activity) {
          await this.onCreate(ctx, activity.object, activity.actor);
        }
      };
    }

    if (this.onUpdate) {
      this.schema.activities.update = {
        match: {
          type: ACTIVITY_TYPES.UPDATE,
          object: {
            type: this.settings.type
          }
        },
        async onEmit(ctx, activity) {
          await this.onUpdate(ctx, activity.object, activity.actor);
        }
      };
    }

    if (this.onDelete) {
      this.schema.activities.delete = {
        match: {
          type: ACTIVITY_TYPES.DELETE,
          object: {
            type: OBJECT_TYPES.TOMBSTONE,
            formerType: this.settings.type
          }
        },
        async onEmit(ctx, activity) {
          await this.onDelete(ctx, activity.object.id, activity.actor);
        }
      };
    }
  },
  actions: {
    async post(ctx) {
      if (!ctx.params.containerUri) {
        ctx.params.containerUri = await this.actions.getContainerUri(
          { actorUri: ctx.params.actorUri },
          { parentCtx: ctx }
        );
      }
      return await ctx.call('pod-resources.post', ctx.params);
    },
    async list(ctx) {
      if (!ctx.params.containerUri) {
        ctx.params.containerUri = await this.actions.getContainerUri(
          { actorUri: ctx.params.actorUri },
          { parentCtx: ctx }
        );
      }
      return await ctx.call('pod-resources.list', ctx.params);
    },
    async get(ctx) {
      return await ctx.call('pod-resources.get', ctx.params);
    },
    async patch(ctx) {
      await ctx.call('pod-resources.patch', ctx.params);
    },
    async put(ctx) {
      await ctx.call('pod-resources.put', ctx.params);
    },
    async delete(ctx) {
      await ctx.call('pod-resources.delete', ctx.params);
    },
    async getContainerUri(ctx) {
      return await ctx.call('data-grants.getContainerByType', {
        type: this.settings.type,
        podOwner: ctx.params.actorUri
      });
    }
  }
};
