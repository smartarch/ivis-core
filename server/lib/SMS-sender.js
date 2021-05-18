'use strict';

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const config = require('./config');

/**
 * This is the configured SNSClient that is used with AWS API.
 * Contains an error if something went wrong.
 * This constant is automatically initialized.
 * @type {SNSClient}
 */
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

/**
 * Sends SMS message.
 * @param {string} phoneNumber - The phone number of the recipient in E.164 format.
 * @param {string} text - The content of the SMS.
 * @returns {Promise<*>} Status of the operation.
 */
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
