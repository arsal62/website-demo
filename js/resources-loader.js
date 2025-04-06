// Script to inject authentication scripts into resources.html
document.addEventListener('DOMContentLoaded', function() {
    // First check if the user is logged in
    if (typeof isLoggedIn === 'undefined') {
        // Load users.js first
        const usersScript = document.createElement('script');
        usersScript.src = 'js/users.js';
        usersScript.onload = function() {
            // After users.js is loaded, check login status
            if (!isLoggedIn()) {
                // If not logged in, redirect to secure-resources page
                window.location.href = 'secure-resources.html';
            } else {
                // If logged in, load the resources-auth.js to show welcome message
                const resourcesAuthScript = document.createElement('script');
                resourcesAuthScript.src = 'js/resources-auth.js';
                document.body.appendChild(resourcesAuthScript);
            }
        };
        document.body.appendChild(usersScript);
    } else {
        // If isLoggedIn is already defined, just check login status
        if (!isLoggedIn()) {
            window.location.href = 'secure-resources.html';
        } else {
            // Load resources-auth.js if not already loaded
            if (!document.querySelector('script[src="js/resources-auth.js"]')) {
                const resourcesAuthScript = document.createElement('script');
                resourcesAuthScript.src = 'js/resources-auth.js';
                document.body.appendChild(resourcesAuthScript);
            }
        }
    }
});
