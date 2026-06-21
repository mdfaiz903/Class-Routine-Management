import { useState } from 'react';
import axios from 'axios';
import AuthContext from './AuthContextValue';

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

function buildUserFromToken(token, fallbackUsername = '') {
    const decoded = parseJwt(token);
    if (!decoded) return null;

    // Review: role comes from backend JWT, so Student/Teacher/Admin UI stays consistent.
    const role = decoded.role || (decoded.is_superuser ? 'Admin' : 'Student');

    return {
        userId: decoded.user_id,
        username: decoded.username || fallbackUsername,
        role,
        isAdmin: role === 'Admin' || decoded.is_superuser || false,
        isTeacher: role === 'Teacher',
        isStudent: role === 'Student',
    };
}

function getStoredUser() {
    const access = localStorage.getItem('access_token');
    return access ? buildUserFromToken(access) : null;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(getStoredUser);
    const [loading] = useState(false);

    const login = async (username, password) => {
        const res = await axios.post('http://localhost:8000/api/token/', {
            username,
            password,
        });
        const { access, refresh } = res.data;
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);

        const userData = buildUserFromToken(access, username);
        setUser(userData);
        return userData;
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

