// User management functions

// Initialize users array from localStorage or create empty array
let users = JSON.parse(localStorage.getItem('users')) || [];

// Function to register a new user
function registerUser(name, email, password) {
    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
        return { success: false, message: 'User with this email already exists' };
    }
    
    // Create new user object
    const newUser = {
        id: Date.now().toString(),
        name: name,
        email: email,
        password: password, // In a real app, this should be hashed
        createdAt: new Date().toISOString()
    };
    
    // Add to users array
    users.push(newUser);
    
    // Save to localStorage
    saveUsers();
    
    return { success: true, message: 'User registered successfully', user: { ...newUser, password: undefined } };
}

// Function to login a user
function loginUser(email, password) {
    // Find user by email
    const user = users.find(user => user.email === email);
    
    // Check if user exists and password matches
    if (!user) {
        return { success: false, message: 'User not found' };
    }
    
    if (user.password !== password) {
        return { success: false, message: 'Incorrect password' };
    }
    
    // Set user session
    sessionStorage.setItem('currentUser', JSON.stringify({ ...user, password: undefined }));
    
    return { success: true, message: 'Login successful', user: { ...user, password: undefined } };
}

// Function to logout user
function logoutUser() {
    // Remove user session
    sessionStorage.removeItem('currentUser');
    return { success: true, message: 'Logout successful' };
}

// Function to check if user is logged in
function isLoggedIn() {
    return sessionStorage.getItem('currentUser') !== null;
}

// Function to get current user
function getCurrentUser() {
    return JSON.parse(sessionStorage.getItem('currentUser'));
}

// Function to save users to localStorage
function saveUsers() {
    localStorage.setItem('users', JSON.stringify(users));
}

// Add some sample users if none exist
if (users.length === 0) {
    registerUser('John Doe', 'john@example.com', 'password123');
    registerUser('Jane Smith', 'jane@example.com', 'password456');
}
