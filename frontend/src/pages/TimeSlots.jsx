import { useEffect, useRef, useState } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/useAuth';
import { downloadCsvTemplate } from '../utils/csv';

export default function TimeSlots() {
    const { user } = useAuth();
    const [timeSlots, setTimeSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ label: '', start_time: '', end_time: '', order: 0 });
    const [error, setError] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const fileInputRef = useRef(null);

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

    const handleDownloadTemplate = () => {
        downloadCsvTemplate('timeslots_template.csv', ['label', 'start_time', 'end_time', 'order']);
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
            const res = await API.post('timeslots/import-csv/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setImportResult(res.data);
            setImportModalOpen(true);
            fetchTimeSlots();
        } catch (err) {
            setImportResult({ errors: [{ row: '-', error: err.response?.data?.detail || 'Import failed' }], created_count: 0, failed_count: 1 });
            setImportModalOpen(true);
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
                            + Add Time Slot
                        </button>
                    </div>
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
