const { ACTIVITY_TYPES, OBJECT_TYPES } = require('@semapps/activitypub');

const JOIN_EVENT = {
  type: ACTIVITY_TYPES.JOIN,
  object: {
    type: OBJECT_TYPES.EVENT,
  },
};

const LEAVE_EVENT = {
  type: ACTIVITY_TYPES.LEAVE,
  object: {
    type: OBJECT_TYPES.EVENT,
  },
};

// const NEW_MESSAGE_ABOUT_EVENT = {
//   type: ACTIVITY_TYPES.CREATE,
//   object: {
//     type: OBJECT_TYPES.NOTE,
//     context: {
//       type: OBJECT_TYPES.EVENT
//     }
//   },
// };

const POST_EVENT_CONTACT_REQUEST = {
  type: ACTIVITY_TYPES.OFFER,
  object: {
    type: ACTIVITY_TYPES.ADD,
    object: {
      type: OBJECT_TYPES.PROFILE,
    }
  },
  context: {
    type: OBJECT_TYPES.EVENT
  }
};

const POST_EVENT_ACCEPT_CONTACT_REQUEST = {
  type: ACTIVITY_TYPES.ACCEPT,
  object: {
    type: ACTIVITY_TYPES.OFFER,
    object: {
      type: ACTIVITY_TYPES.ADD,
      object: {
        type: OBJECT_TYPES.PROFILE,
      },
    },
    context: {
      type: OBJECT_TYPES.EVENT
    }
  },
};

module.exports = {
  JOIN_EVENT,
  LEAVE_EVENT,
  // NEW_MESSAGE_ABOUT_EVENT,
  POST_EVENT_CONTACT_REQUEST,
  POST_EVENT_ACCEPT_CONTACT_REQUEST
};
