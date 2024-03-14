import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGetList, useTranslate, Button } from 'react-admin';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  Avatar,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Dialog,
  useMediaQuery
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useCheckAuthenticated } from '@semapps/auth-provider';
import AppBadge from '../../common/AppBadge';
import ListView from '../../layout/ListView';
import useResourcesByType from '../../hooks/useResourcesByType';
import ResourceCard from '../../common/cards/ResourceCard';

const useStyles = makeStyles(() => ({
  listItem: {
    backgroundColor: 'white',
    padding: 0,
    marginBottom: 8,
    boxShadow: '0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%)'
  },
  listItemText: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    marginRight: 32
  }
}));

const MyDataButton = ({ color }) => {
  const translate = useTranslate();
  return (
    <Link to="/data">
      <Button label={translate('app.page.data')} color={color}>
        <ArrowBackIcon />
      </Button>
    </Link>
  );
};

const DataTypePage = () => {
  useCheckAuthenticated();
  const classes = useStyles();
  const { type } = useParams();
  const translate = useTranslate();
  const [selected, setSelected] = useState();
  const xs = useMediaQuery(theme => theme.breakpoints.down('sm'), { noSsr: true });

  const { data: classDescriptions } = useGetList('ClassDescription', {}, { staleTime: Infinity });
  const { data: appRegistrations } = useGetList('AppRegistration', {}, { staleTime: Infinity });

  const classDescription = classDescriptions?.find(desc => desc['apods:describedClass'] === type);
  const appRegistration = appRegistrations?.find(
    appReg => appReg['apods:preferredForClass'] === classDescription['apods:describedClass']
  );
  const { resources, isLoading, isLoaded } = useResourcesByType(type, classDescription);

  if (!classDescriptions || !appRegistrations) return null;

  return (
    <ListView
      title={classDescription?.['skos:prefLabel']}
      actions={[<MyDataButton />]}
      asides={
        selected && !xs
          ? [<ResourceCard resource={selected} classDescription={classDescription} appRegistration={appRegistration} />]
          : null
      }
    >
      <Box>
        <List>
          {isLoading && <CircularProgress />}
          {isLoaded && resources.length === 0 && translate('ra.navigation.no_results')}
          {resources?.map(resource => (
            <ListItem className={classes.listItem} key={resource.resourceUri.value}>
              <ListItemButton onClick={() => setSelected(resource)}>
                <ListItemAvatar>
                  <AppBadge appUri={appRegistration?.['interop:registeredAgent']}>
                    <Avatar>
                      <InsertDriveFileIcon />
                    </Avatar>
                  </AppBadge>
                </ListItemAvatar>
                <ListItemText
                  primary={resource.label.value}
                  secondary={resource.resourceUri.value}
                  className={classes.listItemText}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
      {xs && (
        <Dialog fullWidth open={!!selected} onClose={() => setSelected(null)}>
          <ResourceCard resource={selected} classDescription={classDescription} appRegistration={appRegistration} />
        </Dialog>
      )}
    </ListView>
  );
};

export default DataTypePage;
