const { ControlledContainerMixin } = require('@semapps/ldp');
const { ACTOR_TYPES } = require('@semapps/activitypub');

module.exports = {
  name: 'actors',
  mixins: [ControlledContainerMixin],
  settings: {
    path: '/as/actor',
    acceptedTypes: [ACTOR_TYPES.APPLICATION, 'interop:Application'],
    readOnly: true
  }
};
