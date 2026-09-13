import { useCallback, useEffect, useRef, useState } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';
import { downloadCsvTemplate } from '../utils/csv';

export default function Teachers() {
    const [teachers, setTeachers] = useState([]);
    const [users, setUsers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ user_id: '' });
    const [editForm, setEditForm] = useState({
        acronym: '', designation: '', department: '', mobile_number: '', specialization_ids: [],
    });
    const [error, setError] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const fileInputRef = useRef(null);

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

    const fetchCourses = useCallback(async () => {
        try {
            const res = await API.get('courses/');
            setCourses(res.data);
        } catch (err) {
            console.error('Failed to fetch courses', err);
        }
    }, []);

    useEffect(() => {
        fetchTeachers();
        fetchUsers();
        fetchCourses();
    }, [fetchTeachers, fetchUsers, fetchCourses]);

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

    const openEdit = (teacher) => {
        setEditing(teacher);
        setEditForm({
            acronym: teacher.acronym || '',
            designation: teacher.designation || '',
            department: teacher.department || '',
            mobile_number: teacher.mobile_number || '',
            specialization_ids: (teacher.specializations || []).map((c) => String(c.id)),
        });
        setError('');
        setModalOpen(true);
    };

    const handleSpecializationSelection = (e) => {
        setEditForm({
            ...editForm,
            specialization_ids: Array.from(e.target.selectedOptions, (option) => option.value),
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await API.patch(`teachers/${editing.id}/`, editForm);
            setModalOpen(false);
            setEditing(null);
            fetchTeachers();
        } catch (err) {
            setError(err.response?.data ? JSON.stringify(err.response.data) : 'Operation failed');
        }
    };

    const handleDownloadTemplate = () => {
        downloadCsvTemplate('teachers_template.csv', [
            'name', 'email', 'username', 'password', 'acronym', 'designation', 'department',
            'mobile_number', 'specialization',
        ]);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await API.post('teachers/import-csv/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setImportResult(res.data);
            setImportModalOpen(true);
            fetchTeachers();
            fetchUsers();
        } catch (err) {
            setImportResult({ errors: [{ row: '-', error: err.response?.data?.detail || 'Import failed' }], created_count: 0, failed_count: 1 });
            setImportModalOpen(true);
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
                <div className="header-left">
                    <button className="btn btn-secondary btn-sm" onClick={handleDownloadTemplate}>
                        Download Template
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleImportClick}>
                        Import CSV
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        style={{ display: 'none' }}
                        onChange={handleImportFile}
                    />
                    <button className="btn btn-primary" onClick={openCreate}>
                        + Add Teacher
                    </button>
                </div>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Acronym</th>
                            <th>Designation</th>
                            <th>Department</th>
                            <th>Mobile</th>
                            <th>Specializations</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teachers.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="empty-row">No teachers found</td>
                            </tr>
                        ) : (
                            teachers.map((t) => (
                                <tr key={t.id}>
                                    <td>{t.id}</td>
                                    <td>{t.name}</td>
                                    <td>{t.email}</td>
                                    <td>{t.acronym || '—'}</td>
                                    <td>{t.designation || '—'}</td>
                                    <td>{t.department || '—'}</td>
                                    <td>{t.mobile_number || '—'}</td>
                                    <td>{(t.specializations || []).map((c) => c.code).join(', ') || '—'}</td>
                                    <td className="actions-cell">
                                        <button className="btn btn-sm btn-edit" onClick={() => openEdit(t)}>
                                            Edit
                                        </button>
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

            <Modal isOpen={modalOpen && !editing} onClose={() => setModalOpen(false)} title="Add Teacher">
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

            <Modal
                isOpen={modalOpen && !!editing}
                onClose={() => { setModalOpen(false); setEditing(null); }}
                title={`Edit Teacher${editing ? ` - ${editing.name}` : ''}`}
            >
                <form onSubmit={handleEditSubmit} className="modal-form">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Acronym</label>
                            <input
                                type="text"
                                value={editForm.acronym}
                                onChange={(e) => setEditForm({ ...editForm, acronym: e.target.value })}
                                placeholder="e.g. RUM"
                            />
                        </div>
                        <div className="form-group">
                            <label>Mobile Number</label>
                            <input
                                type="text"
                                value={editForm.mobile_number}
                                onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Designation</label>
                            <input
                                type="text"
                                value={editForm.designation}
                                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                                placeholder="e.g. Lecturer"
                            />
                        </div>
                        <div className="form-group">
                            <label>Department</label>
                            <input
                                type="text"
                                value={editForm.department}
                                onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                                placeholder="e.g. CSE"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Specializations</label>
                        {courses.length === 0 ? (
                            <div className="empty-row">No courses yet - add or import courses on the Courses page first.</div>
                        ) : (
                            <>
                                <select
                                    multiple
                                    value={editForm.specialization_ids}
                                    onChange={handleSpecializationSelection}
                                    className="multi-select"
                                >
                                    {courses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.name} ({course.code})
                                        </option>
                                    ))}
                                </select>
                                <div className="field-help">
                                    Selected: {editForm.specialization_ids.length}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => { setModalOpen(false); setEditing(null); }}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Update
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="Import Results">
                {importResult && (
                    <div>
                        <div className={importResult.failed_count > 0 ? 'alert alert-error' : 'alert alert-success'}>
                            Created {importResult.created_count} row(s), {importResult.failed_count} failed.
                        </div>
                        {importResult.errors?.length > 0 && (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Row</th>
                                            <th>Error</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importResult.errors.map((err, i) => (
                                            <tr key={i}>
                                                <td>{err.row}</td>
                                                <td className="reason-cell">{err.error}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {importResult.warnings?.length > 0 && (
                            <>
                                <div className="alert alert-warning">
                                    {importResult.warnings.length} row(s) created with warnings (e.g. an unmatched specialization code was skipped).
                                </div>
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Row</th>
                                                <th>Warning</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importResult.warnings.map((warn, i) => (
                                                <tr key={i}>
                                                    <td>{warn.row}</td>
                                                    <td className="reason-cell">{warn.warning}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
