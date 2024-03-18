module.exports = {
  NotificationListenerService: require('./services/listener'),
  NotificationProviderService: require('./services/provider'),
  ActivitiesListenerMixin: require('../app/services/pod-handling/pod-activities-watcher')
};
