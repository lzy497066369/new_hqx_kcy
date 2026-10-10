import { message, Modal } from 'antdv-next';

import { $t } from '#/locales';

const ACTION_MESSAGE_KEY = 'system_action_message';

function getErrorContent(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  if (error && typeof error === 'object') {
    const errorMessage = (error as { message?: unknown }).message;
    if (typeof errorMessage === 'string' && errorMessage) {
      return errorMessage;
    }
  }

  return $t('page.auth.requestFailed');
}

export function confirmAction(content: string, title = $t('ui.actionMessage.updateTitle')) {
  return new Promise<boolean>((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('cancel'));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}

export function showActionLoading(content: string) {
  return message.loading({
    content,
    duration: 0,
    key: ACTION_MESSAGE_KEY,
  });
}

export function showActionSuccess(content: string) {
  message.success({
    content,
    key: ACTION_MESSAGE_KEY,
  });
}

export function showActionError(content: string) {
  message.error({
    content,
    key: ACTION_MESSAGE_KEY,
  });
}

export function showActionFailure(error: unknown) {
  showActionError(getErrorContent(error));
}
