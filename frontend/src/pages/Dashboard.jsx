import { useCallback, useEffect, useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/useAuth';

const now = new Date();
const defaultMonth = now.getMonth() + 1;
const defaultYear = now.getFullYear();

const getAttendanceActions = (records) =>
    records
        .flatMap((record) =>
            (record.actions || []).map((action) => ({
                ...action,
                teacher: action.teacher || record.teacher,
                routine: record.routine,
            }))
        )
        .sort((a, b) => {
            const dateCompare = String(b.date).localeCompare(String(a.date));
            if (dateCompare !== 0) return dateCompare;
            return String(b.time).localeCompare(String(a.time));
        });

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        teachers: 0,
        courses: 0,
        routines: 0,
        changeRequests: 0,
    });
    const [attendanceStatus, setAttendanceStatus] = useState({ slots: [] });
    const [attendanceSummary, setAttendanceSummary] = useState(null);
    const [attendanceReports, setAttendanceReports] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [attendanceFilters, setAttendanceFilters] = useState({
        teacher: '',
        month: String(defaultMonth),
        year: String(defaultYear),
        day: '',
    });
    const [attendanceMessage, setAttendanceMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Review: students are read-only, so they only call endpoints they can access.
                const routineEndpoint = user?.isTeacher ? 'routines/my-routines/' : 'routines/';
                const [coursesRes, routinesRes] = await Promise.all([
                    API.get('courses/'),
                    API.get(routineEndpoint),
                ]);

                let teacherCount = 0;
                let changeRequestCount = 0;

                if (user?.isAdmin) {
                    const teachersRes = await API.get('teachers/');
                    teacherCount = teachersRes.data.length;
                }

                if (user?.isAdmin || user?.isTeacher) {
                    const changeRes = await API.get('change-request/');
                    changeRequestCount = changeRes.data.length;
                }

                setStats({
                    teachers: teacherCount,
                    courses: coursesRes.data.length,
                    routines: routinesRes.data.length,
                    changeRequests: changeRequestCount,
                });
            } catch (err) {
                console.error('Failed to fetch stats', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user]);

    const fetchTeacherAttendance = useCallback(async () => {
        if (!user?.isTeacher) return;

        const [statusRes, summaryRes] = await Promise.all([
            API.get('attendance/status/'),
            API.get('attendance/summary/', {
                params: {
                    month: attendanceFilters.month,
                    year: attendanceFilters.year,
                },
            }),
        ]);

        setAttendanceStatus(statusRes.data);
        setAttendanceSummary(summaryRes.data);
    }, [attendanceFilters.month, attendanceFilters.year, user?.isTeacher]);

    const fetchAdminAttendance = useCallback(async () => {
        if (!user?.isAdmin) return;

        const params = {
            month: attendanceFilters.month,
            year: attendanceFilters.year,
        };
        if (attendanceFilters.teacher) params.teacher = attendanceFilters.teacher;
        if (attendanceFilters.day) params.day = attendanceFilters.day;

        const [teachersRes, summaryRes, recordsRes] = await Promise.all([
            API.get('teachers/'),
            API.get('attendance/summary/', { params }),
            API.get('attendance/', { params }),
        ]);

        setTeachers(teachersRes.data);
        setAttendanceReports(summaryRes.data.reports || []);
        setAttendanceRecords(recordsRes.data);
    }, [attendanceFilters, user?.isAdmin]);

    useEffect(() => {
        const fetchAttendance = async () => {
            try {
                await Promise.all([fetchTeacherAttendance(), fetchAdminAttendance()]);
            } catch (err) {
                console.error('Failed to fetch attendance', err);
            }
        };

        fetchAttendance();
    }, [fetchAdminAttendance, fetchTeacherAttendance]);

    const handleAttendanceAction = async (routineId, action) => {
        setAttendanceMessage('');
        try {
            await API.post(`attendance/${action}/`, { routine_id: routineId });
            setAttendanceMessage(action === 'check-in' ? 'Check-in recorded.' : 'Check-out recorded.');
            await fetchTeacherAttendance();
        } catch (err) {
            setAttendanceMessage(err.response?.data?.detail || 'Attendance action failed.');
        }
    };

    const cards = [
        ...(user?.isAdmin
            ? [{ title: 'Teachers', value: stats.teachers, icon: 'T', color: 'var(--accent-purple)' }]
            : []),
        { title: 'Courses', value: stats.courses, icon: 'C', color: 'var(--accent-blue)' },
        {
            title: user?.isTeacher ? 'My Routines' : 'All Routines',
            value: stats.routines,
            icon: 'R',
            color: 'var(--accent-green)',
        },
        ...(user?.isAdmin || user?.isTeacher
            ? [{ title: 'Change Requests', value: stats.changeRequests, icon: 'Q', color: 'var(--accent-orange)' }]
            : []),
    ];

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
            </div>
        );
    }

    const renderTeacherAttendance = () => {
        if (!user?.isTeacher) return null;

        return (
            <div className="attendance-section">
                <div className="section-header">
                    <h3>Today Attendance</h3>
                    <div className="form-group inline-filter">
                        <label>Month</label>
                        <input
                            type="number"
                            min="1"
                            max="12"
                            value={attendanceFilters.month}
                            onChange={(e) => setAttendanceFilters((current) => ({ ...current, month: e.target.value }))}
                        />
                    </div>
                </div>

                {attendanceMessage && <div className="alert alert-success">{attendanceMessage}</div>}

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Course</th>
                                <th>Schedule</th>
                                <th>Room</th>
                                <th>Check-In</th>
                                <th>Check-Out</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendanceStatus.slots.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-row">No routine is scheduled for today.</td>
                                </tr>
                            ) : (
                                attendanceStatus.slots.map((slot) => (
                                    <tr key={slot.routine.id}>
                                        <td>
                                            <div className="cell-main">{slot.routine.course?.name}</div>
                                            <div className="cell-sub">{slot.routine.course?.code}</div>
                                        </td>
                                        <td>{slot.routine.day} | {slot.routine.start_time} - {slot.routine.end_time}</td>
                                        <td><span className="badge">{slot.routine.room}</span></td>
                                        <td>
                                            <label className="check-cell">
                                                <input
                                                    type="checkbox"
                                                    checked={slot.checked_in}
                                                    disabled={!slot.can_check_in}
                                                    onChange={() => handleAttendanceAction(slot.routine.id, 'check-in')}
                                                />
                                                <span>{slot.check_in_time || 'Check-In'}</span>
                                            </label>
                                        </td>
                                        <td>
                                            <label className="check-cell">
                                                <input
                                                    type="checkbox"
                                                    checked={slot.checked_out}
                                                    disabled={!slot.can_check_out}
                                                    onChange={() => handleAttendanceAction(slot.routine.id, 'check-out')}
                                                />
                                                <span>{slot.check_out_time || 'Check-Out'}</span>
                                            </label>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {attendanceSummary && (
                    <>
                        <div className="stats-grid attendance-stats">
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'var(--accent-green)' }}>P</div>
                                <div className="stat-info">
                                    <span className="stat-value">{attendanceSummary.present_days}</span>
                                    <span className="stat-label">Present Days</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'var(--accent-red)' }}>A</div>
                                <div className="stat-info">
                                    <span className="stat-value">{attendanceSummary.absent_days}</span>
                                    <span className="stat-label">Absent Days</span>
                                </div>
                            </div>
                        </div>

                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Course</th>
                                        <th>Scheduled Time</th>
                                        <th>Status</th>
                                        <th>Check-In</th>
                                        <th>Check-Out</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attendanceSummary.slots.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="empty-row">No scheduled routine found for this month.</td>
                                        </tr>
                                    ) : (
                                        attendanceSummary.slots.map((slot) => (
                                            <tr key={`${slot.date}-${slot.routine_id}`}>
                                                <td>{slot.date}</td>
                                                <td>{slot.course} ({slot.course_code})</td>
                                                <td>{slot.scheduled_time}</td>
                                                <td>
                                                    <span className={`status-badge ${slot.status === 'Present' ? 'status-approved' : 'status-rejected'}`}>
                                                        {slot.status}
                                                    </span>
                                                </td>
                                                <td>{slot.check_in_time || '-'}</td>
                                                <td>{slot.check_out_time || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const renderAdminAttendance = () => {
        if (!user?.isAdmin) return null;

        return (
            <div className="attendance-section">
                <div className="section-header">
                    <h3>Teacher Attendance</h3>
                    <div className="attendance-filters">
                        <div className="form-group inline-filter">
                            <label>Teacher</label>
                            <select
                                value={attendanceFilters.teacher}
                                onChange={(e) => setAttendanceFilters((current) => ({ ...current, teacher: e.target.value }))}
                            >
                                <option value="">All Teachers</option>
                                {teachers.map((teacher) => (
                                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group inline-filter">
                            <label>Month</label>
                            <input
                                type="number"
                                min="1"
                                max="12"
                                value={attendanceFilters.month}
                                onChange={(e) => setAttendanceFilters((current) => ({ ...current, month: e.target.value }))}
                            />
                        </div>
                        <div className="form-group inline-filter">
                            <label>Year</label>
                            <input
                                type="number"
                                min="2000"
                                max="2100"
                                value={attendanceFilters.year}
                                onChange={(e) => setAttendanceFilters((current) => ({ ...current, year: e.target.value }))}
                            />
                        </div>
                        <div className="form-group inline-filter">
                            <label>Day</label>
                            <input
                                type="number"
                                min="1"
                                max="31"
                                placeholder="All"
                                value={attendanceFilters.day}
                                onChange={(e) => setAttendanceFilters((current) => ({ ...current, day: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Teacher</th>
                                <th>Present Days</th>
                                <th>Absent Days</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendanceReports.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="empty-row">No teacher attendance report found.</td>
                                </tr>
                            ) : (
                                attendanceReports.map((report) => (
                                    <tr key={report.teacher_id}>
                                        <td>{report.teacher_name}</td>
                                        <td>{report.present_days}</td>
                                        <td>{report.absent_days}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="table-container attendance-records">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Teacher</th>
                                <th>Date</th>
                                <th>Course</th>
                                <th>Check-In</th>
                                <th>Check-Out</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendanceRecords.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-row">No check-in/check-out records found.</td>
                                </tr>
                            ) : (
                                attendanceRecords.map((record) => (
                                    <tr key={record.id}>
                                        <td>{record.teacher?.name}</td>
                                        <td>{record.date_display}</td>
                                        <td>{record.routine?.course?.name} ({record.routine?.course?.code})</td>
                                        <td>{record.check_in_time_display || '-'}</td>
                                        <td>{record.check_out_time_display || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="table-container attendance-records">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Teacher</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Action Type</th>
                                <th>Routine</th>
                            </tr>
                        </thead>
                        <tbody>
                            {getAttendanceActions(attendanceRecords).length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-row">No attendance actions found.</td>
                                </tr>
                            ) : (
                                getAttendanceActions(attendanceRecords).map((action) => (
                                    <tr key={action.id}>
                                        <td>{action.teacher?.name}</td>
                                        <td>{action.date_display}</td>
                                        <td>{action.time_display}</td>
                                        <td>
                                            <span className={`status-badge ${action.action_type === 'Check-In' ? 'status-approved' : 'status-pending'}`}>
                                                {action.action_type}
                                            </span>
                                        </td>
                                        <td>{action.routine?.course?.name} ({action.routine?.course?.code})</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard">
                <div className="welcome-banner">
                    <div>
                        <h2>Welcome back, {user?.username}!</h2>

                        <p>
                            You are logged in as{' '}
                            {user?.role === 'Admin'
                                ? 'an Administrator'
                                : user?.role === 'Teacher'
                                ? 'a Teacher'
                                : 'a Student'}
                            .
                        </p>
                    </div>
                </div>

            <div className="stats-grid">
                {cards.map((card) => (
                    <div className="stat-card" key={card.title}>
                        <div className="stat-icon" style={{ background: card.color }}>
                            {card.icon}
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{card.value}</span>
                            <span className="stat-label">{card.title}</span>
                        </div>
                    </div>
                ))}
            </div>

            {renderTeacherAttendance()}
            {renderAdminAttendance()}
        </div>
    );
}

