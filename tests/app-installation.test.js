const path = require('path');
const urlJoin = require('url-join');
const waitForExpect = require('wait-for-expect');
const { MIME_TYPES } = require('@semapps/mime-types');
const { arrayOf } = require('@semapps/ldp');
const { initialize, initializeAppServer, clearDataset, listDatasets, installApp } = require('./initialize');
const ExampleAppService = require('./apps/example.app');
const { ACTIVITY_TYPES } = require('@semapps/activitypub');

jest.setTimeout(80000);

const APP_URI = 'http://localhost:3001/app';
const APP2_URI = 'http://localhost:3002/app';

describe('Test app installation', () => {
  let podServer,
    alice,
    appServer,
    appServer2,
    app,
    eventsContainerUri,
    placesContainerUri,
    requiredAccessNeedGroup,
    optionalAccessNeedGroup,
    requiredAccessGrant,
    optionalAccessGrant,
    appRegistration;

  beforeAll(async () => {
    const datasets = await listDatasets();
    for (let dataset of datasets) {
      await clearDataset(dataset);
    }

    podServer = await initialize(3000, 'settings');
    await podServer.loadService(path.resolve(__dirname, './services/profiles.app.js'));
    await podServer.start();

    const actorData = require(`./data/actor1.json`);
    const { webId } = await podServer.call('auth.signup', actorData);
    alice = await podServer.call(
      'activitypub.actor.awaitCreateComplete',
      {
        actorUri: webId,
        additionalKeys: ['url']
      },
      { meta: { dataset: actorData.username } }
    );
    alice.call = (actionName, params, options = {}) =>
      podServer.call(actionName, params, {
        ...options,
        meta: { ...options.meta, webId, dataset: alice.preferredUsername }
      });

    appServer = await initializeAppServer(3001, 'app_settings');
    await appServer.createService(ExampleAppService);
    await appServer.start();

    appServer2 = await initializeAppServer(3002, 'app2_settings');
    await appServer2.createService(ExampleAppService);
    await appServer2.start();
  }, 80000);

  afterAll(async () => {
    await podServer.stop();
    await appServer.stop();
    await appServer2.stop();
  });

  test('App access needs are correctly declared', async () => {
    await waitForExpect(async () => {
      app = await appServer.call('ldp.resource.get', {
        resourceUri: APP_URI,
        accept: MIME_TYPES.JSON
      });
      expect(app).toMatchObject({
        type: expect.arrayContaining(['interop:Application']),
        'interop:applicationName': 'Example App',
        'interop:applicationDescription': 'An ActivityPods app for integration tests',
        'interop:hasAccessNeedGroup': expect.anything()
      });
    });

    let accessNeedGroup;
    for (const accessNeedUri of arrayOf(app['interop:hasAccessNeedGroup'])) {
      accessNeedGroup = await appServer.call('ldp.resource.get', {
        resourceUri: accessNeedUri,
        accept: MIME_TYPES.JSON
      });
      if (accessNeedGroup['interop:accessNecessity'] === 'interop:AccessRequired') {
        requiredAccessNeedGroup = accessNeedGroup;
      } else {
        optionalAccessNeedGroup = accessNeedGroup;
      }
    }

    // REQUIRED ACCESS NEEDS

    expect(requiredAccessNeedGroup).toMatchObject({
      type: 'interop:AccessNeedGroup',
      'interop:accessNecessity': 'interop:AccessRequired',
      'interop:accessScenario': 'interop:PersonalAccess',
      'interop:authenticatedAs': 'interop:SocialAgent',
      'interop:hasAccessNeed': expect.anything(),
      'apods:hasSpecialRights': expect.arrayContaining([
        'apods:ReadInbox',
        'apods:PostOutbox',
        'apods:CreateAclGroup',
        'apods:SendNotification'
      ])
    });

    await expect(
      appServer.call('ldp.resource.get', {
        resourceUri: requiredAccessNeedGroup['interop:hasAccessNeed'],
        accept: MIME_TYPES.JSON
      })
    ).resolves.toMatchObject({
      type: 'interop:AccessNeed',
      'apods:registeredClass': 'as:Event',
      'interop:accessNecessity': 'interop:AccessRequired',
      'interop:accessMode': expect.arrayContaining(['acl:Read', 'acl:Write', 'acl:Control'])
    });

    // OPTIONAL ACCESS NEEDS

    expect(optionalAccessNeedGroup).toMatchObject({
      type: 'interop:AccessNeedGroup',
      'interop:accessNecessity': 'interop:AccessOptional',
      'interop:accessScenario': 'interop:PersonalAccess',
      'interop:authenticatedAs': 'interop:SocialAgent',
      'interop:hasAccessNeed': expect.anything()
    });

    await expect(
      appServer.call('ldp.resource.get', {
        resourceUri: optionalAccessNeedGroup['interop:hasAccessNeed'],
        accept: MIME_TYPES.JSON
      })
    ).resolves.toMatchObject({
      type: 'interop:AccessNeed',
      'apods:registeredClass': 'as:Place',
      'interop:accessNecessity': 'interop:AccessOptional',
      'interop:accessMode': expect.arrayContaining(['acl:Read', 'acl:Append'])
    });
  });

  test('User installs app and grants all access needs', async () => {
    await alice.call('activitypub.outbox.post', {
      collectionUri: alice.outbox,
      type: 'apods:Install',
      object: APP_URI,
      'apods:acceptedAccessNeeds': [
        requiredAccessNeedGroup['interop:hasAccessNeed'],
        optionalAccessNeedGroup['interop:hasAccessNeed']
      ],
      'apods:acceptedSpecialRights': [
        requiredAccessNeedGroup['apods:hasSpecialRights'],
        optionalAccessNeedGroup['apods:hasSpecialRights']
      ]
    });

    let appRegistrationUri, creationActivityUri;

    await waitForExpect(async () => {
      const outbox = await alice.call('activitypub.collection.get', {
        collectionUri: alice.outbox,
        page: 1
      });

      expect(outbox?.orderedItems[0]).toMatchObject({
        type: 'Create',
        object: expect.anything(),
        to: APP_URI
      });

      creationActivityUri = outbox?.orderedItems[0]?.id;
      appRegistrationUri = outbox?.orderedItems[0]?.object;
    });

    // Get the app registration from the app server (it should be public like AccessGrants and DataGrants)
    appRegistration = await appServer.call('ldp.remote.get', {
      resourceUri: appRegistrationUri,
      accept: MIME_TYPES.JSON
    });

    expect(appRegistration).toMatchObject({
      type: 'interop:ApplicationRegistration',
      'interop:registeredAgent': APP_URI,
      'interop:registeredBy': alice.id,
      'interop:hasAccessGrant': expect.arrayContaining([])
    });

    const accessGrants = await Promise.all(
      appRegistration['interop:hasAccessGrant'].map(accessGrantUri =>
        appServer.call('ldp.remote.get', {
          resourceUri: accessGrantUri,
          accept: MIME_TYPES.JSON
        })
      )
    );

    requiredAccessGrant = accessGrants.find(g => g['interop:hasAccessNeedGroup'] === requiredAccessNeedGroup.id);
    optionalAccessGrant = accessGrants.find(g => g['interop:hasAccessNeedGroup'] === optionalAccessNeedGroup.id);

    expect(requiredAccessGrant).toMatchObject({
      type: 'interop:AccessGrant',
      'interop:grantedBy': alice.id,
      'interop:grantee': APP_URI,
      'interop:hasAccessNeedGroup': requiredAccessNeedGroup.id
    });

    await expect(
      appServer.call('ldp.remote.get', {
        resourceUri: requiredAccessGrant['interop:hasDataGrant'],
        accept: MIME_TYPES.JSON
      })
    ).resolves.toMatchObject({
      type: 'interop:DataGrant',
      'apods:registeredClass': 'as:Event',
      'apods:registeredContainer': urlJoin(alice.id, 'data/as/event'),
      'interop:dataOwner': alice.id,
      'interop:grantee': APP_URI,
      'interop:accessMode': expect.arrayContaining(['acl:Read', 'acl:Write', 'acl:Control']),
      'interop:satisfiesAccessNeed': requiredAccessNeedGroup['interop:hasAccessNeed'],
      'interop:scopeOfGrant': 'interop:All'
    });

    expect(optionalAccessGrant).toMatchObject({
      type: 'interop:AccessGrant',
      'interop:grantedBy': alice.id,
      'interop:grantee': APP_URI,
      'interop:hasAccessNeedGroup': optionalAccessNeedGroup.id
    });

    await expect(
      appServer.call('ldp.remote.get', {
        resourceUri: optionalAccessGrant['interop:hasDataGrant'],
        accept: MIME_TYPES.JSON
      })
    ).resolves.toMatchObject({
      type: 'interop:DataGrant',
      'apods:registeredClass': 'as:Place',
      'apods:registeredContainer': urlJoin(alice.id, 'data/as/place'),
      'interop:dataOwner': alice.id,
      'interop:grantee': APP_URI,
      'interop:accessMode': expect.arrayContaining(['acl:Read', 'acl:Append']),
      'interop:satisfiesAccessNeed': optionalAccessNeedGroup['interop:hasAccessNeed'],
      'interop:scopeOfGrant': 'interop:All'
    });

    await waitForExpect(async () => {
      const inbox = await alice.call('activitypub.collection.get', {
        collectionUri: alice.inbox,
        page: 1
      });

      expect(inbox?.orderedItems[0]).toMatchObject({
        type: ACTIVITY_TYPES.ACCEPT,
        object: creationActivityUri
      });
    });
  });

  test('Containers are created according to access needs', async () => {
    await expect(
      alice.call('ldp.container.exist', {
        containerUri: urlJoin(alice.id, 'data/as')
      })
    ).resolves.toBeTruthy();

    eventsContainerUri = urlJoin(alice.id, 'data/as/event');
    placesContainerUri = urlJoin(alice.id, 'data/as/place');

    await expect(
      alice.call('ldp.container.exist', {
        containerUri: eventsContainerUri
      })
    ).resolves.toBeTruthy();

    await expect(
      alice.call('ldp.container.exist', {
        containerUri: placesContainerUri
      })
    ).resolves.toBeTruthy();

    const eventsRights = await alice.call('webacl.resource.getRights', {
      resourceUri: urlJoin(alice.id, 'data/as/event'),
      accept: MIME_TYPES.JSON,
      webId: APP_URI
    });

    expect(eventsRights).toMatchObject({
      '@graph': expect.arrayContaining([
        expect.objectContaining({
          'acl:accessTo': eventsContainerUri,
          'acl:agent': APP_URI,
          'acl:mode': 'acl:Read'
        }),
        expect.objectContaining({
          'acl:accessTo': eventsContainerUri,
          'acl:agent': APP_URI,
          'acl:mode': 'acl:Write'
        })
      ])
    });

    const placesRights = await alice.call('webacl.resource.getRights', {
      resourceUri: urlJoin(alice.id, 'data/as/place'),
      accept: MIME_TYPES.JSON,
      webId: APP_URI
    });

    expect(placesRights).toMatchObject({
      '@graph': expect.arrayContaining([
        expect.objectContaining({
          'acl:agent': APP_URI,
          'acl:mode': 'acl:Read',
          'acl:accessTo': placesContainerUri
        })
      ])
    });

    expect(placesRights['@graph']).not.toContain([
      expect.objectContaining({
        'acl:agent': APP_URI,
        'acl:mode': 'acl:Write',
        'acl:accessTo': placesContainerUri
      })
    ]);
  });

  test('Resources created in the containers have the correct permissions', async () => {
    const eventUri = await alice.call('ldp.container.post', {
      containerUri: urlJoin(alice.id, 'data/as/event'),
      resource: {
        type: 'Event',
        name: 'Birthday party !'
      },
      contentType: MIME_TYPES.JSON
    });

    const eventsRights = await alice.call('webacl.resource.getRights', {
      resourceUri: eventUri,
      accept: MIME_TYPES.JSON,
      webId: 'system' // We must fetch as system, because we need control rights on the container to see all permissions
    });

    expect(eventsRights).toMatchObject({
      '@graph': expect.arrayContaining([
        expect.objectContaining({
          'acl:agent': APP_URI,
          'acl:default': eventsContainerUri,
          'acl:mode': 'acl:Read'
        }),
        expect.objectContaining({
          'acl:agent': APP_URI,
          'acl:default': eventsContainerUri,
          'acl:mode': 'acl:Write'
        }),
        expect.objectContaining({
          'acl:agent': APP_URI,
          'acl:default': eventsContainerUri,
          'acl:mode': 'acl:Control'
        })
      ])
    });

    const placeUri = await alice.call('ldp.container.post', {
      containerUri: urlJoin(alice.id, 'data/as/place'),
      resource: {
        type: 'Place',
        name: 'Home sweet home'
      },
      contentType: MIME_TYPES.JSON
    });

    const placesRights = await alice.call('webacl.resource.getRights', {
      resourceUri: placeUri,
      accept: MIME_TYPES.JSON,
      webId: 'system'
    });

    expect(placesRights).toMatchObject({
      '@graph': expect.arrayContaining([
        expect.objectContaining({
          'acl:agent': APP_URI,
          'acl:mode': 'acl:Read',
          'acl:default': placesContainerUri
        }),
        expect.objectContaining({
          'acl:agent': APP_URI,
          'acl:mode': 'acl:Append',
          'acl:default': placesContainerUri
        })
      ])
    });

    expect(placesRights['@graph']).not.toContain([
      expect.objectContaining({
        'acl:agent': APP_URI,
        'acl:mode': 'acl:Write',
        'acl:default': placesContainerUri
      })
    ]);

    expect(placesRights['@graph']).not.toContain([
      expect.objectContaining({
        'acl:agent': APP_URI,
        'acl:mode': 'acl:Control',
        'acl:default': placesContainerUri
      })
    ]);
  });

  test('User installs same app a second time and get an error', async () => {
    const [creationActivityUri] = await installApp(
      alice,
      APP_URI,
      requiredAccessNeedGroup['interop:hasAccessNeed'],
      requiredAccessNeedGroup['apods:hasSpecialRights']
    );

    await waitForExpect(async () => {
      const inbox = await alice.call('activitypub.collection.get', {
        collectionUri: alice.inbox,
        page: 1
      });

      expect(inbox?.orderedItems[0]).toMatchObject({
        type: ACTIVITY_TYPES.REJECT,
        object: creationActivityUri,
        summary: 'User already has an application registration. Update or delete it.'
      });
    });
  });

  test('User uninstalls app', async () => {
    await alice.call('activitypub.outbox.post', {
      collectionUri: alice.outbox,
      type: ACTIVITY_TYPES.UNDO,
      object: {
        type: 'apods:Install',
        object: APP_URI
      }
    });

    let appRegistrationUri;

    await waitForExpect(async () => {
      const outbox = await alice.call('activitypub.collection.get', {
        collectionUri: alice.outbox,
        page: 1
      });

      expect(outbox?.orderedItems[0]).toMatchObject({
        type: ACTIVITY_TYPES.DELETE,
        object: expect.anything(),
        to: APP_URI
      });

      appRegistrationUri = outbox?.orderedItems[0]?.object;
    });

    // The ApplicationRegistration should be deleted
    await waitForExpect(async () => {
      await expect(
        alice.call('ldp.resource.get', {
          resourceUri: appRegistrationUri,
          accept: MIME_TYPES.JSON
        })
      ).rejects.toThrow();
    });

    // It should be deleted on the app server as well
    await waitForExpect(async () => {
      await expect(
        appServer.call('ldp.remote.getStored', {
          resourceUri: appRegistrationUri,
          webId: 'system'
        })
      ).rejects.toThrow();
    });

    // A DataGrant should be deleted
    await waitForExpect(async () => {
      await expect(
        alice.call('ldp.resource.get', {
          resourceUri: requiredAccessGrant['interop:hasDataGrant'],
          accept: MIME_TYPES.JSON
        })
      ).rejects.toThrow();
    });

    // It should be deleted on the app server as well
    await waitForExpect(async () => {
      await expect(
        appServer.call('ldp.remote.getStored', {
          resourceUri: requiredAccessGrant['interop:hasDataGrant'],
          webId: 'system'
        })
      ).rejects.toThrow();
    });
  });

  test('Permissions granted to the app should be removed', async () => {
    const eventsRights = await alice.call('webacl.resource.getRights', {
      resourceUri: urlJoin(alice.id, 'data/as/event'),
      accept: MIME_TYPES.JSON,
      webId: APP_URI
    });

    expect(eventsRights['@graph']).not.toContain([
      expect.objectContaining({
        'acl:agent': APP_URI,
        'acl:mode': 'acl:Read',
        'acl:accessTo': eventsContainerUri
      })
    ]);

    expect(eventsRights['@graph']).not.toContain([
      expect.objectContaining({
        'acl:agent': APP_URI,
        'acl:mode': 'acl:Write',
        'acl:accessTo': eventsContainerUri
      })
    ]);
  });

  test('User installs app and do not grant required access needs', async () => {
    const [creationActivityUri, appRegistrationUri] = await installApp(
      alice,
      APP_URI,
      optionalAccessNeedGroup['interop:hasAccessNeed'],
      optionalAccessNeedGroup['apods:hasSpecialRights']
    );

    await waitForExpect(async () => {
      const inbox = await alice.call('activitypub.collection.get', {
        collectionUri: alice.inbox,
        page: 1
      });

      expect(inbox?.orderedItems[0]).toMatchObject({
        type: ACTIVITY_TYPES.REJECT,
        object: creationActivityUri,
        summary: 'One or more required access needs have not been granted'
      });
    });

    // The ApplicationRegistration should be deleted
    await waitForExpect(async () => {
      await expect(
        alice.call('ldp.resource.get', {
          resourceUri: appRegistrationUri,
          accept: MIME_TYPES.JSON
        })
      ).rejects.toThrow();
    });
  });

  test('User installs app and only grant required access needs', async () => {
    const [creationActivityUri] = await installApp(
      alice,
      APP_URI,
      requiredAccessNeedGroup['interop:hasAccessNeed'],
      requiredAccessNeedGroup['apods:hasSpecialRights']
    );

    await waitForExpect(async () => {
      const inbox = await alice.call('activitypub.collection.get', {
        collectionUri: alice.inbox,
        page: 1
      });

      expect(inbox?.orderedItems[0]).toMatchObject({
        type: ACTIVITY_TYPES.ACCEPT,
        object: creationActivityUri
      });
    });
  });

  test('User installs app 2 which has same requirements', async () => {
    // Install app2 with only required access needs
    await installApp(alice, APP2_URI);

    // Access to the Event container is required by App2
    await expect(
      alice.call('webacl.resource.getRights', {
        resourceUri: urlJoin(alice.id, 'data/as/event'),
        accept: MIME_TYPES.JSON
      })
    ).resolves.toMatchObject({
      '@graph': expect.arrayContaining([
        expect.objectContaining({
          'acl:agent': [APP_URI, APP2_URI],
          'acl:mode': 'acl:Read'
        }),
        expect.objectContaining({
          'acl:agent': [APP_URI, APP2_URI],
          'acl:mode': 'acl:Write'
        })
      ])
    });
  });
});
