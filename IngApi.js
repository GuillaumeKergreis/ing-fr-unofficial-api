'use strict'

const fetch = require('node-fetch');
const PasswordKeypad = require('./PasswordKeypad');

/**
 * Class representing the ING API
 */
class IngApi {

    /**
     * Create a new IngApi instance
     * @param {String} customerId
     * @param {String} birthdate
     * @param {String} password
     */
    constructor(customerId, birthdate, password) {

        this.customerId = customerId;
        this.birthdate = birthdate;
        this.password = password;

        // This object is used to store the authentication state of the API
        this.session = {
            cookie: null,
            authToken: null,
            saveInvestToken: null
        }
    }

    /**
     * This method realize the authentication process to initialize the session state
     * @return {Promise<Object>}
     */
    async connect() {
        await this.login();

        const missingPasswordDigitsPositions = await this.getMissingPasswordDigitsPositions();
        const keypadImageBuffer = await this.getKeypadImageBuffer();

        const passwordKeypad = new PasswordKeypad(keypadImageBuffer);

        const clickPositions = await passwordKeypad.getClicksPositions(missingPasswordDigitsPositions.pinPositions, this.password);
        await this.postPinCode(clickPositions);

        return await this.getSession();
    }

    /**
     * Post the customerId and the birthdate to complete the first authentication step
     * @return {Promise<Object>}
     */
    async login() {
        const body = {cif: this.customerId, birthDate: this.birthdate};
        return await this.callIngSecureApi('login/cif?v2=true', 'POST', body);
    }

    /**
     * Returns the password digits missing positions
     * @return {Promise<Object>}
     */
    async getMissingPasswordDigitsPositions() {
        const body = {keyPadSize: {width: 3800, height: 1520}, mode: ''};
        return await this.callIngSecureApi('login/keypad?v2=true', 'POST', body);
    }

    /**
     * Get keypad image buffer
     * @return {Promise<Buffer>}
     */
    async getKeypadImageBuffer() {
        const res = await fetch('https://m.ing.fr/secure/api-v1/keypad/newkeypad.png', {
            headers: {
                'Cookie': this.session.cookie
            }
        });
        return await res.buffer();
    }

    /**
     * Complete the last authentication step : send the positions in the keypad of the password missing digits
     * @param {Array<Array<Number>>} clickPositions
     * @return {Promise<Object>}
     */
    async postPinCode(clickPositions) {
        return await this.callIngSecureApi('login/sca/pin', 'POST', {clickPositions})
    }

    /**
     * Returns the accounts
     * @return {Promise<Object>}
     */
    async getAccounts() {
        return await this.callIngSecureApi('accounts');
    }

    /**
     * Returns the detains of a given account
     * @param {String} accountId
     * @return {Promise<Object>}
     */
    async getAccountById(accountId) {
        return await this.callIngSecureApi(`accounts/${accountId}`);
    }

    /**
     * Returns the future operations on an account
     * @param {String} accountId
     * @return {Promise<Object>}
     */
    async getAccountFutureOperations(accountId) {
        return await this.callIngSecureApi(`accounts/${accountId}/futureOperations`);
    }

    /**
     * Returns the customer information
     * @return {Promise<Object>}
     */
    async getCustomerInfo() {
        return await this.callIngSecureApi(`/customer/info`);
    }

    /**
     * Returns the received messages
     * @param {Number} messagesPerPage
     * @param {Number} pageNumber
     * @return {Promise<Object>}
     */
    async getMessages(messagesPerPage = 30, pageNumber = 1) {
        return await this.callIngSecureApi(`customer/hermes?nbRowByPage=${messagesPerPage}&pageNumber=${messagesPerPage}`);
    }

    /**
     * Returns the total number of messages
     * @return {Promise<Object>}
     */
    async getNumberOfMessages() {
        return await this.callIngSecureApi(`customer/hermes/number`);
    }

    /**
     * Returns the number of unread messages
     * @return {Promise<Object>}
     */
    async getNumberOfUnreadMessages() {
        return await this.callIngSecureApi(`customer/hermes/number?hermesCountType=UNREAD`);
    }

    /**
     * Returns the content of a given message
     * @param {Number} messageId
     * @return {Promise<Object>}
     */
    async getMessageContent(messageId) {
        return await this.callIngSecureApi(`customer/hermes/${messageId}/content`);
    }

    /**
     * Set a given message as read
     * @param {Number} messageId
     * @return {Promise<Object>}
     */
    async setMessageAsAlreadyRead(messageId) {
        return await this.callIngSecureApi(`customer/hermes/validate`, 'POST', messageId);
    }

    /**
     * Delete a given message
     * @param {Number} messageId
     * @return {Promise<Object>}
     */
    async deleteMessage(messageId) {
        return await this.callIngSecureApi(`customer/hermes/${messageId}`, 'DELETE');
    }

