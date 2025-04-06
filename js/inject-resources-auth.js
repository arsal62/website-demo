// Script to inject authentication into resources.html
(function() {
    // Check if we have the auth parameter in the URL
    if (window.location.hash.includes('auth=true')) {
        console.log('Auth parameter detected, user is authenticated');
        
        // Load users.js if not already loaded
        if (typeof isLoggedIn === 'undefined') {
            const usersScript = document.createElement('script');
            usersScript.src = 'js/users.js';
            usersScript.onload = loadResourcesAuth;
            document.body.appendChild(usersScript);
        } else {
            loadResourcesAuth();
        }
    } else {
        // No auth parameter, check if user is logged in
        const usersScript = document.createElement('script');
        usersScript.src = 'js/users.js';
        usersScript.onload = function() {
            if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
                // User is not logged in, redirect to secure-resources
                window.location.href = 'secure-resources.html';
            } else {
                // User is logged in, load resources auth
                loadResourcesAuth();
            }
        };
        document.body.appendChild(usersScript);
    }
    
    function loadResourcesAuth() {
        // Load resources-auth.js to show welcome message
        const resourcesAuthScript = document.createElement('script');
        resourcesAuthScript.src = 'js/resources-auth.js';
        document.body.appendChild(resourcesAuthScript);
    }
})();
