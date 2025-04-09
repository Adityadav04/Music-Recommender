// public/js/dashboard.js
document.addEventListener('DOMContentLoaded', function() {
  // Refresh recommendations button
  const refreshBtn = document.getElementById('refreshRecommendations');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      window.location.href = '/dashboard';
    });
  }

  // Generate recommendations button
  const generateBtn = document.getElementById('generateRecommendations');
  if (generateBtn) {
    generateBtn.addEventListener('click', function() {
      window.location.href = '/dashboard';
    });
  }

  // Add to playlist buttons
  const addToPlaylistButtons = document.querySelectorAll('.add-to-playlist');
  addToPlaylistButtons.forEach(button => {
    button.addEventListener('click', function() {
      const trackId = this.getAttribute('data-track-id');
      alert('Feature coming soon: Add track ' + trackId + ' to your playlist');
    });
  });
});
