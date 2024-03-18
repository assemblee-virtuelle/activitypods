const urlJoin = require('url-join');
const { ACTIVITY_TYPES, ACTOR_TYPES, ActivitiesHandlerMixin } = require('@semapps/activitypub');
const { arrayOf } = require('@semapps/ldp');
const { matchActivity } = require('@semapps/activitypub');
const { MIME_TYPES } = require('@semapps/mime-types');
const {
  CONTACT_REQUEST,
  ACCEPT_CONTACT_REQUEST,
  REJECT_CONTACT_REQUEST,
  IGNORE_CONTACT_REQUEST
} = require('../config/patterns');
const {
  CONTACT_REQUEST_MAPPING,
  ACCEPT_CONTACT_REQUEST_MAPPING,
  AUTO_ACCEPTED_CONTACT_REQUEST_MAPPING: CONTACT_REQUEST_BY_INVITE_LINK_MAPPING
} = require('../config/mappings');

module.exports = {
  name: 'contacts.request',
  mixins: [ActivitiesHandlerMixin],
  dependencies: ['activitypub.registry', 'webacl'],
  async started() {
    await this.broker.call('activitypub.registry.register', {
      path: '/contacts',
      attachToTypes: Object.values(ACTOR_TYPES),
      attachPredicate: 'http://activitypods.org/ns/core#contacts',
      ordered: false,
      dereferenceItems: false
    });

    await this.broker.call('activitypub.registry.register', {
      path: '/contact-requests',
      attachToTypes: Object.values(ACTOR_TYPES),
      attachPredicate: 'http://activitypods.org/ns/core#contactRequests',
      ordered: false,
      dereferenceItems: true
    });

    await this.broker.call('activitypub.registry.register', {
      path: '/rejected-contacts',
      attachToTypes: Object.values(ACTOR_TYPES),
      attachPredicate: 'http://activitypods.org/ns/core#rejectedContacts',
      ordered: false,
      dereferenceItems: false
    });

    // Notify on contact requests (unless it's by an invite link capability).
    // await this.broker.call('activity-mapping.addMapper', {
    //   match: async (ctx, activity) => {
    //     if (activityHasInviteCapability(activity)) {
    //       return false;
    //     }

    //     return !!(await matchActivity(ctx, CONTACT_REQUEST, activity));
    //   },
    //   mapping: CONTACT_REQUEST_MAPPING
    // });

    // Notify on auto-accepted invites (by invite link capability).
    // await this.broker.call('activity-mapping.addMapper', {
    //   match: async (ctx, activity) => {
    //     if (!activityHasInviteCapability(activity)) {
    //       return false;
    //     }
    //     return await matchActivity(ctx, CONTACT_REQUEST, activity);
    //   },
    //   mapping: CONTACT_REQUEST_BY_INVITE_LINK_MAPPING
    // });

    // Notify on accepted contact requests (unless auto-accepted by invite link capability).
    // await this.broker.call('activity-mapping.addMapper', {
    //   match: async (ctx, activity) => {
    //     if (activityHasInviteCapability(activity)) {
    //       return false;
    //     }
    //     return await matchActivity(ctx, ACCEPT_CONTACT_REQUEST, activity);
    //   },
    //   mapping: ACCEPT_CONTACT_REQUEST_MAPPING
    // });
  },
  activities: {
    contactRequest: {
      match: CONTACT_REQUEST,
      async onEmit(ctx, activity, emitterUri) {
        // Add the user to the contacts WebACL group so he can see my profile
        for (let targetUri of arrayOf(activity.target)) {
          await ctx.call('webacl.group.addMember', {
            groupSlug: `${new URL(emitterUri).pathname}/contacts`,
            memberUri: targetUri,
            webId: emitterUri
          });
        }
      },
      async onReceive(ctx, activity, recipientUri) {
        const recipient = await ctx.call('activitypub.actor.get', { actorUri: recipientUri });

        // If the actor is already in my contacts, ignore this request (may happen for automatic post-event requests)
        if (
          await ctx.call('activitypub.collection.includes', {
            collectionUri: recipient['apods:contacts'],
            itemUri: activity.actor
          })
        ) {
          return;
        }

        // If the request was already rejected, reject it again
        if (
          await ctx.call('activitypub.collection.includes', {
            collectionUri: recipient['apods:rejectedContacts'],
            itemUri: activity.actor
          })
        ) {
          await ctx.call('activitypub.outbox.post', {
            collectionUri: recipient.outbox,
            type: ACTIVITY_TYPES.REJECT,
            actor: recipient.id,
            object: activity.id,
            to: activity.actor
          });
          return;
        }

        // Check, if an invite capability URI is present. If so, accept the request automatically.
        if (activityHasInviteCapability(activity)) {
          const capability = await ctx.call('auth.getValidateCapability', {
            capabilityUri: activity['sec:capability'],
            webId: recipientUri
          });
          const { url: profileUri } = await ctx.call('ldp.resource.get', {
            resourceUri: recipientUri,
            webId: 'system',
            accept: MIME_TYPES.JSON
          });
          // Capability to read the profile implies automatic contact approval.
          if (
            capability.type === 'acl:Authorization' &&
            capability['acl:mode'] === 'acl:Read' &&
            capability['acl:accessTo'] === profileUri
          ) {
            // Send the accept.
            await ctx.call('activitypub.outbox.post', {
              collectionUri: recipient.outbox,
              type: ACTIVITY_TYPES.ACCEPT,
              actor: recipient.id,
              object: activity.id,
              to: activity.actor,
              // TODO: this is semantically not so clean but the easiest way rn, to detect what kind of response this is.
              'sec:capability': activity['sec:capability']
            });

            // No need to add the user to contact requests.
            return;
          }
        }

        // Check that a request by the same actor is not already waiting (if so, ignore it)
        const collection = await ctx.call('activitypub.collection.get', {
          collectionUri: recipient['apods:contactRequests'],
          webId: recipientUri
        });
        if (
          collection &&
          arrayOf(collection.items).length > 0 &&
          arrayOf(collection.items).find(a => a.actor === activity.actor)
        ) {
          return;
        }

        await ctx.call('activitypub.collection.attach', {
          collectionUri: recipient['apods:contactRequests'],
          item: activity
        });
      }
    },
    acceptContactRequest: {
      match: ACCEPT_CONTACT_REQUEST,
      async onEmit(ctx, activity, emitterUri) {
        const emitter = await ctx.call('activitypub.actor.get', { actorUri: emitterUri });

        // 1. Add the other actor to the contacts WebACL group so he can see my profile
        await ctx.call('webacl.group.addMember', {
          groupSlug: `${new URL(emitterUri).pathname}/contacts`,
          memberUri: activity.to,
          webId: emitterUri
        });

        // 2. Cache the other actor's profile
        await ctx.call('ldp.remote.store', {
          resource: activity.object.object.object,
          webId: emitterUri
        });

        // 3. Attach the other actor's profile to my profiles container
        await ctx.call('ldp.container.attach', {
          containerUri: urlJoin(emitterUri, 'data', 'vcard', 'individual'),
          resourceUri: activity.object.object.object.id,
          webId: emitterUri
        });

        // 4. Add the other actor to my contacts list
        await ctx.call('activitypub.collection.attach', {
          collectionUri: emitter['apods:contacts'],
          item: activity.object.actor
        });

        // 5. Remove the activity from my contact requests
        await ctx.call('activitypub.collection.detach', {
          collectionUri: emitter['apods:contactRequests'],
          item: activity.object.id
        });
      },
      async onReceive(ctx, activity, recipientUri) {
        const emitter = await ctx.call('activitypub.actor.get', { actorUri: activity.actor });
        const recipient = await ctx.call('activitypub.actor.get', { actorUri: recipientUri });

        // Cache the other actor's profile (it should be visible now)
        await ctx.call('ldp.remote.store', {
          resourceUri: emitter.url,
          webId: recipientUri
        });

        // Attach the other actor's profile to my profiles container
        await ctx.call('ldp.container.attach', {
          containerUri: urlJoin(recipientUri, 'data', 'vcard', 'individual'),
          resourceUri: emitter.url,
          webId: recipientUri
        });

        // Add the other actor to my contacts list
        await ctx.call('activitypub.collection.attach', {
          collectionUri: recipient['apods:contacts'],
          item: emitter.id
        });
      }
    },
    ignoreContactRequest: {
      match: IGNORE_CONTACT_REQUEST,
      async onEmit(ctx, activity, emitterUri) {
        const emitter = await ctx.call('activitypub.actor.get', { actorUri: emitterUri });

        // Remove the activity from my contact requests
        await ctx.call('activitypub.collection.detach', {
          collectionUri: emitter['apods:contactRequests'],
          item: activity.object.id
        });
      },
      async onReceive(ctx, activity, recipientUri) {
        // Remove the user from the contacts WebACL group so he can't see my profile anymore
        await ctx.call('webacl.group.removeMember', {
          groupSlug: `${new URL(recipientUri).pathname}/contacts`,
          memberUri: activity.actor,
          webId: recipientUri
        });
      }
    },
    rejectContactRequest: {
      match: REJECT_CONTACT_REQUEST,
      async onEmit(ctx, activity, emitterUri) {
        const emitter = await ctx.call('activitypub.actor.get', { actorUri: emitterUri });

        // Add the actor to my rejected contacts list
        await ctx.call('activitypub.collection.attach', {
          collectionUri: emitter['apods:rejectedContacts'],
          item: activity.object.actor
        });

        // Remove the activity from my contact requests
        await ctx.call('activitypub.collection.detach', {
          collectionUri: emitter['apods:contactRequests'],
          item: activity.object.id
        });
      },
      async onReceive(ctx, activity, recipientUri) {
        // Remove the emitter from the contacts WebACL group so he can't see the recipient's profile anymore
        await ctx.call('webacl.group.removeMember', {
          groupSlug: `${new URL(recipientUri).pathname}/contacts`,
          memberUri: activity.actor,
          webId: recipientUri
        });
      }
    }
  }
};

/**
 * Right now, it's assumed that an Offer > Add > Profile activity with a
 * capability attached is an contact request by invite link. Thus an invite capability.
 * @param activity The activity object.
 * @returns
 */
const activityHasInviteCapability = activity => {
  return !!activity?.['sec:capability'];
};
