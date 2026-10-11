const PARALLAX_RECEIPT_SCHEMA = 'parallax.receipt.v1';
const PARALLAX_LINEAGE_SCHEMA = 'parallax.lineage.v1';

export function toParallaxLineage(packet) {
  if (!packet || packet.schema !== 'phioffice369.transform_packet.v0.2') {
    throw new TypeError('Expected phioffice369.transform_packet.v0.2');
  }
  return {
    schema: PARALLAX_LINEAGE_SCHEMA,
    lineageId: packet.transformId,
    operation: `${packet.source.kind ?? 'document'}_to_${packet.target.kind}`,
    sourceRefs: [packet.source.artifactId],
    targetRefs: [packet.target.artifactId],
    performedAt: packet.trace?.tracedAt ?? packet.createdAt,
    producer: 'PhiOffice369',
    inputHashes: [],
    outputHashes: [],
    parameters: {
      sourceApp: packet.source.app,
      targetApp: packet.target.app,
      localOnly: packet.localOnly === true,
      trustLabels: [...(packet.trustLabels ?? [])],
    },
    warnings: [...(packet.warnings ?? [])],
    compatibilityNotes: [...(packet.compatibilityNotes ?? [])],
  };
}

export function toParallaxTransformReceipt(packet) {
  const lineage = toParallaxLineage(packet);
  return {
    schema: PARALLAX_RECEIPT_SCHEMA,
    receiptId: `phioffice:${packet.packetId}`,
    profile: 'transform',
    createdAt: packet.createdAt,
    producer: 'PhiOffice369',
    subjectRefs: [packet.source.artifactId, packet.target.artifactId],
    inputHashes: [],
    outputHashes: [],
    status: 'recorded',
    warnings: [...(packet.warnings ?? [])],
    lineageRefs: [lineage.lineageId],
    evidenceRefs: [],
    policyRefs: [],
    approvalRefs: [],
    signature: null,
    payload: {
      nativeSchema: packet.schema,
      localOnly: packet.localOnly === true,
      trustLabels: [...(packet.trustLabels ?? [])],
      compatibilityNotes: [...(packet.compatibilityNotes ?? [])],
      native: packet,
    },
  };
}
