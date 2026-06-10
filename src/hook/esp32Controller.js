import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';

const useEsp32Controller = () => {
    const [moisture, setMoisture] = useState(0);
    const [systemStatus, setSystemStatus] = useState('OFF');
    const [history, setHistory] = useState(() => {
        // Mengambil data dari localStorage saat inisialisasi
        return JSON.parse(localStorage.getItem('sensorHistory')) || [];
    });

    const clientRef = useRef(null);

    useEffect(() => {
        const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
        clientRef.current = client;

        client.on('connect', () => {
            console.log('Terhubung ke broker cloud!');
            client.subscribe('kebun/sensor/moisture');
        });

        client.on('message', (topic, message) => {
            if (topic === 'kebun/sensor/moisture') {
                const val = parseInt(message.toString());
                const now = new Date();
                const waktuDisplay = now.toLocaleDateString('id-ID', { weekday: 'long' }) + ', ' +
                    now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

                const newDataPoint = { timestamp: Date.now(), waktu: waktuDisplay, nilai: val };

                setMoisture(val);
                setSystemStatus('ON'); // Sistem ON jika ada data masuk
                setHistory(prev => {
                    // Menyimpan hingga 10.000 data agar mencakup 1 minggu (asumsi 1 data/menit)
                    const updatedHistory = [newDataPoint, ...prev].slice(0, 10000);
                    localStorage.setItem('sensorHistory', JSON.stringify(updatedHistory));
                    return updatedHistory;
                });
            }
        });

        return () => client.end();
    }, []);

    // Mengirim perintah MQTT ke topik tertentu
    const sendCommand = (topic, command) => {
        if (clientRef.current && clientRef.current.connected) {
            clientRef.current.publish(topic, command);
            console.log(`Mengirim ke ${topic}: ${command}`);
        } else {
            console.error("MQTT Client belum terhubung");
        }
    };

    // Fungsi khusus pompa
    const sendPumpCommand = (state) => {
        sendCommand('kebun/pompa/set', state);
    };

    // Fungsi khusus sistem (On/Off)
    const sendSystemCommand = (command) => {
        sendCommand('kebun/sistem/set', command);
        if (command === 'STOP') {
            setSystemStatus('OFF');
        } else if (command === 'START') {
            setSystemStatus('STARTING...');
        }
    };

    // Mengunduh data dengan filter durasi (dalam jam)
    const downloadData = (format = 'json', filterJam = 24) => {
        const sekarang = Date.now();
        const filterMs = filterJam * 60 * 60 * 1000;
        const dataTerfilter = history.filter(item => (sekarang - item.timestamp) <= filterMs);

        if (dataTerfilter.length === 0) return alert("Data kosong!");

        let content, type, filename;
        if (format === 'json') {
            content = JSON.stringify(dataTerfilter);
            type = 'application/json';
            filename = 'data_sensor.json';
        } else {
            content = "Waktu,Kelembaban (%)\n" +
                dataTerfilter.map(r => `"${r.waktu}","${r.nilai}"`).join("\n");
            type = 'text/csv';
            filename = 'data_sensor.csv';
        }

        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };

    // Fungsi untuk UI agar hanya mengambil 20 data terakhir
    const getRecentHistory = () => history.slice(0, 20);
    const getInformationData = () => history.slice(0, 1);

    return {
        moisture,
        systemStatus,
        information: getInformationData(),
        history: getRecentHistory(), // Data untuk Tabel (10 terakhir)
        fullHistory: history,        // Data penuh untuk download
        sendPumpCommand,
        sendSystemCommand,
        downloadData,
        sendCommand
    };
};

export default useEsp32Controller;