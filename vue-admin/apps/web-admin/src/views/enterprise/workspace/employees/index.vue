<script setup lang="ts">
import type { EnterpriseWorkspaceEmployee } from '#/api';

import { shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Card, Spin, Statistic } from 'antdv-next';

import { previewEnterpriseWorkspaceAttachmentApi } from '#/api';
import { useEnterpriseContextStore } from '#/store';

import { confirmAction, showActionFailure, showActionSuccess } from '../../../system/shared/action-feedback';
import EnterpriseEmployeeDetailDrawer from './components/EnterpriseEmployeeDetailDrawer.vue';
import EnterpriseEmployeeList from './components/EnterpriseEmployeeList.vue';
import EnterpriseEmployeeModal from './components/EnterpriseEmployeeModal.vue';
import EnterpriseEmployeeImportPreviewModal from './components/EnterpriseEmployeeImportPreviewModal.vue';
import EnterpriseEmployeeImportUploadModal from './components/EnterpriseEmployeeImportUploadModal.vue';
import { useEnterpriseEmployees } from './composables/use-enterprise-employees';

defineOptions({ name: 'EnterpriseWorkspaceEmployees' });

const { applyFilters, changePage, confirmImport, data, deletingEmployeeId, downloadEmployeeExport, downloadImportTemplate, editingEmployee, editorOpen, filters, importPreview, importPreviewOpen, importing, importUploadOpen, loading, openEditor, openImport, previewImport, removeEmployee, saveEmployee, saving } = useEnterpriseEmployees();
const enterpriseContextStore = useEnterpriseContextStore();
const detailOpen = shallowRef(false);
const detailEmployee = shallowRef<EnterpriseWorkspaceEmployee>();
async function handleSave(data: Parameters<typeof saveEmployee>[0]) { const isEditing = Boolean(editingEmployee.value); try { await saveEmployee(data); showActionSuccess(isEditing ? '员工记录已更新' : '员工记录已新增'); } catch (error) { showActionFailure(error); } }
async function handleRemove(employee: EnterpriseWorkspaceEmployee) { const attachmentCount = [employee.ygFiles, employee.laborContractFile, employee.socialSecurityFile, employee.educationFile, employee.titleFile].filter(Boolean).length; const details = [`身份证后四位：${employee.idCard?.slice(-4) || '-'}`, employee.isKjyf ? '该员工已标记为科技人员' : '', attachmentCount ? `已关联 ${attachmentCount} 份证明材料` : ''].filter(Boolean).join('；'); try { await confirmAction(`确认删除员工“${employee.ygName ?? ''}”吗？${details ? `\n${details}` : ''}\n删除后将从员工名册隐藏，但保留历史数据。`, '删除员工记录'); await removeEmployee(employee.id); if (detailEmployee.value?.id === employee.id) detailOpen.value = false; showActionSuccess('员工记录已删除'); } catch (error) { if (error instanceof Error && error.message === 'cancel') return; showActionFailure(error); } }
async function handleDownloadTemplate() { try { await downloadImportTemplate(); } catch (error) { showActionFailure(error); } }
async function handleDownloadExport() { try { await downloadEmployeeExport(); } catch (error) { showActionFailure(error); } }
async function handleImportPreview(file: File) { try { await previewImport(file); showActionSuccess(`${file.name.toLowerCase().endsWith('.pdf') ? '社保 PDF' : '员工花名册'}已解析，请确认预览结果`); } catch (error) { showActionFailure(error); } }
async function handleImportConfirm(skippedKeys: string[]) { try { const result = await confirmImport(skippedKeys); if (!result) return; showActionSuccess(`员工导入完成：写入 ${result.summary.employeeCount} 条，新增 ${result.summary.createCount ?? 0} 条，更新 ${result.summary.updateCount ?? 0} 条。`); } catch (error) { showActionFailure(error); } }
async function handlePreview(employee: EnterpriseWorkspaceEmployee, path: string) { try { const blob = await previewEnterpriseWorkspaceAttachmentApi(enterpriseContextStore.currentEnterpriseId ?? '', 'employee', employee.id, path); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); } catch (error) { showActionFailure(error); } }
function handleDetail(employee: EnterpriseWorkspaceEmployee) { detailEmployee.value = employee; detailOpen.value = true; }
function handleDetailEdit(employee: EnterpriseWorkspaceEmployee) { detailOpen.value = false; openEditor(employee); }
function handleFilter(value: { activeStatus: 'active' | 'all' | 'inactive'; employeeType: number; keyword: string; researchStatus: 'all' | 'no' | 'yes' }) { Object.assign(filters, value); void applyFilters(); }
watch(() => enterpriseContextStore.currentEnterpriseId, () => { detailOpen.value = false; detailEmployee.value = undefined; });
</script>

<template>
  <Page auto-content-height><Spin :spinning="loading"><div class="enterprise-employees-page">
    <template v-if="data"><div class="enterprise-employees-page__stats"><Card><Statistic title="员工总数" :value="data.stats.total" /></Card><Card><Statistic title="在职人数" :value="data.stats.activeCount" /></Card><Card><Statistic title="科技人员" :value="data.stats.researchCount" /></Card></div><Card title="员工名册"><EnterpriseEmployeeList :key="enterpriseContextStore.currentEnterpriseId ?? ''" :deleting-employee-id="deletingEmployeeId" :employees="data.items" :page="data.page" :page-size="data.pageSize" :saving="saving" :total="data.total" @create="openEditor()" @detail="handleDetail" @download-export="handleDownloadExport" @download-template="handleDownloadTemplate" @edit="openEditor" @filter="handleFilter" @import="openImport" @page-change="changePage" @preview="handlePreview" @remove="handleRemove" /></Card></template>
    <EnterpriseEmployeeModal v-model:open="editorOpen" :employee="editingEmployee" :enterprise-id="enterpriseContextStore.currentEnterpriseId ?? ''" :saving="saving" @save="handleSave" /><EnterpriseEmployeeDetailDrawer v-model:open="detailOpen" :employee="detailEmployee" @edit="handleDetailEdit" @preview="handlePreview" /><EnterpriseEmployeeImportUploadModal v-model:open="importUploadOpen" :loading="importing" @submit="handleImportPreview" /><EnterpriseEmployeeImportPreviewModal v-model:open="importPreviewOpen" :loading="importing" :preview="importPreview" @confirm="handleImportConfirm" />
  </div></Spin></Page>
</template>

<style scoped>.enterprise-employees-page { display: grid; gap: 16px; }.enterprise-employees-page__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }@media (max-width: 640px) {.enterprise-employees-page__stats { grid-template-columns: 1fr; }}</style>
