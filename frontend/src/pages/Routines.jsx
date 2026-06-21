import { useCallback, useEffect, useState } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/useAuth';

export default function Routines() {
    const { user } = useAuth();
    const [routines, setRoutines] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [form, setForm] = useState({
        teacher_id: '',
        course_id: '',
        day: 'Monday',
        start_time: '',
        end_time: '',
        room: '',
    });
    const [error, setError] = useState('');

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
        setForm({ teacher_id: '', course_id: '', day: 'Monday', start_time: '', end_time: '', room: '' });
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
            start_time: routine.start_time,
            end_time: routine.end_time,
            room: routine.room,
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
        try {
            let routine;
            if (editing) {
                const res = await API.patch(`routines/${editing.id}/`, form);
                routine = res.data;
            } else {
                const res = await API.post('routines/', form);
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
                {user?.isAdmin && (
                    <button className="btn btn-primary" onClick={openCreate}>
                        + Add Routine
                    </button>
                )}
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Course</th>
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
                                <td colSpan={user?.isAdmin ? 7 : 5} className="empty-row">No routines found</td>
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
                                    <td>{r.teacher?.name}</td>
                                    <td>
                                        <span className="time-range">
                                            {r.start_time} - {r.end_time}
                                        </span>
                                    </td>
                                    <td><span className="badge">{r.room}</span></td>
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
                                required
                            >
                                <option value="">Select Teacher</option>
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

                    <div className="form-row">
                        <div className="form-group">
                            <label>Start Time</label>
                            <input
                                type="time"
                                value={form.start_time}
                                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>End Time</label>
                            <input
                                type="time"
                                value={form.end_time}
                                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Room</label>
                        <input
                            type="text"
                            value={form.room}
                            onChange={(e) => setForm({ ...form, room: e.target.value })}
                            placeholder="e.g. Room 101"
                            required
                        />
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
        </div>
    );
}
