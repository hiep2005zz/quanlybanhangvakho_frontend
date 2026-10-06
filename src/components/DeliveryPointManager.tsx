import { useCallback, useEffect, useState } from 'react';
import {
    listDeliveryPointsApi,
    createDeliveryPointApi,
    updateDeliveryPointApi,
    setDefaultDeliveryPointApi,
    deleteDeliveryPointApi,
} from '../services/api';
import type { DeliveryPoint, DeliveryPointInput } from '../types/deliveryPoint';

interface Props {
    token: string;
    dealerId: number;
    onChanged?: () => void;
    onCreated?: () => void;
}

const EMPTY: DeliveryPointInput = {
    label: '', address: '', receiver_name: '', receiver_phone: '',
    route_note: '', is_default: false,
};

export default function DeliveryPointManager({ token, dealerId, onChanged, onCreated }: Props) {
    const [points, setPoints] = useState<DeliveryPoint[]>([]);
    const [form, setForm] = useState<DeliveryPointInput>(EMPTY);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [deletingPoint, setDeletingPoint] = useState<DeliveryPoint | null>(null);

    const load = useCallback(async () => {
        try {
            setPoints(await listDeliveryPointsApi(token, dealerId));
        } catch (e) {
            setError((e as Error).message);
        }
    }, [token, dealerId]);

    useEffect(() => { load(); }, [load]);

    const run = async (fn: () => Promise<unknown>, isCreate = false) => {
        setError('');
        try {
            await fn();
            await load();
            onChanged?.();
            if (isCreate) onCreated?.();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const submit = () =>
        run(async () => {
            if (editingId) await updateDeliveryPointApi(token, dealerId, editingId, form);
            else await createDeliveryPointApi(token, dealerId, form);
            setForm(EMPTY);
            setEditingId(null);
        }, !editingId);
    const field = 'w-full rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && <p className="text-sm text-red-600">{error}</p>}

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {points.map((p) => (
                    <li
                        key={p.id}
                        style={{
                            listStyle: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            padding: 14,
                            borderRadius: 12,
                            border: p.is_default ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid #e2e8f0',
                            background: p.is_default ? 'rgba(99, 102, 241, 0.06)' : '#ffffff',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <b style={{ fontSize: 15, color: '#0f172a' }}>{p.label}</b>
                            {p.is_default && (
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: '2px 8px',
                                        borderRadius: 999,
                                        background: 'rgba(99, 102, 241, 0.15)',
                                        color: '#4f46e5',
                                    }}
                                >
                                    Mặc định
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: 13, color: '#475569' }}>{p.address}</div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                            {p.receiver_name} - {p.receiver_phone}
                        </div>
                        {p.route_note && (
                            <div style={{ fontSize: 12, fontStyle: 'italic', color: '#64748b' }}>
                                Ghi chú: {p.route_note}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <button type="button" onClick={() => {
                                setEditingId(p.id);
                                setForm({
                                    label: p.label, address: p.address, receiver_name: p.receiver_name,
                                    receiver_phone: p.receiver_phone, route_note: p.route_note ?? '',
                                    is_default: p.is_default,
                                });
                            }}>Sửa</button>
                            {!p.is_default && (
                                <button type="button" onClick={() => run(() => setDefaultDeliveryPointApi(token, dealerId, p.id))}>
                                    Đặt mặc định
                                </button>
                            )}
                            <button type="button" className="text-red-600" onClick={() => setDeletingPoint(p)}>Xóa</button>
                        </div>
                    </li>
                ))}
            </ul>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                    {editingId ? 'Sửa điểm giao' : 'Thêm điểm giao'}
                </h4>
                <input className={field} placeholder="Tên điểm giao (VD: Kho Bình Dương)"
                    value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                <input className={field} placeholder="Địa chỉ"
                    value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                <input className={field} placeholder="Người nhận"
                    value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} />
                <input className={field} placeholder="Số điện thoại"
                    value={form.receiver_phone} onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })} />
                <textarea className={field} placeholder="Ghi chú đường đi"
                    value={form.route_note ?? ''} onChange={(e) => setForm({ ...form, route_note: e.target.value })} />
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 8,
                        cursor: 'pointer',
                        width: '100%',
                        fontSize: 14,
                        color: '#334155',
                    }}
                >
                    <input
                        type="checkbox"
                        checked={form.is_default}
                        onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                        style={{ width: 16, height: 16, margin: 0, flex: '0 0 auto' }}
                    />
                    <span>Đặt làm điểm giao mặc định</span>
                </label>
                <div className="flex gap-2">
                    <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">
                        {editingId ? 'Lưu' : 'Thêm'}
                    </button>
                    {editingId && (
                        <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); }}
                            className="rounded-lg border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm">Hủy</button>
                    )}
                </div>
            </div>
            {deletingPoint && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100000,
                        padding: 16,
                    }}
                    onClick={() => setDeletingPoint(null)}
                >
                    <div
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 16,
                            padding: 24,
                            width: '100%',
                            maxWidth: 420,
                            color: '#0f172a',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                            Xóa điểm giao hàng?
                        </h3>
                        <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>
                            Điểm giao "{deletingPoint.label}" sẽ bị xóa. Các đơn hàng cũ không bị ảnh hưởng.
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setDeletingPoint(null)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    color: '#475569',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    fontWeight: 500,
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const id = deletingPoint.id;
                                    setDeletingPoint(null);
                                    run(() => deleteDeliveryPointApi(token, dealerId, id));
                                }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#ef4444',
                                    color: '#fff',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: 14,
                                }}
                            >
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}