window.addEventListener('DOMContentLoaded', () => {
  const versions = document.getElementById('versions');
  if (versions) {
    versions.textContent = `Electron ${process.versions.electron} · Node ${process.versions.node}`;
  }
});
