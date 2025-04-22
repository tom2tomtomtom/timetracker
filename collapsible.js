// Simple accessible collapsible panel logic
// Usage: <div class="collapsible-header">...</div><div class="collapsible-panel">...</div>
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.setAttribute('tabindex', '0');
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', 'false');
    header.addEventListener('click', () => togglePanel(header));
    header.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePanel(header);
      }
    });
  });
});

function togglePanel(header) {
  const panel = header.nextElementSibling;
  if (!panel || !panel.classList.contains('collapsible-panel')) return;
  const expanded = header.getAttribute('aria-expanded') === 'true';
  header.setAttribute('aria-expanded', String(!expanded));
  panel.style.display = expanded ? 'none' : 'block';
}

// Optionally, collapse all panels on load
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.collapsible-panel').forEach(panel => {
    panel.style.display = 'none';
  });
});
