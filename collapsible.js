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

// Programmatically open a panel by header ID
function openPanelById(headerId) {
  const header = document.getElementById(headerId);
  if (!header) return;
  const panel = header.nextElementSibling;
  if (!panel || !panel.classList.contains('collapsible-panel')) return;
  header.setAttribute('aria-expanded', 'true');
  panel.style.display = 'block';
}

// Expose helper globally for other scripts
window.openPanelById = openPanelById;

// Optionally, collapse all panels on load
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.collapsible-panel').forEach(panel => {
    panel.style.display = 'none';
  });

  const menuToggle = document.getElementById('tracking-menu-toggle');
  const menu = document.getElementById('tracking-menu');
  if (menuToggle && menu) {
    menuToggle.addEventListener('click', () => {
      menu.classList.toggle('show');
    });

    document.querySelectorAll('#tracking-menu a').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        menu.classList.remove('show');
        const headerId = link.getAttribute('data-header');
        const header = document.getElementById(headerId);
        if (header) {
          togglePanel(header);
          header.scrollIntoView({behavior: 'smooth'});
        }
      });
    });
  }
});
