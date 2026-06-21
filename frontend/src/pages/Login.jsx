import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const successMessage = location.state?.message;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            if (err.response?.status === 401) {
                setError('Invalid username or password');
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-bg-shapes">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
                <div className="shape shape-3"></div>
            </div>

            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon">📋</div>
                    <h1>SCMS</h1>
                    <p>Class Routine Management System</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {successMessage && <div className="alert alert-success">{successMessage}</div>}
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? (
                            <span className="btn-loading">
                                <span className="spinner-small"></span> Signing in...
                            </span>
                        ) : (
                            'Sign In'
                        )}
                    </button>

                    <div className="signup-divider">
                        <span>New to SCMS?</span>
                    </div>

                    <Link to="/signup" className="btn btn-secondary btn-full signup-button">
                        Create Account
                    </Link>
                </form>
            </div>
        </div>
    );
}
