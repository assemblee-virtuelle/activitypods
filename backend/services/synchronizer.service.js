const { SynchronizerService } = require('@activitypods/synchronizer');

module.exports = {
  mixins: [SynchronizerService],
  settings: {
    podProvider: true,
    mirrorGraph: false,
    synchronizeContainers: false,
    attachToLocalContainers: true
  }
};
