import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SATU_JAM_MS          = 60 * 60 * 1000;
const THRESHOLD_SUHU       = 2;
const THRESHOLD_KELEMBABAN = 1;

const useEsp32Controller = () => {
    const [moisture, setMoisture]         = useState(0);
    const [temperature, setTemperature]   = useState(null);
    const [systemStatus, setSystemStatus] = useState('OFF');
    const [history, setHistory]           = useState([]);
    const [isLoading, setIsLoading]       = useState(true);
    const [lastSaveEvent, setLastSaveEvent] = useState(null); // { id, reason }

    const clientRef    = useRef(null);
    const lastSaveTime = useRef(0);

    const pendingMoisture = useRef(null);
    const pendingSuhu     = useRef(null);
    const pendingWaktu    = useRef(null);
    const pendingTs       = useRef(null);

    const lastSavedMoisture = useRef(null);
    const lastSavedSuhu     = useRef(null);

    // --------------------------------------------------
    // Cek kondisi perlu simpan
    // --------------------------------------------------
    const shouldSave = () => {
        const nowMs = Date.now();
        if (nowMs - lastSaveTime.current >= SATU_JAM_MS)
            return { save: true, reason: '1 jam' };

        if (
            pendingSuhu.current !== null &&
            lastSavedSuhu.current !== null &&
            (lastSavedSuhu.current - pendingSuhu.current) >= THRESHOLD_SUHU
        ) return { save: true, reason: `suhu turun ${(lastSavedSuhu.current - pendingSuhu.current).toFixed(1)}°C` };

        if (
            pendingMoisture.current !== null &&
            lastSavedMoisture.current !== null &&
            (lastSavedMoisture.current - pendingMoisture.current) >= THRESHOLD_KELEMBABAN
        ) return { save: true, reason: `kelembaban turun ${lastSavedMoisture.current - pendingMoisture.current}%` };

        return { save: false };
    };

    // --------------------------------------------------
    // Insert ke Supabase
    // --------------------------------------------------
    const trySaveToSupabase = async () => {
        if (pendingMoisture.current === null) return;

        const { save, reason } = shouldSave();
        if (!save) return;

        lastSaveTime.current = Date.now();

        const payload = {
            timestamp: pendingTs.current,
            waktu:     pendingWaktu.current,
            nilai:     pendingMoisture.current,
            suhu:      pendingSuhu.current,
        };

        const { error } = await supabase
            .from('sensor_history')
            .insert([payload]);

        if (error) {
            console.error('Gagal simpan ke Supabase:', error.message);
            lastSaveTime.current = 0;
        } else {
            console.log(`✅ Tersimpan (${reason}):`, payload.waktu);
            lastSavedMoisture.current = pendingMoisture.current;
            lastSavedSuhu.current     = pendingSuhu.current;

            // Trigger notif ke UI
            setLastSaveEvent({ id: Date.now(), reason });
        }

        pendingMoisture.current = null;
        pendingSuhu.current     = null;
    };

    // --------------------------------------------------
    // 1. Load history awal
    // --------------------------------------------------
    useEffect(() => {
        const loadHistory = async () => {
            setIsLoading(true);
            const sebulanLalu = Date.now() - (30 * 24 * 60 * 60 * 1000);

            const { data, error } = await supabase
                .from('sensor_history')
                .select('*')
                .gte('timestamp', sebulanLalu)
                .order('timestamp', { ascending: false });

            if (error) {
                console.error('Gagal load history:', error.message);
            } else {
                const loaded = data || [];
                setHistory(loaded);
                if (loaded.length > 0) {
                    lastSavedMoisture.current = loaded[0].nilai;
                    lastSavedSuhu.current     = loaded[0].suhu;
                }
            }
            setIsLoading(false);
        };

        loadHistory();
    }, []);

    // --------------------------------------------------
    // 2. Realtime subscription
    // --------------------------------------------------
    useEffect(() => {
        const channel = supabase
            .channel('sensor_history_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sensor_history' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setHistory(prev => [payload.new, ...prev]);
                    } else if (payload.eventType === 'DELETE') {
                        setHistory(prev => prev.filter(row => row.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    // --------------------------------------------------
    // 3. MQTT
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

            if (topic === 'kebun/sensor/moisture') {
                const numVal = parseInt(val);
                const nowMs  = Date.now();
                const now    = new Date();
                const waktuDisplay =
                    now.toLocaleDateString('id-ID', { weekday: 'long' }) + ', ' +
                    now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

                setMoisture(numVal);
                setSystemStatus('ON');

                setHistory(prev => [{
                    id:        `local-${nowMs}`,
                    timestamp: nowMs,
                    waktu:     waktuDisplay,
                    nilai:     numVal,
                    suhu:      pendingSuhu.current,
                }, ...prev]);

                pendingMoisture.current = numVal;
                pendingWaktu.current    = waktuDisplay;
                pendingTs.current       = nowMs;

                await trySaveToSupabase();
            }

            if (topic === 'kebun/sensor/suhu') {
                if (val === 'error' || val === '0') {
                    setTemperature(null);
                    pendingSuhu.current = null;
                    return;
                }

                const suhuVal = parseFloat(val);
                if (!isNaN(suhuVal)) {
                    setTemperature(suhuVal);
                    pendingSuhu.current = suhuVal;

                    setHistory(prev => {
                        if (prev.length === 0) return prev;
                        const updated = [...prev];
                        updated[0] = { ...updated[0], suhu: suhuVal };
                        return updated;
                    });

                    await trySaveToSupabase();
                }
            }
        });

        return () => client.end();
    }, []);

    // --------------------------------------------------
    // 4. Kontrol
    // --------------------------------------------------
    const sendCommand = (topic, command) => {
        if (clientRef.current?.connected) {
            clientRef.current.publish(topic, command);
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
    // 5. Download
    // --------------------------------------------------
    const downloadData = async (format = 'json', filterJam = 24) => {
        const filterTime = Date.now() - (filterJam * 60 * 60 * 1000);

        const { data, error } = await supabase
            .from('sensor_history')
            .select('*')
            .gte('timestamp', filterTime)
            .order('timestamp', { ascending: false });

        if (error)                      { alert('Gagal mengambil data: ' + error.message); return; }
        if (!data || data.length === 0) { alert('Data kosong untuk rentang waktu ini!');   return; }

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
    // 6. Return
    // --------------------------------------------------
    return {
        moisture,
        temperature,
        systemStatus,
        isLoading,
        lastSaveEvent,
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