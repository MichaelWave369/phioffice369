const { hostOrigin, childOrigin } = JSON.parse(document.getElementById('fixture-config').textContent);
window.addEventListener('message', (event) => {
  if (event.origin !== hostOrigin || event.source !== parent || event.data?.fixture !== 'command') return;
  if (event.data.command === 'spoof-host') parent.postMessage(event.data.packet, hostOrigin);
  if (event.data.command === 'spoof-client') parent.frames[0].postMessage(event.data.packet, childOrigin);
});
