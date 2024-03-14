import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDataModels } from '@semapps/semantic-data-provider';
import ontologies from '../config/ontologies.json';

const prefix = uri => {
  if (!uri.startsWith('http')) return uri; // If it is already prefixed
  const ontology = ontologies.find(o => uri.startsWith(o.url));
  return uri.replace(ontology.url, ontology.prefix + ':');
};

const RedirectPage = () => {
  const dataModels = useDataModels();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (dataModels) {
      const prefixedType = prefix(searchParams.get('type'));
      const resource = Object.keys(dataModels).find(
        key => dataModels[key].types && dataModels[key].types.includes(prefixedType)
      );
      if (searchParams.has('uri')) {
        navigate(
          `/${resource}/${encodeURIComponent(searchParams.get('uri'))}${
            searchParams.get('mode') === 'show' ? '/show' : ''
          }`
        );
      } else if (resource) {
        navigate(`/${resource}`);
      } else {
        navigate('/');
      }
    }
  }, [dataModels, searchParams, navigate]);

  return null;
};

export default RedirectPage;
