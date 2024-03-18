const { getContainerFromUri, arrayOf, isObject } = require('@semapps/ldp');
const { matchActivity } = require('@semapps/activitypub');
const { MIME_TYPES } = require('@semapps/mime-types');
const { objectDepth } = require('../../utils');

const queueOptions =
  process.env.NODE_ENV === 'test'
    ? {}
    : {
        // Try again after 3 minutes and until 12 hours later
        attempts: 8,
        backoff: { type: 'exponential', delay: '180000' }
      };

module.exports = {
  name: 'pod-activities-watcher',
  dependencies: ['triplestore', 'activitypub.actor', 'solid-notifications.listener'],
  async started() {
    const nodes = await this.broker.call('triplestore.query', {
      query: `
        SELECT DISTINCT ?specialRights ?grantedBy
        WHERE { 
          ?accessGrant a <http://www.w3.org/ns/solid/interop#AccessGrant> .
          ?accessGrant <http://activitypods.org/ns/core#hasSpecialRights> ?specialRights .
          ?accessGrant <http://www.w3.org/ns/solid/interop#grantedBy> ?grantedBy
        }
      `,
      accept: MIME_TYPES.JSON,
      webId: 'system'
    });

    // On (re)start, delete existing queue
    this.getQueue('registerListener').clean(0);
    this.getQueue('registerListener').clean(0, 'failed');
    this.getQueue('registerListener').empty();

    for (const { grantedBy, specialRights } of nodes) {
      try {
        switch (specialRights.value) {
          case 'http://activitypods.org/ns/core#ReadInbox':
            this.createJob(
              'registerListener',
              grantedBy.value + ' inbox',
              { actorUri: grantedBy.value, collectionPredicate: 'inbox' },
              queueOptions
            );
            break;

          case 'http://activitypods.org/ns/core#ReadOutbox':
            this.createJob(
              'registerListener',
              grantedBy.value + ' outbox',
              { actorUri: grantedBy.value, collectionPredicate: 'outbox' },
              queueOptions
            );
            break;
        }
      } catch (e) {
        this.logger.warn(`Could not listen to actor ${grantedBy.value}. Error message: ${e.message}`);
      }
    }

    this.handlers = [];
  },
  actions: {
    async watch(ctx) {
      const { matcher, actionName, boxTypes, key } = ctx.params;

      this.handlers.push({ matcher, actionName, boxTypes, key });

      this.sortHandlers();
    },
    async processWebhook(ctx) {
      const { type, object, target } = ctx.params;

      // Ignore Remove activities
      if (type !== 'Add') return;

      // TODO properly find the pod owner URI from the target
      // Apparently not specified by Solid https://forum.solidproject.org/t/discovering-webid-owner-of-a-particular-resource/2490
      const actorUri = getContainerFromUri(target);

      const actor = await ctx.call('activitypub.actor.get', { actorUri });

      // TODO get the cached activity to ensure we have no authorization problems
      const activity = await ctx.call('pod-resources.get', { resourceUri: object, actorUri });

      // Use pod-resources.get instead of ldp.resource.get for matcher
      const fetcher = (ctx, resourceUri) => ctx.call('pod-resources.get', { resourceUri, actorUri });

      if (target === actor.inbox) {
        for (const handler of this.handlers) {
          if (handler.boxTypes.includes('inbox')) {
            const dereferencedActivity = await matchActivity(ctx, handler.matcher, activity, fetcher);
            if (!!dereferencedActivity) {
              this.logger.info(`Reception of activity "${handler.key}" by ${actorUri} detected`);
              await ctx.call(handler.actionName, {
                key: handler.key,
                boxType: 'inbox',
                dereferencedActivity,
                actorUri
              });
            }
          }
        }
      } else if (target === actor.outbox) {
        for (const handler of this.handlers) {
          if (handler.boxTypes.includes('outbox')) {
            const dereferencedActivity = await matchActivity(ctx, handler.matcher, activity, fetcher);
            if (!!dereferencedActivity) {
              this.logger.info(`Emission of activity "${handler.key}" by ${actorUri} detected`);
              await ctx.call(handler.actionName, {
                key: handler.key,
                boxType: 'outbox',
                dereferencedActivity,
                actorUri
              });
            }
          }
        }
      }
    },
    getHandlers() {
      return this.handlers;
    }
  },
  methods: {
    sortHandlers() {
      // Sort handlers by the depth of matchers (if matcher is a function, it is put at the end)
      this.handlers.sort((a, b) => {
        if (isObject(a.matcher)) {
          if (isObject(b.matcher)) {
            return objectDepth(a.matcher) - objectDepth(b.matcher);
          } else {
            return 1;
          }
        } else {
          if (isObject(b)) {
            return -1;
          } else {
            return 0;
          }
        }
      });
    }
  },
  events: {
    async 'app.registered'(ctx) {
      const { accessGrants, appRegistration } = ctx.params;

      // If we were given the permission to read the inbox, add listener
      if (arrayOf(accessGrants['apods:hasSpecialRights']).includes('apods:ReadInbox')) {
        this.createJob(
          'registerListener',
          appRegistration['interop:registeredBy'] + ' inbox',
          { actorUri: appRegistration['interop:registeredBy'], collectionPredicate: 'inbox' },
          queueOptions
        );
      }

      // If we were given the permission to read the inbox, add listener
      if (arrayOf(accessGrants['apods:hasSpecialRights']).includes('apods:ReadOutbox')) {
        this.createJob(
          'registerListener',
          appRegistration['interop:registeredBy'] + ' outbox',
          { actorUri: appRegistration['interop:registeredBy'], collectionPredicate: 'outbox' },
          queueOptions
        );
      }
    }
  },
  queues: {
    registerListener: {
      name: '*',
      async process(job) {
        const { actorUri, collectionPredicate } = job.data;

        const actor = await this.broker.call('activitypub.actor.get', { actorUri });

        const listener = await this.broker.call('solid-notifications.listener.register', {
          resourceUri: actor[collectionPredicate],
          actionName: this.name + '.processWebhook'
        });

        this.logger.info(`Listening to ${actor.id} ${collectionPredicate}...`);

        return listener;
      }
    }
  }
};
