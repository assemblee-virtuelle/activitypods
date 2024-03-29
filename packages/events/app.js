const AttendeesMatcherService = require('./services/attendees-matcher');
const EventService = require('./services/event');
const LocationService = require('./services/location');
const MessageService = require('./services/message');
const RegistrationService = require('./services/registration');
const StatusService = require('./services/status');

const EventsApp = {
  name: 'events',
  created() {
    this.broker.createService(EventService);

    this.broker.createService(LocationService);

    this.broker.createService(MessageService);

    this.broker.createService(RegistrationService);

    this.broker.createService(AttendeesMatcherService);

    this.broker.createService(StatusService);
  }
};

module.exports = EventsApp;
