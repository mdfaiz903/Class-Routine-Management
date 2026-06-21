import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="brand-icon">📋</div>
                    <span>SCMS</span>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                        <span className="nav-icon">🏠</span>
                        <span>Dashboard</span>
                    </NavLink>

                    {user?.isAdmin && (
                        <NavLink to="/teachers" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                            <span className="nav-icon">👨‍🏫</span>
                            <span>Teachers</span>
                        </NavLink>
                    )}

                    <NavLink to="/courses" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                        <span className="nav-icon">📚</span>
                        <span>Courses</span>
                    </NavLink>

                    <NavLink to="/routines" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                        <span className="nav-icon">📅</span>
                        <span>Routines</span>
                    </NavLink>

                    {(user?.isAdmin || user?.isTeacher) && (
                        <NavLink to="/change-requests" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                            <span className="nav-icon">📝</span>
                            <span>Change Requests</span>
                        </NavLink>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">{user?.username?.[0]?.toUpperCase() || 'U'}</div>
                        <div className="user-details">
                            <span className="user-name">{user?.username}</span>
                            <span className="user-role">{user?.role || 'Student'}</span>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <h1 className="page-title">Class Routine Management</h1>
                    <button className="btn btn-logout" onClick={handleLogout}>
                        Logout
                    </button>
                </header>

                <div className="content-area">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
