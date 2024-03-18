import React from 'react';
import { TextInput, required, SimpleForm } from 'react-admin';
import { DateTimeInput } from '@semapps/date-components';

const EventForm = () => (
  <SimpleForm>
    <TextInput source="name" fullWidth validate={[required()]} />
    <TextInput source="content" fullWidth multiline rows={10} validate={[required()]} />
    <DateTimeInput source="startTime" validate={[required()]} />
  </SimpleForm>
);

export default EventForm;
