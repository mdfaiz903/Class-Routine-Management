import { useState, useEffect } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/useAuth';

export default function Courses() {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', code: '' });
    const [error, setError] = useState('');

    const fetchCourses = async () => {
        try {
            const res = await API.get('courses/');
            setCourses(res.data);
        } catch (err) {
            console.error('Failed to fetch courses', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourses();
    }, []);

    const openCreate = () => {
        setEditing(null);
        setForm({ name: '', code: '' });
        setError('');
        setModalOpen(true);
    };

    const openEdit = (course) => {
        setEditing(course);
        setForm({ name: course.name, code: course.code });
        setError('');
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (editing) {
                await API.patch(`courses/${editing.id}/`, form);
            } else {
                await API.post('courses/', form);
            }
            setModalOpen(false);
            fetchCourses();
        } catch (err) {
            setError(err.response?.data ? JSON.stringify(err.response.data) : 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this course?')) return;
        try {
            await API.delete(`courses/${id}/`);
            fetchCourses();
        } catch (err) {
            console.error('Delete failed', err);
        }
    };

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
                <h2>Courses</h2>
                {user?.isAdmin && (
                    <button className="btn btn-primary" onClick={openCreate}>
                        + Add Course
                    </button>
                )}
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Code</th>
                            {user?.isAdmin && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {courses.length === 0 ? (
                            <tr>
                                <td colSpan={user?.isAdmin ? 4 : 3} className="empty-row">No courses found</td>
                            </tr>
                        ) : (
                            courses.map((c) => (
                                <tr key={c.id}>
                                    <td>{c.id}</td>
                                    <td>{c.name}</td>
                                    <td><span className="badge">{c.code}</span></td>
                                    {user?.isAdmin && (
                                        <td className="actions-cell">
                                            <button className="btn btn-sm btn-edit" onClick={() => openEdit(c)}>
                                                Edit
                                            </button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}>
                                                Delete
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Course' : 'Add Course'}>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                        <label>Course Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Course Code</label>
                        <input
                            type="text"
                            value={form.code}
                            onChange={(e) => setForm({ ...form, code: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            {editing ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
