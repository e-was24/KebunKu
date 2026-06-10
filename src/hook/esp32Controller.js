import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';

const useEsp32Controller = () => {
    const [moisture, setMoisture] = useState(0);
    const [temperature, setTemperature] = useState(null);
    const [systemStatus, setSystemStatus] = useState('OFF');
    const [history, setHistory] = useState(() => {
        return JSON.parse(localStorage.getItem('sensorHistory')) || [];
    });

    const clientRef = useRef(null);

    useEffect(() => {
        const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
        clientRef.current = client;

        client.on('connect', () => {
            console.log('Terhubung ke broker cloud!');
            client.subscribe('kebun/sensor/moisture');
            client.subscribe('kebun/sensor/suhu');
        });

        client.on('message', (topic, message) => {
            const val = message.toString();

            if (topic === 'kebun/sensor/moisture') {
                const numVal = parseInt(val);
                const now = new Date();
                const waktuDisplay =
                    now.toLocaleDateString('id-ID', { weekday: 'long' }) + ', ' +
                    now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

                const newDataPoint = { timestamp: Date.now(), waktu: waktuDisplay, nilai: numVal };

                setMoisture(numVal);
                setSystemStatus('ON');
                setHistory(prev => {
                    const updatedHistory = [newDataPoint, ...prev].slice(0, 10000);
                    localStorage.setItem('sensorHistory', JSON.stringify(updatedHistory));
                    return updatedHistory;
                });
            }

            if (topic === 'kebun/sensor/suhu') {
                if (val === 'error' || val === '0') {
                    setTemperature(null);
                } else {
                    const suhuVal = parseFloat(val);
                    if (!isNaN(suhuVal)) setTemperature(suhuVal);
                }
            }
        });

        return () => client.end();
    }, []);

    const sendCommand = (topic, command) => {
        if (clientRef.current && clientRef.current.connected) {
            clientRef.current.publish(topic, command);
            console.log(`Mengirim ke ${topic}: ${command}`);
        } else {
            console.error('MQTT Client belum terhubung');
        }
    };

    const sendPumpCommand = (state) => sendCommand('kebun/pompa/set', state);

    const sendSystemCommand = (command) => {
        sendCommand('kebun/sistem/set', command);
        if (command === 'STOP') {
            setSystemStatus('OFF');
            setTemperature(null);
        } else if (command === 'START') {
            setSystemStatus('STARTING...');
        }
    };

    const downloadData = (format = 'json', filterJam = 24) => {
        const sekarang = Date.now();
        const filterMs = filterJam * 60 * 60 * 1000;
        const dataTerfilter = history.filter(item => (sekarang - item.timestamp) <= filterMs);

        if (dataTerfilter.length === 0) return alert('Data kosong!');

        let content, type, filename;
        if (format === 'json') {
            content  = JSON.stringify(dataTerfilter, null, 2);
            type     = 'application/json';
            filename = 'data_sensor.json';
        } else {
            content  = 'Waktu,Kelembaban (%)\n' +
                       dataTerfilter.map(r => `"${r.waktu}","${r.nilai}"`).join('\n');
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

    return {
        moisture,
        temperature,
        systemStatus,
        information: history.slice(0, 1),
        history:     history.slice(0, 20),
        fullHistory: history,
        sendPumpCommand,
        sendSystemCommand,
        downloadData,
        sendCommand,
    };
};

export default useEsp32Controller;