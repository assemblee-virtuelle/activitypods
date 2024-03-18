import React from 'react';
import { Show, SimpleShowLayout, TextField, DateField } from 'react-admin';

const ProfileShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="vcard:given-name" />
      <TextField source="describes" />
      <TextField source="vcard:note" />
      <DateField source="dc:created" options={{ month: 'long', day: 'numeric', year: 'numeric' }} />
    </SimpleShowLayout>
  </Show>
);

export default ProfileShow;
