'use strict';

const express = require('express');
const IngApi = require("./IngApi");

const app = express();

app.use(express.json());

const customerId = process.env.CUSTOMER_ID; // e.g. 0123456789
const birthdate = process.env.BIRTHDATE; // e.g. 01011970 (DDMMYYYY format)
const password = process.env.PASSWORD; // e.g. 123456

const ingApi = new IngApi(customerId, birthdate, password);


app.use(async (req, res, next) => {
    await ingApi.refreshSession();
    next();
});


app.post('/validation/sms', async (req, res, next) => {
    const operation = req.body.validation.operation;
    const code = req.body.validation.code;

    let validationRequest = null;
    if (operation === ingApi.SensitiveOperationAction.EXTERNAL_TRANSFER) validationRequest = ingApi.validationRequest.transferRequest;
    else if (operation === ingApi.SensitiveOperationAction.ADD_TRANSFER_BENEFICIARY) validationRequest = ingApi.validationRequest.externalAccountsRequest;

    res.json(await ingApi.confirmOneTimePassword(operation, code, validationRequest));
});


app.get('/accounts', async (req, res) => {
    res.json(await ingApi.getAccounts());
});


app.get('/accounts/:accountId', async (req, res) => {
    res.json(await ingApi.getAccountById(req.params.accountId));
});


app.get('/accounts/debit', async (req, res) => {
    res.json(await ingApi.getTransfersDebitAccounts());
});


app.get('/account/:accountId/externalAccount', async (req, res) => {
    res.json(await ingApi.getCreditAccounts(req.params.accountId));
});


app.get('/account/:accountId/bankRecord', async (req, res) => {
    res.json(await ingApi.getAccountBankRecord(req.params.accountId));
});


app.post('/account/:accountId/transfer', async (req, res) => {
    const accountId = req.params.accountId;
    const beneficiaryId = req.body.beneficiaryId;
    const amount = req.body.amount;
    const label = req.body.label;

    res.json(await ingApi.makeTransfer(accountId, beneficiaryId, amount, label));
});


app.listen(8080);

