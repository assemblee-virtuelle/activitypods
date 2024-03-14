import { useMemo } from 'react';
import { useGetOne, useGetIdentity } from 'react-admin';
import { formatUsername } from '../utils';

const useActor = actorUri => {
  const { data: identity } = useGetIdentity();

  const { data: webId, isLoading: isWebIdLoading } = useGetOne(
    'Actor',
    {
      id: actorUri
    },
    {
      enabled: !!actorUri,
      staleTime: Infinity
    }
  );

  const { data: profile, isLoading: isProfileLoading } = useGetOne(
    'Profile',
    {
      id: webId?.url
    },
    {
      enabled: !!webId?.url,
      staleTime: Infinity
    }
  );

  const username = useMemo(() => actorUri && formatUsername(actorUri), [actorUri]);

  return {
    ...webId,
    uri: actorUri,
    isLoggedUser: actorUri === identity?.id,
    name: profile?.['vcard:given-name'] || webId?.name || webId?.['foaf:nick'] || webId?.preferredUsername,
    image: profile?.['vcard:photo'] || webId?.icon?.url,
    username,
    isLoading: isWebIdLoading || isProfileLoading
  };
};

export default useActor;