    /**
     * Returns the last transactions given an account
     * @param {String} accountId
     * @param {Number} startAt
     * @param {Number} limit
     * @return {Promise<Object>}
     */
    async getAccountTransactions(accountId, startAt = 0, limit = 50) {
        return await this.callIngSecureApi(`accounts/${accountId}/transactions/after/${startAt}/limit/${limit}`);
    }

    /**
     * Returns the status of the aggregation agreement
     * @return {Promise<Object>}
     */
    async isAggregationTermsAndConditionsAccepted() {
        return await this.callIngSecureApi(`aggregation/isTermsAndConditionsAccepted`);
    }

    /**
     * Returns the status of the PSD2 aggregation agreement
     * @return {Promise<Object>}
     */
    async isAggregationPsd2TermsAndConditionsAccepted() {
        return await this.callIngSecureApi(`aggregation/psd2/isTermsAndConditionsAccepted`);
    }

    /**
     * Returns the session state (authenticated or not)
     * @return {Promise<Object>}
     */
    async getSession() {
        return await this.callIngSecureApi(`session`);
    }

    /**
     * Returns the bank record for a given account
     * @param {String} accountId
     * @return {Promise<Object>}
     */
    async getAccountBankRecord(accountId) {
        return await this.callIngSecureApi(`accounts/${accountId}/bankRecord`);
    }

    /**
     * Returns the cards associated to an account
     * @param {String} accountId
     * @return {Promise<Object>}
     */
    async getCards(accountId) {
        return await this.callIngSecureApi(`accounts/cards/v2/cards/${accountId}`);
    }

    /**
     * Returns the transactions associated to a card
     * @param {String} accountId
     * @param {String} cardId
     * @return {Promise<Object>}
     */
    async getCardTransactions(accountId, cardId) {
        const body = {accountUid: accountId, cardUid: cardId}
        return await this.callIngSecureApi(`accounts/cards/v2/transactions`, 'POST', body);
    }

    /**
     * Returns the card functionalities access for a given card
     * @param {String} accountId
     * @param {String} cardId
     * @return {Promise<Object>}
     */
    async getCardFunctionalitiesAccess(accountId, cardId) {
        const body = {
            accountUid: accountId,
            cardUid: cardId,
            functionalities: ['CARD_RENEWAL', 'CONTACTLESS', 'CARD_HARD_BLOCKING', 'CHANGE_PIN', 'CARD_LIMIT', 'CHANGE_DEBIT_TYPE']
        };
        return await this.callIngSecureApi(`accounts/cards/v2/functionalities/access`, 'POST', body);
    }

    /**
     * Returns the card payment and withdraw limits
     * @param {String} accountId
     * @param {String} cardId
     * @return {Promise<Object>}
     */
    async getCardLimits(accountId, cardId) {
        const body = {accountUid: accountId, cardUid: cardId};
        return await this.callIngSecureApi(`accounts/cards/v2/limits`, 'POST', body);
    }

    /**
     * Change the card contactless status
     * @param {String} accountId
     * @param {String} cardId
     * @param {String} contactlessStatus (ON, OFF)
     * @return {Promise<Object>}
     */
    async setCardContactlessStatus(accountId, cardId, contactlessStatus = 'ON') {
        const body = {accountUid: accountId, cardUid: cardId, contactlessToggleStatus: contactlessStatus};
        return await this.callIngSecureApi(`accounts/cards/v2/contactless`, 'POST', body);
    }

    /**
     * Change the card status
     * @param {String} accountId
     * @param {String} cardId
     * @param {String} statusCode (LOCKED_BY_CLIENT, ACTIVATED)
     * @return {Promise<Object>}
     */
    async setCardStatus(accountId, cardId, statusCode = 'ACTIVATED') {
        const body = {accountUniqueID: accountId, cardUid: cardId, statusCode: statusCode};
        return await this.callIngSecureApi(`accounts/cards/v2/changeCardStatus`, 'POST', body);
    }

    /**
     * Returns the future transfers
     * @return {Promise<Object>}
     */
    async getFutureTransfers() {
        return await this.callIngSecureApi(`futureTransfers`);
    }

    /**
     * Returns the transfer debit accounts (checking account)
     * @return {Promise<Object>}
     */
    async getTransfersDebitAccounts() {
        return await this.callIngSecureApi(`transfers/debitAccounts`);
    }

    /**
     * Returns the life insurance external accounts
     * @return {Promise<Object>}
     */
    async getLifeInsuranceExternalAccounts() {
        return await this.callIngSecureApi(`lifeInsurance/externalAccounts`);
    }

    /**
     * Returns the direct debit authorizations (SDD mandates)
     * @param {String} accountId
     * @return {Promise<Object>}
     */
    async getAccountDirectDebitAuthorizations(accountId) {
        return await this.callIngSecureApi(`accounts/${accountId}/directDebits/authorizations`);
    }

