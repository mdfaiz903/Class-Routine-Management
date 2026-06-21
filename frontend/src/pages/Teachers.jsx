import { useCallback, useEffect, useState } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';

export default function Teachers() {
    const [teachers, setTeachers] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ user_id: '' });
    const [error, setError] = useState('');

    const fetchTeachers = useCallback(async () => {
        try {
            const res = await API.get('teachers/');
            setTeachers(res.data);
        } catch (err) {
            console.error('Failed to fetch teachers', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await API.get('users/');
            setUsers(res.data);
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    }, []);

    useEffect(() => {
        fetchTeachers();
        fetchUsers();
    }, [fetchTeachers, fetchUsers]);

    const openCreate = () => {
        setForm({ user_id: '' });
        setError('');
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            // Review: teacher role is assigned to an existing registered user.
            await API.post('teachers/', { user_id: form.user_id });
            setModalOpen(false);
            fetchTeachers();
            fetchUsers();
        } catch (err) {
            setError(err.response?.data ? JSON.stringify(err.response.data) : 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this teacher?')) return;
        try {
            await API.delete(`teachers/${id}/`);
            fetchTeachers();
            fetchUsers();
        } catch (err) {
            console.error('Delete failed', err);
        }
    };

    const availableUsers = users.filter((user) => user.role === 'Student');

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <h2>Teachers</h2>
                <button className="btn btn-primary" onClick={openCreate}>
                    + Add Teacher
                </button>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>User ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teachers.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="empty-row">No teachers found</td>
                            </tr>
                        ) : (
                            teachers.map((t) => (
                                <tr key={t.id}>
                                    <td>{t.id}</td>
                                    <td>{t.user_id}</td>
                                    <td>{t.name}</td>
                                    <td>{t.email}</td>
                                    <td className="actions-cell">
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Teacher">
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                        <label>Select User</label>
                        <select
                            value={form.user_id}
                            onChange={(e) => setForm({ user_id: e.target.value })}
                            required
                        >
                            <option value="">Choose a student user...</option>
                            {availableUsers.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.name || user.username} ({user.email || user.username})
                                </option>
                            ))}
                        </select>
                    </div>

                    {availableUsers.length === 0 && (
                        <div className="empty-row">No student users are available to promote.</div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={availableUsers.length === 0}>
                            Create
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
