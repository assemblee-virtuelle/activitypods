import React, { useEffect, useCallback, useState } from 'react';
import { Link, useTranslate, useGetList } from 'react-admin';
import { Typography, Box, Chip, Button } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import makeStyles from '@mui/styles/makeStyles';
import WarningIcon from '@mui/icons-material/Warning';
import DoneIcon from '@mui/icons-material/Done';
import { useCheckAuthenticated } from '@semapps/auth-provider';
import { useOutbox } from '@semapps/activitypub-components';
import SimpleBox from '../../layout/SimpleBox';
import useTrustedApps from '../../hooks/useTrustedApps';
import useApplication from '../../hooks/useApplication';
import useAccessNeeds from '../../hooks/useAccessNeeds';
import AccessNeedsList from './AccessNeedsList';

const useStyles = makeStyles(() => ({
  app: {
    padding: 15,
    paddingLeft: 70,
    position: 'relative',
    border: '1px solid lightgrey'
  },
  appIcon: {
    position: 'absolute',
    top: 15,
    left: 15,
    width: 40,
    height: 40
  },
  appTitle: {
    lineHeight: 1,
    marginBottom: 8
  },
  appChip: {
    marginTop: 8,
    backgroundColor: '#8bd78b'
  },
  appUrl: {
    marginTop: 5,
    color: 'grey',
    fontStyle: 'italic'
  },
  button: {
    marginLeft: 10
  }
}));

const AuthorizePageView = () => {
  const classes = useStyles();
  useCheckAuthenticated();
  const [showScreen, setShowScreen] = useState(false);
  const [allowedAccessNeeds, setAllowedAccessNeeds] = useState();
  const outbox = useOutbox();
  const translate = useTranslate();
  const trustedApps = useTrustedApps();
  const [searchParams] = useSearchParams();
  const { data: appRegistrations, isLoading } = useGetList('AppRegistration', { page: 1, perPage: Infinity });
  const redirectTo = searchParams.get('redirect');
  const clientId = searchParams.get('client_id');
  const clientDomain = new URL(clientId).host;
  const isTrustedApp = trustedApps.some(domain => domain === clientDomain);

  if (!clientId) throw new Error('The client ID is missing !');

  const application = useApplication(clientDomain);
  const { requiredAccessNeeds, optionalAccessNeeds, loaded } = useAccessNeeds(application);

  useEffect(() => {
    if (loaded) {
      setAllowedAccessNeeds([
        ...requiredAccessNeeds.map(a => (typeof a === 'string' ? a : a?.id)),
        ...optionalAccessNeeds.map(a => (typeof a === 'string' ? a : a?.id))
      ]);
    }
  }, [loaded, requiredAccessNeeds, optionalAccessNeeds, setAllowedAccessNeeds]);

  const accessApp = useCallback(() => {
    window.location.href = redirectTo;
  }, [redirectTo]);

  const installApp = useCallback(async () => {
    await outbox.post({
      '@context': process.env.REACT_APP_JSON_CONTEXT,
      type: 'apods:Install',
      actor: outbox.owner,
      object: application.id,
      'apods:acceptedAccessNeeds': allowedAccessNeeds.filter(a => !a.startsWith('apods:')),
      'apods:acceptedSpecialRights': allowedAccessNeeds.filter(a => a.startsWith('apods:'))
    });
    accessApp();
  }, [outbox, application, allowedAccessNeeds, accessApp]);

  // Once all data are loaded, either redirect to app or show authorization screen
  useEffect(() => {
    if (!isLoading && application?.id && clientDomain) {
      if (appRegistrations.some(reg => reg['interop:registeredAgent'] === application?.id)) {
        console.log('access app');
        accessApp();
      } else {
        setShowScreen(true);
      }
    }
  }, [appRegistrations, isLoading, clientDomain, application, accessApp, setShowScreen]);

  if (!showScreen) return null;

  return (
    <SimpleBox
      title={translate('app.page.authorize')}
      icon={<WarningIcon />}
      text={translate('app.helper.authorize', { appDomain: clientDomain })}
    >
      {application && (
        <>
          <Box p={2} pb={0}>
            <div className={classes.app}>
              <img
                src={application['interop:applicationThumbnail']}
                alt={application['interop:applicationName']}
                className={classes.appIcon}
              />
              <Typography variant="h4" className={classes.appTitle}>
                {application['interop:applicationName']}
              </Typography>
              <Typography variant="body2">{application['interop:applicationDescription']}</Typography>
              <Typography variant="body2" className={classes.appUrl}>
                {clientDomain}
              </Typography>
              {isTrustedApp && (
                <Chip
                  size="small"
                  label={translate('app.message.verified_app')}
                  color="primary"
                  onDelete={() => {}}
                  deleteIcon={<DoneIcon />}
                  className={classes.appChip}
                />
              )}
            </div>
          </Box>
          <AccessNeedsList
            required
            accessNeeds={requiredAccessNeeds}
            allowedAccessNeeds={allowedAccessNeeds}
            setAllowedAccessNeeds={setAllowedAccessNeeds}
          />
          <AccessNeedsList
            accessNeeds={optionalAccessNeeds}
            allowedAccessNeeds={allowedAccessNeeds}
            setAllowedAccessNeeds={setAllowedAccessNeeds}
          />
        </>
      )}
      <Box p={2} display="flex" justifyContent="end">
        <Button variant="contained" color="secondary" className={classes.button} onClick={installApp}>
          {translate('app.action.accept')}
        </Button>
        <Link to="/AppRegistration">
          <Button variant="contained" className={classes.button}>
            {translate('app.action.reject')}
          </Button>
        </Link>
      </Box>
    </SimpleBox>
  );
};

export default AuthorizePageView;
