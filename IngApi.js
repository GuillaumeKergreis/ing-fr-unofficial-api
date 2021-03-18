'use strict';

const fetch = require('node-fetch');
const PasswordKeypad = require('./PasswordKeypad');

/**
 * Class representing the ING API
 */
class IngApi {

    SensitiveOperationAction = {
        DISPLAY_TRANSACTIONS: 'DISPLAY_TRANSACTIONS',
        EXTERNAL_TRANSFER: 'EXTERNAL_TRANSFER',
        ADD_TRANSFER_BENEFICIARY: 'ADD_TRANSFER_BENEFICIARY'
    };

    ErrorCode = {
        AUTHENTICATION: {
            INVALID_CIF_AND_BIRTHDATE_COMBINATION: 'AUTHENTICATION.INVALID_CIF_AND_BIRTHDATE_COMBINATION'
        },
        SCA: {
            STEP1_NOT_DONE: 'SCA.STEP1_NOT_DONE'
        },
        EXTERNAL_ACCOUNT: {
            IBAN_BAD_FORMAT: 'EXTERNAL_ACCOUNT.IBAN_BAD_FORMAT',
            EXTERNAL_ACCOUNT_ALREADY_EXISTS: 'EXTERNAL_ACCOUNT.EXTERNAL_ACCOUNT_ALREADY_EXISTS'
        }
    };

    /**
     * Create a new IngApi instance
     * @param {string} customerId
     * @param {string} birthdate
     * @param {string} password
     */
    constructor(customerId, birthdate, password) {

        this.customerId = customerId;
        this.birthdate = birthdate;
        this.password = password;

        // This object is used to store the authentication state of the API
        this.session = {
            regieId: null,
            cookie: null,
            authToken: null,
            saveInvestToken: null
        };

        // TODO : manage better this side effect
        this.validationRequest = {
            transactionRequest: null,
            externalAccountsRequest: null
        };

    }

    /**
     * This method realize the authentication process to initialize the session state
     * @return {Promise<Object>}
     */
    async connect() {
        const loginResult = await this.loginWithCustomerIdAndBirthdate();
        this.session.regieId = loginResult.regieId;

        const missingPasswordDigitsPositions = await this.getMissingPasswordDigitsPositions();
        const keypadImageBuffer = await this.getKeypadImageBuffer();

        const passwordKeypad = new PasswordKeypad(keypadImageBuffer);

        const clickPositions = await passwordKeypad.getClicksPositions(missingPasswordDigitsPositions.pinPositions, this.password);
        await this.postLoginPinCode(clickPositions);

        return await this.getSession();
    }

    /**
     * Post the customerId and the birthdate to complete the first authentication step
     * @return {Promise<{regieId: string, mustCreatePinCode: boolean}>}
     */
    async loginWithCustomerIdAndBirthdate() {
        const body = {cif: this.customerId, birthDate: this.birthdate};
        return await this.callIngSecureApi('login/cif?v2=true', 'POST', body);
    }

    /**
     * Post the regieId and the birthdate to complete the first authentication step
     * @return {Promise<{regieId: string, mustCreatePinCode: boolean}>}
     */
    async loginWithRegieIdAndBirthdate() {
        const body = {regieId: this.regieId, birthDate: this.birthdate};
        return await this.callIngSecureApi('login/cif?v2=true', 'POST', body);
    }

    /**
     * Returns the password digits missing positions
     * @return {Promise<{pinPositions: Array<number>}>}
     */
    async getMissingPasswordDigitsPositions() {
        const body = {keyPadSize: {width: 3800, height: 1520}, mode: ''};
        return await this.callIngSecureApi('login/keypad?v2=true', 'POST', body);
    }

