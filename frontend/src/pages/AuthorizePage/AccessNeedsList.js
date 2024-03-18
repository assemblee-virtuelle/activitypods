import React, { useCallback } from 'react';
import { useTranslate } from 'react-admin';
import { List, ListItem, ListItemIcon, ListItemText, ListSubheader, Switch } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import NotificationsIcon from '@mui/icons-material/Notifications';
import OutboxIcon from '@mui/icons-material/Outbox';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import SearchIcon from '@mui/icons-material/Search';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { arrayFromLdField } from '../../utils';

const specialRights = {
  'apods:ReadInbox': {
    label: 'app.authorization.read_inbox',
    icon: MoveToInboxIcon
  },
  'apods:ReadOutbox': {
    label: 'app.authorization.read_outbox',
    icon: OutboxIcon
  },
  'apods:PostOutbox': {
    label: 'app.authorization.post_outbox',
    icon: OutboxIcon
  },
  'apods:SendNotification': {
    label: 'app.authorization.send_notification',
    icon: NotificationsIcon
  },
  'apods:QuerySparqlEndpoint': {
    label: 'app.authorization.query_sparql_endpoint',
    icon: SearchIcon
  },
  'apods:CreateAclGroup': {
    label: 'app.authorization.create_acl_group',
    icon: GroupAddIcon
  }
};

const AccessNeedsList = ({ accessNeeds, required, allowedAccessNeeds, setAllowedAccessNeeds }) => {
  const translate = useTranslate();

  const parseAccessNeed = useCallback(
    accessNeed => {
      if (typeof accessNeed === 'string') {
        const { label, icon } = specialRights[accessNeed];
        return {
          label: translate(label),
          icon
        };
      } else {
        const accessRights = [];

        const hasRead = arrayFromLdField(accessNeed['interop:accessMode']).includes('acl:Read');
        const hasAppend = arrayFromLdField(accessNeed['interop:accessMode']).includes('acl:Append');
        const hasWrite = arrayFromLdField(accessNeed['interop:accessMode']).includes('acl:Write');
        const hasControl = arrayFromLdField(accessNeed['interop:accessMode']).includes('acl:Control');

        if (hasRead) accessRights.push(translate('app.authorization.read'));
        if (hasAppend) accessRights.push(translate('app.authorization.append'));
        if (hasWrite) accessRights.push(translate('app.authorization.write'));
        if (hasControl) accessRights.push(translate('app.authorization.control'));

        return {
          label: translate('app.authorization.access_resources_of_type', {
            access_right: accessRights.join('/'),
            type: accessNeed['apods:registeredClass']
          }),
          icon: hasAppend || hasWrite ? CreateNewFolderIcon : FolderIcon
        };
      }
    },
    [translate]
  );

  const toggle = useCallback(
    (accessNeed, checked) => {
      if (checked) {
        setAllowedAccessNeeds(a => a.filter(a => a !== accessNeed && a !== accessNeed?.id));
      } else {
        setAllowedAccessNeeds(a => [...a, accessNeed?.id || accessNeed]);
      }
    },
    [setAllowedAccessNeeds]
  );

  return (
    <List
      sx={{ width: '100%', bgcolor: 'background.paper' }}
      subheader={
        <ListSubheader>
          {translate(required ? 'app.authorization.required' : 'app.authorization.optional')}
        </ListSubheader>
      }
    >
      {accessNeeds.map((accessNeed, i) => {
        const { label, icon } = parseAccessNeed(accessNeed);
        const checked = arrayFromLdField(allowedAccessNeeds).some(a => a === accessNeed || a === accessNeed?.id);
        return (
          <ListItem key={i} sx={{ pt: 0, pb: 0 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>{React.createElement(icon)}</ListItemIcon>
            <ListItemText primary={label} />
            <Switch edge="end" onChange={() => toggle(accessNeed, checked)} checked={checked} disabled={required} />
          </ListItem>
        );
      })}
    </List>
  );
};

export default AccessNeedsList;
