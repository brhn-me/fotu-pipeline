import { useState, useEffect } from 'react';
import { API_Base } from '../config';

export function SettingsPage() {
    const [outputDir, setOutputDir] = useState('');

    useEffect(() => {
        fetch(`${API_Base}/config`).then(r => r.json()).then(d => {
            if (d.output_dir) setOutputDir(d.output_dir);
        });
    }, []);

    const save = async () => {
        await fetch(`${API_Base}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'output_dir', value: outputDir })
        });
        alert("Saved");
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <h2 className="text-3xl font-bold text-gray-800">Settings</h2>
            <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Global Output Directory</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={outputDir}
                            onChange={e => setOutputDir(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button onClick={save} className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-black transition-colors">Save</button>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">All processed files will be saved here, organized by type (/photos, /videos, /raw).</p>
                </div>
            </div>
        </div>
    );
}
