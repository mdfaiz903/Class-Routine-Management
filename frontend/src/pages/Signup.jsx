import { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

export default function Signup() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        username: '',
        password: '',
        confirm_password: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((current) => ({ ...current, [name]: value }));
    };

    const getErrorMessage = (data) => {
        if (!data) return 'Something went wrong. Please try again.';
        if (typeof data === 'string') return data;

        const firstKey = Object.keys(data)[0];
        const firstValue = data[firstKey];
        if (Array.isArray(firstValue)) return firstValue[0];
        if (typeof firstValue === 'string') return firstValue;
        return 'Please check your details and try again.';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await axios.post('http://localhost:8000/api/register/', formData);
            navigate('/login', {
                state: { message: 'Account created successfully. Please sign in.' },
            });
        } catch (err) {
            setError(getErrorMessage(err.response?.data));
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

            <div className="login-card signup-card">
                <div className="login-header">
                    <div className="login-icon">+</div>
                    <h1>Create Account</h1>
                    <p>Join SCMS</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Enter your full name"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="Choose a username"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Create password"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirm_password">Confirm</label>
                            <input
                                id="confirm_password"
                                name="confirm_password"
                                type="password"
                                value={formData.confirm_password}
                                onChange={handleChange}
                                placeholder="Confirm password"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? (
                            <span className="btn-loading">
                                <span className="spinner-small"></span> Creating...
                            </span>
                        ) : (
                            'Create Account'
                        )}
                    </button>

                    <div className="signup-divider">
                        <span>Already have an account?</span>
                    </div>

                    <Link to="/login" className="btn btn-secondary btn-full signup-button">
                        Sign In
                    </Link>
                </form>
            </div>
        </div>
    );
}
