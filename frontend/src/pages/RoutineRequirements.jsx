import { useCallback, useEffect, useState } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';

const ROOM_TYPES = ['', 'Theory', 'Lab'];

export default function RoutineRequirements() {
    const [requirements, setRequirements] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        course_id: '',
        teacher_id: '',
        section: '',
        sessions_per_week: 1,
        required_room_type: '',
    });
    const [error, setError] = useState('');

    const fetchAll = useCallback(async () => {
        try {
            const [reqRes, tRes, cRes] = await Promise.all([
                API.get('routine-requirements/'),
                API.get('teachers/'),
                API.get('courses/'),
            ]);
            setRequirements(reqRes.data);
            setTeachers(tRes.data);
            setCourses(cRes.data);
        } catch (err) {
            console.error('Failed to fetch requirements', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const openCreate = () => {
        setEditing(null);
        setForm({ course_id: '', teacher_id: '', section: '', sessions_per_week: 1, required_room_type: '' });
        setError('');
        setModalOpen(true);
    };

    const openEdit = (req) => {
        setEditing(req);
        setForm({
            course_id: req.course?.id || '',
            teacher_id: req.teacher?.id || '',
            section: req.section,
            sessions_per_week: req.sessions_per_week,
            required_room_type: req.required_room_type || '',
        });
        setError('');
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const payload = { ...form, required_room_type: form.required_room_type || null };
        try {
            if (editing) {
                await API.patch(`routine-requirements/${editing.id}/`, payload);
            } else {
                await API.post('routine-requirements/', payload);
            }
            setModalOpen(false);
            fetchAll();
        } catch (err) {
            setError(err.response?.data ? JSON.stringify(err.response.data) : 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this requirement?')) return;
        try {
            await API.delete(`routine-requirements/${id}/`);
            fetchAll();
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
                <h2>Routine Requirements</h2>
                <button className="btn btn-primary" onClick={openCreate}>
                    + Add Requirement
                </button>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Course</th>
                            <th>Teacher</th>
                            <th>Section</th>
                            <th>Sessions/Week</th>
                            <th>Room Type</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requirements.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="empty-row">No requirements found</td>
                            </tr>
                        ) : (
                            requirements.map((req) => (
                                <tr key={req.id}>
                                    <td>
                                        <div className="cell-main">{req.course?.name}</div>
                                        <div className="cell-sub">{req.course?.code}</div>
                                    </td>
                                    <td>{req.teacher?.name}</td>
                                    <td><span className="badge">{req.section}</span></td>
                                    <td>{req.sessions_per_week}</td>
                                    <td>{req.required_room_type || 'Any'}</td>
                                    <td className="actions-cell">
                                        <button className="btn btn-sm btn-edit" onClick={() => openEdit(req)}>
                                            Edit
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(req.id)}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Requirement' : 'Add Requirement'}>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Course</label>
                            <select
                                value={form.course_id}
                                onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                                required
                            >
                                <option value="">Select Course</option>
                                {courses.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Teacher</label>
                            <select
                                value={form.teacher_id}
                                onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                                required
                            >
                                <option value="">Select Teacher</option>
                                {teachers.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Section</label>
                            <input
                                type="text"
                                value={form.section}
                                onChange={(e) => setForm({ ...form, section: e.target.value })}
                                placeholder="e.g. 3B"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Sessions / Week</label>
                            <input
                                type="number"
                                min="1"
                                value={form.sessions_per_week}
                                onChange={(e) => setForm({ ...form, sessions_per_week: Number(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Required Room Type</label>
                        <select
                            value={form.required_room_type}
                            onChange={(e) => setForm({ ...form, required_room_type: e.target.value })}
                        >
                            {ROOM_TYPES.map((type) => (
                                <option key={type} value={type}>{type || 'Any'}</option>
                            ))}
                        </select>
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
