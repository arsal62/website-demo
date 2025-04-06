// Script to inject authentication scripts into resources.html
document.addEventListener('DOMContentLoaded', function() {
    // Create script element for users.js
    const usersScript = document.createElement('script');
    usersScript.src = 'js/users.js';
    document.body.appendChild(usersScript);
    
    // Create script element for auth.js
    const authScript = document.createElement('script');
    authScript.src = 'js/auth.js';
    document.body.appendChild(authScript);
    
    // Create script element for resources-auth.js
    const resourcesAuthScript = document.createElement('script');
    resourcesAuthScript.src = 'js/resources-auth.js';
    document.body.appendChild(resourcesAuthScript);
    
    console.log('Authentication scripts injected into resources page');
});
