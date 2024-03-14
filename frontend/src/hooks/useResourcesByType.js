import { useEffect, useState } from 'react';
import urlJoin from 'url-join';
import jsonld from 'jsonld';
import dashify from 'dashify';
import { useDataProvider, useGetIdentity } from 'react-admin';

const typeToContainerPath = type => {
  const regex = /^([^:]+):([^:]+)$/gm;

  if (type.match(regex)) {
    const matchResults = regex.exec(type);
    if (matchResults) {
      const prefix = matchResults[1];
      const className = matchResults[2];
      return `/${prefix}/${dashify(className)}`;
    }
  } else {
    throw new Error(`The resourceType must a prefixed type. Provided: ${type}`);
  }
};

const useResourcesByType = (type, classDescription) => {
  const { data: identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      if (type && classDescription && identity?.id) {
        try {
          const [expandedClassDescription] = await jsonld.expand(classDescription);
          const containerUri = urlJoin(identity.id, 'data', typeToContainerPath(type));

          const { json } = await dataProvider.fetch(urlJoin(identity.id, 'sparql'), {
            method: 'POST',
            body: `
              PREFIX ldp: <http://www.w3.org/ns/ldp#>
              PREFIX dc: <http://purl.org/dc/terms/>
              SELECT ?resourceUri ?label ?creator ?created ?modified
              WHERE {
                <${containerUri}> ldp:contains ?resourceUri .
                OPTIONAL {
                  ?resourceUri <${expandedClassDescription['http://activitypods.org/ns/core#labelPredicate'][0]['@id']}> ?label .
                  ?resourceUri dc:creator ?creator .
                  ?resourceUri dc:created ?created .
                  ?resourceUri dc:modified ?modified .
                }
              }
            `
          });

          setResources(json);
          setIsLoading(false);
          setIsLoaded(true);
        } catch (e) {
          console.error(e);
          setIsLoading(false);
        }
      }
    })();
  }, [type, classDescription, identity, dataProvider, setResources, setIsLoading, setIsLoaded]);

  return { resources, isLoading, isLoaded };
};

export default useResourcesByType;
