import { useCallback, useEffect, useState } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/useAuth';

export default function ChangeRequests() {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [routines, setRoutines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ routine_id: '', reason: '' });
    const [error, setError] = useState('');
    const canUseChangeRequests = user?.isAdmin || user?.isTeacher;

    const fetchRequests = useCallback(async () => {
        try {
            const res = await API.get('change-request/');
            setRequests(res.data);
        } catch (err) {
            console.error('Failed to fetch change requests', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchRoutines = useCallback(async () => {
        try {
            const endpoint = user?.isAdmin ? 'routines/' : 'routines/my-routines/';
            const res = await API.get(endpoint);
            setRoutines(res.data);
        } catch (err) {
            console.error('Failed to fetch routines', err);
        }
    }, [user?.isAdmin]);

    useEffect(() => {
        // Review: Student users are read-only and should not access change requests.
        if (!canUseChangeRequests) {
            setLoading(false);
            return;
        }

        fetchRequests();
        fetchRoutines();
    }, [canUseChangeRequests, fetchRequests, fetchRoutines]);

    const openCreate = () => {
        setForm({ routine_id: '', reason: '' });
        setError('');
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await API.post('change-request/', form);
            setModalOpen(false);
            fetchRequests();
        } catch (err) {
            setError(err.response?.data ? JSON.stringify(err.response.data) : 'Operation failed');
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            await API.patch(`change-request/${id}/`, { status: newStatus });
            fetchRequests();
        } catch (err) {
            console.error('Status update failed', err);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved':
                return 'status-approved';
            case 'Rejected':
                return 'status-rejected';
            default:
                return 'status-pending';
        }
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!canUseChangeRequests) {
        return (
            <div className="page">
                <div className="page-header">
                    <h2>Change Requests</h2>
                </div>
                <div className="table-container">
                    <div className="empty-row">Students can view courses and routines only.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <h2>Change Requests</h2>
                {user?.isTeacher && (
                    <button className="btn btn-primary" onClick={openCreate}>
                        + New Request
                    </button>
                )}
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Routine</th>
                            <th>Requested By</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Date</th>
                            {user?.isAdmin && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {requests.length === 0 ? (
                            <tr>
                                <td colSpan={user?.isAdmin ? 7 : 6} className="empty-row">No change requests found</td>
                            </tr>
                        ) : (
                            requests.map((r) => (
                                <tr key={r.id}>
                                    <td>{r.id}</td>
                                    <td>
                                        <div className="cell-main">
                                            {r.routine?.course?.name} ({r.routine?.course?.code})
                                        </div>
                                        <div className="cell-sub">
                                            {r.routine?.day} · {r.routine?.start_time} – {r.routine?.end_time}
                                        </div>
                                    </td>
                                    <td>{r.requested_by?.name}</td>
                                    <td className="reason-cell">{r.reason}</td>
                                    <td>
                                        <span className={`status-badge ${getStatusColor(r.status)}`}>{r.status}</span>
                                    </td>
                                    <td className="date-cell">
                                        {new Date(r.requested_at).toLocaleDateString()}
                                    </td>
                                    {user?.isAdmin && (
                                        <td className="actions-cell">
                                            {r.status === 'Pending' && (
                                                <>
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => handleStatusChange(r.id, 'Approved')}
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleStatusChange(r.id, 'Rejected')}
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                            {r.status !== 'Pending' && (
                                                <span className="text-muted">—</span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Change Request">
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                        <label>Select Routine</label>
                        <select
                            value={form.routine_id}
                            onChange={(e) => setForm({ ...form, routine_id: e.target.value })}
                            required
                        >
                            <option value="">Choose a routine...</option>
                            {routines.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.course?.name || `Course #${r.course}`} · {r.day} · {r.start_time}–{r.end_time}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Reason for Change</label>
                        <textarea
                            value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                            placeholder="Explain the reason for the change request..."
                            rows={4}
                            required
                        />
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Submit Request
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
