export const propertyLedgerFields = {
  ip: [
    'ipLevel',
    'advancedDegree',
    'supportEffect',
    'softWorkFile',
    'relatedRdIds',
    'relatedPsIds',
    'relatedTransformationIds',
  ],
  ps: [
    'psCode',
    'proofFiles',
    'relatedIpIds',
    'relatedRdIds',
    'relatedTransformationIds',
    'relatedContractIds',
    'relatedInvoiceIds',
  ],
  rd: [
    'lxbgFile',
    'relatedIpIds',
    'relatedPsIds',
    'relatedTransformationIds',
  ],
  transformation: [
    'proofFiles',
    'relatedIpIds',
    'relatedRdIds',
    'relatedPsIds',
    'relatedContractIds',
    'relatedInvoiceIds',
  ],
} as const;
