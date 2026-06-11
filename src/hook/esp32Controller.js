import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';

// ======================================================
// KONFIGURASI SUPABASE — ganti dengan kredensial kamu
// ======================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;       // dari Project Settings → API
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; // anon/public key

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ======================================================
// HOOK UTAMA
// ======================================================
const useEsp32Controller = () => {
    const [moisture, setMoisture]       = useState(0);
    const [temperature, setTemperature] = useState(null);
    const [systemStatus, setSystemStatus] = useState('OFF');
    const [history, setHistory]         = useState([]);
    const [isLoading, setIsLoading]     = useState(true);

    const clientRef      = useRef(null);
    const lastInsertedId = useRef(null); // untuk update suhu ke baris terakhir

    // --------------------------------------------------
    // 1. Load history awal dari Supabase saat pertama buka
    // --------------------------------------------------
    useEffect(() => {
        const loadHistory = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('sensor_history')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(10000);

            if (error) {
                console.error('Gagal load history:', error.message);
            } else {
                setHistory(data || []);
            }
            setIsLoading(false);
        };

        loadHistory();
    }, []);

    // --------------------------------------------------
    // 2. Realtime subscription — update UI otomatis
    //    kalau ada perangkat lain / tab lain yang insert
    // --------------------------------------------------
    useEffect(() => {
        const channel = supabase
            .channel('sensor_history_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sensor_history' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setHistory(prev => [payload.new, ...prev].slice(0, 10000));
                    } else if (payload.eventType === 'UPDATE') {
                        setHistory(prev =>
                            prev.map(row => row.id === payload.new.id ? payload.new : row)
                        );
                    } else if (payload.eventType === 'DELETE') {
                        // Data lama dihapus trigger — bersihkan dari state juga
                        setHistory(prev => prev.filter(row => row.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    // --------------------------------------------------
    // 3. MQTT — terima data dari ESP32
    // --------------------------------------------------
    useEffect(() => {
        const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
        clientRef.current = client;

        client.on('connect', () => {
            console.log('Terhubung ke broker MQTT!');
            client.subscribe('kebun/sensor/moisture');
            client.subscribe('kebun/sensor/suhu');
        });

        client.on('message', async (topic, message) => {
            const val = message.toString();

            // --- Data Kelembaban ---
            if (topic === 'kebun/sensor/moisture') {
                const numVal = parseInt(val);
                const now    = new Date();
                const waktuDisplay =
                    now.toLocaleDateString('id-ID', { weekday: 'long' }) + ', ' +
                    now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

                setMoisture(numVal);
                setSystemStatus('ON');

                // Simpan ke Supabase
                const { data, error } = await supabase
                    .from('sensor_history')
                    .insert([{
                        timestamp: Date.now(),
                        waktu:     waktuDisplay,
                        nilai:     numVal,
                        suhu:      null,
                    }])
                    .select('id')
                    .single();

                if (error) {
                    console.error('Gagal simpan moisture:', error.message);
                } else {
                    lastInsertedId.current = data.id; // simpan ID untuk di-update suhu nanti
                }
            }

            // --- Data Suhu ---
            if (topic === 'kebun/sensor/suhu') {
                if (val === 'error' || val === '0') {
                    setTemperature(null);
                    return;
                }

                const suhuVal = parseFloat(val);
                if (!isNaN(suhuVal)) {
                    setTemperature(suhuVal);

                    // Update suhu ke baris moisture terakhir
                    if (lastInsertedId.current) {
                        const { error } = await supabase
                            .from('sensor_history')
                            .update({ suhu: suhuVal })
                            .eq('id', lastInsertedId.current);

                        if (error) {
                            console.error('Gagal update suhu:', error.message);
                        }
                    }
                }
            }
        });

        return () => client.end();
    }, []);

    // --------------------------------------------------
    // 4. Kirim perintah via MQTT
    // --------------------------------------------------
    const sendCommand = (topic, command) => {
        if (clientRef.current?.connected) {
            clientRef.current.publish(topic, command);
            console.log(`Mengirim ke ${topic}: ${command}`);
        } else {
            console.error('MQTT Client belum terhubung');
        }
    };

    const sendPumpCommand   = (state)   => sendCommand('kebun/pompa/set', state);
    const sendSystemCommand = (command) => {
        sendCommand('kebun/sistem/set', command);
        if (command === 'STOP') {
            setSystemStatus('OFF');
            setTemperature(null);
        } else if (command === 'START') {
            setSystemStatus('STARTING...');
        }
    };

    // --------------------------------------------------
    // 5. Download data (query langsung dari Supabase)
    // --------------------------------------------------
    const downloadData = async (format = 'json', filterJam = 24) => {
        const sekarang   = Date.now();
        const filterMs   = filterJam * 60 * 60 * 1000;
        const filterTime = sekarang - filterMs;

        const { data, error } = await supabase
            .from('sensor_history')
            .select('*')
            .gte('timestamp', filterTime)
            .order('timestamp', { ascending: false });

        if (error) {
            alert('Gagal mengambil data: ' + error.message);
            return;
        }
        if (!data || data.length === 0) {
            alert('Data kosong untuk rentang waktu ini!');
            return;
        }

        let content, type, filename;
        if (format === 'json') {
            content  = JSON.stringify(data, null, 2);
            type     = 'application/json';
            filename = 'data_sensor.json';
        } else {
            content = 'Waktu,Kelembaban (%),Suhu (°C)\n' +
                data.map(r =>
                    `"${r.waktu}","${r.nilai}","${r.suhu !== null && r.suhu !== undefined ? r.suhu : '-'}"`
                ).join('\n');
            type     = 'text/csv';
            filename = 'data_sensor.csv';
        }

        const blob = new Blob([content], { type });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // --------------------------------------------------
    // 6. Return nilai & fungsi ke komponen
    // --------------------------------------------------
    return {
        moisture,
        temperature,
        systemStatus,
        isLoading,
        information:  history.slice(0, 1),
        history:      history.slice(0, 20),
        fullHistory:  history,
        sendPumpCommand,
        sendSystemCommand,
        downloadData,
        sendCommand,
    };
};

export default useEsp32Controller;