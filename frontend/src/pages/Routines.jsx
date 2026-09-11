import { useCallback, useEffect, useRef, useState } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/useAuth';

export default function Routines() {
    const { user } = useAuth();
    const [routines, setRoutines] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [form, setForm] = useState({
        teacher_id: '',
        course_id: '',
        day: 'Monday',
        section: '',
        room_id: '',
        time_slot_id: '',
    });
    const [error, setError] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const fileInputRef = useRef(null);

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const fetchRoutines = useCallback(async () => {
        try {
            // Review: only Teacher users have a personal routine endpoint.
            const endpoint = user?.isTeacher ? 'routines/my-routines/' : 'routines/';
            const res = await API.get(endpoint);
            setRoutines(res.data);
        } catch (err) {
            console.error('Failed to fetch routines', err);
        } finally {
            setLoading(false);
        }
    }, [user?.isTeacher]);

    const fetchDropdowns = useCallback(async () => {
        try {
            const [rmRes, tsRes] = await Promise.all([API.get('rooms/'), API.get('timeslots/')]);
            setRooms(rmRes.data);
            setTimeSlots(tsRes.data);
        } catch (err) {
            console.error('Failed to fetch dropdown data', err);
        }

        if (!user?.isAdmin) return;
        try {
            const [tRes, cRes, uRes] = await Promise.all([API.get('teachers/'), API.get('courses/'), API.get('users/')]);
            setTeachers(tRes.data);
            setCourses(cRes.data);
            setStudents(uRes.data.filter((item) => item.role === 'Student'));
        } catch (err) {
            console.error('Failed to fetch dropdown data', err);
        }
    }, [user?.isAdmin]);

    useEffect(() => {
        fetchRoutines();
        fetchDropdowns();
    }, [fetchDropdowns, fetchRoutines]);

    const openCreate = () => {
        setEditing(null);
        setForm({ teacher_id: '', course_id: '', day: 'Monday', section: '', room_id: '', time_slot_id: '' });
        setSelectedStudentIds([]);
        setError('');
        setModalOpen(true);
    };

    const openEdit = (routine) => {
        setEditing(routine);
        setForm({
            teacher_id: routine.teacher?.id || '',
            course_id: routine.course?.id || '',
            day: routine.day,
            section: routine.section || '',
            room_id: routine.room?.id || '',
            time_slot_id: routine.time_slot?.id || '',
        });
        setSelectedStudentIds((routine.enrollments || []).map((enrollment) => String(enrollment.student?.id)));
        setError('');
        setModalOpen(true);
    };

    const handleStudentSelection = (e) => {
        setSelectedStudentIds(Array.from(e.target.selectedOptions, (option) => option.value));
    };

    const syncRoutineEnrollments = async (routine, desiredStudentIds) => {
        const currentEnrollments = routine.enrollments || [];
        const desired = new Set(desiredStudentIds.map(String));
        const current = new Set(currentEnrollments.map((enrollment) => String(enrollment.student?.id)));

        const removals = currentEnrollments
            .filter((enrollment) => !desired.has(String(enrollment.student?.id)))
            .map((enrollment) => API.delete(`enrollments/${enrollment.id}/`));

        const additions = desiredStudentIds
            .filter((studentId) => !current.has(String(studentId)))
            .map((studentId) =>
                API.post('enrollments/', {
                    routine_id: routine.id,
                    student_id: studentId,
                })
            );

        await Promise.all([...removals, ...additions]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const payload = { ...form, teacher_id: form.teacher_id || null };
        try {
            let routine;
            if (editing) {
                const res = await API.patch(`routines/${editing.id}/`, payload);
                routine = res.data;
            } else {
                const res = await API.post('routines/', payload);
                routine = res.data;
            }
            await syncRoutineEnrollments(routine, selectedStudentIds);
            setModalOpen(false);
            fetchRoutines();
        } catch (err) {
            setError(err.response?.data ? JSON.stringify(err.response.data) : 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this routine?')) return;
        try {
            await API.delete(`routines/${id}/`);
            fetchRoutines();
        } catch (err) {
            console.error('Delete failed', err);
        }
    };

    const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const handleExport = async (type) => {
        try {
            const res = await API.get(`routines/export/?type=${type}`, { responseType: 'blob' });
            downloadBlob(res.data, type === 'pdf' ? 'routine.pdf' : 'routine.xlsx');
        } catch (err) {
            console.error('Export failed', err);
        }
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
            const res = await API.post('routines/import-excel/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setImportResult(res.data);
            setImportModalOpen(true);
            fetchRoutines();
        } catch (err) {
            setImportResult({ errors: [{ row: '-', error: err.response?.data?.detail || 'Import failed' }], created_count: 0, failed_count: 1 });
            setImportModalOpen(true);
        }
    };

    const getStudentSummary = (routine) => {
        const enrolledStudents = routine.enrollments || [];
        if (enrolledStudents.length === 0) return 'No students';
        return enrolledStudents
            .slice(0, 3)
            .map((enrollment) => enrollment.student?.name || enrollment.student?.username)
            .join(', ') + (enrolledStudents.length > 3 ? ` +${enrolledStudents.length - 3}` : '');
    };

    const getDayColor = (day) => {
        const colors = {
            Monday: '#6366f1',
            Tuesday: '#8b5cf6',
            Wednesday: '#ec4899',
            Thursday: '#f59e0b',
            Friday: '#10b981',
            Saturday: '#06b6d4',
            Sunday: '#ef4444',
        };
        return colors[day] || '#6366f1';
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
                <div className="header-left">
                    <h2>Routines</h2>
                    {!user?.isAdmin && (
                        <span className="header-badge">{user?.isTeacher ? 'My Routines' : 'My Enrolled Routines'}</span>
                    )}
                    {user?.isAdmin && (
                        <span className="header-badge">All Routines</span>
                    )}
                </div>
                <div className="header-left">
                    <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}>
                        Export PDF
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleExport('excel')}>
                        Export Excel
                    </button>
                    {user?.isAdmin && (
                        <>
                            <button className="btn btn-secondary btn-sm" onClick={handleImportClick}>
                                Import Excel
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx"
                                style={{ display: 'none' }}
                                onChange={handleImportFile}
                            />
                            <button className="btn btn-primary" onClick={openCreate}>
                                + Add Routine
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Course</th>
                            <th>Section</th>
                            <th>Teacher</th>
                            <th>Time</th>
                            <th>Room</th>
                            {user?.isAdmin && <th>Students</th>}
                            {user?.isAdmin && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {routines.length === 0 ? (
                            <tr>
                                <td colSpan={user?.isAdmin ? 8 : 6} className="empty-row">No routines found</td>
                            </tr>
                        ) : (
                            routines.map((r) => (
                                <tr key={r.id}>
                                    <td>
                                        <span className="day-badge" style={{ background: getDayColor(r.day) }}>
                                            {r.day}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="cell-main">{r.course?.name}</div>
                                        <div className="cell-sub">{r.course?.code}</div>
                                    </td>
                                    <td><span className="badge">{r.section || '—'}</span></td>
                                    <td>{r.teacher?.name || 'TBA'}</td>
                                    <td>
                                        <span className="time-range">
                                            {r.time_slot ? `${r.time_slot.start_time} - ${r.time_slot.end_time}` : '—'}
                                        </span>
                                    </td>
                                    <td><span className="badge">{r.room?.name}</span></td>
                                    {user?.isAdmin && (
                                        <td className="students-cell">
                                            <div className="cell-main">{r.enrollments?.length || 0} assigned</div>
                                            <div className="cell-sub">{getStudentSummary(r)}</div>
                                        </td>
                                    )}
                                    {user?.isAdmin && (
                                        <td className="actions-cell">
                                            <button className="btn btn-sm btn-edit" onClick={() => openEdit(r)}>
                                                Edit
                                            </button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>
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

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Routine' : 'Add Routine'}>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Teacher</label>
                            <select
                                value={form.teacher_id}
                                onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                            >
                                <option value="">TBA (unassigned)</option>
                                {teachers.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Course</label>
                            <select
                                value={form.course_id}
                                onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                                required
                            >
                                <option value="">Select Course</option>
                                {courses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Day</label>
                            <select
                                value={form.day}
                                onChange={(e) => setForm({ ...form, day: e.target.value })}
                                required
                            >
                                {DAYS.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Section</label>
                            <input
                                type="text"
                                value={form.section}
                                onChange={(e) => setForm({ ...form, section: e.target.value })}
                                placeholder="e.g. 3B"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Time Slot</label>
                            <select
                                value={form.time_slot_id}
                                onChange={(e) => setForm({ ...form, time_slot_id: e.target.value })}
                                required
                            >
                                <option value="">Select Time Slot</option>
                                {timeSlots.map((slot) => (
                                    <option key={slot.id} value={slot.id}>
                                        {slot.start_time} - {slot.end_time}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Room</label>
                            <select
                                value={form.room_id}
                                onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                                required
                            >
                                <option value="">Select Room</option>
                                {rooms.map((room) => (
                                    <option key={room.id} value={room.id}>
                                        {room.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Students</label>
                        <select
                            multiple
                            value={selectedStudentIds}
                            onChange={handleStudentSelection}
                            className="multi-select"
                        >
                            {students.map((student) => (
                                <option key={student.id} value={student.id}>
                                    {student.name || student.username} - ID {student.id}
                                </option>
                            ))}
                        </select>
                        <div className="field-help">
                            Selected: {selectedStudentIds.length}
                        </div>
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
                    </div>
                )}
            </Modal>
        </div>
    );
}
