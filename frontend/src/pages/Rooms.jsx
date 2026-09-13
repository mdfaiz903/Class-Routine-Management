import { useEffect, useRef, useState } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/useAuth';
import { downloadCsvTemplate } from '../utils/csv';

const ROOM_TYPES = ['Theory', 'Lab'];

export default function Rooms() {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', room_type: 'Theory' });
    const [error, setError] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const fileInputRef = useRef(null);

    const fetchRooms = async () => {
        try {
            const res = await API.get('rooms/');
            setRooms(res.data);
        } catch (err) {
            console.error('Failed to fetch rooms', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    const openCreate = () => {
        setEditing(null);
        setForm({ name: '', room_type: 'Theory' });
        setError('');
        setModalOpen(true);
    };

    const openEdit = (room) => {
        setEditing(room);
        setForm({ name: room.name, room_type: room.room_type });
        setError('');
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (editing) {
                await API.patch(`rooms/${editing.id}/`, form);
            } else {
                await API.post('rooms/', form);
            }
            setModalOpen(false);
            fetchRooms();
        } catch (err) {
            setError(err.response?.data ? JSON.stringify(err.response.data) : 'Operation failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this room?')) return;
        try {
            await API.delete(`rooms/${id}/`);
            fetchRooms();
        } catch (err) {
            console.error('Delete failed', err);
        }
    };

    const handleDownloadTemplate = () => {
        downloadCsvTemplate('rooms_template.csv', ['name', 'room_type']);
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
            const res = await API.post('rooms/import-csv/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setImportResult(res.data);
            setImportModalOpen(true);
            fetchRooms();
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
                <h2>Rooms</h2>
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
                            + Add Room
                        </button>
                    </div>
                )}
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            {user?.isAdmin && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rooms.length === 0 ? (
                            <tr>
                                <td colSpan={user?.isAdmin ? 3 : 2} className="empty-row">No rooms found</td>
                            </tr>
                        ) : (
                            rooms.map((room) => (
                                <tr key={room.id}>
                                    <td>{room.name}</td>
                                    <td><span className="badge">{room.room_type}</span></td>
                                    {user?.isAdmin && (
                                        <td className="actions-cell">
                                            <button className="btn btn-sm btn-edit" onClick={() => openEdit(room)}>
                                                Edit
                                            </button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(room.id)}>
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

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Room' : 'Add Room'}>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                        <label>Room Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. 401(MB)"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Room Type</label>
                        <select
                            value={form.room_type}
                            onChange={(e) => setForm({ ...form, room_type: e.target.value })}
                            required
                        >
                            {ROOM_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
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
