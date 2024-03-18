const { triple, namedNode } = require('@rdfjs/data-model');
const { ControlledContainerMixin } = require('@semapps/ldp');
const { OBJECT_TYPES, AS_PREFIX } = require('@semapps/activitypub');
const { MIME_TYPES } = require('@semapps/mime-types');

module.exports = {
  name: 'profiles.profile',
  mixins: [ControlledContainerMixin],
  settings: {
    publicProfile: false,
    // ControlledContainerMixin settings
    path: '/vcard/individual',
    acceptedTypes: ['vcard:Individual', OBJECT_TYPES.PROFILE],
    permissions: {},
    newResourcesPermissions: {}
  },
  dependencies: ['activitypub', 'webacl'],
  events: {
    async 'auth.registered'(ctx) {
      const { webId, profileData } = ctx.params;
      const containerUri = await this.actions.getContainerUri({ webId }, { parentCtx: ctx });

      await this.actions.waitForContainerCreation({ containerUri }, { parentCtx: ctx });

      const profileUri = await this.actions.post(
        {
          containerUri,
          resource: {
            '@type': ['vcard:Individual', OBJECT_TYPES.PROFILE],
            'vcard:fn': profileData.familyName
              ? `${profileData.name} ${profileData.familyName.toUpperCase()}`
              : profileData.name,
            'vcard:given-name': profileData.name,
            'vcard:family-name': profileData.familyName,
            describes: webId
          },
          contentType: MIME_TYPES.JSON,
          webId
        },
        { parentCtx: ctx }
      );

      if (this.settings.publicProfile) {
        await ctx.call('webacl.resource.addRights', {
          resourceUri: profileUri,
          additionalRights: {
            anon: {
              read: true
            }
          },
          webId
        });
      }

      await ctx.call('ldp.resource.patch', {
        resourceUri: webId,
        triplesToAdd: [triple(namedNode(webId), namedNode(AS_PREFIX + 'url'), namedNode(profileUri))],
        webId
      });

      // TODO put this on the contacts app
      // Create a WebACL group for the user's contact
      const { groupUri: contactsGroupUri } = await ctx.call('webacl.group.create', {
        groupSlug: new URL(webId).pathname + '/contacts',
        webId
      });

      // Authorize this group to view the user's profile
      await ctx.call('webacl.resource.addRights', {
        resourceUri: profileUri,
        additionalRights: {
          group: {
            uri: contactsGroupUri,
            read: true
          }
        },
        webId
      });
    }
  },
  hooks: {
    before: {
      async put(ctx) {
        // Update vcard:hasGeo if vcard:hasAddress is set
        if (ctx.params.resource['vcard:hasAddress']) {
          const location = await ctx.call('profiles.location.get', {
            resourceUri: ctx.params.resource['vcard:hasAddress'],
            webId: ctx.params.webId
          });
          if (location && location['vcard:hasAddress'] && location['vcard:hasAddress']['vcard:hasGeo']) {
            ctx.params.resource['vcard:hasGeo'] = location['vcard:hasAddress']['vcard:hasGeo'];
          } else {
            this.logger.warn(
              `Could not fetch location ${ctx.params.resource['vcard:hasAddress']} when updating profile`
            );
          }
        } else {
          if (ctx.params.resource['vcard:hasGeo']) {
            delete ctx.params.resource['vcard:hasGeo'];
          }
        }
      }
    }
    // TODO give permissions to read home address to all contacts ?
    // The action webacl.group.getUri need to be published first
    //   after: {
    //     async put(ctx, res) {
    //       const { oldData, newData, webId } = res;
    //       if (newData['vcard:hasAddress'] !== oldData['vcard:hasAddress']) {
    //         const contactsGroupUri = await ctx.call('webacl.group.getUri', { groupSlug: new URL(webId).pathname + '/contacts' })
    //         if (newData['vcard:hasAddress']) {
    //           await ctx.call('webacl.resource.addRights', {
    //             resourceUri: newData['vcard:hasAddress'],
    //             additionalRights: {
    //               group: {
    //                 uri: contactsGroupUri,
    //                 read: true,
    //               },
    //             },
    //             webId,
    //           });
    //         }
    //         if (oldData['vcard:hasAddress']) {
    //           await ctx.call('webacl.resource.removeRights', {
    //             resourceUri: oldData['vcard:hasAddress'],
    //             rights: {
    //               group: {
    //                 uri: contactsGroupUri,
    //                 read: true,
    //               },
    //             },
    //             webId,
    //           });
    //         }
    //       }
    //       return res;
    //     }
    //   }
  }
};
