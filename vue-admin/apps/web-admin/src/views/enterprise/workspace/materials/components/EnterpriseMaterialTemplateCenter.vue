<script setup lang="ts">
import type {
  EnterpriseWorkspaceEmployeeImportPreview,
  EnterpriseWorkspaceMaterialError,
  EnterpriseWorkspaceMaterialRecord,
  EnterpriseWorkspaceMaterialTemplate,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';

import { computed, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Download, IconifyIcon } from '@vben/icons';
import { Alert, Button, Empty, Modal, Spin, Table, Tag } from 'antdv-next';

import {
  confirmEnterpriseWorkspaceEmployeeImportApi,
  downloadEnterpriseWorkspaceMaterialTemplateApi,
  getEnterpriseWorkspaceMaterialErrorsApi,
  getEnterpriseWorkspaceMaterialsApi,
  getEnterpriseWorkspaceMaterialTemplatesApi,
  previewEnterpriseWorkspaceEmployeeImportApi,
  previewEnterpriseWorkspaceMaterialApi,
  uploadEnterpriseWorkspaceMaterialApi,
} from '#/api';

import { showActionFailure, showActionSuccess } from '../../../../system/shared/action-feedback';
import EnterpriseEmployeeImportPreviewModal from '../../employees/components/EnterpriseEmployeeImportPreviewModal.vue';
import EnterpriseEmployeeImportUploadModal from '../../employees/components/EnterpriseEmployeeImportUploadModal.vue';
import { getMaterialTemplateConfig } from '../material-template-config';

defineOptions({ name: 'EnterpriseMaterialTemplateCenter' });
const route = useRoute();
const enterpriseContextStore = useEnterpriseContextStore();
const templates = shallowRef<EnterpriseWorkspaceMaterialTemplate[]>([]);
const materials = shallowRef<EnterpriseWorkspaceMaterialRecord[]>([]);
const errors = shallowRef<EnterpriseWorkspaceMaterialError[]>([]);
const loading = shallowRef(false);
const errorLoading = shallowRef(false);
const errorModalOpen = shallowRef(false);
const selectedMaterial = shallowRef<EnterpriseWorkspaceMaterialRecord>();
const uploadingTemplateId = shallowRef<string>();
const employeeImportPreview = shallowRef<EnterpriseWorkspaceEmployeeImportPreview>();
const employeeImportUploadOpen = shallowRef(false);
const employeeImportPreviewOpen = shallowRef(false);
const employeeImporting = shallowRef(false);
const locatedMaterialId = computed(() => typeof route.query.materialId === 'string' ? route.query.materialId : '');
const locatedMaterial = computed(() => materials.value.find((item) => item.id === locatedMaterialId.value));

const templateColumns = [{ dataIndex: 'name', key: 'name', title: '材料模板' }, { dataIndex: 'description', key: 'description', title: '说明' }, { dataIndex: 'version', key: 'version', title: '版本' }, { key: 'required', title: '必填' }, { key: 'actions', title: '操作' }];
const materialColumns = [{ dataIndex: 'templateName', key: 'templateName', title: '模板' }, { dataIndex: 'fileName', key: 'fileName', title: '文件' }, { key: 'status', title: '状态' }, { dataIndex: 'errorCount', key: 'errorCount', title: '错误数' }, { dataIndex: 'uploadTime', key: 'uploadTime', title: '上传时间' }, { key: 'actions', title: '操作' }];
const errorColumns = [{ dataIndex: 'sheetName', key: 'sheetName', title: '工作表' }, { dataIndex: 'rowNumber', key: 'rowNumber', title: '行号' }, { dataIndex: 'fieldName', key: 'fieldName', title: '字段' }, { dataIndex: 'rawValue', key: 'rawValue', title: '原始值' }, { dataIndex: 'message', key: 'message', title: '错误说明' }, { dataIndex: 'suggestion', key: 'suggestion', title: '修正建议' }];

function enterpriseId() { return enterpriseContextStore.currentEnterpriseId ?? ''; }
function materialStatus(record: EnterpriseWorkspaceMaterialRecord) { return ({ invalid: { color: 'red', label: '解析失败' }, partial: { color: 'orange', label: '部分成功' }, uploaded: { color: 'blue', label: '已上传' }, valid: { color: 'green', label: '解析成功' } } as Record<string, { color: string; label: string }>)[record.status] ?? { color: 'default', label: record.status || '未知' }; }
async function load() { const id = enterpriseId(); loading.value = true; try { const [nextTemplates, nextMaterials] = await Promise.all([getEnterpriseWorkspaceMaterialTemplatesApi(), id ? getEnterpriseWorkspaceMaterialsApi(id) : Promise.resolve([])]); templates.value = nextTemplates; materials.value = nextMaterials; } finally { loading.value = false; } }
async function downloadTemplate(template: EnterpriseWorkspaceMaterialTemplate) { try { const blob = await downloadEnterpriseWorkspaceMaterialTemplateApi(template.id); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.download = template.fileName; link.href = url; link.click(); URL.revokeObjectURL(url); } catch (error) { showActionFailure(error); } }
async function upload(template: EnterpriseWorkspaceMaterialTemplate, event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return; uploadingTemplateId.value = template.id; try { await uploadEnterpriseWorkspaceMaterialApi(enterpriseId(), template.id, file); await load(); showActionSuccess(`${template.name}已上传并解析`); } catch (error) { showActionFailure(error); } finally { uploadingTemplateId.value = undefined; } }
async function previewEmployeeImport(file: File) { employeeImporting.value = true; try { employeeImportPreview.value = await previewEnterpriseWorkspaceEmployeeImportApi(enterpriseId(), file); employeeImportUploadOpen.value = false; employeeImportPreviewOpen.value = true; showActionSuccess('员工花名册已解析，请确认预览结果'); } catch (error) { showActionFailure(error); } finally { employeeImporting.value = false; } }
async function confirmEmployeeImport(skippedKeys: string[]) { const preview = employeeImportPreview.value; if (!preview) return; employeeImporting.value = true; try { const result = await confirmEnterpriseWorkspaceEmployeeImportApi(enterpriseId(), preview.materialId, skippedKeys); await load(); employeeImportPreviewOpen.value = false; employeeImportPreview.value = undefined; showActionSuccess(`员工导入完成：写入 ${result.summary.employeeCount} 条，新增 ${result.summary.createCount ?? 0} 条，更新 ${result.summary.updateCount ?? 0} 条。`); } catch (error) { showActionFailure(error); } finally { employeeImporting.value = false; } }
async function openErrors(record: EnterpriseWorkspaceMaterialRecord) { selectedMaterial.value = record; errorModalOpen.value = true; errorLoading.value = true; try { errors.value = await getEnterpriseWorkspaceMaterialErrorsApi(enterpriseId(), record.id); } catch (error) { errors.value = []; showActionFailure(error); } finally { errorLoading.value = false; } }
async function downloadMaterial(record: EnterpriseWorkspaceMaterialRecord) { try { const blob = await previewEnterpriseWorkspaceMaterialApi(enterpriseId(), record.id); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.download = record.fileName || '企业材料'; link.href = url; link.click(); URL.revokeObjectURL(url); } catch (error) { showActionFailure(error); } }
async function openMaterialErrorFromQuery() { const materialId = typeof route.query.materialId === 'string' ? route.query.materialId : ''; if (!materialId) return; const material = materials.value.find((item) => item.id === materialId); if (material?.errorCount) await openErrors(material); }
watch(() => enterpriseContextStore.currentEnterpriseId, () => { employeeImportPreview.value = undefined; employeeImportPreviewOpen.value = false; void load(); }, { immediate: true });
watch([materials, () => route.query.materialId], () => void openMaterialErrorFromQuery());
</script>
<template><Spin :spinning="loading"><div class="enterprise-material-template-center"><Table :columns="templateColumns" :data-source="templates" :pagination="false" :row-key="(item: EnterpriseWorkspaceMaterialTemplate) => item.id" :scroll="{ x: 880 }"><template #bodyCell="{ column, record }"><template v-if="column.key === 'required'"><Tag :color="record.required ? 'red' : 'default'">{{ record.required ? '必填' : '选填' }}</Tag></template><template v-else-if="column.key === 'actions'"><Button size="small" type="link" @click="downloadTemplate(record)"><Download class="size-4" />下载模板</Button><Button v-if="getMaterialTemplateConfig(record.id).importMode === 'employee-preview'" size="small" type="link" @click="employeeImportUploadOpen = true"><IconifyIcon icon="lucide:upload" class="size-4" />上传并预览</Button><label v-else class="enterprise-material-template-center__upload"><Button :loading="uploadingTemplateId === record.id" size="small" type="link"><IconifyIcon icon="lucide:upload" class="size-4" />上传</Button><input :accept="getMaterialTemplateConfig(record.id).accept" type="file" @change="upload(record, $event)" /></label></template></template></Table><section class="enterprise-material-template-center__records"><h3>当前企业上传记录</h3><Alert v-if="locatedMaterial" :message="`已定位：${locatedMaterial.templateName || locatedMaterial.fileName || '材料导入记录'}`" show-icon type="info" /><Alert v-else-if="locatedMaterialId && !loading" message="未找到指定材料记录，可能已删除或不属于当前企业。" show-icon type="warning" /><Table v-if="materials.length" :columns="materialColumns" :data-source="materials" :pagination="false" :row-class-name="(record: EnterpriseWorkspaceMaterialRecord) => record.id === locatedMaterialId ? 'enterprise-material-template-center__record--located' : ''" :row-key="(item: EnterpriseWorkspaceMaterialRecord) => item.id" :scroll="{ x: 940 }"><template #bodyCell="{ column, record }"><template v-if="column.key === 'status'"><Tag :color="materialStatus(record).color">{{ materialStatus(record).label }}</Tag></template><template v-else-if="column.key === 'actions'"><Button :disabled="!record.filePath" size="small" type="link" @click="downloadMaterial(record)">下载</Button><Button :disabled="!record.errorCount" size="small" type="link" @click="openErrors(record)">查看错误</Button></template></template></Table><Empty v-else description="当前企业暂无材料上传记录" /></section><Modal v-model:open="errorModalOpen" :footer="null" :title="`${selectedMaterial?.templateName || selectedMaterial?.fileName || '材料'}错误明细`" width="960px"><Spin :spinning="errorLoading"><Table v-if="errors.length" :columns="errorColumns" :data-source="errors" :pagination="false" :row-key="(item: EnterpriseWorkspaceMaterialError) => item.id" :scroll="{ x: 1100 }" size="small" /><Empty v-else-if="!errorLoading" description="未发现可展示的解析错误" /></Spin></Modal><EnterpriseEmployeeImportUploadModal v-model:open="employeeImportUploadOpen" :loading="employeeImporting" @submit="previewEmployeeImport" /><EnterpriseEmployeeImportPreviewModal v-model:open="employeeImportPreviewOpen" :loading="employeeImporting" :preview="employeeImportPreview" @confirm="confirmEmployeeImport" /></div></Spin></template>
<style scoped>.enterprise-material-template-center,.enterprise-material-template-center__records { display: grid; gap: 16px; }.enterprise-material-template-center__records h3 { margin: 8px 0 0; font-size: 16px; }.enterprise-material-template-center__upload input { display: none; }:deep(.enterprise-material-template-center__record--located > td) { background: #eff6ff !important; }</style>
