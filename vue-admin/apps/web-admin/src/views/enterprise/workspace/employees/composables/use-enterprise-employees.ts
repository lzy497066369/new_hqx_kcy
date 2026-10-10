import type {
  EnterpriseWorkspaceEmployee,
  EnterpriseWorkspaceEmployeeInput,
  EnterpriseWorkspaceEmployeeImportPreview,
  EnterpriseWorkspaceEmployeeList,
  EnterpriseWorkspaceEmployeeListParams,
} from '#/api';

import { reactive, shallowRef, watch } from 'vue';
import {
  createEnterpriseWorkspaceEmployeeApi,
  confirmEnterpriseWorkspaceEmployeeImportApi,
  deleteEnterpriseWorkspaceEmployeeApi,
  downloadEnterpriseWorkspaceEmployeeExportApi,
  downloadEnterpriseWorkspaceEmployeeTemplateApi,
  getEnterpriseWorkspaceEmployeesApi,
  previewEnterpriseWorkspaceEmployeeImportApi,
  updateEnterpriseWorkspaceEmployeeApi,
} from '#/api';

import { useEnterpriseContextStore } from '#/store';

export function useEnterpriseEmployees() {
  const enterpriseContextStore = useEnterpriseContextStore();
  const data = shallowRef<EnterpriseWorkspaceEmployeeList>();
  const deletingEmployeeId = shallowRef<string>();
  const editorOpen = shallowRef(false);
  const editingEmployee = shallowRef<EnterpriseWorkspaceEmployee>();
  const importPreview = shallowRef<EnterpriseWorkspaceEmployeeImportPreview>();
  const importPreviewOpen = shallowRef(false);
  const importUploadOpen = shallowRef(false);
  const importing = shallowRef(false);
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const filters = reactive<Required<EnterpriseWorkspaceEmployeeListParams>>({
    activeStatus: 'all',
    employeeType: 0,
    keyword: '',
    page: 1,
    pageSize: 20,
    researchStatus: 'all',
  });
  let loadRequestId = 0;

  function getEnterpriseId() {
    return enterpriseContextStore.currentEnterpriseId ?? '';
  }

  async function load() {
    const enterpriseId = getEnterpriseId();
    const requestId = ++loadRequestId;
    if (!enterpriseId) {
      data.value = undefined;
      loading.value = false;
      return;
    }
    loading.value = true;
    try {
      const result = await getEnterpriseWorkspaceEmployeesApi(enterpriseId, {
        ...filters,
        employeeType: filters.employeeType || undefined,
        keyword: filters.keyword.trim() || undefined,
      });
      if (requestId === loadRequestId && enterpriseId === getEnterpriseId()) {
        data.value = result;
      }
    } finally {
      if (requestId === loadRequestId) {
        loading.value = false;
      }
    }
  }

  function openEditor(employee?: EnterpriseWorkspaceEmployee) {
    editingEmployee.value = employee;
    editorOpen.value = true;
  }

  function applyFilters() {
    filters.page = 1;
    return load();
  }

  function resetFilters() {
    Object.assign(filters, {
      activeStatus: 'all',
      employeeType: 0,
      keyword: '',
      page: 1,
      pageSize: 20,
      researchStatus: 'all',
    });
    return load();
  }

  function changePage(page: number, pageSize: number) {
    filters.page = page;
    filters.pageSize = pageSize;
    return load();
  }

  async function saveEmployee(data: EnterpriseWorkspaceEmployeeInput) {
    const enterpriseId = getEnterpriseId();
    saving.value = true;
    try {
      if (editingEmployee.value) {
        await updateEnterpriseWorkspaceEmployeeApi(
          enterpriseId,
          editingEmployee.value.id,
          data,
        );
      } else {
        await createEnterpriseWorkspaceEmployeeApi(enterpriseId, data);
        filters.page = 1;
      }
      editorOpen.value = false;
      editingEmployee.value = undefined;
      await load();
    } finally {
      saving.value = false;
    }
  }

  async function removeEmployee(employeeId: string) {
    deletingEmployeeId.value = employeeId;
    try {
      await deleteEnterpriseWorkspaceEmployeeApi(getEnterpriseId(), employeeId);
      if (data.value?.items.length === 1 && filters.page > 1) {
        filters.page -= 1;
      }
      await load();
    } finally {
      deletingEmployeeId.value = undefined;
    }
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadImportTemplate() {
    const blob = await downloadEnterpriseWorkspaceEmployeeTemplateApi(
      getEnterpriseId(),
    );
    downloadBlob(blob, '员工花名册模板.xlsx');
  }

  async function downloadEmployeeExport() {
    const blob = await downloadEnterpriseWorkspaceEmployeeExportApi(
      getEnterpriseId(),
    );
    downloadBlob(blob, '员工花名册.xlsx');
  }

  function openImport() {
    importUploadOpen.value = true;
  }

  async function previewImport(file: File) {
    importing.value = true;
    try {
      importPreview.value = await previewEnterpriseWorkspaceEmployeeImportApi(
        getEnterpriseId(),
        file,
      );
      importUploadOpen.value = false;
      importPreviewOpen.value = true;
    } finally {
      importing.value = false;
    }
  }

  async function confirmImport(skippedKeys: string[]) {
    const preview = importPreview.value;
    if (!preview) {
      return;
    }
    importing.value = true;
    try {
      const result = await confirmEnterpriseWorkspaceEmployeeImportApi(
        getEnterpriseId(),
        preview.materialId,
        skippedKeys,
      );
      await load();
      importPreviewOpen.value = false;
      importPreview.value = undefined;
      return result;
    } finally {
      importing.value = false;
    }
  }

  watch(
    () => enterpriseContextStore.currentEnterpriseId,
    () => {
      filters.page = 1;
      editorOpen.value = false;
      editingEmployee.value = undefined;
      importPreviewOpen.value = false;
      importUploadOpen.value = false;
      void load();
    },
    { immediate: true },
  );

  return {
    data,
    applyFilters,
    changePage,
    confirmImport,
    deletingEmployeeId,
    downloadImportTemplate,
    downloadEmployeeExport,
    editingEmployee,
    editorOpen,
    filters,
    importPreview,
    importPreviewOpen,
    importing,
    importUploadOpen,
    load,
    loading,
    openEditor,
    openImport,
    previewImport,
    resetFilters,
    removeEmployee,
    saveEmployee,
    saving,
  };
}
