export type DocumentKind = 'contract' | 'invoice';

export interface ContractRecord {
  amount: number;
  contractNo: string;
  counterparty: string;
  fileName: string;
  id: string;
  name: string;
  ourEntity: string;
  signDate: string;
  status: 'active' | 'completed' | 'draft';
  summary: string;
}

export interface InvoiceRecord {
  amount: number;
  buyerName: string;
  contractId?: string;
  fileName: string;
  id: string;
  invoiceNo: string;
  invoiceType: string;
  issueDate: string;
  sellerName: string;
  status: 'confirmed' | 'unlinked';
  taxAmount: number;
}

export interface ContractDraft {
  amount: string;
  contractNo: string;
  counterparty: string;
  fileName: string;
  id: string;
  name: string;
  ourEntity: string;
  signDate: string;
  summary: string;
}

export interface InvoiceDraft {
  amount: string;
  buyerName: string;
  contractId?: string;
  fileName: string;
  id: string;
  invoiceNo: string;
  invoiceType: string;
  issueDate: string;
  matchConfidence: 'high' | 'low' | 'medium';
  sellerName: string;
  taxAmount: string;
}

export type RecognizedDraft =
  | {
      data: ContractDraft;
      kind: 'contract';
    }
  | {
      data: InvoiceDraft;
      kind: 'invoice';
    };

export interface UploadRecognizePayload {
  drafts: RecognizedDraft[];
}
