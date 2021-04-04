'use strict';

const knex = require('./knex');
const { evaluate } = require('./alerts-condition-parser');
const moment = require('moment');
const { sendEmail } = require('./mailer');

const senderName = 'IVIS Alert';

class Alert{
    constructor(fields) {
        this.fields = fields;
    }

    async init() {
        await this.addLogEntry('init');
        if (!this.fields.enabled) return;
        const elapsed = moment().diff(this.fields.state_changed);
        if (this.fields.state === 'worse') {
            if (elapsed >= this.fields.duration * 60 * 1000) await this.trigger();
            else this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), (this.fields.duration * 60 * 1000) - elapsed);
        }
        else if (this.fields.state === 'better') {
            if (elapsed >= this.fields.delay * 60 * 1000) await this.revoke();
            else this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), (this.fields.delay * 60 * 1000) - elapsed);
        }
        if (this.fields.repeat !== 0 && (this.fields.state === 'bad' || this.fields.state === 'better')) await this.repeatNotification();
    }

    async update(newFields) {
        await this.addLogEntry('update');
        let ns = '';
        if (!newFields.enabled) {
            this.terminate();
            ns = 'good';
        }
        else if (this.fields.sigset !== newFields.sigset || this.fields.duration !== newFields.duration ||
            this.fields.delay !== newFields.delay || this.fields.condition !== newFields.condition) {
            clearTimeout(this.conditionClock);
            clearTimeout(this.repeatClock);
            ns = 'good';
        }
        else if (this.fields.repeat !== newFields.repeat) {
            clearTimeout(this.repeatClock);
            if (this.fields.repeat !== 0 && (this.fields.state === 'bad' || this.fields.state === 'better')) this.repeatClock = setTimeout(this.repeatNotification.bind(this), this.fields.repeat * 60 * 1000);
        }

        this.fields = newFields;
        if (ns !== '') await this.writeState(ns);
    }

    terminate(){
        clearTimeout(this.conditionClock);
        clearTimeout(this.repeatClock);
    }

    async execute(){
        if (!this.fields.enabled) return;
        const result = await evaluate(this.fields.condition, this.fields.sigset);
        if (typeof result === 'boolean') await this.changeState(result);
        else await this.addLogEntry(result);
    }

    /*
    * Possible states are: good, worse, bad, better.
    * Boolean result means wrong incoming data, !result means right incoming data
    */
    async changeState(result){
        if (result) {
            if (this.fields.state === 'good') {
                if (this.fields.duration === 0) {
                    await this.trigger();
                }
                else {
                    await this.writeState('worse');
                    this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), this.fields.duration * 60 * 1000);
                }
            }
            else if (this.fields.state === 'better') {
                clearTimeout(this.conditionClock);
                await this.writeState('bad');
            }
        }
        else {
            if (this.fields.state === 'bad') {
                if (this.fields.delay === 0) {
                    await this.revoke();
                }
                else {
                    await this.writeState('better');
                    this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), this.fields.delay * 60 * 1000);
                }
            }
            else if (this.fields.state === 'worse') {
                clearTimeout(this.conditionClock);
                await this.writeState('good');
            }
        }
    }

    async conditionClockHandler(){
        if (this.fields.state === 'worse') {
            await this.trigger();
        }
        else if (this.fields.state === 'better') {
            await this.revoke();
        }
    }

    async trigger(){
        await this.writeState('bad');
        await this.addLogEntry('trigger');
        const addresses = this.fields.emails.split(/\r?\n/);
        const subject = `Alert ${this.fields.name} was triggered!`;
        const text = `Alert ${this.fields.name} was triggered!\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${this.fields.description}\nCondition:\n${this.fields.condition}`;
        await sendEmail(senderName, addresses, subject, text);
        if (this.fields.repeat !== 0) this.repeatClock = setTimeout(this.repeatNotification.bind(this), this.fields.repeat * 60 * 1000);
    }

    async revoke(){
        clearTimeout(this.repeatClock);
        await this.writeState('good');
        await this.addLogEntry('revoke');
        if (this.fields.finalnotification) {
            const addresses = this.fields.emails.split(/\r?\n/);
            const subject = `Alert ${this.fields.name} was revoked`;
            const text = `Alert ${this.fields.name} was revoked.\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${this.fields.description}\nCondition:\n${this.fields.condition}`;
            await sendEmail(senderName, addresses, subject, text);
        }
    }

    async repeatNotification() {
        this.repeatClock = setTimeout(this.repeatNotification.bind(this), this.fields.repeat * 60 * 1000);
        const addresses = this.fields.emails.split(/\r?\n/);
        const subject = `Alert ${this.fields.name} is still triggered!`;
        const text = `Alert ${this.fields.name} has been triggered!\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${this.fields.description}\nCondition:\n${this.fields.condition}`;
        await sendEmail(senderName, addresses, subject, text);
    }

    async writeState(newState) {
        const time = moment().format('YYYY-MM-DD HH:mm:ss');
        this.fields.state = newState;
        this.fields.state_changed = time;
        await knex('alerts').where('id', this.fields.id).update({state: newState, state_changed: time});
    }

    async addLogEntry(value){
        try {
            await knex('alerts_log').insert({alert: this.fields.id, type: value});
        }
        catch (e) {}
    }
}

module.exports.Alert = Alert;
