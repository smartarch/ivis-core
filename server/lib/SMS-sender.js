'use strict';

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const config = require('./config');

const client = function() {
    try {
        process.env.AWS_ACCESS_KEY_ID = config.SMS.keyID;
        process.env.AWS_SECRET_ACCESS_KEY = config.SMS.secretKey;
        return new SNSClient({region: config.SMS.region});
    }
    catch (error) {
        return error;
    }
}();

async function sendSMS(phoneNumber, text) {
    try {
        const params = {PhoneNumber: phoneNumber, Message: text};
        return await client.send(new PublishCommand(params));
    }
    catch (error) {
        return error;
    }
}

module.exports.sendSMS = sendSMS;
