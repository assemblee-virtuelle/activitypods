const dataServers = {
  pod: {
    pod: true,
    authServer: true,
    default: true,
    baseUrl: null, // Calculated from the token
    sparqlEndpoint: null,
    containers: {
      pod: {
        'vcard:Individual': ['/vcard/individual'],
        'as:Event': ['/as/event']
      }
    },
    uploadsContainer: '/semapps/file'
  }
};

export default dataServers;
