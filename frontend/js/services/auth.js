/**
 * Authentication Service
 * Centralized authentication management for the application
 */

export class AuthService {
    constructor() {
        this.storageKeys = {
            authenticated: 'user_authenticated',
            username: 'username',
            fullName: 'user_full_name',
            email: 'user_email',
            team: 'user_team',
            teamFull: 'user_team_full',
            awsAccessKey: 'aws_access_key',
            loginTimestamp: 'login_timestamp'
        };
    }

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return sessionStorage.getItem(this.storageKeys.authenticated) === 'true';
    }

    /**
     * Get authentication headers for API calls
     * @returns {Object} Headers object with Authorization and x-user-team
     */
    getAuthHeaders() {
        const awsAccessKey = sessionStorage.getItem(this.storageKeys.awsAccessKey);
        const userTeam = sessionStorage.getItem(this.storageKeys.team);

        if (!awsAccessKey || !userTeam) {
            throw new Error('No authentication tokens found');
        }

        return {
            'Authorization': awsAccessKey,
            'x-user-team': userTeam,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Get user information
     * @returns {Object} User information object
     */
    getUserInfo() {
        return {
            username: sessionStorage.getItem(this.storageKeys.username) || '',
            fullName: sessionStorage.getItem(this.storageKeys.fullName) || '',
            email: sessionStorage.getItem(this.storageKeys.email) || '',
            team: sessionStorage.getItem(this.storageKeys.team) || '',
            teamFull: sessionStorage.getItem(this.storageKeys.teamFull) || '',
            loginTimestamp: sessionStorage.getItem(this.storageKeys.loginTimestamp) || ''
        };
    }

    /**
     * Get user's team
     * @returns {string} User's team
     */
    getUserTeam() {
        return sessionStorage.getItem(this.storageKeys.team) || '';
    }

    /**
     * Get AWS access key
     * @returns {string} AWS access key
     */
    getAwsAccessKey() {
        return sessionStorage.getItem(this.storageKeys.awsAccessKey) || '';
    }

    /**
     * Set authentication data
     * @param {Object} authData - Authentication data
     */
    setAuthData(authData) {
        sessionStorage.setItem(this.storageKeys.authenticated, 'true');
        sessionStorage.setItem(this.storageKeys.username, authData.username || '');
        sessionStorage.setItem(this.storageKeys.fullName, authData.fullName || authData.username || '');
        sessionStorage.setItem(this.storageKeys.email, authData.email || '');
        sessionStorage.setItem(this.storageKeys.team, authData.team || '');
        sessionStorage.setItem(this.storageKeys.teamFull, authData.teamFull || '');
        sessionStorage.setItem(this.storageKeys.awsAccessKey, authData.awsAccessKey || '');
        sessionStorage.setItem(this.storageKeys.loginTimestamp, new Date().toISOString());
    }

    /**
     * Clear authentication data and logout
     */
    logout() {
        sessionStorage.clear();
        window.location.href = 'login-new.html';
    }

    /**
     * Redirect to login if not authenticated
     */
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'login-new.html';
            return false;
        }
        return true;
    }

    /**
     * Make authenticated API call
     * @param {string} url - API endpoint URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>}
     */
    async authenticatedFetch(url, options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        const headers = this.getAuthHeaders();
        
        const fetchOptions = {
            ...options,
            headers: {
                ...headers,
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, fetchOptions);
            
            // Handle 401 Unauthorized - redirect to login
            if (response.status === 401) {
                console.warn('Authentication failed, redirecting to login');
                this.logout();
                throw new Error('Authentication failed');
            }

            return response;
        } catch (error) {
            console.error('Authenticated fetch error:', error);
            throw error;
        }
    }

    /**
     * Initialize user interface with authentication data
     */
    initializeUI() {
        const userInfo = this.getUserInfo();

        // Populate team button
        const teamBtn = document.getElementById('team-name-btn');
        if (teamBtn && userInfo.team) {
            teamBtn.textContent = userInfo.team.toUpperCase();
        } else if (teamBtn && userInfo.teamFull) {
            teamBtn.textContent = userInfo.teamFull;
        }

        // Populate initial button
        const initialBtn = document.getElementById('user-initial-btn');
        if (initialBtn && userInfo.fullName) {
            initialBtn.textContent = userInfo.fullName.charAt(0).toUpperCase();
        }

        // Populate dropdown
        const dropdownAvatar = document.getElementById('dropdown-avatar');
        if (dropdownAvatar && userInfo.fullName) {
            dropdownAvatar.textContent = userInfo.fullName.charAt(0).toUpperCase();
        }

        const dropdownName = document.getElementById('dropdown-name');
        if (dropdownName) {
            dropdownName.textContent = userInfo.fullName;
        }

        const dropdownEmail = document.getElementById('dropdown-email');
        if (dropdownEmail) {
            dropdownEmail.textContent = userInfo.email;
        }

        console.log('User authenticated:', {
            username: userInfo.username,
            fullName: userInfo.fullName,
            team: userInfo.team,
            email: userInfo.email,
            loginTime: userInfo.loginTimestamp
        });
    }

    /**
     * Check authentication and initialize UI on page load
     * @returns {boolean} True if authenticated, false otherwise
     */
    checkAndInitialize() {
        if (!this.requireAuth()) {
            return false;
        }

        this.initializeUI();
        return true;
    }
}

// Create singleton instance
const authService = new AuthService();

// Export singleton instance as default
export default authService;
