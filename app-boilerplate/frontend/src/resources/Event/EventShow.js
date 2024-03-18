import React from 'react';
import {
  Show,
  SimpleShowLayout,
  TextField,
  DateField,
  TopToolbar,
  EditButton,
  useNotify,
  Button,
  useGetRecordId
} from 'react-admin';
import { useOutbox, ACTIVITY_TYPES } from '@semapps/activitypub-components';

const EventShowActions = ({ onInvite }) => (
  <TopToolbar>
    <EditButton />
    <Button color="primary" onClick={onInvite}>
      Test Invite Action
    </Button>
  </TopToolbar>
);

const EventShow = () => {
  const outbox = useOutbox();
  const notify = useNotify();
  const recordId = useGetRecordId();

  const invite = React.useCallback(async () => {
    try {
      await outbox.post({
        type: ACTIVITY_TYPES.INVITE,
        actor: outbox.owner,
        object: recordId,
        to: outbox.owner
      });
      notify('You invited yourself to your own event. Enjoy!');
    } catch (e) {
      notify(e.message, { type: 'error' });
    }
  }, [outbox, notify, recordId]);

  return (
    <Show actions={<EventShowActions onInvite={invite} />}>
      <SimpleShowLayout>
        <TextField source="name" />
        <TextField source="content" />
        <DateField source="startTime" />
      </SimpleShowLayout>
    </Show>
  );
};

export default EventShow;
