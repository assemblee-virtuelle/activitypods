const { ACTIVITY_TYPES, OBJECT_TYPES } = require('@semapps/activitypub');

const CREATE_COMMENT = {
  type: ACTIVITY_TYPES.CREATE,
  object: {
    type: OBJECT_TYPES.NOTE,
    inReplyTo: {
      type: Object.values(OBJECT_TYPES)
    }
  },
};

module.exports = {
  CREATE_COMMENT
};
