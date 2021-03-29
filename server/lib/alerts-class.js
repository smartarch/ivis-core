'use strict';

const knex = require('./knex');
const { evaluate } = require('./alerts-condition-parser');
const moment = require('moment');
const { sendEmail } = require('./mailer');

const senderName = 'IVIS Alert';

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
        await this.repeatNotification();
    }

    terminate(){
        clearTimeout(this.conditionClock);
        clearTimeout(this.repeatClock);
    }

    async execute(){
        await knex.transaction(async tx => {
            const alert = await tx('alerts').where('id', this.id).first();
            if (!alert) return;
            if (!alert.enabled) {
                await this.revokeTx(tx, alert);
                return;
            }
            const result = await evaluate(alert.condition, alert.sigset);
            if (typeof result === 'boolean') await this.changeStateTx(tx, alert, result);
            else await this.addLogEntryTx(tx, result);
        });
    }

    /*
    * Possible states are: good, worse, bad, better.
    * result means wrong incoming data, !result means right incoming data
    */
    async changeStateTx(tx, alert, result){
        if (result) {
            if (alert.state === 'good') {
                if (alert.duration === 0) {
                    await this.triggerTx(tx, alert);
                }
                else {
                    await this.writeStateTx(tx, 'worse');
                    this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), alert.duration * 60 * 1000);
                }
            }
            else if (alert.state === 'better') {
                clearTimeout(this.conditionClock);
                await this.writeStateTx(tx, 'bad');
            }
        }
        else {
            if (alert.state === 'bad') {
                if (alert.delay === 0) {
                    await this.revokeTx(tx, alert);
                }
                else {
                    await this.writeStateTx(tx, 'better');
                    this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), alert.delay * 60 * 1000);
                }
            }
            else if (alert.state === 'worse') {
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
                await this.revokeTx(tx, alert);
                return;
            }
            if (alert.state === 'worse') {
                await this.triggerTx(tx, alert);
            }
            else if (alert.state === 'better') {
                await this.revokeTx(tx, alert);
            }
        });
    }

    async triggerTx(tx, alert){
        await this.writeStateTx(tx, 'bad');
        await this.addLogEntryTx(tx, 'trigger');
        const addresses = alert.emails.split(/\r?\n/);
        const subject = `Alert ${alert.name} was triggered!`;
        const text = `Alert ${alert.name} was triggered!\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${alert.description}\nCondition:\n${alert.condition}`;
        await sendEmail(senderName, addresses, subject, text);
        if (alert.repeat === 0) this.repeatClock = setTimeout(this.repeatNotification.bind(this), 60 * 1000);
        else this.repeatClock = setTimeout(this.repeatNotification.bind(this), alert.repeat * 60 * 1000);
    }

    async revokeTx(tx, alert){
        clearTimeout(this.conditionClock);
        clearTimeout(this.repeatClock);
        await this.writeStateTx(tx, 'good');
        if (alert.enabled) {
            await this.addLogEntryTx(tx, 'revoke');
            if (alert.finalnotification) {
                const addresses = alert.emails.split(/\r?\n/);
                const subject = `Alert ${alert.name} was revoked`;
                const text = `Alert ${alert.name} was revoked.\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${alert.description}\nCondition:\n${alert.condition}`;
                await sendEmail(senderName, addresses, subject, text);
            }
        }
    }

    async repeatNotification() {
        await knex.transaction(async tx => {
            const alert = await tx('alerts').where('id', this.id).first();
            if (!alert) return;
            if (!alert.enabled) {
                await this.revokeTx(tx, alert);
                return;
            }
            if (alert.state !== 'bad' && alert.state !== 'better') return;
            if (alert.repeat === 0) {
                this.repeatClock = setTimeout(this.repeatNotification.bind(this), 60 * 1000);
                return;
            }
            const addresses = alert.emails.split(/\r?\n/);
            const subject = `Alert ${alert.name} is still triggered!`;
            const text = `Alert ${alert.name} has been triggered!\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${alert.description}\nCondition:\n${alert.condition}`;
            await sendEmail(senderName, addresses, subject, text);
            this.repeatClock = setTimeout(this.repeatNotification.bind(this), alert.repeat * 60 * 1000);
        });
    }

    async writeStateTx(tx, newState) {
        await tx('alerts').where('id', this.id).update({state: newState, state_changed: moment().format('YYYY-MM-DD HH:mm:ss')});
    }

    async addLogEntryTx(tx, value){
        await tx('alerts_log').insert({alert: this.id, type: value});
    }
}

module.exports.Alert = Alert;
