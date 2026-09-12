import { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../api/axios';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function GenerateRoutine() {
    const [requirements, setRequirements] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [rooms, setRooms] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [courses, setCourses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [committing, setCommitting] = useState(false);
    const [preview, setPreview] = useState(null);
    const [previewRows, setPreviewRows] = useState([]);
    const [commitResult, setCommitResult] = useState(null);
    const [error, setError] = useState('');

    const fetchAll = useCallback(async () => {
        try {
            const [reqRes, roomRes, slotRes, courseRes, teacherRes] = await Promise.all([
                API.get('routine-requirements/'),
                API.get('rooms/'),
                API.get('timeslots/'),
                API.get('courses/'),
                API.get('teachers/'),
            ]);
            setRequirements(reqRes.data);
            setSelectedIds(new Set(reqRes.data.map((r) => r.id)));
            setRooms(roomRes.data);
            setTimeSlots(slotRes.data);
            setCourses(courseRes.data);
            setTeachers(teacherRes.data);
        } catch (err) {
            console.error('Failed to fetch generator setup data', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const courseById = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c])), [courses]);
    const teacherById = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t])), [teachers]);

    const toggleSelected = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleGenerate = async () => {
        setError('');
        setCommitResult(null);
        setGenerating(true);
        try {
            const res = await API.post('routines/generate/', { requirement_ids: Array.from(selectedIds) });
            setPreview(res.data);
            setPreviewRows(res.data.placed.map((row) => ({ ...row })));
        } catch (err) {
            setError(err.response?.data ? JSON.stringify(err.response.data) : 'Failed to generate preview');
        } finally {
            setGenerating(false);
        }
    };

    const updateRow = (index, field, value) => {
        setPreviewRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    };

    const handleCommit = async () => {
        setError('');
        setCommitting(true);
        try {
            const rows = previewRows.map((row) => ({
                teacher_id: row.teacher_id,
                course_id: row.course_id,
                day: row.day,
                section: row.section,
                room_id: row.room_id,
                time_slot_id: row.time_slot_id,
            }));
            const res = await API.post('routines/generate/commit/', { rows });
            setCommitResult(res.data);
            setPreview(null);
            setPreviewRows([]);
            fetchAll();
        } catch (err) {
            setError(err.response?.data ? JSON.stringify(err.response.data) : 'Failed to commit routine');
        } finally {
            setCommitting(false);
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
                <h2>Generate Routine</h2>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {commitResult && (
                <div className="alert alert-success">
                    Created {commitResult.created.length} routine(s).
                    {commitResult.rejected.length > 0 && ` ${commitResult.rejected.length} row(s) were rejected at commit time.`}
                </div>
            )}

            {commitResult?.rejected?.length > 0 && (
                <div className="table-container" style={{ marginBottom: 24 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Row</th>
                                <th>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {commitResult.rejected.map((r, i) => (
                                <tr key={i}>
                                    <td>{JSON.stringify(r.row)}</td>
                                    <td className="reason-cell">{r.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="table-container" style={{ marginBottom: 24 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Include</th>
                            <th>Course</th>
                            <th>Teacher</th>
                            <th>Section</th>
                            <th>Sessions/Week</th>
                            <th>Room Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requirements.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="empty-row">
                                    No requirements defined yet. Add some on the Routine Requirements page first.
                                </td>
                            </tr>
                        ) : (
                            requirements.map((req) => (
                                <tr key={req.id}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(req.id)}
                                            onChange={() => toggleSelected(req.id)}
                                        />
                                    </td>
                                    <td>{req.course?.name} ({req.course?.code})</td>
                                    <td>{req.teacher?.name}</td>
                                    <td><span className="badge">{req.section}</span></td>
                                    <td>{req.sessions_per_week}</td>
                                    <td>{req.required_room_type || 'Any'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="form-actions" style={{ justifyContent: 'flex-start', marginBottom: 24 }}>
                <button
                    className="btn btn-primary"
                    onClick={handleGenerate}
                    disabled={generating || selectedIds.size === 0}
                >
                    {generating ? 'Generating…' : 'Generate Preview'}
                </button>
            </div>

            {preview && (
                <>
                    <div className="header-badge" style={{ display: 'inline-block', marginBottom: 16 }}>
                        {preview.summary.placed_count} placed / {preview.summary.unplaced_count} unplaced
                        {' '}(of {preview.summary.total_sessions} sessions)
                    </div>

                    <div className="table-container" style={{ marginBottom: 24 }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Course</th>
                                    <th>Teacher</th>
                                    <th>Section</th>
                                    <th>Day</th>
                                    <th>Time Slot</th>
                                    <th>Room</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewRows.length === 0 && preview.unplaced.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="empty-row">Nothing to place</td>
                                    </tr>
                                ) : null}

                                {previewRows.map((row, index) => (
                                    <tr key={`placed-${row.requirement_id}-${row.session_index}`}>
                                        <td><span className="status-badge status-approved">Placed</span></td>
                                        <td>{courseById[row.course_id]?.code}</td>
                                        <td>{teacherById[row.teacher_id]?.name}</td>
                                        <td><span className="badge">{row.section}</span></td>
                                        <td>
                                            <select value={row.day} onChange={(e) => updateRow(index, 'day', e.target.value)}>
                                                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            <select
                                                value={row.time_slot_id}
                                                onChange={(e) => updateRow(index, 'time_slot_id', Number(e.target.value))}
                                            >
                                                {timeSlots.map((slot) => (
                                                    <option key={slot.id} value={slot.id}>
                                                        {slot.start_time}-{slot.end_time}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <select
                                                value={row.room_id}
                                                onChange={(e) => updateRow(index, 'room_id', Number(e.target.value))}
                                            >
                                                {rooms.map((room) => (
                                                    <option key={room.id} value={room.id}>{room.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}

                                {preview.unplaced.map((row, i) => (
                                    <tr key={`unplaced-${row.requirement_id}-${row.session_index}-${i}`}>
                                        <td><span className="status-badge status-rejected">Unplaced</span></td>
                                        <td>{courseById[row.course_id]?.code}</td>
                                        <td>{teacherById[row.teacher_id]?.name}</td>
                                        <td><span className="badge">{row.section}</span></td>
                                        <td colSpan={3} className="reason-cell">{row.reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                        <button
                            className="btn btn-success"
                            onClick={handleCommit}
                            disabled={committing || previewRows.length === 0}
                        >
                            {committing ? 'Committing…' : 'Commit Routine'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
