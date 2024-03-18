import { useEffect, useState } from 'react';
import { fetchUtils } from 'react-admin';
import { arrayFromLdField } from '../utils';

const useAccessNeeds = application => {
  const [requiredAccessNeeds, setRequiredAccessNeeds] = useState([]);
  const [optionalAccessNeeds, setOptionalAccessNeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (application && !loading && !loaded) {
          setLoading(true);
          for (const accessNeedGroupUri of arrayFromLdField(application['interop:hasAccessNeedGroup'])) {
            const { json: accessNeedGroup } = await fetchUtils.fetchJson(accessNeedGroupUri);
            for (const accessNeedUri of arrayFromLdField(accessNeedGroup['interop:hasAccessNeed'])) {
              const { json: accessNeed } = await fetchUtils.fetchJson(accessNeedUri);
              if (accessNeedGroup['interop:accessNecessity'] === 'interop:AccessRequired') {
                setRequiredAccessNeeds(a => [...a, accessNeed]);
              } else {
                setOptionalAccessNeeds(a => [...a, accessNeed]);
              }
            }
            for (const specialRight of arrayFromLdField(accessNeedGroup['apods:hasSpecialRights'])) {
              if (accessNeedGroup['interop:accessNecessity'] === 'interop:AccessRequired') {
                setRequiredAccessNeeds(a => [...a, specialRight]);
              } else {
                setOptionalAccessNeeds(a => [...a, specialRight]);
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
  }, [application, setRequiredAccessNeeds, setOptionalAccessNeeds, loading, setLoading, loaded, setLoaded]);

  return { requiredAccessNeeds, optionalAccessNeeds, loading, loaded };
};

export default useAccessNeeds;
