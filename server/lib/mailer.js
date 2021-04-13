'use strict';

const nodemailer = require('nodemailer');
const config = require('./config');

async function sendEmail(senderName, receiverAddress, subject, text) {
    try {
        let transporter = nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            secure: config.email.port === 465,
            auth: {
                user: config.email.account,
                pass: config.email.password
            }
        });
        return await transporter.sendMail({
            from: `"${senderName}" <${config.email.account}>`,
            to: receiverAddress,
            subject: subject,
            text: text
        });
    }
    catch(error) {
        return error;
    }
}

module.exports.sendEmail = sendEmail;
