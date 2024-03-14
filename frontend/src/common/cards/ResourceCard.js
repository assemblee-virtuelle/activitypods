import React from 'react';
import { Card, Avatar, Box, Button, Table, TableBody, TableRow, TableCell, Typography } from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useTranslate } from 'react-admin';
import useActor from '../../hooks/useActor';
import AppBadge from '../AppBadge';

const useStyles = makeStyles(theme => ({
  title: {
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    backgroundImage: `radial-gradient(circle at 50% 14em, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
    color: theme.palette.primary.contrastText,
    height: 85,
    position: 'relative'
  },
  avatarWrapper: {
    position: 'absolute',
    margin: 10,
    top: 0,
    left: 0,
    right: 0,
    textAlign: 'center'
  },
  avatar: {
    width: 150,
    height: 150
  }
}));

const ResourceCard = ({ resource, classDescription, appRegistration }) => {
  const translate = useTranslate();
  const classes = useStyles();

  const actor = useActor(resource?.creator.value);

  const created = new Date(resource?.created.value);
  const modified = new Date(resource?.modified.value);
  const dateTimeFormat = new Intl.DateTimeFormat(process.env.REACT_APP_LANG);

  if (!resource) return null;

  return (
    <Card>
      <Box className={classes.title}>
        <Box display="flex" justifyContent="center" className={classes.avatarWrapper}>
          <AppBadge large appUri={appRegistration?.['interop:registeredAgent']}>
            <Avatar className={classes.avatar}>
              <InsertDriveFileIcon sx={{ width: 100, height: 100 }} />
            </Avatar>
          </AppBadge>
        </Box>
      </Box>

      <Typography variant="h4" sx={{ mt: 10, textAlign: 'center' }}>
        {resource?.label.value}
      </Typography>
      <Box p={2}>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>{translate('app.input.creator')}</TableCell>
              <TableCell align="right">{actor.name}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>{translate('app.input.created')}</TableCell>
              <TableCell align="right">{dateTimeFormat.format(created)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>{translate('app.input.modified')}</TableCell>
              <TableCell align="right">{dateTimeFormat.format(modified)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
      {classDescription['apods:openEndpoint'] && (
        <Box sx={{ mt: 1, mb: 3, textAlign: 'center' }}>
          <a
            href={`${classDescription['apods:openEndpoint']}?type=${encodeURIComponent(
              classDescription['apods:describedClass']
            )}&uri=${encodeURIComponent(resource?.resourceUri.value)}&mode=show`}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="contained" color="secondary" type="submit">
              {translate('app.action.open')}
            </Button>
          </a>
        </Box>
      )}
    </Card>
  );
};

export default ResourceCard;
