import type {
  EnterpriseProfileItem,
  EnterpriseWorkspaceContact,
  EnterpriseWorkspaceContactInput,
  EnterpriseWorkspaceProfileInput,
} from '#/api';

import { shallowRef, watch } from 'vue';
import {
  createEnterpriseWorkspaceContactApi,
  deleteEnterpriseWorkspaceContactApi,
  getEnterpriseWorkspaceContactsApi,
  getEnterpriseWorkspaceProfileApi,
  updateEnterpriseWorkspaceContactApi,
  updateEnterpriseWorkspaceProfileApi,
} from '#/api';

import { useEnterpriseContextStore } from '#/store';

export function useEnterpriseProfile() {
  const enterpriseContextStore = useEnterpriseContextStore();
  const contacts = shallowRef<EnterpriseWorkspaceContact[]>([]);
  const loading = shallowRef(false);
  const profile = shallowRef<EnterpriseProfileItem>();
  const saving = shallowRef(false);

  function getEnterpriseId() {
    return enterpriseContextStore.currentEnterpriseId ?? '';
  }

  async function load() {
    const enterpriseId = getEnterpriseId();
    if (!enterpriseId) {
      profile.value = undefined;
      contacts.value = [];
      return;
    }

    loading.value = true;
    try {
      const [nextProfile, nextContacts] = await Promise.all([
        getEnterpriseWorkspaceProfileApi(enterpriseId),
        getEnterpriseWorkspaceContactsApi(enterpriseId),
      ]);
      profile.value = nextProfile;
      contacts.value = nextContacts;
    } finally {
      loading.value = false;
    }
  }

  async function saveProfile(data: EnterpriseWorkspaceProfileInput) {
    const enterpriseId = getEnterpriseId();
    saving.value = true;
    try {
      profile.value = await updateEnterpriseWorkspaceProfileApi(enterpriseId, data);
      return profile.value;
    } finally {
      saving.value = false;
    }
  }

  async function saveContact(
    data: EnterpriseWorkspaceContactInput,
    contactId?: string,
  ) {
    const enterpriseId = getEnterpriseId();
    saving.value = true;
    try {
      if (contactId) {
        await updateEnterpriseWorkspaceContactApi(enterpriseId, contactId, data);
      } else {
        await createEnterpriseWorkspaceContactApi(enterpriseId, data);
      }
      contacts.value = await getEnterpriseWorkspaceContactsApi(enterpriseId);
    } finally {
      saving.value = false;
    }
  }

  async function removeContact(contactId: string) {
    const enterpriseId = getEnterpriseId();
    saving.value = true;
    try {
      await deleteEnterpriseWorkspaceContactApi(enterpriseId, contactId);
      contacts.value = contacts.value.filter((item) => item.id !== contactId);
    } finally {
      saving.value = false;
    }
  }

  watch(
    () => enterpriseContextStore.currentEnterpriseId,
    () => void load(),
    { immediate: true },
  );

  return {
    contacts,
    loading,
    profile,
    removeContact,
    saveContact,
    saveProfile,
    saving,
  };
}
