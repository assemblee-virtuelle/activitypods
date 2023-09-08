import React from 'react';
import { useTranslate } from 'react-admin';
import { useCheckAuthenticated } from '@semapps/auth-provider';
import Create from '../../layout/Create';
import GroupForm from './GroupForm';

export const GroupCreate = (props) => {
  const { identity } = useCheckAuthenticated();
  const translate = useTranslate();
  if (!identity) return null;
  return (
    <Create {...props}>
      <GroupForm defaultValues={{ 'vcard:label': translate('app.group.label') }} />
    </Create>
  );
};

export default GroupCreate;