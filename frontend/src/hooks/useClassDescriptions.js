import { useEffect, useState } from 'react';
import { fetchUtils, useGetList } from 'react-admin';
import { arrayFromLdField } from '../utils';

const useClassDescriptions = application => {
  const [appData, setAppData] = useState([]);
  const { data: currentData } = useGetList('ClassDescription');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (application && currentData && !loading && !loaded) {
          setLoading(true);
          for (const accessDescriptionSetUri of arrayFromLdField(application['interop:hasAccessDescriptionSet'])) {
            const { json: accessDescriptionSet } = await fetchUtils.fetchJson(accessDescriptionSetUri);
            if (accessDescriptionSet['interop:usesLanguage'] === process.env.REACT_APP_LANG) {
              for (const classDescriptionUri of arrayFromLdField(accessDescriptionSet['apods:hasClassDescription'])) {
                const { json: classDescription } = await fetchUtils.fetchJson(classDescriptionUri);
                setAppData(oldData => {
                  oldData.push(classDescription);
                  return oldData;
                });
              }
            }
          }
          setLoaded(true);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    })();
  }, [application, currentData, setAppData, loading, setLoading, loaded, setLoaded]);

  return { classDescriptions: loaded ? [...appData, ...currentData] : [], loading, loaded };
};

export default useClassDescriptions;
