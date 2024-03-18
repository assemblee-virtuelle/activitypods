import React, { useEffect, useState } from 'react';
import { useNotify, useLocaleState, useTranslate, useLogin, useLogout } from 'react-admin';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Card,
  Typography
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import LockIcon from '@mui/icons-material/Lock';
import StorageIcon from '@mui/icons-material/Storage';

const useStyles = makeStyles(theme => ({
  '@global': {
    body: {
      backgroundColor: theme.palette.primary.main
    }
  },
  text: {
    textAlign: 'center',
    padding: '4px 8px 8px'
  },
  card: {
    minWidth: 300,
    maxWidth: 350,
    marginTop: '6em',
    [theme.breakpoints.down('sm')]: {
      margin: '1em'
    }
  },
  lockIconAvatar: {
    margin: '1em',
    display: 'flex',
    justifyContent: 'center'
  },
  lockIcon: {
    backgroundColor: theme.palette.grey['500']
  },
  list: {
    paddingTop: 0,
    paddingBottom: 0
  }
}));

const PodProvider = ({ podProvider, onSelect }) => (
  <>
    <Divider />
    <ListItem>
      <ListItemButton onClick={onSelect}>
        <ListItemAvatar>
          <Avatar>
            <StorageIcon />
          </Avatar>
        </ListItemAvatar>
        <ListItemText primary={podProvider['apods:domainName']} secondary={podProvider['apods:area']} />
      </ListItemButton>
    </ListItem>
  </>
);

const PodLoginPageView = ({ text, customPodProviders }) => {
  const classes = useStyles();
  const notify = useNotify();
  const [searchParams] = useSearchParams();
  const [locale] = useLocaleState();
  const login = useLogin();
  const logout = useLogout();
  const translate = useTranslate();
  const [podProviders, setPodProviders] = useState(customPodProviders || []);

  useEffect(() => {
    (async () => {
      if (podProviders.length === 0) {
        const results = await fetch('https://data.activitypods.org/pod-providers', {
          headers: {
            Accept: 'application/ld+json'
          }
        });
        if (results.ok) {
          const json = await results.json();
          // Filter POD providers by available locales
          const podProviders = json['ldp:contains'].filter(provider =>
            Array.isArray(provider['apods:locales'])
              ? provider['apods:locales'].includes(locale)
              : provider['apods:locales'] === locale
          );
          setPodProviders(podProviders);
        } else {
          notify('auth.message.pod_providers_not_loaded', 'error');
        }
      }
    })();
  }, [podProviders, setPodProviders, notify, locale]);

  useEffect(() => {
    if (searchParams.has('iss')) {
      // Automatically login if Pod provider is known
      login({ issuer: searchParams.get('iss') });
    } else if (searchParams.has('logout')) {
      logout();
    }
  }, [searchParams, login, logout]);

  return (
    <Box display="flex" flexDirection="column" alignItems="center">
      <Card className={classes.card}>
        <div className={classes.lockIconAvatar}>
          <Avatar className={classes.lockIcon}>
            <LockIcon />
          </Avatar>
        </div>
        <Box pl={2} pr={2}>
          <Typography variant="body2" className={classes.text}>
            {text || translate('auth.message.choose_pod_provider')}
          </Typography>
        </Box>
        <Box m={2}>
          <List className={classes.list}>
            {podProviders.map((podProvider, i) => (
              <PodProvider
                key={i}
                podProvider={podProvider}
                onSelect={() =>
                  login({
                    // TODO include HTTP scheme in Pod providers list
                    issuer: `${podProvider['apods:domainName'].includes('localhost') ? 'http' : 'https'}://${
                      podProvider['apods:domainName']
                    }`
                  })
                }
              />
            ))}
          </List>
        </Box>
      </Card>
    </Box>
  );
};

export default PodLoginPageView;
