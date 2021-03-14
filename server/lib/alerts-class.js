'use strict';

const knex = require('./knex');
const { evaluate } = require('./alerts-condition-parser');
const moment = require('moment');

class Alert{
    constructor(id){
        this.id = id;
    }

    async setupTimers(state, state_changed, delay, duration) {
        const elapsed = moment().diff(state_changed);
        if (state === 'worse') {
            if (elapsed >= duration * 60 * 1000) await this.conditionClockHandler();
            else this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), (duration * 60 * 1000) - elapsed);
        }
        else if (state === 'better') {
            if (elapsed >= delay * 60 * 1000) await this.conditionClockHandler();
            else this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), (delay * 60 * 1000) - elapsed);
        }
    }

    terminate(){
        clearTimeout(this.conditionClock);
    }

    async execute(){
        await knex.transaction(async tx => {
            const alert = await tx('alerts').where('id', this.id).first();
            if (!alert) return;
            if (!alert.enabled) {
                await this.revokeTx(tx);
                return;
            }
            const result = await evaluate(alert.condition, alert.sigset);
            if (typeof result === 'boolean') await this.changeStateTx(tx, result, alert.duration, alert.delay, alert.state);
            else await this.addLogEntryTx(tx, result);
        });
    }

    /*
    * Possible states are: good, worse, bad, better.
    * result means wrong incoming data, !result means right incoming data
    */
    async changeStateTx(tx, result, duration, delay, currentState){
        if (result) {
            if (currentState === 'good') {
                if (duration === 0) {
                    await this.triggerTx(tx);
                }
                else {
                    await this.writeStateTx(tx, 'worse');
                    this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), duration * 60 * 1000);
                }
            }
            else if (currentState === 'better') {
                clearTimeout(this.conditionClock);
                await this.writeStateTx(tx, 'bad');
            }
        }
        else {
            if (currentState === 'bad') {
                if (delay === 0) {
                    await this.revokeTx(tx);
                }
                else {
                    await this.writeStateTx(tx, 'better');
                    this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), delay * 60 * 1000);
                }
            }
            else if (currentState === 'worse') {
                clearTimeout(this.conditionClock);
                await this.writeStateTx(tx, 'good');
            }
        }
    }

    async conditionClockHandler(){
        await knex.transaction(async tx => {
            const alert = await tx('alerts').where('id', this.id).first();
            if (!alert) return;
            if (!alert.enabled) {
                await this.revokeTx(tx);
                return;
            }
            if (alert.state === 'worse') {
                await this.triggerTx(tx);
            }
            else if (alert.state === 'better') {
                await this.revokeTx(tx);
            }
        });
    }

    async triggerTx(tx){
        await this.writeStateTx(tx, 'bad');
        await this.addLogEntryTx(tx, 'condition');
    }

    async revokeTx(tx){
        await this.writeStateTx(tx, 'good');
    }

    async writeStateTx(tx, newState) {
        await tx('alerts').where('id', this.id).update({state: newState, state_changed: moment().format('YYYY-MM-DD HH:mm:ss')});
    }

    async addLogEntryTx(tx, value){
        await tx('alerts_log').insert({alert: this.id, type: value});
    }
}

module.exports.Alert = Alert;
