'use strict';

const knex = require('./knex');
const { evaluate } = require('./alerts-condition-parser');

class Alert{
    constructor(id){
        this.id = id;
        this.state = 'good';
    }

    terminate(){
        if (this.conditionClock) clearTimeout(this.conditionClock);
    }

    /*
    * Possible states are: good, worse, bad, better.
    * result means wrong incoming data, !result means right incoming data
    * */
    async changeState(result, duration, delay){
        if (this.state === 'good' && result) {
            if (duration === 0) {
                this.state = 'bad';
                await this.trigger('condition')
            }
            else {
                this.state = 'worse';
                if (this.conditionClock) clearTimeout(this.conditionClock);
                this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), duration * 60 * 1000);
            }
        }
        else if (this.state === 'worse' && !result) {
            this.state = 'good'
        }
        else if (this.state === 'bad' && !result) {
            if (delay === 0) {
                this.state = 'good';
                await this.revoke('condition');
            }
            else {
                this.state = 'better';
                if (this.conditionClock) clearTimeout(this.conditionClock);
                this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), delay * 60 * 1000);
            }
        }
        else if (this.state === 'better' && result) {
            this.state = 'bad';
        }
    }

    async conditionClockHandler(){
        if (this.state === 'worse') {
            this.state = 'bad';
            await this.trigger('condition');
        }
        else if (this.state === 'better') {
            this.state = 'good';
            await this.revoke('condition');
        }
    }

    async trigger(type){
        await this.addLogEntry(type);
    }

    async revoke(type){

    }

    async execute(){
        await knex.transaction(async tx => {
            const alert = await tx('alerts').where('id', this.id).first();
            if (!alert) return;
            if (!alert.enabled) {
                await this.revoke('disabled');
                this.state = 'good';
                return;
            }
            const result = await evaluate(alert.condition, alert.sigset);
            if (typeof result === 'boolean') await this.changeState(result, alert.duration, alert.delay);
            else await this.addLogEntryTx(tx, result);
        });
    }

    async addLogEntryTx(tx, value){
        if (await this.existsTx(tx)) await tx('alerts_log').insert({alert: this.id, type: value});
    }

    async addLogEntry(value){
        await knex.transaction(async tx => {
            await this.addLogEntryTx(tx, value);
        });
    }

    async existsTx(tx){
        const test = await tx('alerts').where('id', this.id).first('id');
        return !!test;
    }

    async exists(){
        return await knex.transaction(async tx => {
            return await this.existsTx(tx);
        });
    }
}

module.exports.Alert = Alert;
