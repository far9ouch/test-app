function updateTime() {
    fetch('/api/time')
        .then(response => response.json())
        .then(data => {
            document.getElementById('time-display').textContent = data.current_time;
            document.getElementById('api-message').textContent = data.message;
        })
        .catch(error => console.error('Error:', error));
}

// Update time every second
setInterval(updateTime, 1000);
updateTime(); // Initial update 