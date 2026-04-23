document.addEventListener('DOMContentLoaded', function () {
  loadAlerts();
});

/* ── Load and render alerts ── */
function loadAlerts() {
  // For now, using mock data. In a real app, fetch from API
  const mockAlerts = [
    {
      id: 1,
      type: 'warning',
      title: 'High Similarity Match Detected',
      message: 'A new upload shows 85% similarity to your protected asset "logo.png".',
      time: '2 hours ago'
    },
    {
      id: 2,
      type: 'danger',
      title: 'Unauthorized Distribution',
      message: 'Your asset "document.pdf" has been found on an unauthorized website.',
      time: '1 day ago'
    },
    {
      id: 3,
      type: 'info',
      title: 'Scan Completed',
      message: 'Weekly scan of your digital assets has been completed successfully.',
      time: '3 days ago'
    }
  ];

  renderAlerts(mockAlerts);
}

/* ── Render alerts list ── */
function renderAlerts(alerts) {
  const container = document.getElementById('alerts-list');
  if (!container) return;

  if (alerts.length === 0) {
    container.innerHTML = '<p>No alerts at this time.</p>';
    return;
  }

  container.innerHTML = alerts.map(alert => `
    <div class="alert-card">
      <div class="alert-icon ${alert.type}">
        ${getAlertIcon(alert.type)}
      </div>
      <div class="alert-content">
        <div class="alert-title">${alert.title}</div>
        <div class="alert-message">${alert.message}</div>
        <div class="alert-time">${alert.time}</div>
      </div>
    </div>
  `).join('');
}

/* ── Get icon for alert type ── */
function getAlertIcon(type) {
  switch (type) {
    case 'warning': return '⚠️';
    case 'danger': return '🚨';
    case 'info': return 'ℹ️';
    default: return '📢';
  }
}