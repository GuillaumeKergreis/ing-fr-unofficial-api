'use strict';

const express = require('express');
const IngApi = require("./IngApi");

const app = express();

app.use(express.json());

app.post('/validation/sms', smsValidation);
async function smsValidation(req, res, next) {
    console.log(req.body);

    const operation = req.body.validation.operation;
    const code = req.body.validation.code;

    console.log(operation);
    console.log(code);

    let validationRequest = null;
    if (operation === ingApi.SensitiveOperationAction.EXTERNAL_TRANSFER) validationRequest = ingApi.validationRequest.transactionRequest;
    else if (operation === ingApi.SensitiveOperationAction.ADD_TRANSFER_BENEFICIARY) validationRequest = ingApi.validationRequest.externalAccountsRequest;

    const result = await ingApi.confirmOneTimePassword(operation, code, validationRequest);
    console.log("confirmOneTimePassword", result);

    res.json(result);
}

app.listen(8080)


const customerId = process.env.CUSTOMER_ID; // e.g. 0123456789
const birthdate = process.env.BIRTHDATE; // e.g. 01011970 (DDMMYYYY format)
const password = process.env.PASSWORD; // e.g. 123456

const ingApi = new IngApi(customerId, birthdate, password);

main(ingApi);

/**
 * Example of the ING Api usage
 * @param {IngApi} ingApi
 * @return {Promise<void>}
 */
async function main(ingApi) {
    await ingApi.connect();

    const accounts = await ingApi.getAccounts();
    console.log(accounts);

    const sentOtp = await ingApi.accessMoreTransactions();
    console.log(sentOtp);

}
