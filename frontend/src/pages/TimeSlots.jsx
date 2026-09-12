import { useEffect, useState } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/useAuth';

export default function TimeSlots() {
    const { user } = useAuth();
    const [timeSlots, setTimeSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ label: '', start_time: '', end_time: '', order: 0 });
    const [error, setError] = useState('');

    const fetchTimeSlots = async () => {
        try {
            const res = await API.get('timeslots/');
            setTimeSlots(res.data);
        } catch (err) {
            console.error('Failed to fetch time slots', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimeSlots();
    }, []);

    const openCreate = () => {
        setEditing(null);
        setForm({ label: '', start_time: '', end_time: '', order: timeSlots.length });
        setError('');
        setModalOpen(true);
    };

    const openEdit = (slot) => {
        setEditing(slot);
        setForm({ label: slot.label, start_time: slot.start_time, end_time: slot.end_time, order: slot.order });
        setError('');
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (editing) {
                await API.patch(`timeslots/${editing.id}/`, form);
            } else {
                await API.post('timeslots/', form);
            }
            setModalOpen(false);
            fetchTimeSlots();
        } catch (err) {
            setError(err.response?.data ? JSON.stringify(err.response.data) : 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this time slot?')) return;
        try {
            await API.delete(`timeslots/${id}/`);
            fetchTimeSlots();
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
                <h2>Time Slots</h2>
                {user?.isAdmin && (
                    <button className="btn btn-primary" onClick={openCreate}>
                        + Add Time Slot
                    </button>
                )}
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Order</th>
                            <th>Label</th>
                            <th>Start</th>
                            <th>End</th>
                            {user?.isAdmin && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.length === 0 ? (
                            <tr>
                                <td colSpan={user?.isAdmin ? 5 : 4} className="empty-row">No time slots found</td>
                            </tr>
                        ) : (
                            timeSlots.map((slot) => (
                                <tr key={slot.id}>
                                    <td>{slot.order}</td>
                                    <td>{slot.label || '—'}</td>
                                    <td><span className="time-range">{slot.start_time}</span></td>
                                    <td><span className="time-range">{slot.end_time}</span></td>
                                    {user?.isAdmin && (
                                        <td className="actions-cell">
                                            <button className="btn btn-sm btn-edit" onClick={() => openEdit(slot)}>
                                                Edit
                                            </button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(slot.id)}>
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

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Time Slot' : 'Add Time Slot'}>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                        <label>Label (optional)</label>
                        <input
                            type="text"
                            value={form.label}
                            onChange={(e) => setForm({ ...form, label: e.target.value })}
                            placeholder="e.g. Slot 1"
                        />
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
                        <label>Sort Order</label>
                        <input
                            type="number"
                            min="0"
                            value={form.order}
                            onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
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