    /**
     * Returns the user information at the login step
     * @return {Promise<{firstName: string, lastName:string, title: string, lastLogin: string}>}
     */
    async getLoginInformations() {
        return await this.callIngSecureApi('login/informations');
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
     * @param {Array<Array<number>>} clickPositions
     * @return {Promise<{strongAuthenticationLoginExempted: boolean}>}
     */
    async postLoginPinCode(clickPositions) {
        return await this.callIngSecureApi('login/sca/pin', 'POST', {clickPositions})
    }

    /**
     * Returns the accounts
     * @return {Promise<{aggregatedBalance: number, businessDate: string, accounts: Array<{uid: string, label: string, ledgerBalance: number, availableBalance?: number, owner: string, type: {code: string, label: string}, role: {code: string, label: string}, ownership: {code: string, label: string}, acknowledgments: Array<>, inGoodStanding: boolean, hasPositiveBalance: boolean, accountStatus: string, checkingAccountActivationDate?: string, balanceLevels?: Array<>}>}>}
     */
    async getAccounts() {
        return await this.callIngSecureApi('accounts');
    }

    /**
     * Returns the customer status
     * @return {Promise<string>} TODO : check the real return
     */
    async getCustomerStatus() {
        return await this.callIngSecureApi('customer/status');
    }

    /**
     * Returns the detains of a given account
     * @param {string} accountId
     * @return {Promise<{uid: string, label: string, ledgerBalance: number, availableBalance: number, owner: string, type: {code: string,label: string}, role:{code: string, label: string}, ownership:{code: string, label: string}, inGoodStanding:boolean, hasPositiveBalance:boolean, accountStatus:string, openingDate:string, overdraftAmount:number, estimatedBalance: {amount: number, estimationDate: string}}>}
     */
    async getAccountById(accountId) {
        return await this.callIngSecureApi(`accounts/${accountId}`);
    }

    /**
     * Returns the future operations on an account
     * @param {string} accountId
     * @return {Promise<{totalAmount: number, futureOperations: Array<Object>}>}
     */
    async getAccountFutureOperations(accountId) {
        return await this.callIngSecureApi(`accounts/${accountId}/futureOperations`);
    }

    /**
     * Returns the customer information
     * @return {Promise<{cif: string, title: string, emailAddress: string, mailingAddress: {address1: string, address2: string, address3: string, address4: string, city: string, postCode: string, country: string, npai: boolean}, name: {firstName: string, lastName: string}, phones: Array<{uid: string, number: string, type: string}>, birthDate: string, placeOfBirth: string, kyc: {netMonthlyIncomeLabel: string, patrimonyLabel: string, professionLabel: string, professionalStatusLabel: string, professionTypeLabel: string, currentEmployer: string, employerActivityLabel: string, realEstateAssetLabel: string}, isACreditRisk: boolean, isDAC: boolean, fiscalAddress: {address1: string, address2: string, address3: string, address4: string, city: string, postCode: string, country: string}, isMailingAdressSameThanFiscalAddress: boolean, customerIsFriendAndFamily: boolean}>}
     */
    async getCustomerInfo() {
        return await this.callIngSecureApi(`/customer/info`);
    }

    /**
     * Returns the received messages
     * @param {number} messagesPerPage
     * @param {number} pageNumber
     * @return {Promise<Array<{messageId: number, dateOnLine: string, object: string, alreadyRead: boolean, severity: number}>>}
     */
    async getMessages(messagesPerPage = 30, pageNumber = 1) {
        return await this.callIngSecureApi(`customer/hermes?nbRowByPage=${messagesPerPage}&pageNumber=${messagesPerPage}`);
    }

    /**
     * Returns the total number of messages
     * @return {Promise<number>} TODO : check this return
     */
    async getNumberOfMessages() {
        return await this.callIngSecureApi(`customer/hermes/number`);
    }

    /**
     * Returns the number of unread messages
     * @return {Promise<number>} TODO : check this return
     */
    async getNumberOfUnreadMessages() {
        return await this.callIngSecureApi(`customer/hermes/number?hermesCountType=UNREAD`);
    }

    /**
     * Returns the content of a given message
     * @param {number} messageId
     * @return {Promise<{messageId: number, dateOnLine: string, object: string, content: string}>}
     */
    async getMessageContent(messageId) {
        return await this.callIngSecureApi(`customer/hermes/${messageId}/content`);
    }

    /**
     * Set a given message as read
     * @param {number} messageId
     * @return {Promise<{acknowledged: boolean}>}
     */
    async setMessageAsAlreadyRead(messageId) {
        return await this.callIngSecureApi(`customer/hermes/validate`, 'POST', messageId);
    }

    /**
     * Delete a given message
     * @param {number} messageId
     * @return {Promise<{acknowledged: boolean}>}
     */
    async deleteMessage(messageId) {
        return await this.callIngSecureApi(`customer/hermes/${messageId}`, 'DELETE');
    }

    /**
     * Returns the last transactions given an account
     * @param {string} accountId
     * @param {number} startAt - transactionId
     * @param {number} limit
     * @return {Promise<Array<{id: string, effectiveDate: string, accountingDate: string, detail: string, amount: number, transcodeNeedCustomerAction: boolean, type: string, isOldBankCode: boolean, sameMonthAsPrevious: boolean, sameDateAsPrevious: boolean, sameDateAsNext: boolean}>>}
     */
    async getAccountTransactions(accountId, startAt = 0, limit = 50) {
        return await this.callIngSecureApi(`accounts/${accountId}/transactions/after/${startAt}/limit/${limit}`);
    }

    /**
     * Returns the status of the aggregation agreement
     * @return {Promise<boolean>} TODO : check this return
     */
    async isAggregationTermsAndConditionsAccepted() {
        return await this.callIngSecureApi(`aggregation/isTermsAndConditionsAccepted`);
    }

    /**
     * Returns the status of the PSD2 aggregation agreement
     * @return {Promise<boolean>} TODO : check this return
     */
    async isAggregationPsd2TermsAndConditionsAccepted() {
        return await this.callIngSecureApi(`aggregation/psd2/isTermsAndConditionsAccepted`);
    }

    /**
     * Returns the session state (authenticated or not)
     * @return {Promise<{authenticated: boolean}>}
     */
    async getSession() {
        return await this.callIngSecureApi(`session`);
    }

    /**
     * Returns the bank record for a given account
     * @param {string} accountId
     * @return {Promise<{bic: string, iban: string, bankCode: string, counterCode: string, accountNumber: string, ribKey: string, ownerAddress: {name: string, address1: string, address2: string, address3: string, address4: string, city: string, postCode: string, country: string}, bankingDomiciliation: {name: string, address1: string, address2: string, address3:string, address4: string, city: string, postCode: string, country: string}}>}
     */
    async getAccountBankRecord(accountId) {
        return await this.callIngSecureApi(`accounts/${accountId}/bankRecord`);
    }

    /**
     * Returns the cards associated to an account
     * @param {string} accountId
     * @return {Promise<Array<{uid: string, status: {code: string, label: string}, owner: {firstName: string, lastName: string, salutation: string}, expirationDate: number, renewalAllowed: boolean, contactless: boolean, number: string, type: {code: string, label: string}, mark: string, limitsChangedWithinTheDay: boolean, ownedByConnectedCustomer: boolean, opposedForMoreThanOneMonth: boolean}>>}
     */
    async getCards(accountId) {
        return await this.callIngSecureApi(`accounts/cards/v2/cards/${accountId}`);
    }

    /**
     * Returns the transactions associated to a card
     * @param {string} accountId
     * @param {string} cardId
     * @return {Promise<Array<{transactionSequence: string, effectiveDate: number, amount: number, transactionDirection: string, description: string, preAuthorization: boolean}>>}
     */
    async getCardTransactions(accountId, cardId) {
        const body = {accountUid: accountId, cardUid: cardId}
        return await this.callIngSecureApi(`accounts/cards/v2/transactions`, 'POST', body);
    }

    /**
     * Returns the card functionalities access for a given card
     * @param {string} accountId
     * @param {string} cardId
     * @return {Promise<{CHANGE_PIN: {enabled: boolean, restrictionType: string}, CONTACTLESS: {enabled: boolean, restrictionType: string}, CARD_HARD_BLOCKING: {enabled: boolean, restrictionType: string}, CARD_LIMIT: {enabled: boolean, restrictionType: string}, CARD_RENEWAL: {enabled: boolean, restrictionType: string}, CHANGE_DEBIT_TYPE: {enabled: boolean, restrictionType: string}}>}
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
     * @param {string} accountId
     * @param {string} cardId
     * @return {Promise<{limits: Array<{type: string, authorized: number, available: number, used: number}>, acknowledged: boolean}>}
     */
    async getCardLimits(accountId, cardId) {
        const body = {accountUid: accountId, cardUid: cardId};
        return await this.callIngSecureApi(`accounts/cards/v2/limits`, 'POST', body);
    }

    /**
     * Change the card contactless status
     * @param {string} accountId
     * @param {string} cardId
     * @param {string} contactlessStatus (ON, OFF)
     * TODO : check void return
     */
    async setCardContactlessStatus(accountId, cardId, contactlessStatus = 'ON') {
        const body = {accountUid: accountId, cardUid: cardId, contactlessToggleStatus: contactlessStatus};
        return await this.callIngSecureApi(`accounts/cards/v2/contactless`, 'POST', body);
    }

    /**
     * Change the card status
     * @param {string} accountId
     * @param {string} cardId
     * @param {string} statusCode (LOCKED_BY_CLIENT, ACTIVATED)
     * @return {Promise<{acknowledged: boolean}>}
     */
    async setCardStatus(accountId, cardId, statusCode = 'ACTIVATED') {
        const body = {accountUniqueID: accountId, cardUid: cardId, statusCode: statusCode};
        return await this.callIngSecureApi(`accounts/cards/v2/changeCardStatus`, 'POST', body);
    }

    /**
     * Returns the future transfers
     * @return {Promise<{pendingTransfers: Array<{uid: string, amount: number, label: string, mobilePeriodicity: {code: string, label: string}, executionDate: string, fromAccountUid: string, fromAccountLabel: string, fromAccountType: {code: string, label: string}, toExternalAccountUid: string, toAccountLabel: string, toAccountOwner: string, toAccountBankName: string, toAccountType: {code: string, label: string}, toAccountNotOwned: boolean, cancelable: boolean}>, mobileReccuringTransfers: Array<Object>, nbPendingTransfers: number}>}
     */
    async getFutureTransfers() {
        return await this.callIngSecureApi(`futureTransfers`);
    }

    /**
     * Returns the transfer debit accounts (checking account)
     * @return {Promise<Array<{uid: string, label: string, ledgerBalance: number, availableBalance: number, owner: string, type: {code: string, label: string}, role: {code: string, label: string}, ownership: {code: string, label: string}, inGoodStanding: boolean, hasPositiveBalance: boolean}>>}
     */
    async getTransfersDebitAccounts() {
        return await this.callIngSecureApi(`transfers/debitAccounts`);
    }

    /**
     * Returns the life insurance external accounts
     * @return {Promise<Array<{externalAccount: {uid: string, label: string, type: {code: string, label: string}, owner: string, bankName: string}, lifeInsuranceContractsUids: Array<string>}>>}
     */
    async getLifeInsuranceExternalAccounts() {
        return await this.callIngSecureApi(`lifeInsurance/externalAccounts`);
    }

    /**
     * Returns the direct debit authorizations (SDD mandates)
     * @param {string} accountId
     * @return {Promise<Array<{label: string, nneCode: string, uid: string, authorizationId: string, creditorId: string, validityStartDate: string, sepa: boolean, status: {code: string, label: string}, scheme: {code: string, label: string}, creditorBlocked: boolean}>>}
     */
    async getAccountDirectDebitAuthorizations(accountId) {
        return await this.callIngSecureApi(`accounts/${accountId}/directDebits/authorizations`);
    }

    /**
     * Returns the past direct debit transactions for a given account
     * @param {string} accountId
     * @return {Promise<Array<{effectiveDate: string, creditorName: string, creditorId: string, reference: string, type: string, amount: number, status: string, action: string}>>}
     */
    async getAccountDirectDebitPastTransactions(accountId) {
        return await this.callIngSecureApi(`accounts/direct/debit/past/list/${accountId}`);
    }

    /**
     * Returns the direct debit pending transactions
     * @param {string} accountId
     * @return {Promise<Array<Object>>}
     */
    async getAccountDirectDebitPendingTransactions(accountId) {
        return await this.callIngSecureApi(`accounts/direct/debit/pending/list/${accountId}`);
    }

    /**
     * Returns the external accounts beneficiaries
     * @return {Promise<Array<{uid: string, label: string, owner: string, type: {code: string, label: string}, bankName: string, bic: string, inGoodStanding: boolean, hasPositiveBalance: boolean}>>}
     */
    async getExternalAccountsBeneficiaries() {
        return await this.callIngSecureApi(`externalAccounts/beneficiaries`);
    }

    /**
     * Returns the possible verification channels (One Time Password) to perform a sensitive operation (Mobile phone)
     * @param {string} sensitiveOperationType
     * @return {Promise<Array<{phone: string, type: string}>>}
     */
    async getSensitiveOperationOneTimePasswordChannels(sensitiveOperationType) {
        return await this.callIngSecureApi(`sensitiveoperation/${sensitiveOperationType}/otpChannels`);
    }

    /**
     * Generate a token to access the Save Invest API
     * @return {Promise<{token: string, cif: string}>}
     */
    async generateSaveInvestApiToken() {
        const res = await this.callIngSecureApi(`saveInvest/token/generate`);
        this.session.saveInvestToken = res.token;
        return res;
    }

    /**
     * Returns the details for a life insurance contract
     * @param {string} contractId
     * @return {Promise<{id: string, holder: {firstName: string, lastName: string}, balance: {value: number, reachDate: string}, subscriptionDate: string, contractInvestment: Object<string, {isin: string, name: string, counterValue: number, allocationPercentage: number, gainOrLoss: number, partValue: number, partNumber: number, amount: number, dateValue: string, assetClass: number}>, managementMode: string, mandate?: {type: string, id: number}, netissimaPercent?: number}>}
     */
    async getLifeInsuranceContract(contractId) {
        return await this.callIngSaveInvestApi(`lifeinsurance/contract/${contractId}`);
    }

    /**
     * Returns the life insurance amounts for a given contract
     * @param {string} contractId
     * @return {Promise<{id: string, deposit: {totalDeposited: number, totalInvested: number}, withdrawal: number, capitalGains: number}>}
     */
    async getLifeInsuranceContractAmounts(contractId) {
        return await this.callIngSaveInvestApi(`lifeinsurance/contract/${contractId}?only=DEPOSIT,WITHDRAWAL,GAIN`);
    }

    /**
     * Returns the advice for a life insurance contract
     * @param {string} customerId
     * @param {string} contractId
     * @return {Promise<{questionnaireId: number, cif: string, contractId: string, date: string, riskProfile: string, profile: {type: string, selfAllocation: {type: string, allocation: {EUROS: {value: number}, SHARES: {value: number}, BOND: {value: number}}}, mandatedAllocation: {type: string, id: number, allocation: {EUROS: {value: number}, SHARES: {value: number, minValue: number, maxValue: number}, BOND: {value: number, minValue: number, maxValue: number}}}}, managementMode: string, status: string, flaggedProfile: boolean}>}
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

    /**
     * Returns missing password digits positions and new keypad url
     * @param {string} sensitiveOperationAction
     * @return {Promise<{pinPositions: Array<number>, keyPadUrl: string}>}
     */
    async getMissingPasswordDigitsPositionsSensitiveOperationAction(sensitiveOperationAction) {
        const body = {keyPadSize: {width: 3800, height: 1520}, sensitiveOperationAction: sensitiveOperationAction};
        return await this.callIngSecureApi('sca/keyPad', 'POST', body);
    }

    /**
     * Get keypad image buffer for sensitive operation action validation
     * @return {Promise<Buffer>}
     */
    async getKeypadImageBufferSensitiveOperationAction(keyPadUrl) {
        const res = await fetch(`https://m.ing.fr/secure/api-v1/${keyPadUrl}`, {
            headers: {
                'Cookie': this.session.cookie,
                'Ingdf-Auth-Token': this.session.authToken
            }
        });
        return await res.buffer();
    }

    /**
     * Validate a sensitive operation action posting password missing digits positions
     * @param {Array<Array<Number>>} clickPositions
     * @param {string} sensitiveOperationAction
     * @param {{fromAccount: string, toAccount: string, amount: number, label: string, executionDate: string} | {accountHolderName: string, bankName:string, bic: string, iban: string} | null} request
     * @return {Promise<{validated: boolean, secretCode: string, executed: boolean}>}
     */
    async validatePinSensitiveOperationAction(clickPositions, sensitiveOperationAction, request = null) {
        const body = {keyPad: {clickPositions: clickPositions}, sensitiveOperationAction: sensitiveOperationAction};
        if (sensitiveOperationAction === this.SensitiveOperationAction.EXTERNAL_TRANSFER && request) body.transactionRequest = request
        else if (sensitiveOperationAction === this.SensitiveOperationAction.ADD_TRANSFER_BENEFICIARY && request) body.externalAccountsRequest = request
        return await this.callIngSecureApi('sca/validatePin', 'POST', body);
    }

    /**
     * Send the one time password to the given channel
     * @param {string} sensitiveOperationAction
     * @param {string} secretCode
     * @param {string} channelValue
     * @param {string} channelType
     * @param {{fromAccount: string, toAccount: string, amount: number, label: string, executionDate: string} | {accountHolderName: string, bankName:string, bic: string, iban: string} | null} request
     * @return {Promise<{acknowledged: boolean}>}
     */
    async sendOneTimePassword(sensitiveOperationAction, secretCode, channelValue, channelType, request = null) {
        const body = {sensitiveOperationAction, secretCode, channelValue, channelType};
        if (sensitiveOperationAction === this.SensitiveOperationAction.EXTERNAL_TRANSFER && request) body.transactionRequest = request
        else if (sensitiveOperationAction === this.SensitiveOperationAction.ADD_TRANSFER_BENEFICIARY && request) body.externalAccountsRequest = request
        return await this.callIngSecureApi('sca/sendOtp', 'POST', body);
    }

    /**
     * Confirm the one time password received
     * @param {string} sensitiveOperationAction
     * @param {string} oneTimePassword
     * @param {{fromAccount: string, toAccount: string, amount: number, label: string, executionDate: string} | {accountHolderName: string, bankName:string, bic: string, iban: string} | null} request
     * @return {Promise<{acknowledged: boolean}>}
     */
    async confirmOneTimePassword(sensitiveOperationAction, oneTimePassword, request = null) {
        const body = {sensitiveOperationAction, otp: oneTimePassword};
        if (sensitiveOperationAction === this.SensitiveOperationAction.EXTERNAL_TRANSFER && request) body.transactionRequest = request
        else if (sensitiveOperationAction === this.SensitiveOperationAction.ADD_TRANSFER_BENEFICIARY && request) body.externalAccountsRequest = request
        return await this.callIngSecureApi('sca/confirmOtp', 'POST', body);
    }

    /**
     * Allows the loading of more transactions, a 2FA verification is necessary
     * @return {Promise<{acknowledged: boolean}>}
     */
    async accessMoreTransactions() {
        const sensitiveOperationAction = this.SensitiveOperationAction.DISPLAY_TRANSACTIONS;

        const missingPasswordDigitsPositions = await this.getMissingPasswordDigitsPositionsSensitiveOperationAction(sensitiveOperationAction);
        const keypadImageBuffer = await this.getKeypadImageBufferSensitiveOperationAction(missingPasswordDigitsPositions.keyPadUrl);

        const passwordKeypad = new PasswordKeypad(keypadImageBuffer, 5);

        const clickPositions = await passwordKeypad.getClicksPositions(missingPasswordDigitsPositions.pinPositions, this.password);
        const validatePin = await this.validatePinSensitiveOperationAction(clickPositions, sensitiveOperationAction);

        const oneTimePasswordChannels = await this.getSensitiveOperationOneTimePasswordChannels(sensitiveOperationAction);

        const otpSmsChannel = oneTimePasswordChannels.find(channel => channel.type === "SMS_MOBILE");

        return this.sendOneTimePassword(sensitiveOperationAction, validatePin.secretCode, otpSmsChannel.phone, otpSmsChannel.type);

    }

    /**
     * Create and validate a credit transfer, a 2FA verification is necessary
     * @param {string} fromAccount - Debit account id
     * @param {string} toAccount - External account id
     * @param {number} amount
     * @param {string} label
     * @param {string} desiredExecutionDate - Desired execution date with format "YYYY-MM-DD"
     * @return {Promise<{acknowledged: boolean}>}
     */
    async makeTransfer(fromAccount, toAccount, amount, label, desiredExecutionDate = '') {
        const sensitiveOperationAction = this.SensitiveOperationAction.EXTERNAL_TRANSFER;

        const initiatedTransfer = await this.validateNewTransfer(fromAccount, toAccount, amount, label, desiredExecutionDate);

        const executionDate = initiatedTransfer.executionSuggestedDate;
        const transferRequest = {fromAccount, toAccount, amount, label, executionDate};
        this.validationRequest.transactionRequest = transferRequest;

        const missingPasswordDigitsPositions = await this.getMissingPasswordDigitsPositionsSensitiveOperationAction(sensitiveOperationAction);
        const keypadImageBuffer = await this.getKeypadImageBufferSensitiveOperationAction(missingPasswordDigitsPositions.keyPadUrl);

        const passwordKeypad = new PasswordKeypad(keypadImageBuffer, 5);

        const clickPositions = await passwordKeypad.getClicksPositions(missingPasswordDigitsPositions.pinPositions, this.password);
        const validatePin = await this.validatePinSensitiveOperationAction(clickPositions, sensitiveOperationAction, transferRequest);

        const oneTimePasswordChannels = await this.getSensitiveOperationOneTimePasswordChannels(sensitiveOperationAction);
        const otpSmsChannel = oneTimePasswordChannels.find(channel => channel.type === "SMS_MOBILE");

        return this.sendOneTimePassword(sensitiveOperationAction, validatePin.secretCode, otpSmsChannel.phone, otpSmsChannel.type);

    }

    /**
     * Returns the available accounts for a transfer destination given an ING account
     * @param {string} accountId
     * @return {Promise<Object>}
     */
    async getCreditAccounts(accountId) {
        return await this.callIngSecureApi(`transfers/debitAccounts/${accountId}/creditAccounts`);
    }

    /**
     * Initiate a new credit transfer
     * @param {string} fromAccount
     * @param {string} toAccount
     * @param {number} amount
     * @param {string} label
     * @param {string} executionDate
     * @return {Promise<{executionSuggestedDate: string}>}
     */
    async validateNewTransfer(fromAccount, toAccount, amount, label, executionDate = '') {
        const body = {fromAccount, toAccount, amount, label, keyPadSize: {width: 3800, height: 1520}};
        if (executionDate) body.executionDate = executionDate;
        return await this.callIngSecureApi(`transfers/v3/new/validate`, 'POST', body);
    }

    /**
     * Create and validate a new beneficiary, a 2FA verification is necessary
     * @param {string} accountHolderName
     * @param {string} iban
     * @return {Promise<{acknowledged: boolean}|{error: {code: string, message: string, values: {}}}>}
     */
    async addNewBeneficiary(accountHolderName, iban) {
        const sensitiveOperationAction = this.SensitiveOperationAction.ADD_TRANSFER_BENEFICIARY;

        const externalAccountRequest = await this.addExternalAccountRequest(accountHolderName, iban);

        if (externalAccountRequest.error) return externalAccountRequest; // TODO : manage the error
        this.validationRequest.externalAccountsRequest = externalAccountRequest;

        const toggleScaStatusResponse = await this.toggleScaStatus(sensitiveOperationAction);
        console.log(toggleScaStatusResponse);

        const missingPasswordDigitsPositions = await this.getMissingPasswordDigitsPositionsSensitiveOperationAction(sensitiveOperationAction);
        const keypadImageBuffer = await this.getKeypadImageBufferSensitiveOperationAction(missingPasswordDigitsPositions.keyPadUrl);

        const passwordKeypad = new PasswordKeypad(keypadImageBuffer, 5);
        const clickPositions = await passwordKeypad.getClicksPositions(missingPasswordDigitsPositions.pinPositions, this.password);

        const validatePin = await this.validatePinSensitiveOperationAction(clickPositions, sensitiveOperationAction, externalAccountRequest);

        const oneTimePasswordChannels = await this.getSensitiveOperationOneTimePasswordChannels(sensitiveOperationAction);
        const otpSmsChannel = oneTimePasswordChannels.find(channel => channel.type === "SMS_MOBILE");

        return this.sendOneTimePassword(sensitiveOperationAction, validatePin.secretCode, otpSmsChannel.phone, otpSmsChannel.type);

    }

    /**
     * Send a request to initiate the external account addition process
     * @param {string} accountHolderName
     * @param {string} iban
     * @return {Promise<{accountHolderName: string, bankName:string, bic: string, iban: string} | {error: {code: string, message:string, values:{}}}>}
     */
    async addExternalAccountRequest(accountHolderName, iban) {
        const body = {accountHolderName, iban};
        return await this.callIngSecureApi(`externalAccounts/add/validateRequest`, 'POST', body);
    }

    /**
     * Toggle the strong customer authentication status to the given sensitive operation action
     * @param {string} sensitiveOperationAction
     * @return {Promise<Object>} TODO : vérifier le retour
     */
    async toggleScaStatus(sensitiveOperationAction) {
        return await this.callIngSecureApi(`toggle/sca/status?action=${sensitiveOperationAction}`);
    }

    /**
     * Delete a given beneficiary
     * @param {string} beneficiaryId
     * TODO : vérifier le retour
     */
    async deleteBeneficiary(beneficiaryId) {
        return await this.callIngSecureApi(`externalAccounts/${beneficiaryId}`, 'DELETE');
    }

    /*
    TODO :
    Endpoints :
        - Change card payment limits
        - Cancel a recurrent transfer
        - Suspend a direct debit authorization
        - Make an international wire transfer
        - 2FA management (maybe an app to scan the SMS) : Partially done with mobile application
        - Error management
     */

    /**
     * Returns the security type to confirm an operation, usually OTP
     * @param {string} accountId
     * @return {Promise<{type: string}>}
     */
    async getSecurityOperationType(accountId) {
        return await this.callIngSecureApi(`/security/operation/type`);
    }

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

class IngApiError {
    /**
     * Create a new IngApiError instance
     * @param {string} code
     * @param {string} message
     * @param {Object} values
     */
    constructor(code, message, values) {
        this.code = code;
        this.message = message;
        this.values = values;
    }
}

module.exports = IngApi;
