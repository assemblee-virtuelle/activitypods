import { useNodeinfo } from '@semapps/activitypub-components';

const useApplication = clientDomain => {
  const application = useNodeinfo(clientDomain, 'https://www.w3.org/ns/activitystreams#Application');
  return application;
};

export default useApplication;