    /**
     * Returns the past direct debit transactions for a given account
     * @param {String} accountId
     * @return {Promise<Object>}
     */
    async getAccountDirectDebitPastTransactions(accountId) {
        return await this.callIngSecureApi(`accounts/direct/debit/past/list/${accountId}`);
    }

    /**
     * Returns the direct debit pending transactions
     * @param {String} accountId
     * @return {Promise<Object>}
     */
    async getAccountDirectDebitPendingTransactions(accountId) {
        return await this.callIngSecureApi(`accounts/direct/debit/pending/list/${accountId}`);
    }

    /**
     * Returns the external accounts beneficiaries
     * @return {Promise<Object>}
     */
    async getExternalAccountsBeneficiaries() {
        return await this.callIngSecureApi(`externalAccounts/beneficiaries`);
    }

    /**
     * Returns the possible verification channels to perform a sensitive operation (Mobile phone)
     * @param {String} sensitiveOperationType (ADD_TRANSFER_BENEFICIARY)
     * @return {Promise<Object>}
     */
    async getSensitiveOperation(sensitiveOperationType) {
        return await this.callIngSecureApi(`sensitiveoperation/${sensitiveOperationType}/otpChannels`);
    }

    /**
     * Generate a token to access the Save Invest API
     * @return {Promise<Object>}
     */
    async generateSaveInvestApiToken() {
        const res = await this.callIngSecureApi(`saveInvest/token/generate`);
        this.session.saveInvestToken = res.token;
        return res;
    }

    /**
     * Returns the details for a life insurance contract
     * @param {String} contractId
     * @return {Promise<Object>}
     */
    async getLifeInsuranceContract(contractId) {
        return await this.callIngSaveInvestApi(`lifeinsurance/contract/${contractId}`);
    }

    /**
     * Returns the life insurance amounts for a given contract
     * @param {String} contractId
     * @return {Promise<Object>}
     */
    async getLifeInsuranceContractAmounts(contractId) {
        return await this.callIngSaveInvestApi(`lifeinsurance/contract/${contractId}?only=DEPOSIT,WITHDRAWAL,GAIN`);
    }

    /**
     * Returns the advice for a life insurance contract
     * @param {String} customerId
     * @param {String} contractId
     * @return {Promise<Object>}
     */
    async getLifeInsuranceAdvice(customerId, contractId) {
        return await this.callIngSaveInvestApi(`lifeinsurance/advice/${customerId}/${contractId}`);
    }

    /**
     * Returns the available management mandates for a life insurance
     * @return {Promise<Object>}
     */
    async getLifeInsuranceMandates() {
        return await this.callIngSaveInvestApi(`lifeinsurance/mandate`);
    }


    /*
    TODO :
    Endpoints :
        - Load more transactions
        - Transaction check
        - Change card payment limits
        - Make a transfer
        - Add a beneficiary
        - Remove a beneficiary
        - Cancel a recurrent transfer
        - Suspend a direct debit authorization
        - Make an international wire transfer
        - 2FA management (maybe an app to scan the SMS)
    Api responses model
     */


    /**
     * Call the ING Secure API given a path, method and body
     * @param {String} path
     * @param {String} method
     * @param {Object} body
     * @return {Promise<Object>}
     */
    async callIngSecureApi(path, method = 'GET', body = null) {

        const ING_HOST = 'm.ing.fr';
        const BASE_PATH = 'secure/api-v1';

        const res = await fetch(`https://${ING_HOST}/${BASE_PATH}/${path}`, {
            method: method,
            body: body ? JSON.stringify(body) : null,
            headers: {
                'Content-Type': 'application/json',
                'Cookie': this.session.cookie,
                'Ingdf-Auth-Token': this.session.authToken
            }
        });

        if (res.headers.get('Set-Cookie')) this.session.cookie = res.headers.get('Set-Cookie');
        if (res.headers.get('Ingdf-Auth-Token')) this.session.authToken = res.headers.get('Ingdf-Auth-Token');

        return await res.json();
    }

    /**
     * Call the ING Save Invest API given a path, method and body
     * @param {String} path
     * @param {String} method
     * @param {Object} body
     * @return {Promise<Object>}
     */
    async callIngSaveInvestApi(path, method = 'GET', body = null) {

        const ING_HOST = 'm.ing.fr';
        const BASE_PATH = 'saveinvestapi/v1';

        // We need to generate a saveInvestToken to request the saveInvest API
        if (!this.session.saveInvestToken) await this.generateSaveInvestApiToken();

        const res = await fetch(`https://${ING_HOST}/${BASE_PATH}/${path}`, {
            method: method,
            body: body ? JSON.stringify(body) : null,
            headers: {
                'Content-Type': 'application/json',
                'Cookie': this.session.cookie,
                'Authorization': `Bearer ${this.session.saveInvestToken}`
            }
        });

        return await res.json();
    }
}

module.exports = IngApi;
