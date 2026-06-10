import React, { useState, useEffect, useRef } from 'react';
import useEsp32Controller from '../hook/esp32Controller';
import './css/monitor.css';
import './js/Animation';

const Icons = {
    Moisture: () => (
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
    ),
    Temp: () => (
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
        </svg>
    ),
    Pump: () => (
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
        </svg>
    ),
    Download: () => (
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    ),
    History: () => (
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    Power: () => (
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
        </svg>
    )
};

const LogEntry = ({ row, isActive }) => {
    const prevValue = useRef(row.nilai);
    const [flash, setFlash] = useState('');

    useEffect(() => {
        if (row.nilai !== prevValue.current) {
            const newFlash = row.nilai > prevValue.current ? 'flash-up' : 'flash-down';
            setFlash(newFlash);
            prevValue.current = row.nilai;
            const timer = setTimeout(() => setFlash(''), 1000);
            return () => clearTimeout(timer);
        }
    }, [row.nilai]);

    return (
        <div className={`log-item ${flash} ${!isActive ? 'hidden' : ''}`}>
            <span className="log-time">{row.waktu}</span>
            <span className="log-value">{row.nilai}%</span>
            <span className="log-temp">
                {row.suhu !== null && row.suhu !== undefined ? `${row.suhu}°C` : '—'}
            </span>
        </div>
    );
};

const MiniFlowchart = ({ data }) => {
    if (!data || data.length < 2) return null;

    const points = [...data].reverse().map(item => item.nilai);
    const maxVal = 100;
    const width  = 200;
    const height = 40;

    const svgPoints = points.map((val, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - (val / maxVal) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="mini-flowchart">
            <svg width="100%" height="auto" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <polyline fill="none" stroke="currentColor" strokeWidth="2" points={svgPoints} />
            </svg>
        </div>
    );
};

const getTempStatus = (temp) => {
    if (temp === null) return { label: 'Menunggu data...', dotClass: '' };
    if (temp > 35)    return { label: 'Suhu Terlalu Tinggi', dotClass: 'danger-dot' };
    if (temp > 28)    return { label: 'Suhu Hangat', dotClass: 'warning' };
    return              { label: 'Suhu Normal', dotClass: 'healthy' };
};

function Monitoring() {
    const {
        moisture,
        temperature,
        systemStatus,
        information,
        history,
        sendPumpCommand,
        sendSystemCommand,
        downloadData
    } = useEsp32Controller();

    const [isDetailActive, setIsDetailActive] = useState(false);
    const tempStatus = getTempStatus(temperature);

    return (
        <div className="monitoring-wrapper">
            <header className="dashboard-header">
                <h1>Kebun<span className="accent">Ku</span> Monitoring</h1>
                <p className="subtitle">Smart Agriculture System</p>
            </header>

            <main className="dashboard-grid">
                {/* Moisture Card */}
                <section className="card card-hero">
                    <div className="card-icon"><Icons.Moisture /></div>
                    <div className="card-content">
                        <h3>Status Kelembaban</h3>
                        <div className="hero-value">
                            {moisture}<span className="unit">%</span>
                            <MiniFlowchart data={history} />
                        </div>
                        <div className="status-indicator">
                            <span className={`dot ${moisture > 30 ? 'healthy' : 'warning'}`}></span>
                            {moisture > 30 ? 'Kondisi Optimal' : 'Butuh Penyiraman'}
                        </div>
                    </div>
                </section>

                {/* Temperature Card */}
                <section className="card card-detail">
                    <div className="card-header" onClick={() => setIsDetailActive(!isDetailActive)}>
                        <div className="header-title">
                            <Icons.Temp />
                            <span>Detail Suhu</span>
                        </div>
                        <button className={`toggle-btn ${isDetailActive ? 'active' : ''}`}>
                            {isDetailActive ? 'Sembunyikan' : 'Lihat Detail'}
                        </button>
                    </div>

                    <div className={`detail-content ${isDetailActive ? 'show' : ''}`}>
                        <div className="temp-metric">
                            <span className="label">Suhu DHT22</span>
                            <span className="value">
                                {temperature !== null
                                    ? <>{temperature.toFixed(1)}<span className="unit">°C</span></>
                                    : <span className="no-data">Menunggu data...</span>
                                }
                            </span>
                        </div>
                        {temperature !== null && (
                            <div className="status-indicator" style={{ marginTop: '0.5rem' }}>
                                <span className={`dot ${tempStatus.dotClass}`}></span>
                                {tempStatus.label}
                            </div>
                        )}
                    </div>
                </section>

                {/* System Controls */}
                <section className="card card-system">
                    <div className="card-icon"><Icons.Power /></div>
                    <div className="card-content">
                        <h3>Kontrol Sistem</h3>
                        <div className="status-indicator">
                            <span className={`dot ${
                                systemStatus === 'ON'          ? 'healthy'   :
                                systemStatus === 'STARTING...' ? 'warning'   : 'danger-dot'
                            }`}></span>
                            Sistem: {systemStatus}
                        </div>
                        <div className="button-group">
                            <button
                                className={`btn btn-success ${systemStatus === 'ON' || systemStatus === 'STARTING...' ? 'active' : ''}`}
                                onClick={() => sendSystemCommand('START')}
                            >
                                Mulai
                            </button>
                            <button
                                className={`btn btn-warning ${systemStatus === 'OFF' ? 'active' : ''}`}
                                onClick={() => sendSystemCommand('STOP')}
                            >
                                Berhenti
                            </button>
                        </div>
                    </div>
                </section>

                {/* Pump Controls */}
                <section className="card card-controls">
                    <div className="card-icon"><Icons.Pump /></div>
                    <div className="card-content">
                        <h3>Kontrol Pompa</h3>
                        <div className="button-group">
                            <button className="btn btn-primary" onClick={() => sendPumpCommand('ON')}>
                                Nyalakan
                            </button>
                            <button className="btn btn-danger" onClick={() => sendPumpCommand('OFF')}>
                                Matikan
                            </button>
                        </div>
                    </div>
                </section>

                {/* Export Data */}
                <section className="card card-export">
                    <div className="card-icon"><Icons.Download /></div>
                    <div className="card-content">
                        <h3>Unduh Data</h3>
                        <div className="export-options">
                            <div className="export-section">
                                <span>Format JSON:</span>
                                <div className="btn-row">
                                    <button onClick={() => downloadData('json', 24)}>1H</button>
                                    <button onClick={() => downloadData('json', 168)}>1M</button>
                                    <button onClick={() => downloadData('json', 720)}>1B</button>
                                </div>
                            </div>
                            <div className="export-section">
                                <span>Format CSV:</span>
                                <div className="btn-row">
                                    <button onClick={() => downloadData('csv', 24)}>1H</button>
                                    <button onClick={() => downloadData('csv', 168)}>1M</button>
                                    <button onClick={() => downloadData('csv', 720)}>1B</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Logs / History */}
                <section className="card card-logs">
                    <div className="card-header">
                        <div className="header-title">
                            <Icons.History />
                            <span>Riwayat Aktivitas</span>
                        </div>
                    </div>
                    <div className="log-header">
                        <span>Waktu</span>
                        <span>Kelembaban (%)</span>
                        <span>Suhu (°C)</span>
                    </div>
                    <div className="logs-container">
                        {history.length > 0 ? (
                            history.slice(0, 10).map((row, index) => (
                                <LogEntry key={index} row={row} isActive={true} />
                            ))
                        ) : (
                            <p className="no-data">Belum ada data riwayat.</p>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default Monitoring;