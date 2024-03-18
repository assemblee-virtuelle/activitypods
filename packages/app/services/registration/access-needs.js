const { ControlledContainerMixin } = require('@semapps/ldp');

module.exports = {
  name: 'access-needs',
  mixins: [ControlledContainerMixin],
  settings: {
    acceptedTypes: ['interop:AccessNeed'],
    readOnly: true
  }
};
