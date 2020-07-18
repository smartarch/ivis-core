'use strict';

const log = require('../../../server/lib/log');
const si = require('systeminformation');

class ServerMonitor {
    constructor() {
        this.status = {
            isPlaying: false,
            position: 0,
            data: null,
        };

        this.refreshStatsBound = this.refreshStats.bind(this);
    }

    async getCPULoad() {
        const loadInfo = await si.currentLoad();

        return {
            load: loadInfo.currentload,
            user: loadInfo.currentload_user,
            system: loadInfo.currentload_system,
        };
    }
    async getMemStatus() {
        const memInfo = await si.mem();

        return {
            total: memInfo.total,
            free: memInfo.free,
            used: memInfo.used,
        };
    }
    async getNetLoad() {
        const netInfo = await si.networkStats('*');

        return netInfo.map(netIface => ({
            iface: netIface.iface,
            recievedBPerSec: netIface.rx_sec,
            transferedBPerSec: netIface.tx_sec,
        }));
    }
    async getDiskLoad() {
        const diskStat = await si.disksIO();

        return {
            readIOPerSec: diskStat.rIO_sec,
            writeIOPerSec: diskStat.wIO_sec,
            totalIOPerSec: diskStat.tIO_sec,
        };
    }

    async refreshStats() {
        const cpu_load =  await this.getCPULoad();

        const mem_status = await this.getMemStatus();

        const net_load = await this.getNetLoad();

        const disk_load = await this.getDiskLoad();

        this.updateStatus({data: { cpu_load, mem_status, net_load, disk_load}});
    }

    updateStatus(newStatus) {
        Object.assign(this.status, newStatus);
        this.status.position = Date.now();
    }


    startMonitoring() {
        this.refreshStats();
        this.refreshInterval = setInterval(this.refreshStatsBound, 100);
    }

    stopMonitoring() {
        clearInterval(this.refreshInterval);
    }

    getStatus() {
        return {...this.status};
    }

    play() {
        if (this.status.isPlaying) return;

        this.updateStatus({isPlaying: true});
        this.startMonitoring();
    }
    pause() {
        this.updateStatus({isPlaying: false});
        this.stopMonitoring();
    }
}

module.exports.create = function create() {
    return new ServerMonitor();
}
