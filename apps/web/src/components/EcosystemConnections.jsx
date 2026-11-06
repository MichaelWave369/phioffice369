export default function EcosystemConnections() {
  return (
    <details className="ecosystem-connections panel">
      <summary>PhiOS ecosystem connections</summary>
      <dl>
        <div><dt>PhiOS</dt><dd>Launch this workspace in a browser. File access stays with this browser profile.</dd></div>
        <div><dt>PhiID</dt><dd>Sign-in unavailable. All local editing is available without an account.</dd></div>
        <div><dt>PhiCloud</dt><dd>Sync unavailable. Use PhiVault to download or restore local backups.</dd></div>
        <div><dt>PhiMail</dt><dd>App handoff unavailable. Export a file, then attach it in your mail app.</dd></div>
      </dl>
    </details>
  );
}
