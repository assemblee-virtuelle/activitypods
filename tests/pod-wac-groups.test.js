const path = require('path');
const urlJoin = require('url-join');
const { MIME_TYPES } = require('@semapps/mime-types');
const { initialize, initializeAppServer, clearDataset, listDatasets, installApp } = require('./initialize');
const ExampleAppService = require('./apps/example.app');
const Example2AppService = require('./apps/example2.app');

jest.setTimeout(100000);

const NUM_PODS = 1;

const APP_SERVER_BASE_URL = 'http://localhost:3001';
const APP_URI = urlJoin(APP_SERVER_BASE_URL, 'app');

const APP2_SERVER_BASE_URL = 'http://localhost:3002';
const APP2_URI = urlJoin(APP2_SERVER_BASE_URL, 'app');

describe('Test Pod WAC groups handling', () => {
  let actors = [],
    podServer,
    alice,
    appServer,
    app2Server;

  beforeAll(async () => {
    const datasets = await listDatasets();
    for (let dataset of datasets) {
      await clearDataset(dataset);
    }

    podServer = await initialize(3000, 'settings');
    await podServer.loadService(path.resolve(__dirname, './services/profiles.app.js'));
    await podServer.start();

    appServer = await initializeAppServer(3001, 'app_settings');
    await appServer.createService(ExampleAppService);
    await appServer.start();

    app2Server = await initializeAppServer(3002, 'app2_settings');
    await app2Server.createService(Example2AppService);
    await app2Server.start();

    for (let i = 1; i <= NUM_PODS; i++) {
      const actorData = require(`./data/actor${i}.json`);
      const { webId } = await podServer.call('auth.signup', actorData);
      actors[i] = await podServer.call(
        'activitypub.actor.awaitCreateComplete',
        {
          actorUri: webId,
          additionalKeys: ['url']
        },
        { meta: { dataset: actorData.username } }
      );
      actors[i].call = (actionName, params, options = {}) =>
        podServer.call(actionName, params, {
          ...options,
          meta: { ...options.meta, webId, dataset: actors[i].preferredUsername }
        });
    }

    alice = actors[1];

    await installApp(alice, APP_URI);
    await installApp(alice, APP2_URI);
  }, 100000);

  afterAll(async () => {
    await podServer.stop();
    await appServer.stop();
  });

  test('Create WAC group with apods:CreateAclGroup permission', async () => {
    await expect(
      appServer.call('pod-wac-groups.create', {
        groupSlug: 'my-group',
        actorUri: alice.id
      })
    ).resolves.toBe('http://localhost:3000/_groups/alice/my-group');

    await expect(
      appServer.call('pod-wac-groups.get', {
        groupSlug: 'my-group',
        actorUri: alice.id
      })
    ).resolves.toHaveLength(0);

    await expect(
      appServer.call('pod-wac-groups.list', {
        actorUri: alice.id
      })
    ).resolves.toContain('http://localhost:3000/_groups/alice/my-group');
  });

  test('Add permission without apods:CreateAclGroup permission', async () => {
    await expect(
      app2Server.call('pod-wac-groups.create', {
        groupSlug: 'my-other-group',
        actorUri: alice.id
      })
    ).rejects.toThrow();
  });

  test('Add members to WAC group', async () => {
    await expect(
      appServer.call('pod-wac-groups.addMember', {
        groupSlug: 'my-group',
        memberUri: 'http://localhost:3000/bob',
        actorUri: alice.id
      })
    ).resolves.toBeTruthy();

    await expect(
      appServer.call('pod-wac-groups.get', {
        groupSlug: 'my-group',
        actorUri: alice.id
      })
    ).resolves.toContain('http://localhost:3000/bob');
  });

  test('Remove members from WAC group', async () => {
    await expect(
      appServer.call('pod-wac-groups.removeMember', {
        groupSlug: 'my-group',
        memberUri: 'http://localhost:3000/bob',
        actorUri: alice.id
      })
    ).resolves.toBeTruthy();

    await expect(
      appServer.call('pod-wac-groups.get', {
        groupSlug: 'my-group',
        actorUri: alice.id
      })
    ).resolves.toHaveLength(0);
  });

  test('Delete WAC group', async () => {
    await expect(
      appServer.call('pod-wac-groups.delete', {
        groupSlug: 'my-group',
        actorUri: alice.id
      })
    ).resolves.toBeTruthy();

    await expect(
      appServer.call('pod-wac-groups.get', {
        groupSlug: 'my-group',
        actorUri: alice.id
      })
    ).rejects.toThrow();
  });
});
